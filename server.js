// ============================================================
// APKASPA website server
// - Serves the website files and the admin dashboard (/admin)
// - Stores everything in MongoDB (see db.js): accounts, bookings, newsletter, activity
// - Creates Razorpay orders (amount is calculated here, never trusted from the browser)
// - Verifies Razorpay payment signatures
// - Pushes every new event to open admin dashboards in real time (Server-Sent Events)
//
// Run:   node server.js        (then open http://localhost:5500 and http://localhost:5500/admin)
// Setup: copy .env.example to .env (MongoDB address, admin password, Razorpay keys)
// ============================================================
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');
const store = require('./db');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const ADMIN_DIR = path.join(ROOT, 'Admin');

// ---------- .env loader (no packages needed) ----------
const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}
const PORT = Number(process.env.PORT) || 5500;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apkaspa';
const KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const RAZORPAY_ENABLED = Boolean(KEY_ID && KEY_SECRET);
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const ADMIN_ENABLED = ADMIN_PASSWORD.length >= 10;

const { col, toId } = store;

// ---------- Prices: read the same js/therapists.js the website uses ----------
function loadCatalog() {
  const code = fs.readFileSync(path.join(ROOT, 'js', 'therapists.js'), 'utf8');
  return vm.runInNewContext(code + '\n;({ THERAPISTS, VISIT_CHARGE, OFFERS, discountFor, getTherapist })', {});
}

function quote({ type, id, pay, code }) {
  const cat = loadCatalog(); // re-read each time so price edits apply without a restart
  const t = cat.getTherapist(String(type), Number(id));
  if (!t) throw new Error('Unknown therapist');
  if (pay !== 'online' && pay !== 'cod') throw new Error('Unknown payment method');
  const cleanCode = String(code || '').trim().toUpperCase();
  const discount = cat.discountFor(cleanCode, t.price);
  const treatment = Math.max(t.price - discount, 0);
  const payNow = pay === 'online' ? treatment : cat.VISIT_CHARGE;
  const cashLater = pay === 'online' ? 0 : treatment;
  return { therapist: t, price: t.price, discount, code: discount ? cleanCode : '', treatment, payNow, cashLater, visitCharge: cat.VISIT_CHARGE };
}

