// My Bookings page
// Shows paid bookings from the server (made on this device, or by the logged-in account)
// plus WhatsApp booking requests saved on this device.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rupee = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

const ic = {
  clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
  pin: '<svg viewBox="0 0 24 24"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
  card: '<svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>',
};

// "4:00 PM" + "2026-10-20" → Date (for sorting into upcoming / past)
function slotDate(b) {
  const d = b.customer?.date;
  if (!d) return new Date(b.createdAt || 0);
  const m = String(b.customer?.time || '').match(/(\d+):(\d+)\s*(AM|PM)/i);
  let h = m ? Number(m[1]) % 12 + (m[3].toUpperCase() === 'PM' ? 12 : 0) : 0;
  return new Date(`${d}T${String(h).padStart(2, '0')}:${m ? m[2] : '00'}:00`);
}

function card(b, past, i) {
  const when = slotDate(b);
  // Status set by the admin (or by payment), shown to the customer
  const STATUS = {
    requested: ['requested', 'Requested'],
    paid: ['paid', 'Confirmed'],
    confirmed: ['paid', 'Confirmed'],
    completed: ['done', 'Completed'],
    cancelled: ['cancelled', 'Cancelled'],
  };
  const status = past && ['paid', 'confirmed'].includes(b.status) ? STATUS.completed : STATUS[b.status] || STATUS.requested;
  const p = b.payment || {};
  let payLine;
  const paidOnline = Boolean(p.paymentId) || b.status === 'paid';
  if (b.status === 'cancelled' && !paidOnline) {
    payLine = 'No payment due';
  } else if (!paidOnline && b.status !== 'requested') {
    payLine = `Total <b>${rupee(p.total)}</b> · pay as agreed on WhatsApp`;
  } else if (!paidOnline) {
    payLine = p.method === 'cod'
      ? `${rupee(VISIT_CHARGE)} visiting charge + <b>${rupee(p.cashOnService)}</b> cash · awaiting confirmation`
      : `Total <b>${rupee(p.total)}</b> · awaiting payment link`;
  } else {
    payLine = p.method === 'cod'
      ? `Paid ${rupee(p.paidOnline)} online · <b>${rupee(p.cashOnService)}</b> in cash at service`
      : `Paid <b>${rupee(p.paidOnline)}</b> online`;
  }
  const help = encodeURIComponent(`Hi, I need help with my booking ${b.bookingId}`);
  return `
    <article class="bk-card" style="animation-delay:${i * 50}ms">
      <div class="bk-head">
        <div class="bk-date"><b>${when.getDate()}</b><small>${when.toLocaleDateString('en-IN', { month: 'short' })}</small></div>
        <div class="bk-main">
          <h3>${esc(b.therapist?.name || 'Therapist')}</h3>
          <p>${esc(b.therapist?.speciality || 'Massage')} · ${esc(b.customer?.stay || 'Home Stay')}</p>
        </div>
        <span class="bk-status ${status[0]}">${status[1]}</span>
      </div>
      <div class="bk-rows">
        <div class="bk-row">${ic.clock}<span>${esc(when.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }))}, ${esc(b.customer?.time || '')}</span></div>
        ${b.customer?.address ? `<div class="bk-row">${ic.pin}<span>${esc(b.customer.address)}</span></div>` : ''}
        <div class="bk-row">${ic.card}<span>${payLine}${p.referral ? ` · code ${esc(p.referral)}` : ''}</span></div>
      </div>
      <div class="bk-foot">
        <span>ID: ${esc(b.bookingId)}</span>
        <a href="https://wa.me/${BUSINESS_WHATSAPP}?text=${help}" target="_blank" rel="noopener">Need help?</a>
      </div>
    </article>`;
}

function render(list) {
  document.getElementById('bkLoading').hidden = true;
  if (!list.length) { document.getElementById('bkEmpty').hidden = false; return; }
  const now = Date.now();
  // Treat a session as past one hour after its start time
  const upcoming = list.filter((b) => slotDate(b).getTime() + 3600e3 >= now).sort((a, b) => slotDate(a) - slotDate(b));
  const past = list.filter((b) => slotDate(b).getTime() + 3600e3 < now).sort((a, b) => slotDate(b) - slotDate(a));
  if (upcoming.length) {
    document.getElementById('bkUpcoming').hidden = false;
    document.getElementById('bkUpcomingList').innerHTML = upcoming.map((b, i) => card(b, false, i)).join('');
  }
  if (past.length) {
    document.getElementById('bkPast').hidden = false;
    document.getElementById('bkPastList').innerHTML = past.map((b, i) => card(b, true, i)).join('');
  }
}

async function load() {
  const local = readLocalBookings();
  let server = [];
  try {
    const res = await fetch('/api/my-bookings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin', body: JSON.stringify({ deviceId: getDeviceId() }),
    });
    if (res.ok) server = (await res.json()).bookings || [];
  } catch (e) {}
  render([...server, ...local]);

  // Hide the "log in" hint for logged-in customers
  fetch('/api/me', { credentials: 'same-origin' }).then((r) => (r.ok ? r.json() : null))
    .then((d) => { if (d && d.user) document.getElementById('bkLoginHint').hidden = true; }).catch(() => {});
}
load();

// Avatar / logo fallbacks
document.querySelectorAll('img[data-ph]').forEach((img) => {
  const hide = () => { img.style.opacity = 0; if (img.hasAttribute('data-hide-on-error')) img.style.display = 'none'; };
  if (img.complete && img.naturalWidth === 0) hide();
  img.addEventListener('error', hide);
});
