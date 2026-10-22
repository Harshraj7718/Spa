// ============================================================
// Therapist details + checkout page
// Settings you may want to change:
// ============================================================
const OPEN_HOUR = 10;   // first slot 10 AM
const CLOSE_HOUR = 21;  // last slot 9 PM (service ends 10 PM)
const MAP_CENTER = [22.7196, 75.8577]; // Indore
// Referral codes and the visiting charge live in js/therapists.js

// ---------- Load therapist from URL (?type=basic&id=0) ----------
const params = new URLSearchParams(location.search);
const type = params.get('type') || 'basic';
const t = getTherapist(type, Number(params.get('id') || 0)) || getTherapist('basic', 0);

document.title = `Book ${t.name} – APKASPA`;
document.getElementById('backBtn').href = `book-now.html#${type}`;
document.getElementById('pName').textContent = t.name;
document.getElementById('pRole').textContent = `${t.speciality} Therapist`;
document.getElementById('pRating').textContent = t.rating;
document.getElementById('pReviews').textContent = `(${t.reviews} reviews)`;
document.getElementById('pExp').textContent = t.experience;
document.getElementById('pSpec').textContent = t.specializes;
document.getElementById('pLang').textContent = t.languages;
document.getElementById('pAboutTitle').textContent = `About ${t.name}`;
document.getElementById('pAbout').textContent = t.about;

const pImg = document.getElementById('pImg');
pImg.alt = t.name;
pImg.addEventListener('error', () => {
  const box = document.getElementById('pPhoto');
  box.classList.add('missing');
  box.setAttribute('data-ph', 'therapists/' + t.photo);
});
pImg.src = PHOTO_DIR + t.photo;

// Read more
const about = document.getElementById('pAbout');
const readMore = document.getElementById('readMore');
requestAnimationFrame(() => { if (about.scrollHeight <= about.clientHeight + 2) readMore.hidden = true; });
readMore.addEventListener('click', () => {
  const open = about.classList.toggle('clamp');
  readMore.textContent = open ? 'Read more' : 'Show less';
});

// Optional notice banner – hidden unless assets/images/notice-banner.jpg exists
const banner = document.getElementById('noticeBanner');
banner.addEventListener('error', () => banner.remove());
if (banner.complete && banner.naturalWidth === 0) banner.remove();

// ---------- Favourite + share ----------
const favBtn = document.getElementById('favBtn');
const favKey = `fav:${type}:${t.name}`;
try { if (localStorage.getItem(favKey)) favBtn.classList.add('on'); } catch (e) {}
favBtn.addEventListener('click', () => {
  const on = favBtn.classList.toggle('on');
  try { on ? localStorage.setItem(favKey, '1') : localStorage.removeItem(favKey); } catch (e) {}
});
document.getElementById('shareBtn').addEventListener('click', async () => {
  const data = { title: `Book ${t.name} – APKASPA`, url: location.href };
  if (navigator.share) { try { await navigator.share(data); } catch (e) {} }
  else {
    try { await navigator.clipboard.writeText(location.href); alert('Link copied!'); }
    catch (e) { prompt('Copy this link to share:', location.href); } // clipboard blocked → show the link
  }
});

// ---------- State ----------
const state = { stay: 'Home Stay', date: '', time: '', pay: '', discount: 0, code: '', latlng: null };

// ---------- 1. Stay type ----------
document.querySelectorAll('[data-stay]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-stay]').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    state.stay = btn.dataset.stay;
    const hotel = state.stay === 'Hotel Stay';
    document.getElementById('addressLabel').textContent = hotel ? 'Hotel Name & Address' : 'Full Address';
    document.getElementById('address').placeholder = hotel ? 'Hotel name, area...' : 'Apartment, street...';
    document.getElementById('flatLabel').textContent = hotel ? 'Room No. (Optional)' : 'Flat/House No. (Optional)';
  });
});

// ---------- Date + time slots ----------
const dateInput = document.getElementById('date');
const slotsEl = document.getElementById('slots');
const pad = (n) => String(n).padStart(2, '0');
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtHour = (h) => `${h % 12 || 12}:00 ${h < 12 ? 'AM' : 'PM'}`;

