// APKASPA admin dashboard
// All data comes from server.js (/api/admin/*). New events arrive live over /api/admin/stream.
// Everything shown here was typed by customers, so it is always escaped before being put on the page.

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rupee = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
const when = (d) => d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '–';
const day = (ymd) => ymd ? new Date(ymd + 'T00:00:00+05:30').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }) : '–';
function ago(d) {
  const s = Math.round((Date.now() - new Date(d)) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return when(d);
}

async function api(path, opts = {}) {
  const res = await fetch(path, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, ...opts });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !path.endsWith('/login')) { showLogin(); throw new Error('Session ended – please sign in again.'); }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function toast(msg, isError = false) {
  const t = document.createElement('div');
  t.className = 'toast' + (isError ? ' err' : '');
  t.textContent = msg;
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), 4500);
}

// ============ Login ============
function showLogin(message) {
  stopLive();
  $('#appView').hidden = true;
  $('#loginView').hidden = false;
  if (message) { $('#loginAlert').textContent = message; $('#loginAlert').hidden = false; }
  $('#username').focus();
}

$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#loginBtn');
  btn.disabled = true; btn.textContent = 'Signing in…';
  $('#loginAlert').hidden = true;
  try {
    await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ username: $('#username').value.trim(), password: $('#password').value }) });
    $('#password').value = '';
    startApp();
  } catch (err) {
    $('#loginAlert').textContent = err.message; $('#loginAlert').hidden = false;
  } finally {
    btn.disabled = false; btn.textContent = 'Sign in';
  }
});

async function logout() {
  try { await api('/api/admin/logout', { method: 'POST' }); } catch (e) {}
  showLogin();
}
$('#logoutBtn').addEventListener('click', logout);
$('#logoutBtnMobile').addEventListener('click', logout);

// ============ Tabs ============
const TABS = {
  bookings: ['Bookings', 'Every booking, updated in real time.'],
  customers: ['Customers', 'People who created an account on the website.'],
  subscribers: ['Subscribers', 'Newsletter sign-ups from the website footer.'],
  activity: ['Activity', 'Everything happening on the website, as it happens.'],
  analytics: ['Analytics', 'How the business is doing – updates live as bookings come in.'],
};
let tab = 'bookings';
$('#sideNav').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tab]');
  if (!b) return;
  tab = b.dataset.tab;
  document.querySelectorAll('#sideNav [data-tab]').forEach((x) => x.classList.toggle('on', x === b));
  document.querySelectorAll('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== tab; });
  $('#pageTitle').textContent = TABS[tab][0];
  $('#pageSub').textContent = TABS[tab][1];
  document.querySelector('.feed-side').style.display = ['activity', 'analytics'].includes(tab) ? 'none' : '';
  document.querySelector('.layout').classList.toggle('no-feed', ['activity', 'analytics'].includes(tab));
  loadTab();
});

// ============ Summary ============
let lastRequests = null;
async function loadSummary() {
  const s = await api('/api/admin/summary');
  const set = (id, v) => {
    const el = $(id); const txt = String(v);
    if (el.textContent !== txt && el.textContent !== '–') { el.parentElement.classList.add('bump'); setTimeout(() => el.parentElement.classList.remove('bump'), 400); }
    el.textContent = txt;
  };
  set('#sToday', s.today); set('#sRequests', s.requests); set('#sUpcoming', s.upcoming); set('#sRevenue', rupee(s.revenue));
  set('#sTotal', s.total); set('#sCustomers', s.customers); set('#sSubscribers', s.subscribers);
  $('#navRequests').hidden = !s.requests;
  $('#navRequests').textContent = s.requests;
  lastRequests = s.requests;
}

// ============ Bookings ============
let statusFilter = 'active';
let search = '';
const knownBookings = new Set();
const STATUS_OPTIONS = [['requested', 'Requested'], ['paid', 'Paid'], ['confirmed', 'Confirmed'], ['completed', 'Completed'], ['cancelled', 'Cancelled']];