// ---------- Razorpay API ----------
async function razorpay(method, endpoint, body) {
  const res = await fetch('https://api.razorpay.com/v1' + endpoint, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Basic ' + Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString('base64'),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.description || `Razorpay error ${res.status}`);
  return json;
}

function signatureValid(orderId, paymentId, signature) {
  const expected = crypto.createHmac('sha256', KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---------- Small helpers ----------
const clip = (v, n = 300) => String(v ?? '').slice(0, n);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MOBILE_RE = /^[6-9]\d{9}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const deviceHashOf = (deviceId) => (/^[a-f0-9-]{20,64}$/.test(String(deviceId || '')) ? sha256(deviceId) : '');
const newBookingId = (prefix) => prefix + Date.now().toString(36).toUpperCase() + crypto.randomBytes(2).toString('hex').toUpperCase();
const clientIp = (req) => String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

function cleanCustomer(c = {}) {
  return {
    name: clip(c.name, 80).trim(), mobile: clip(c.mobile, 15).replace(/\D/g, ''), stay: clip(c.stay, 20),
    date: clip(c.date, 20), time: clip(c.time, 20), address: clip(c.address, 400).trim(),
    flat: clip(c.flat, 60), floor: clip(c.floor, 30), landmark: clip(c.landmark, 150),
    pin: /^-?\d{1,3}\.\d+,-?\d{1,3}\.\d+$/.test(String(c.pin || '')) ? String(c.pin) : '',
  };
}
function customerError(c) {
  if (c.name.length < 2) return 'Please enter your name.';
  if (!MOBILE_RE.test(c.mobile)) return 'Enter a valid 10-digit mobile number.';
  if (c.address.length < 5) return 'Please enter your address.';
  if (!DATE_RE.test(c.date) || !c.time) return 'Please choose a date and time.';
  return '';
}

// ---------- Live updates for the admin dashboard ----------
// Every saved change is logged in "events" and pushed to open dashboards straight away.
const liveClients = new Set();
async function logEvent(type, message, ref = {}) {
  const event = { type, message, ref, at: new Date() };
  try { await col('events').insertOne(event); } catch (e) { console.error('event log failed:', e.message); }
  const line = `data: ${JSON.stringify({ ...event, _id: String(event._id || '') })}\n\n`;
  for (const res of liveClients) res.write(line);
}
setInterval(() => { for (const res of liveClients) res.write(': ping\n\n'); }, 25000).unref();

// ---------- Customer accounts ----------
// Passwords are stored only as scrypt hashes. Logins use a signed, HttpOnly cookie.
const SECRET_FILE = path.join(DATA_DIR, 'session-secret');
const SESSION_DAYS = 30;
const COOKIE = 'apk_session';
const ADMIN_COOKIE = 'apk_admin';
const ADMIN_HOURS = 12;

function sessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(SECRET_FILE)) fs.writeFileSync(SECRET_FILE, crypto.randomBytes(32).toString('hex'));
  return fs.readFileSync(SECRET_FILE, 'utf8').trim();
}
const SESSION_SECRET = sessionSecret();

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `scrypt:${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;
}
function passwordMatches(password, stored) {
  const [, salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const a = crypto.scryptSync(password, salt, 64);
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
// Used when the email doesn't exist, so a wrong email takes as long as a wrong password
const DUMMY_HASH = hashPassword(crypto.randomBytes(8).toString('hex'));

function sign(payload, purpose) {
  return crypto.createHmac('sha256', `${SESSION_SECRET}:${purpose}`).update(payload).digest('base64url');
}
function makeToken(subject, ms, purpose) {
  const payload = `${subject}.${Date.now() + ms}`;
  return `${payload}.${sign(payload, purpose)}`;
}
function readToken(req, cookieName, purpose) {
  const raw = (req.headers.cookie || '').split(/;\s*/).find((c) => c.startsWith(cookieName + '='));
  if (!raw) return null;
  const [subject, exp, sig] = decodeURIComponent(raw.slice(cookieName.length + 1)).split('.');
  if (!subject || !exp || !sig || Number(exp) < Date.now()) return null;
  const good = sign(`${subject}.${exp}`, purpose);
  if (good.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(good), Buffer.from(sig))) return null;
  return subject;
}
function cookie(req, name, value, maxAge, sameSite = 'Lax') {
  const secure = req.headers['x-forwarded-proto'] === 'https' || req.socket.encrypted ? '; Secure' : '';
  return `${name}=${value}; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=${maxAge}${secure}`;
}

async function currentUser(req) {
  const id = readToken(req, COOKIE, 'user');
  if (!id) return null;
  const _id = toId(id);
  return _id ? col('users').findOne({ _id }) : col('users').findOne({ legacyId: id });
}
const userCookie = (req, user) => cookie(req, COOKIE, makeToken(String(user._id), SESSION_DAYS * 864e5, 'user'), SESSION_DAYS * 86400);
const publicUser = (u) => ({ name: u.name, email: u.email, mobile: u.mobile });

const isAdmin = (req) => ADMIN_ENABLED && readToken(req, ADMIN_COOKIE, 'admin') === 'admin';

// Slow down password guessing: max 5 failed logins per account+IP every 15 minutes
const failedLogins = new Map();
function tooManyAttempts(key) {
  const now = Date.now();
  const list = (failedLogins.get(key) || []).filter((t) => now - t < 15 * 60e3);
  failedLogins.set(key, list);
  return list.length >= 5;
}
function recordFailure(key) { failedLogins.set(key, [...(failedLogins.get(key) || []), Date.now()]); }
function sameSecret(a, b) { return crypto.timingSafeEqual(Buffer.from(sha256(a)), Buffer.from(sha256(b))); }

// ---------- HTTP helpers ----------
function sendJSON(res, status, data, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(data));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > 20000) { reject(new Error('Body too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString() || '{}')); } catch (e) { reject(new Error('Invalid JSON')); } });
    req.on('error', reject);
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.woff2': 'font/woff2', '.md': 'text/plain; charset=utf-8',
};
// Files the website may serve; everything else (server.js, db.js, .env, data/, node_modules/) stays private
const PUBLIC = /^\/(index\.html|book-now\.html|therapist\.html|offers\.html|login\.html|signup\.html|bookings\.html|css\/.+|js\/.+|assets\/.+)$/;
const ADMIN_FILES = { '/admin': 'index.html', '/admin/': 'index.html', '/admin/admin.css': 'admin.css', '/admin/admin.js': 'admin.js' };

function serveFile(req, res, file, extraHeaders = {}) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('Not found'); }
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const range = req.headers.range;
    if (range && type.startsWith('video/')) { // lets videos seek/stream
      const [s, e] = range.replace('bytes=', '').split('-');
      const start = Number(s) || 0;
      const end = e ? Number(e) : st.size - 1;
      res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 });
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, ...extraHeaders });
    fs.createReadStream(file).pipe(res);
  });
}
function serveStatic(req, res) {
  let urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (ADMIN_FILES[urlPath]) {
    // Admin pages: never cached, never framed by other sites
    return serveFile(req, res, path.join(ADMIN_DIR, ADMIN_FILES[urlPath]),
      { 'Cache-Control': 'no-store', 'X-Frame-Options': 'DENY', 'X-Robots-Tag': 'noindex' });
  }
  if (urlPath === '/') urlPath = '/index.html';
  const file = path.normalize(path.join(ROOT, urlPath));
  if (!file.startsWith(ROOT + path.sep) || !PUBLIC.test(urlPath) || urlPath.includes('..')) {
    res.writeHead(404); return res.end('Not found');
  }
  serveFile(req, res, file);
}

// ---------- Shaping data for the browser ----------
const iso = (d) => (d instanceof Date ? d.toISOString() : d);
function bookingForCustomer(b) {
  return {
    bookingId: b.bookingId, createdAt: iso(b.createdAt), status: b.status, source: b.source,
    therapist: { name: b.therapist?.name, speciality: b.therapist?.speciality },
    payment: {
      method: b.payment?.method, paidOnline: b.payment?.paidOnline || 0, cashOnService: b.payment?.cashOnService || 0,
      total: b.payment?.total, referral: b.payment?.referral, paymentId: b.payment?.paymentId,
    },
    customer: {
      stay: b.customer?.stay, date: b.customer?.date, time: b.customer?.time,
      address: [b.customer?.flat, b.customer?.address].filter(Boolean).join(', '),
    },
  };
}
function bookingForAdmin(b) {
  const { deviceHash, ...rest } = b; // never needed by the admin
  return { ...rest, _id: String(b._id), createdAt: iso(b.createdAt), paidAt: iso(b.paidAt), updatedAt: iso(b.updatedAt) };
}

// Today's date in India, as YYYY-MM-DD, and midnight IST as a Date
function istToday() {
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  return { ymd, start: new Date(`${ymd}T00:00:00+05:30`) };
}

const ADMIN_STATUSES = ['requested', 'paid', 'confirmed', 'completed', 'cancelled'];
const STATUS_LABEL = { requested: 'Requested', pending_payment: 'Awaiting payment', paid: 'Paid', confirmed: 'Confirmed', completed: 'Completed', cancelled: 'Cancelled' };

// ---------- Routes ----------
async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  const { pathname } = url;

  if (pathname === '/api/config' && req.method === 'GET') {
    return sendJSON(res, 200, { razorpay: RAZORPAY_ENABLED, keyId: RAZORPAY_ENABLED ? KEY_ID : null });
  }

  // ===== Customer accounts =====
  if (pathname === '/api/signup' && req.method === 'POST') {
    const body = await readBody(req);
    const name = clip(body.name, 80).trim();
    const email = clip(body.email, 120).trim().toLowerCase();
    const mobile = clip(body.mobile, 10).replace(/\D/g, '');
    const password = String(body.password || '');
    if (name.length < 2) return sendJSON(res, 400, { error: 'Please enter your full name.', field: 'name' });
    if (!EMAIL_RE.test(email)) return sendJSON(res, 400, { error: 'Please enter a valid email address.', field: 'email' });
    if (mobile && !MOBILE_RE.test(mobile)) return sendJSON(res, 400, { error: 'Enter a valid 10-digit mobile number.', field: 'mobile' });
    if (password.length < 8 || password.length > 128) return sendJSON(res, 400, { error: 'Password must be at least 8 characters.', field: 'password' });
    const user = { name, email, mobile, password: hashPassword(password), createdAt: new Date(), lastLoginAt: new Date() };
    try {
      const r = await col('users').insertOne(user);
      user._id = r.insertedId;
    } catch (e) {
      if (e.code === 11000) return sendJSON(res, 409, { error: 'An account with this email already exists. Please log in.', field: 'email' });
      throw e;
    }
    await logEvent('signup', `New customer account: ${name}`, { email });
    return sendJSON(res, 201, { ok: true, user: publicUser(user) }, { 'Set-Cookie': userCookie(req, user) });
  }

  if (pathname === '/api/login' && req.method === 'POST') {
    const body = await readBody(req);
    const email = clip(body.email, 120).trim().toLowerCase();
    const password = String(body.password || '').slice(0, 128);
    const key = `${email}|${clientIp(req)}`;
    if (tooManyAttempts(key)) return sendJSON(res, 429, { error: 'Too many attempts. Please wait 15 minutes and try again.' });
    const user = await col('users').findOne({ email });
    const ok = passwordMatches(password, user ? user.password : DUMMY_HASH) && !!user;
    if (!ok) { recordFailure(key); return sendJSON(res, 401, { error: 'Incorrect email or password.' }); }
    failedLogins.delete(key);
    await col('users').updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });
    return sendJSON(res, 200, { ok: true, user: publicUser(user) }, { 'Set-Cookie': userCookie(req, user) });
  }

  if (pathname === '/api/logout' && req.method === 'POST') {
    return sendJSON(res, 200, { ok: true }, { 'Set-Cookie': cookie(req, COOKIE, '', 0) });
  }

  if (pathname === '/api/me' && req.method === 'GET') {
    const user = await currentUser(req);
    return sendJSON(res, 200, { user: user ? publicUser(user) : null });
  }

  // ===== Newsletter =====
  if (pathname === '/api/subscribe' && req.method === 'POST') {
    const email = clip((await readBody(req)).email, 120).trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return sendJSON(res, 400, { error: 'Please enter a valid email address.' });
    const r = await col('subscribers').updateOne({ email }, { $setOnInsert: { email, createdAt: new Date() } }, { upsert: true });
    if (r.upsertedCount) await logEvent('subscribe', `Newsletter sign-up: ${email}`, { email });
    return sendJSON(res, 200, { ok: true, already: !r.upsertedCount });
  }

  // ===== Bookings =====
  // WhatsApp booking request (no online payment) – saved so the admin sees it immediately
  if (pathname === '/api/booking-request' && req.method === 'POST') {
    const body = await readBody(req);
    const q = quote(body);
    const customer = cleanCustomer(body.customer);
    const problem = customerError(customer);
    if (problem) return sendJSON(res, 400, { error: problem });
    const user = await currentUser(req);
    const booking = {
      bookingId: newBookingId('REQ'), source: 'whatsapp', status: 'requested', createdAt: new Date(),
      deviceHash: deviceHashOf(body.deviceId), userId: user ? String(user._id) : '',
      therapist: { type: clip(body.type, 20), id: Number(body.id), name: q.therapist.name, speciality: q.therapist.speciality },
      payment: {
        method: body.pay, price: q.price, discount: q.discount, referral: q.code, paidOnline: 0,
        total: q.treatment + (body.pay === 'cod' ? q.visitCharge : 0), cashOnService: q.cashLater,
        visitCharge: body.pay === 'cod' ? q.visitCharge : 0,
      },
      customer,
    };
    await col('bookings').insertOne(booking);
    await logEvent('booking_request', `New WhatsApp booking request from ${customer.name} for ${q.therapist.name}`, { bookingId: booking.bookingId });
    return sendJSON(res, 201, { ok: true, bookingId: booking.bookingId });
  }

  // My Bookings: bookings made on this device or by this account
  if (pathname === '/api/my-bookings' && req.method === 'POST') {
    const { deviceId } = await readBody(req);
    const deviceHash = deviceHashOf(deviceId);
    const user = await currentUser(req);
    const or = [];
    if (deviceHash) or.push({ deviceHash });
    if (user) or.push({ userId: String(user._id) });
    if (!or.length) return sendJSON(res, 200, { bookings: [] });
    const list = await col('bookings')
      .find({ $or: or, status: { $ne: 'pending_payment' } })
      .sort({ createdAt: -1 }).limit(100).toArray();
    return sendJSON(res, 200, { bookings: list.map(bookingForCustomer) });
  }

  if (pathname === '/api/create-order' && req.method === 'POST') {
    if (!RAZORPAY_ENABLED) return sendJSON(res, 503, { error: 'Online payment is not set up yet.' });
    const body = await readBody(req);
    const q = quote(body);
    const customer = cleanCustomer(body.customer);
    const problem = customerError(customer);
    if (problem) return sendJSON(res, 400, { error: problem });
    const bookingId = newBookingId('APK');
    let order;
    try {
      order = await razorpay('POST', '/orders', {
        amount: q.payNow * 100, // paise
        currency: 'INR',
        receipt: bookingId,
        notes: {
          therapist: q.therapist.name, payment: body.pay, customer: customer.name,
          mobile: customer.mobile, slot: `${customer.date} ${customer.time}`,
        },
      });
    } catch (e) {
      // Razorpay unreachable or keys wrong: tell the page so it can offer WhatsApp instead
      console.error('Razorpay order failed:', e.message);
      return sendJSON(res, 502, { error: 'Online payment is not available right now.', code: 'payment_unavailable' });
    }
    const user = await currentUser(req);
    await col('bookings').insertOne({
      bookingId, source: 'online', status: 'pending_payment', createdAt: new Date(),
      deviceHash: deviceHashOf(body.deviceId), userId: user ? String(user._id) : '',
      therapist: { type: clip(body.type, 20), id: Number(body.id), name: q.therapist.name, speciality: q.therapist.speciality },
      payment: {
        method: body.pay, price: q.price, discount: q.discount, referral: q.code, paidOnline: q.payNow,
        cashOnService: q.cashLater, total: q.payNow + q.cashLater, orderId: order.id,
        visitCharge: body.pay === 'cod' ? q.visitCharge : 0,
      },
      customer,
    });
    await logEvent('payment_started', `${customer.name} opened payment for ₹${q.payNow} (${q.therapist.name})`, { bookingId });
    return sendJSON(res, 200, { orderId: order.id, amount: order.amount, currency: order.currency, keyId: KEY_ID, bookingId });
  }

  if (pathname === '/api/verify-payment' && req.method === 'POST') {
    if (!RAZORPAY_ENABLED) return sendJSON(res, 503, { error: 'Online payment is not set up yet.' });
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: sig } = await readBody(req);
    if (!signatureValid(orderId, paymentId, sig)) return sendJSON(res, 400, { error: 'Payment could not be verified.' });
    const paid = { status: 'paid', paidAt: new Date(), 'payment.paymentId': String(paymentId) };
    let booking = await col('bookings').findOneAndUpdate(
      { 'payment.orderId': String(orderId) }, { $set: paid }, { returnDocument: 'after' });
    if (!booking) {
      // Order isn't in the database (e.g. made before this version): rebuild it from Razorpay
      const order = await razorpay('GET', `/orders/${encodeURIComponent(orderId)}`).catch(() => ({}));
      booking = {
        bookingId: order.receipt || newBookingId('APK'), source: 'online', status: 'paid', createdAt: new Date(), paidAt: new Date(),
        therapist: { name: order.notes?.therapist },
        payment: { method: order.notes?.payment, paidOnline: order.amount ? order.amount / 100 : 0, orderId: String(orderId), paymentId: String(paymentId) },
        customer: { name: order.notes?.customer, mobile: order.notes?.mobile, slot: order.notes?.slot },
        note: 'Recovered from Razorpay order – check the Razorpay dashboard for full details',
      };
      await col('bookings').insertOne(booking);
    }
    await logEvent('payment_success', `Payment received: ₹${booking.payment?.paidOnline ?? '?'} from ${booking.customer?.name || 'customer'} (${booking.bookingId})`, { bookingId: booking.bookingId });
    console.log(`✔ Paid booking ${booking.bookingId} – ${booking.customer?.name || ''} – ₹${booking.payment?.paidOnline ?? '?'}`);
    return sendJSON(res, 200, { ok: true, bookingId: booking.bookingId });
  }

  // ===== Admin =====
  if (pathname === '/api/admin/login' && req.method === 'POST') {
    if (!ADMIN_ENABLED) return sendJSON(res, 503, { error: 'Admin login is turned off. Set ADMIN_PASSWORD (10+ characters) in the .env file and restart the server.' });
    const body = await readBody(req);
    const key = `admin|${clientIp(req)}`;
    if (tooManyAttempts(key)) return sendJSON(res, 429, { error: 'Too many attempts. Please wait 15 minutes and try again.' });
    const ok = sameSecret(clip(body.username, 100), ADMIN_USERNAME) & sameSecret(String(body.password || '').slice(0, 200), ADMIN_PASSWORD);
    if (!ok) { recordFailure(key); return sendJSON(res, 401, { error: 'Incorrect username or password.' }); }
    failedLogins.delete(key);
    return sendJSON(res, 200, { ok: true },
      { 'Set-Cookie': cookie(req, ADMIN_COOKIE, makeToken('admin', ADMIN_HOURS * 3600e3, 'admin'), ADMIN_HOURS * 3600, 'Strict') });
  }
  if (pathname === '/api/admin/logout' && req.method === 'POST') {
    return sendJSON(res, 200, { ok: true }, { 'Set-Cookie': cookie(req, ADMIN_COOKIE, '', 0, 'Strict') });
  }
  if (pathname === '/api/admin/me' && req.method === 'GET') {
    return sendJSON(res, 200, { admin: isAdmin(req), enabled: ADMIN_ENABLED, username: isAdmin(req) ? ADMIN_USERNAME : null });
  }

  if (pathname.startsWith('/api/admin/')) {
    if (!isAdmin(req)) return sendJSON(res, 401, { error: 'Please log in as admin.' });

    // Real-time stream (Server-Sent Events)
    if (pathname === '/api/admin/stream' && req.method === 'GET') {
      if (liveClients.size >= 25) return sendJSON(res, 429, { error: 'Too many dashboards open.' });
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
      res.write('retry: 3000\n\n');
      liveClients.add(res);
      req.on('close', () => liveClients.delete(res));
      return;
    }

    if (pathname === '/api/admin/summary' && req.method === 'GET') {
      const { ymd, start } = istToday();
      const real = { status: { $ne: 'pending_payment' } };
      const [total, today, upcoming, requests, revenue, customers, subscribers, byStatus] = await Promise.all([
        col('bookings').countDocuments(real),
        col('bookings').countDocuments({ ...real, createdAt: { $gte: start } }),
        col('bookings').countDocuments({ 'customer.date': { $gte: ymd }, status: { $in: ['requested', 'paid', 'confirmed'] } }),
        col('bookings').countDocuments({ status: 'requested' }),
        col('bookings').aggregate([
          { $match: { 'payment.paymentId': { $exists: true }, status: { $in: ['paid', 'confirmed', 'completed'] } } },
          { $group: { _id: null, sum: { $sum: '$payment.paidOnline' } } },
        ]).toArray(),
        col('users').countDocuments(),
        col('subscribers').countDocuments(),
        col('bookings').aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]).toArray(),
      ]);
      return sendJSON(res, 200, {
        total, today, upcoming, requests, revenue: revenue[0]?.sum || 0, customers, subscribers,
        byStatus: Object.fromEntries(byStatus.map((s) => [s._id, s.n])),
      });
    }

    if (pathname === '/api/admin/bookings' && req.method === 'GET') {
      const status = url.searchParams.get('status') || '';
      const q = clip(url.searchParams.get('q'), 60).trim();
      const filter = {};
      if (status === 'active') filter.status = { $in: ['requested', 'paid', 'confirmed'] };
      else if (status) filter.status = status;
      else filter.status = { $ne: 'pending_payment' };
      if (q) {
        const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        filter.$or = [{ bookingId: rx }, { 'customer.name': rx }, { 'customer.mobile': rx }, { 'therapist.name': rx }, { 'customer.address': rx }];
      }
      const list = await col('bookings').find(filter).sort({ createdAt: -1 }).limit(300).toArray();
      return sendJSON(res, 200, { bookings: list.map(bookingForAdmin) });
    }

    const statusMatch = pathname.match(/^\/api\/admin\/bookings\/([A-Za-z0-9]{6,40})$/);
    if (statusMatch && req.method === 'PATCH') {
      const body = await readBody(req);
      const status = String(body.status || '');
      if (!ADMIN_STATUSES.includes(status)) return sendJSON(res, 400, { error: 'Unknown status.' });
      const b = await col('bookings').findOneAndUpdate(
        { bookingId: statusMatch[1] },
        { $set: { status, updatedAt: new Date(), ...(typeof body.note === 'string' ? { adminNote: clip(body.note, 500) } : {}) } },
        { returnDocument: 'after' });
      if (!b) return sendJSON(res, 404, { error: 'Booking not found.' });
      await logEvent('status_change', `Booking ${b.bookingId} (${b.customer?.name || ''}) marked ${STATUS_LABEL[status]}`, { bookingId: b.bookingId, status });
      return sendJSON(res, 200, { ok: true, booking: bookingForAdmin(b) });
    }

    // Numbers for the Analytics tab (last 7 / 30 / 90 days, Indian time)
    if (pathname === '/api/admin/analytics' && req.method === 'GET') {
      const days = [7, 30, 90].includes(Number(url.searchParams.get('days'))) ? Number(url.searchParams.get('days')) : 30;
      const { start: todayStart } = istToday();
      const from = new Date(todayStart.getTime() - (days - 1) * 864e5);
      const list = await col('bookings')
        .find({ createdAt: { $gte: from }, status: { $ne: 'pending_payment' } },
          { projection: { status: 1, source: 1, createdAt: 1, therapist: 1, payment: 1, 'customer.time': 1, 'customer.mobile': 1 } })
        .toArray();

      const istDay = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
      const daily = [];
      for (let i = 0; i < days; i++) daily.push({ date: istDay(new Date(from.getTime() + i * 864e5 + 6 * 3600e3)), bookings: 0, revenue: 0 });
      const dayIndex = Object.fromEntries(daily.map((d, i) => [d.date, i]));
      const hours = Array.from({ length: 12 }, (_, i) => ({ hour: 10 + i, bookings: 0 })); // 10 AM – 9 PM slots
      const tally = (obj, key) => { obj[key] = (obj[key] || 0) + 1; };
      const therapists = {}, statuses = {}, channels = {}, offers = {}, phones = {};
      let valueSum = 0, valueN = 0, discountSum = 0;

      for (const b of list) {
        const p = b.payment || {};
        const paidOnline = p.paymentId ? Number(p.paidOnline) || 0 : 0;
        const i = dayIndex[istDay(b.createdAt)];
        if (i !== undefined) { daily[i].bookings++; daily[i].revenue += paidOnline; }
        const m = String(b.customer?.time || '').match(/(\d+):\d+\s*(AM|PM)/i);
        if (m) { const h = (Number(m[1]) % 12) + (m[2].toUpperCase() === 'PM' ? 12 : 0); const slot = hours.find((x) => x.hour === h); if (slot) slot.bookings++; }
        if (b.therapist?.name) tally(therapists, b.therapist.name);
        tally(statuses, b.status);
        tally(channels, b.source === 'whatsapp' ? 'WhatsApp request' : p.method === 'cod' ? 'Cash on delivery' : 'Paid online');
        if (p.referral) { tally(offers, p.referral); discountSum += Number(p.discount) || 0; }
        if (b.customer?.mobile) tally(phones, b.customer.mobile);
        const value = Number(p.total ?? (Number(p.paidOnline || 0) + Number(p.cashOnService || 0))) || 0;
        if (value > 0 && b.status !== 'cancelled') { valueSum += value; valueN++; }
      }

      const top = (obj, n) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(([label, value]) => ({ label, value }));
      const STATUS_ORDER = ['requested', 'paid', 'confirmed', 'completed', 'cancelled'];
      const customers = Object.values(phones);
      return sendJSON(res, 200, {
        days,
        total: list.length,
        daily, hours,
        therapists: top(therapists, 8),
        statuses: STATUS_ORDER.map((s) => ({ label: STATUS_LABEL[s], value: statuses[s] || 0 })),
        channels: ['WhatsApp request', 'Paid online', 'Cash on delivery'].map((c) => ({ label: c, value: channels[c] || 0 })),
        offers: top(offers, 8),
        tiles: {
          avgValue: valueN ? Math.round(valueSum / valueN) : 0,
          cancelRate: list.length ? Math.round(((statuses.cancelled || 0) / list.length) * 100) : 0,
          repeatCustomers: customers.filter((n) => n >= 2).length,
          uniqueCustomers: customers.length,
          offerShare: list.length ? Math.round((Object.values(offers).reduce((a, b) => a + b, 0) / list.length) * 100) : 0,
          discountSum,
          revenue: daily.reduce((a, d) => a + d.revenue, 0),
        },
      });
    }

    if (pathname === '/api/admin/customers' && req.method === 'GET') {
      const users = await col('users').find({}, { projection: { password: 0 } }).sort({ createdAt: -1 }).limit(500).toArray();
      const counts = await col('bookings').aggregate([
        { $match: { userId: { $ne: '' }, status: { $ne: 'pending_payment' } } },
        { $group: { _id: '$userId', n: { $sum: 1 } } },
      ]).toArray();
      const byUser = Object.fromEntries(counts.map((c) => [c._id, c.n]));
      return sendJSON(res, 200, {
        customers: users.map((u) => ({
          _id: String(u._id), name: u.name, email: u.email, mobile: u.mobile,
          createdAt: iso(u.createdAt), lastLoginAt: iso(u.lastLoginAt), bookings: byUser[String(u._id)] || 0,
        })),
      });
    }

    if (pathname === '/api/admin/subscribers' && req.method === 'GET') {
      const subs = await col('subscribers').find().sort({ createdAt: -1 }).limit(1000).toArray();
      return sendJSON(res, 200, { subscribers: subs.map((s) => ({ email: s.email, createdAt: iso(s.createdAt) })) });
    }

    if (pathname === '/api/admin/events' && req.method === 'GET') {
      const events = await col('events').find().sort({ at: -1 }).limit(60).toArray();
      return sendJSON(res, 200, { events: events.map((e) => ({ ...e, _id: String(e._id), at: iso(e.at) })) });
    }

    return sendJSON(res, 404, { error: 'Not found' });
  }

  if (pathname.startsWith('/api/')) return sendJSON(res, 404, { error: 'Not found' });
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
  serveStatic(req, res);
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((err) => {
    console.error(err.message);
    if (!res.headersSent) sendJSON(res, 400, { error: err.message || 'Something went wrong.' });
    else res.end();
  });
});

// ---------- Start: connect to MongoDB first, then accept requests ----------
(async () => {
  try {
    const db = await store.connect(MONGODB_URI);
    console.log(`MongoDB: connected (database "${db.databaseName}")`);
    const imported = await store.importJsonFiles(DATA_DIR);
    if (imported.length) console.log(`MongoDB: imported ${imported.join(' and ')} from the old data/ JSON files`);
  } catch (e) {
    console.error(`\n✖ Could not connect to MongoDB at ${MONGODB_URI.replace(/\/\/[^@/]*@/, '//***@')}\n  ${e.message}`);
    console.error('  Start MongoDB (Windows: the "MongoDB" service) or set MONGODB_URI in .env, then run node server.js again.\n');
    process.exit(1);
  }
  server.listen(PORT, () => {
    console.log(`APKASPA running at http://localhost:${PORT}`);
    console.log(ADMIN_ENABLED
      ? `Admin dashboard: http://localhost:${PORT}/admin  (username "${ADMIN_USERNAME}")`
      : 'Admin dashboard: OFF – set ADMIN_PASSWORD (10+ characters) in .env to turn it on');
    console.log(RAZORPAY_ENABLED
      ? `Razorpay: ON (${KEY_ID.startsWith('rzp_test_') ? 'TEST mode' : 'LIVE mode'})`
      : 'Razorpay: OFF – add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env (bookings fall back to WhatsApp)');
  });
})();