const today = new Date();
dateInput.min = toISO(today);
const maxDate = new Date(); maxDate.setDate(maxDate.getDate() + 30);
dateInput.max = toISO(maxDate);
// If no slots left today, start from tomorrow
if (today.getHours() + 1 > CLOSE_HOUR) today.setDate(today.getDate() + 1);
dateInput.value = toISO(today);

function renderSlots() {
  state.date = dateInput.value;
  state.time = '';
  slotsEl.innerHTML = '';
  const now = new Date();
  const isToday = state.date === toISO(now);
  let available = 0;
  for (let h = OPEN_HOUR; h <= CLOSE_HOUR; h++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'slot';
    b.textContent = fmtHour(h);
    // Need at least 1 hour notice for today
    if (isToday && h <= now.getHours() + 1) b.disabled = true; else available++;
    b.addEventListener('click', () => {
      slotsEl.querySelectorAll('.slot').forEach((s) => s.classList.remove('on'));
      b.classList.add('on');
      state.time = b.textContent;
      document.getElementById('timeError').classList.remove('show');
      updateBar();
    });
    slotsEl.appendChild(b);
  }
  if (!available) slotsEl.innerHTML = '<p class="slots-empty">No slots left for this day. Please pick another date.</p>';
  updateBar();
}
dateInput.addEventListener('change', renderSlots);

// ---------- 2. Map ----------
let map, marker;
const mapHint = document.getElementById('mapHint');
function setPin(latlng, zoom) {
  state.latlng = latlng;
  if (!map) return;
  if (marker) marker.setLatLng(latlng); else marker = L.marker(latlng).addTo(map);
  map.setView(latlng, zoom || map.getZoom());
  mapHint.textContent = `Pin dropped at ${latlng[0].toFixed(5)}, ${latlng[1].toFixed(5)}`;
  mapHint.className = 'hint ok';
}
if (window.L) {
  map = L.map('map', { scrollWheelZoom: false }).setView(MAP_CENTER, 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map);
  map.on('click', (e) => setPin([e.latlng.lat, e.latlng.lng]));
} else {
  document.getElementById('map').remove();
  mapHint.textContent = 'Map could not load. Your address is enough.';
}