$('#statusFilters').addEventListener('click', (e) => {
  const c = e.target.closest('[data-status]');
  if (!c) return;
  statusFilter = c.dataset.status;
  document.querySelectorAll('#statusFilters .chip').forEach((x) => x.classList.toggle('on', x === c));
  loadBookings();
});
let searchTimer;
$('#bookingSearch').addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { search = e.target.value.trim(); loadBookings(); }, 250);
});

function bookingRow(b, isNew) {
  const c = b.customer || {}; const p = b.payment || {}; const t = b.therapist || {};
  const mobile = String(c.mobile || '').replace(/\D/g, '');
  const pin = /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(c.pin || '') ? c.pin : '';
  const payment = p.method === 'cod'
    ? `<b>Cash on delivery</b><small>${p.paymentId ? `Visit fee ${rupee(p.paidOnline)} paid` : `Visit fee ${rupee(p.visitCharge || p.paidOnline)}`} · ${rupee(p.cashOnService)} cash</small>`
    : `<b>${p.paymentId ? `Paid ${rupee(p.paidOnline)}` : `${rupee(p.total ?? p.paidOnline)} online`}</b><small>${p.paymentId ? esc(p.paymentId) : 'not paid yet'}</small>`;
  const options = STATUS_OPTIONS.map(([v, l]) => `<option value="${v}"${v === b.status ? ' selected' : ''}>${l}</option>`).join('');
  return `<tr data-id="${esc(b.bookingId)}"${isNew ? ' class="flash"' : ''}>
    <td data-label="Booking"><b class="mono">${esc(b.bookingId)}</b><small>${esc(when(b.createdAt))}</small>
      <span class="src ${b.source === 'whatsapp' ? 'whatsapp' : ''}">${b.source === 'whatsapp' ? 'WhatsApp' : 'Online'}</span></td>
    <td data-label="Customer"><b>${esc(c.name || '–')}</b><small>${esc(c.mobile ? '+91 ' + c.mobile : '')}</small>
      ${mobile ? `<span class="contact-links"><a href="tel:+91${mobile}">Call</a><a href="https://wa.me/91${mobile}" target="_blank" rel="noopener">WhatsApp</a></span>` : ''}</td>
    <td data-label="Therapist & slot"><b>${esc(t.name || '–')}</b><small>${esc(t.speciality || '')}</small>
      <small>${esc(day(c.date))}, ${esc(c.time || '')} · ${esc(c.stay || '')}</small></td>
    <td data-label="Address" class="addr">${esc([c.flat, c.floor, c.address].filter(Boolean).join(', ') || c.slot || '–')}
      ${c.landmark ? `<small>Near ${esc(c.landmark)}</small>` : ''}
      ${pin ? `<small><a href="https://maps.google.com/?q=${encodeURIComponent(pin)}" target="_blank" rel="noopener">Open map pin ↗</a></small>` : ''}</td>
    <td data-label="Payment">${payment}${p.referral ? `<small>Code ${esc(p.referral)} (−${rupee(p.discount)})</small>` : ''}</td>
    <td data-label="Status"><select class="status-select ${esc(b.status)}" data-booking="${esc(b.bookingId)}" aria-label="Status for ${esc(b.bookingId)}">${options}</select></td>
  </tr>`;
}

async function loadBookings() {
  const params = new URLSearchParams({ status: statusFilter, q: search });
  const { bookings } = await api('/api/admin/bookings?' + params);
  const firstLoad = knownBookings.size === 0;
  $('#bookingRows').innerHTML = bookings.map((b) => {
    const isNew = !firstLoad && !knownBookings.has(b.bookingId);
    knownBookings.add(b.bookingId);
    return bookingRow(b, isNew);
  }).join('');
  $('#bookingEmpty').hidden = bookings.length > 0;
}

