// Offers page – cards come from the OFFERS list in js/therapists.js
const OFFER_KEY = 'apkaspa:offer'; // remembered code, auto-applied at checkout

const list = document.getElementById('offerList');
const visible = OFFERS.filter((o) => !o.hidden);

const tagIcon = '<svg viewBox="0 0 24 24"><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8Z"/><circle cx="7" cy="7" r="1.5"/></svg>';
const copyIcon = '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
const checkIcon = '<svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const badge = (o) => (o.kind === 'percent' ? `${o.value}% OFF` : `₹${o.value} OFF`);

if (!visible.length) {
  list.innerHTML = '<p class="offers-empty">No offers right now – check back soon!</p>';
} else {
  list.innerHTML = visible.map((o, i) => `
    <article class="deal" style="animation-delay:${i * 60}ms">
      <div class="deal-top">
        <span class="deal-icon">${tagIcon}</span>
        <span class="deal-badge">${esc(badge(o))}</span>
      </div>
      <h2>${esc(o.title)}</h2>
      <p>${esc(o.desc)}</p>
      <div class="code-box">
        <small>Use code</small>
        <b>${esc(o.code)}</b>
        <button type="button" class="copy-btn" data-code="${esc(o.code)}">${copyIcon}Copy</button>
      </div>
      <button type="button" class="use-btn" data-use="${esc(o.code)}">BOOK WITH THIS OFFER <span>→</span></button>
    </article>`).join('');
}

function remember(code) { try { localStorage.setItem(OFFER_KEY, code); } catch (e) {} }

let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) {
    // Fallback for older browsers / non-HTTPS
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy'); ta.remove(); return ok;
  }
}

list.addEventListener('click', async (e) => {
  const copy = e.target.closest('[data-code]');
  if (copy) {
    const code = copy.dataset.code;
    await copyText(code);
    remember(code);
    copy.innerHTML = checkIcon + 'Copied';
    copy.classList.add('done');
    toast(`${code} copied – it will be applied at checkout`);
    setTimeout(() => { copy.innerHTML = copyIcon + 'Copy'; copy.classList.remove('done'); }, 1800);
    return;
  }
  const use = e.target.closest('[data-use]');
  if (use) { remember(use.dataset.use); location.href = 'book-now.html'; }
});

// "Book with Offer" uses the first listed offer
document.getElementById('bookWithOffer').addEventListener('click', () => {
  if (visible[0]) remember(visible[0].code);
});


// Avatar / logo fallbacks
document.querySelectorAll('img[data-ph]').forEach((img) => {
  const hide = () => { img.style.opacity = 0; if (img.hasAttribute('data-hide-on-error')) img.style.display = 'none'; };
  if (img.complete && img.naturalWidth === 0) hide();
  img.addEventListener('error', hide);
});