// Use Location
const locBtn = document.getElementById('useLocation');
locBtn.addEventListener('click', () => {
  if (!navigator.geolocation) return alert('Location is not supported on this device.');
  locBtn.classList.add('loading');
  locBtn.querySelector('span').textContent = 'Locating...';
  navigator.geolocation.getCurrentPosition(async (pos) => {
    const ll = [pos.coords.latitude, pos.coords.longitude];
    setPin(ll, 17);
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${ll[0]}&lon=${ll[1]}`);
      const j = await r.json();
      const addr = document.getElementById('address');
      if (j.display_name) { addr.value = j.display_name; addr.classList.remove('err'); document.getElementById('addressError').classList.remove('show'); }
    } catch (e) {}
    locBtn.classList.remove('loading');
    locBtn.querySelector('span').textContent = 'Use Location';
  }, () => {
    locBtn.classList.remove('loading');
    locBtn.querySelector('span').textContent = 'Use Location';
    alert('Could not get your location. Please allow location access or type your address.');
  }, { enableHighAccuracy: true, timeout: 10000 });
});

// Mobile: digits only
const mobile = document.getElementById('mobile');
mobile.addEventListener('input', () => { mobile.value = mobile.value.replace(/\D/g, '').slice(0, 10); });

// Referral code
const refInput = document.getElementById('referral');
const applyBtn = document.getElementById('applyCode');
const codeMsg = document.getElementById('codeMsg');
refInput.addEventListener('input', () => applyBtn.classList.toggle('ready', refInput.value.trim().length > 0));
applyBtn.addEventListener('click', () => {
  const code = refInput.value.trim().toUpperCase();
  if (!code) return;
  const off = discountFor(code, t.price);
  if (off > 0) {
    state.discount = off;
    state.code = code;
    codeMsg.textContent = `Code applied – ₹${state.discount} off!`;
    codeMsg.className = 'hint ok';
  } else {
    state.discount = 0;
    state.code = '';
    codeMsg.textContent = 'This code is not valid.';
    codeMsg.className = 'hint bad';
  }
  renderBill();
});

// ---------- 3. Payment + 4. Bill ----------
const rupee = (n) => '₹' + n.toLocaleString('en-IN');
const treatment = () => Math.max(t.price - state.discount, 0);

document.querySelectorAll('input[name="pay"]').forEach((r) => {
  r.addEventListener('change', () => { state.pay = r.value; renderBill(); });
});
document.getElementById('codDesc').textContent =
  `Pay a ${rupee(VISIT_CHARGE)} visiting charge online now to confirm; pay the treatment amount in cash when the therapist arrives.`;

function renderBill() {
  const bill = document.getElementById('bill');
  const note = document.getElementById('secureNote');
  const disc = state.discount ? `<div class="bill-row discount"><span>Offer (${state.code})</span><b>−${rupee(state.discount)}</b></div>` : '';
  if (state.pay === 'online') {
    bill.innerHTML = `
      <div class="bill-row"><span>Treatment Amount</span><b>${rupee(t.price)}</b></div>${disc}
      <div class="bill-row total"><span>Total Payable</span><b>${rupee(treatment())}</b></div>`;
    note.querySelector('span').textContent = 'Payments are processed securely via Razorpay.';
  } else if (state.pay === 'cod') {
    const total = treatment() + VISIT_CHARGE;
    bill.innerHTML = `
      <div class="bill-row"><span>Treatment Amount (Cash on Delivery)</span><b>${rupee(t.price)}</b></div>${disc}
      <div class="bill-row"><span>Visiting / Travel Charge (Pay Online Now)</span><b>${rupee(VISIT_CHARGE)}</b></div>
      <div class="bill-row total"><span>Total Payable</span><b>${rupee(total)}</b></div>
      <p class="bill-note">Pay the ${rupee(VISIT_CHARGE)} visiting charge online now to confirm your booking. The remaining ${rupee(treatment())} treatment amount is paid in cash to the therapist at the time of service.</p>
      <div class="pay-now"><span><small>PAY NOW</small><b>${rupee(VISIT_CHARGE)}</b></span><span>${rupee(treatment())} + ${rupee(VISIT_CHARGE)} = ${rupee(total)} total</span></div>`;
    note.querySelector('span').textContent = `The ${rupee(VISIT_CHARGE)} visiting charge is processed securely via Razorpay; the therapist collects the treatment amount in person.`;
  } else {
    bill.innerHTML = '<p class="hint">Choose a payment method above to see your bill.</p>';
  }
  note.classList.toggle('show', !!state.pay);
  updateBar();
}

// ---------- Sticky bar ----------
const cbLeft = document.getElementById('cbLeft');
const payBtn = document.getElementById('payBtn');
function updateBar() {
  const when = state.time ? `${state.time} · ${new Date(state.date + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : 'Select a time';
  if (state.pay === 'online') {
    cbLeft.innerHTML = `<b>${rupee(treatment())}</b><small>${when}</small>`;
    payBtn.innerHTML = 'Pay Online <span>→</span>';
  } else if (state.pay === 'cod') {
    cbLeft.innerHTML = `<b>${rupee(VISIT_CHARGE)}</b><small>Pay ${rupee(VISIT_CHARGE)} now · ${rupee(treatment())} after service</small>`;
    payBtn.innerHTML = 'Pay Visiting Charge <span>→</span>';
  } else {
    cbLeft.innerHTML = '<span class="hint">Select a payment method</span>';
    payBtn.innerHTML = 'Continue <span>→</span>';
  }
}

// ---------- Validate + confirm ----------
function fail(el, errId) {
  if (el) el.classList.add('err');
  if (errId) document.getElementById(errId).classList.add('show');
  return false;
}
Object.entries({ address: 'addressError', mobile: 'mobileError', fullName: 'nameError' }).forEach(([id, errId]) => {
  document.getElementById(id).addEventListener('input', (e) => {
    e.target.classList.remove('err');
    document.getElementById(errId).classList.remove('show');
  });
});

function validate() {
  let ok = true, first = null;
  const mark = (el) => { if (!first) first = el; ok = false; };
  if (!state.time) { fail(null, 'timeError'); mark(slotsEl); }
  const address = document.getElementById('address');
  if (address.value.trim().length < 5) { fail(address, 'addressError'); mark(address); }
  if (!/^[6-9]\d{9}$/.test(mobile.value)) { fail(mobile, 'mobileError'); mark(mobile); }
  const name = document.getElementById('fullName');
  if (name.value.trim().length < 2) { fail(name, 'nameError'); mark(name); }
  if (!state.pay && ok) { mark(document.querySelector('.pay-opt')); }
  if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
  return ok && !!state.pay;
}

// ---------- Razorpay ----------
// Turned on when the site runs through server.js with Razorpay keys in .env.
// Otherwise the booking falls back to the WhatsApp confirmation sheet.
let razorpayKey = null;
fetch('/api/config').then((r) => r.ok ? r.json() : null).then((cfg) => {
  if (cfg && cfg.razorpay) razorpayKey = cfg.keyId;
}).catch(() => {});

function bookingDetails() {
  const v = (id) => document.getElementById(id).value.trim();
  return {
    type, id: Number(params.get('id') || 0), pay: state.pay, code: state.code, deviceId: getDeviceId(),
    customer: {
      name: v('fullName'), mobile: v('mobile'), stay: state.stay, date: state.date, time: state.time,
      address: v('address'), flat: v('flat'), floor: document.getElementById('floor').value, landmark: v('landmark'),
      pin: state.latlng ? `${state.latlng[0].toFixed(6)},${state.latlng[1].toFixed(6)}` : '',
    },
  };
}

function setPaying(on) {
  payBtn.disabled = on;
  payBtn.classList.toggle('loading', on);
  if (on) payBtn.innerHTML = 'Please wait…';
  else updateBar();
}

async function startPayment() {
  if (!window.Razorpay) { openSheet(); paymentFallbackNote(); return; } // payment script blocked or offline
  setPaying(true);
  const details = bookingDetails();
  try {
    const res = await fetch('/api/create-order', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(details),
    });
    const order = await res.json();
    if (!res.ok) {
      const err = new Error(order.error || 'Could not start payment.');
      err.unavailable = order.code === 'payment_unavailable' || res.status >= 500;
      throw err;
    }

    const rzp = new Razorpay({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount,
      currency: order.currency,
      name: 'APKASPA',
      description: state.pay === 'online' ? `${t.name} – ${t.speciality}` : `Visiting charge – ${t.name}`,
      prefill: { name: details.customer.name, contact: '+91' + details.customer.mobile },
      notes: { booking_id: order.bookingId },
      theme: { color: '#6e8240' },
      handler: (resp) => verifyPayment(resp),
      modal: { ondismiss: () => setPaying(false) },
    });
    rzp.on('payment.failed', (resp) => {
      setPaying(false);
      alert('Payment failed: ' + (resp.error?.description || 'please try again.'));
    });
    rzp.open();
  } catch (err) {
    setPaying(false);
    // Payment system down (or no internet to Razorpay): don't leave the customer stuck – offer WhatsApp
    if (err.unavailable || err.message === 'Failed to fetch') { openSheet(); paymentFallbackNote(); return; }
    alert(err.message);
  }
}

function paymentFallbackNote() {
  document.getElementById('sheetTitle').textContent = 'Confirm on WhatsApp';
  document.getElementById('sheetNote').textContent = "Online payment isn't available right now. Send your booking on WhatsApp and we'll confirm it and share a payment link.";
}

async function verifyPayment(resp) {
  try {
    const res = await fetch('/api/verify-payment', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(resp),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    showSuccess(data.bookingId, resp.razorpay_payment_id);
  } catch (err) {
    alert(`We received your payment (ID ${resp.razorpay_payment_id}) but could not confirm it automatically. Please share this ID with us on WhatsApp.`);
  } finally {
    setPaying(false);
  }
}

function showSuccess(bookingId, paymentId) {
  openSheet();
  document.getElementById('sheetTitle').textContent = 'Booking confirmed 🎉';
  document.getElementById('sheetBody').insertAdjacentHTML('afterbegin',
    `<div class="success-box"><b>Booking ID: ${escapeHtml(bookingId)}</b><small>Payment ID: ${escapeHtml(paymentId)}</small></div>`);
  const wa = document.getElementById('waConfirm');
  wa.innerHTML = 'Share on WhatsApp <span>→</span>';
  wa.href = wa.href.replace(encodeURIComponent('New booking request'), encodeURIComponent(`Paid booking ${bookingId} (payment ${paymentId})`));
  document.getElementById('sheetNote').innerHTML = 'Payment received. Our therapist will reach you at the chosen time. <a href="bookings.html">View my bookings</a>';
  sheetMode = 'paid';
}

payBtn.addEventListener('click', () => {
  if (!validate()) return;
  if (razorpayKey) startPayment();
  else openSheet();
});

const sheet = document.getElementById('sheet');
let sheetMode = 'request'; // 'request' = WhatsApp request, 'paid' = after Razorpay
let requestSaved = false;

// Save a WhatsApp request to the database (admin sees it live); fall back to this device if offline
document.getElementById('waConfirm').addEventListener('click', () => {
  if (sheetMode !== 'request' || requestSaved) return;
  requestSaved = true;
  const d = bookingDetails();
  fetch('/api/booking-request', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
    body: JSON.stringify(d), keepalive: true,
  }).then((r) => { if (!r.ok) throw new Error(); }).catch(() => saveLocalCopy(d));
});

function saveLocalCopy(d) {
  saveLocalBooking({
    bookingId: 'REQ-' + Date.now().toString(36).toUpperCase(),
    createdAt: new Date().toISOString(),
    status: 'requested',
    therapist: { name: t.name, speciality: t.speciality },
    payment: {
      method: state.pay,
      paidOnline: 0,
      total: state.pay === 'online' ? treatment() : treatment() + VISIT_CHARGE,
      cashOnService: state.pay === 'cod' ? treatment() : 0,
      referral: state.code,
    },
    customer: { stay: d.customer.stay, date: d.customer.date, time: d.customer.time, address: [d.customer.flat, d.customer.address].filter(Boolean).join(', ') },
  });
}

function openSheet() {
  sheetMode = 'request';
  const v = (id) => document.getElementById(id).value.trim();
  const rows = [
    ['Therapist', `${t.name} (${t.speciality})`],
    ['Service', state.stay],
    ['Date & Time', `${new Date(state.date + 'T00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}, ${state.time}`],
    ['Name', v('fullName')],
    ['Mobile', '+91 ' + v('mobile')],
    ['Address', [v('flat'), document.getElementById('floor').value, v('address')].filter(Boolean).join(', ')],
  ];
  if (v('landmark')) rows.push(['Landmark', v('landmark')]);
  if (state.latlng) rows.push(['Map pin', `https://maps.google.com/?q=${state.latlng[0].toFixed(6)},${state.latlng[1].toFixed(6)}`]);
  if (state.code) rows.push(['Offer code', `${state.code} (−${rupee(state.discount)})`]);
  if (state.pay === 'online') {
    rows.push(['Payment', 'Pay Online'], ['Total', rupee(treatment())]);
  } else {
    rows.push(['Payment', 'Cash on Delivery'], ['Pay now (visiting)', rupee(VISIT_CHARGE)], ['Cash after service', rupee(treatment())]);
  }

  document.getElementById('sheetTitle').textContent = 'Confirm your booking';
  document.getElementById('waConfirm').innerHTML = 'Confirm on WhatsApp <span>→</span>';
  document.getElementById('sheetNote').textContent = 'Our team will reply with the payment link and confirm your therapist.';
  document.getElementById('sheetBody').innerHTML = rows
    .map(([k, val]) => `<div class="sum-row"><span>${k}</span><span>${escapeHtml(val)}</span></div>`).join('');
  const msg = 'New booking request – APKASPA\n\n' + rows.map(([k, val]) => `${k}: ${val}`).join('\n');
  document.getElementById('waConfirm').href = `https://wa.me/${BUSINESS_WHATSAPP}?text=${encodeURIComponent(msg)}`;
  sheet.hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeSheet() { sheet.hidden = true; document.body.style.overflow = ''; }
document.getElementById('sheetClose').addEventListener('click', closeSheet);
sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !sheet.hidden) closeSheet(); });

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

renderSlots();
renderBill();

// Auto-apply an offer picked on the Offers page
try {
  const saved = localStorage.getItem('apkaspa:offer');
  if (saved && discountFor(saved, t.price) > 0) {
    refInput.value = saved;
    applyBtn.classList.add('ready');
    applyBtn.click();
  }
} catch (e) {}