$('#bookingRows').addEventListener('change', async (e) => {
  const sel = e.target.closest('.status-select');
  if (!sel) return;
  const prev = [...sel.classList].find((c) => c !== 'status-select');
  sel.disabled = true;
  try {
    await api(`/api/admin/bookings/${encodeURIComponent(sel.dataset.booking)}`, { method: 'PATCH', body: JSON.stringify({ status: sel.value }) });
    sel.className = `status-select ${sel.value}`;
    toast(`${sel.dataset.booking} → ${sel.options[sel.selectedIndex].text}`);
  } catch (err) {
    sel.value = prev; toast(err.message, true);
  } finally {
    sel.disabled = false;
  }
});

// ============ Customers / subscribers ============
async function loadCustomers() {
  const { customers } = await api('/api/admin/customers');
  $('#customerRows').innerHTML = customers.map((u) => `<tr>
    <td data-label="Name"><b>${esc(u.name)}</b></td>
    <td data-label="Email"><a href="mailto:${esc(u.email)}">${esc(u.email)}</a></td>
    <td data-label="Mobile">${u.mobile ? `<a href="tel:+91${esc(u.mobile)}">+91 ${esc(u.mobile)}</a>` : '–'}</td>
    <td data-label="Joined">${esc(when(u.createdAt))}</td>
    <td data-label="Last login">${esc(when(u.lastLoginAt))}</td>
    <td data-label="Bookings"><b>${u.bookings}</b></td></tr>`).join('');
  $('#customerEmpty').hidden = customers.length > 0;
}

let subscriberEmails = [];
async function loadSubscribers() {
  const { subscribers } = await api('/api/admin/subscribers');
  subscriberEmails = subscribers.map((s) => s.email);
  $('#subscriberRows').innerHTML = subscribers.map((s) => `<tr>
    <td data-label="Email"><a href="mailto:${esc(s.email)}">${esc(s.email)}</a></td>
    <td data-label="Subscribed">${esc(when(s.createdAt))}</td></tr>`).join('');
  $('#subscriberEmpty').hidden = subscribers.length > 0;
  $('#subCount').textContent = `${subscribers.length} subscriber${subscribers.length === 1 ? '' : 's'}`;
}
$('#copyEmails').addEventListener('click', async () => {
  if (!subscriberEmails.length) return toast('No emails to copy yet.');
  try { await navigator.clipboard.writeText(subscriberEmails.join(', ')); toast(`Copied ${subscriberEmails.length} emails`); }
  catch (e) { prompt('Copy these emails:', subscriberEmails.join(', ')); }
});

// ============ Activity feed ============
const ICON = { booking_request: '📝', payment_started: '💳', payment_success: '✅', signup: '👤', subscribe: '✉️', status_change: '🔄' };
let events = [];
function renderFeed(highlightId) {
  const html = events.length
    ? events.map((e) => `<li${e._id === highlightId ? ' class="new"' : ''}><span class="dot">${ICON[e.type] || '•'}</span>
        <div><p>${esc(e.message)}</p><time datetime="${esc(e.at)}">${esc(ago(e.at))}</time></div></li>`).join('')
    : '<li class="feed-empty">Nothing yet – activity appears here the moment it happens.</li>';
  $('#feed').innerHTML = html;
  $('#feedFull').innerHTML = html;
}
async function loadEvents() {
  events = (await api('/api/admin/events')).events;
  renderFeed();
}
setInterval(() => renderFeed(), 30000); // keep "x min ago" fresh

async function loadTab() {
  try {
    if (tab === 'bookings') await loadBookings();
    if (tab === 'customers') await loadCustomers();
    if (tab === 'subscribers') await loadSubscribers();
    if (tab === 'activity') await loadEvents();
    if (tab === 'analytics') await loadAnalytics();
  } catch (err) { toast(err.message, true); }
}

// ============ Real time ============
let source = null;
let unseen = 0;
const baseTitle = document.title;
function setLive(state, text) {
  const el = $('#liveState');
  el.className = 'live ' + state;
  el.querySelector('b').textContent = text;
}

let refreshTimer;
function refreshSoon() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => { loadSummary().catch(() => {}); loadTab(); }, 300);
}

function startLive() {
  stopLive();
  source = new EventSource('/api/admin/stream');
  source.onopen = () => setLive('on', 'Live');
  source.onmessage = (msg) => {
    let e; try { e = JSON.parse(msg.data); } catch (err) { return; }
    events = [e, ...events].slice(0, 60);
    renderFeed(e._id);
    if (e.type !== 'status_change') toast(e.message);
    if (['booking_request', 'payment_success'].includes(e.type)) ding();
    if (document.hidden) { unseen++; document.title = `(${unseen}) ${baseTitle}`; }
    refreshSoon();
  };
  source.onerror = async () => {
    setLive('off', 'Reconnecting…');
    // If the admin session expired, go back to the login screen
    try { const me = await fetch('/api/admin/me', { credentials: 'same-origin' }).then((r) => r.json()); if (!me.admin) showLogin('Your session ended. Please sign in again.'); } catch (err) {}
  };
}
function stopLive() { if (source) { source.close(); source = null; } }
document.addEventListener('visibilitychange', () => { if (!document.hidden) { unseen = 0; document.title = baseTitle; } });

// Optional sound for new bookings / payments
let soundOn = false;
try { soundOn = localStorage.getItem('apkaspa:admin-sound') === '1'; } catch (e) {}
function paintSound() {
  $('#soundBtn').textContent = soundOn ? '🔔 Sound on' : '🔕 Sound off';
  $('#soundBtn').setAttribute('aria-pressed', String(soundOn));
}
$('#soundBtn').addEventListener('click', () => {
  soundOn = !soundOn;
  try { localStorage.setItem('apkaspa:admin-sound', soundOn ? '1' : '0'); } catch (e) {}
  paintSound();
  if (soundOn) ding();
});
let audioCtx;
function ding() {
  if (!soundOn) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
    o.frequency.value = 880; o.type = 'sine';
    g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, audioCtx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.5);
    o.connect(g).connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + 0.5);
  } catch (e) {}
}

// ============ Start ============
async function startApp() {
  $('#loginView').hidden = true;
  $('#appView').hidden = false;
  paintSound();
  try {
    await Promise.all([loadSummary(), loadEvents(), loadTab()]);
  } catch (err) { toast(err.message, true); }
  startLive();
}

(async () => {
  try {
    const me = await fetch('/api/admin/me', { credentials: 'same-origin' }).then((r) => r.json());
    if (!me.enabled) return showLogin('Admin login is turned off. Set ADMIN_PASSWORD (10+ characters) in the .env file and restart the server.');
    if (me.admin) startApp(); else showLogin();
  } catch (e) {
    showLogin('Could not reach the server. Make sure "node server.js" is running.');
  }
})();

// ============ Analytics (hand-built SVG charts) ============
// One series per chart → one validated color (--chart), no legend; the title names the data.
// Every chart has hover + keyboard tooltips and a "Table" view with the exact numbers.
let anDays = 30;
let anData = null;
const compact = (n) => n >= 1e5 ? (n / 1e5).toFixed(n % 1e5 ? 1 : 0) + 'L' : n >= 1000 ? (n / 1000).toFixed(n % 1000 ? 1 : 0) + 'K' : String(n);
const money = (n) => '₹' + compact(n);
const shortDate = (ymd) => new Date(ymd + 'T00:00:00+05:30').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
const longDate = (ymd) => new Date(ymd + 'T00:00:00+05:30').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
const hourLabel = (h) => `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`;

function niceScale(max, maxTicks = 4) {
  if (max <= 0) return { top: maxTicks, step: 1 };
  const raw = max / maxTicks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max(1, [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw));
  return { top: Math.ceil(max / step) * step, step };
}

// Column with a 4px rounded data-end, square at the baseline
function colPath(x, y, w, h) {
  if (h <= 0) return '';
  const r = Math.min(4, h, w / 2);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}
// Horizontal bar, rounded at the value end, square at the baseline
function barPath(x, y, w, h) {
  if (w <= 0) return '';
  const r = Math.min(4, w, h / 2);
  return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`;
}

// Vertical columns over an ordered axis (days, hours)
function columnChart(el, rows, { fmt = String, tipFmt = fmt, xLabel = (r) => r.label, unit = '' } = {}) {
  const W = Math.max(280, el.clientWidth);
  const H = 204, padL = 44, padR = 8, padT = 22, padB = 30;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const max = Math.max(0, ...rows.map((r) => r.value));
  const { top, step } = niceScale(max);
  const band = plotW / rows.length;
  const bw = Math.max(2, Math.min(24, band - 2)); // 2px surface gap between neighbours
  const y = (v) => padT + plotH - (v / top) * plotH;
  const labelEvery = Math.max(1, Math.ceil(rows.length / Math.max(1, Math.floor(plotW / 54))));
  const maxIdx = max > 0 ? rows.findIndex((r) => r.value === max) : -1;
  // When labels are spaced out, skip the very first bar so its label never meets the "0" axis label
  const labelOffset = labelEvery > 1 ? Math.floor(labelEvery / 2) : 0;

  let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(el.dataset.title)}"><g class="grid">`;
  for (let v = 0; v <= top; v += step) {
    s += `<line x1="${padL}" x2="${W - padR}" y1="${y(v)}" y2="${y(v)}"/><text x="${padL - 8}" y="${y(v) + 4}" text-anchor="end">${esc(fmt(v))}</text>`;
  }
  s += `</g><line class="base" x1="${padL}" x2="${W - padR}" y1="${y(0)}" y2="${y(0)}"/>`;
  rows.forEach((r, i) => {
    const cx = padL + band * i + band / 2;
    const h = (r.value / top) * plotH;
    s += `<g><rect class="hit" x="${padL + band * i}" y="${padT}" width="${band}" height="${plotH}" tabindex="0" data-t="${esc(r.tipTitle || r.label)}" data-v="${esc((unit ? unit + ': ' : '') + tipFmt(r.value))}"/>`;
    s += `<path class="bar" d="${colPath(cx - bw / 2, y(r.value), bw, h)}"/></g>`;
    if (i === maxIdx) s += `<text class="val" x="${cx}" y="${y(r.value) - 6}" text-anchor="middle">${esc(fmt(r.value))}</text>`;
    if (i % labelEvery === labelOffset) s += `<text x="${cx}" y="${H - 6}" text-anchor="middle">${esc(xLabel(r))}</text>`;
  });
  el.innerHTML = s + '</svg>';
}

// Horizontal bars for named categories (value at the tip)
function barChart(el, rows, { fmt = String, unit = '' } = {}) {
  if (!rows.length || rows.every((r) => !r.value)) { el.innerHTML = '<p class="an-empty">No data in this period yet.</p>'; return; }
  const W = Math.max(280, el.clientWidth);
  const rowH = 34, bh = 16, padT = 4;
  const labelW = Math.min(150, Math.max(124, Math.round(W * 0.42)));
  const valW = 44;
  const plotW = W - labelW - valW;
  const max = Math.max(...rows.map((r) => r.value), 1);
  const H = padT + rows.length * rowH;
  let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(el.dataset.title)}">`;
  s += `<line class="base" x1="${labelW}" x2="${labelW}" y1="0" y2="${H}"/>`;
  rows.forEach((r, i) => {
    const yTop = padT + i * rowH;
    const w = (r.value / max) * plotW;
    const fit = Math.max(4, Math.floor((labelW - 14) / 7)); // ~7px per character at 12px
    const name = r.label.length > fit ? r.label.slice(0, fit - 1) + '…' : r.label;
    s += `<text class="cat" x="${labelW - 10}" y="${yTop + rowH / 2 + 4}" text-anchor="end">${esc(name)}</text>`;
    s += `<g><rect class="hit" x="0" y="${yTop}" width="${W}" height="${rowH}" tabindex="0" data-t="${esc(r.label)}" data-v="${esc((unit ? unit + ': ' : '') + fmt(r.value))}"/>`;
    s += `<path class="bar" d="${barPath(labelW, yTop + (rowH - bh) / 2, w, bh)}"/></g>`;
    s += `<text class="val" x="${labelW + w + 6}" y="${yTop + rowH / 2 + 4}">${esc(fmt(r.value))}</text>`;
  });
  el.innerHTML = s + '</svg>';
}

function tableHtml(rows, colA, colB, fmt = String) {
  return `<div class="an-table-wrap"><table class="an-table"><thead><tr><th>${esc(colA)}</th><th>${esc(colB)}</th></tr></thead><tbody>${
    rows.map((r) => `<tr><td>${esc(r.tipTitle || r.label)}</td><td>${esc(fmt(r.value))}</td></tr>`).join('')}</tbody></table></div>`;
}

// Chart definitions – built from the /api/admin/analytics response
function chartDefs(d) {
  const range = `last ${d.days} days`;
  const day = (x) => ({ label: x.date, tipTitle: longDate(x.date) });
  return [
    { id: 'perDay', wide: true, kind: 'col', title: 'Bookings per day', sub: `${d.total} bookings in the ${range}`, colA: 'Date', col: 'Bookings',
      rows: d.daily.map((x) => ({ ...day(x), value: x.bookings })), xLabel: (r) => shortDate(r.label) },
    { id: 'revenue', wide: true, kind: 'col', title: 'Money paid online per day', sub: `${rupee(d.tiles.revenue)} received online in the ${range} (cash collected at the door isn't included)`, colA: 'Date', col: 'Paid online',
      rows: d.daily.map((x) => ({ ...day(x), value: x.revenue })), fmt: money, tableFmt: rupee, xLabel: (r) => shortDate(r.label) },
    { id: 'hours', kind: 'col', title: 'Busiest time slots', sub: 'Which session times customers pick', colA: 'Time', col: 'Bookings',
      rows: d.hours.map((h) => ({ label: hourLabel(h.hour), value: h.bookings })) },
    { id: 'therapists', kind: 'bar', title: 'Most booked therapists', sub: 'Top 8 in this period', colA: 'Therapist', col: 'Bookings', rows: d.therapists },
    { id: 'channels', kind: 'bar', title: 'How customers book', sub: 'WhatsApp request, pay online, or cash on delivery', colA: 'Method', col: 'Bookings', rows: d.channels },
    { id: 'statuses', kind: 'bar', title: 'Booking status', sub: 'Where this period’s bookings stand now', colA: 'Status', col: 'Bookings', rows: d.statuses },
    { id: 'offers', kind: 'bar', title: 'Offer codes used', sub: d.tiles.discountSum ? `${rupee(d.tiles.discountSum)} given as discounts` : 'Codes applied at checkout', colA: 'Code', col: 'Times used', rows: d.offers },
  ];
}

const tableMode = new Set();
function renderAnalytics() {
  if (!anData) return;
  const d = anData;
  const t = d.tiles;
  $('#anTiles').innerHTML = [
    ['Average booking value', rupee(t.avgValue), 'per booking, excluding cancelled'],
    ['Paid online', rupee(t.revenue), `in the last ${d.days} days`],
    ['Repeat customers', `${t.repeatCustomers}`, `of ${t.uniqueCustomers} customers booked 2+ times`],
    ['Cancellation rate', `${t.cancelRate}%`, 'of bookings in this period'],
    ['Bookings with an offer', `${t.offerShare}%`, t.discountSum ? `${rupee(t.discountSum)} in discounts` : 'no discounts given'],
  ].map(([l, v, s]) => `<div class="an-tile"><small>${esc(l)}</small><b>${esc(v)}</b><span>${esc(s)}</span></div>`).join('');

  const defs = chartDefs(d);
  const grid = $('#anGrid');
  if (grid.children.length !== defs.length) {
    grid.innerHTML = defs.map((c) => `<article class="an-card${c.wide ? ' wide' : ''}" data-chart="${c.id}">
      <div class="an-head"><div><h3>${esc(c.title)}</h3><p class="an-sub"></p></div>
      <button class="an-toggle" data-toggle="${c.id}" aria-pressed="false">Table</button></div>
      <div class="an-chart" data-title="${esc(c.title)}"></div></article>`).join('');
  }
  defs.forEach((c) => {
    const card = grid.querySelector(`[data-chart="${c.id}"]`);
    card.classList.remove('loading');
    card.querySelector('.an-sub').textContent = c.sub;
    const el = card.querySelector('.an-chart');
    const fmt = c.fmt || String;
    if (tableMode.has(c.id)) { el.innerHTML = tableHtml(c.rows, c.colA, c.col, c.tableFmt || fmt); return; }
    if (c.kind === 'col') columnChart(el, c.rows, { fmt, tipFmt: c.tableFmt || fmt, xLabel: c.xLabel || ((r) => r.label), unit: c.col });
    else barChart(el, c.rows, { fmt, unit: c.col });
  });
}

async function loadAnalytics() {
  $('#anGrid').querySelectorAll('.an-card').forEach((c) => c.classList.add('loading')); // keep the old render, dimmed
  anData = await api('/api/admin/analytics?days=' + anDays);
  renderAnalytics();
}

document.querySelector('.an-filter').addEventListener('click', (e) => {
  const b = e.target.closest('[data-days]');
  if (!b) return;
  anDays = Number(b.dataset.days);
  document.querySelectorAll('.an-filter [data-days]').forEach((x) => x.classList.toggle('on', x === b));
  loadAnalytics().catch((err) => toast(err.message, true));
});
$('#anGrid').addEventListener('click', (e) => {
  const b = e.target.closest('[data-toggle]');
  if (!b) return;
  const id = b.dataset.toggle;
  if (tableMode.has(id)) tableMode.delete(id); else tableMode.add(id);
  b.textContent = tableMode.has(id) ? 'Chart' : 'Table';
  b.setAttribute('aria-pressed', String(tableMode.has(id)));
  renderAnalytics();
});

// Tooltip for any bar (mouse or keyboard focus)
const tip = document.createElement('div');
tip.className = 'an-tip'; tip.hidden = true; tip.setAttribute('role', 'tooltip');
tip.innerHTML = '<b></b><span></span>';
document.body.appendChild(tip);
function showTip(hit) {
  const r = hit.getBoundingClientRect();
  const bar = hit.nextElementSibling ? hit.nextElementSibling.getBoundingClientRect() : r;
  tip.querySelector('b').textContent = hit.dataset.t;
  tip.querySelector('span').textContent = hit.dataset.v;
  tip.hidden = false;
  tip.style.left = Math.min(Math.max(r.left + r.width / 2, 90), innerWidth - 90) + 'px';
  tip.style.top = Math.max(bar.height ? bar.top : r.top, r.top) + 'px';
}
['mouseover', 'focusin'].forEach((ev) => $('#anGrid').addEventListener(ev, (e) => { const h = e.target.closest('.hit'); if (h) showTip(h); }));
['mouseout', 'focusout'].forEach((ev) => $('#anGrid').addEventListener(ev, (e) => { if (e.target.closest('.hit')) tip.hidden = true; }));

let anResize;
window.addEventListener('resize', () => { clearTimeout(anResize); anResize = setTimeout(() => { if (tab === 'analytics') renderAnalytics(); }, 150); });
