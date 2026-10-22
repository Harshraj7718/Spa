// Login + sign-up pages. Accounts are handled by server.js (/api/login, /api/signup, /api/me, /api/logout).
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const form = loginForm || signupForm;
const alertBox = document.getElementById('formAlert');
const submitBtn = form.querySelector('.submit-btn');
const submitLabel = submitBtn.textContent;

// Where to go after logging in: ?next=page.html (same-site pages only), else home
const nextParam = new URLSearchParams(location.search).get('next') || '';
const NEXT = /^[a-z0-9-]+\.html([?#][^:]*)?$/i.test(nextParam) ? nextParam : 'index.html';

// Keep ?next when switching between login and sign-up
if (nextParam) {
  document.querySelectorAll('a[href="signup.html"], a[href="login.html"]').forEach((a) => {
    if (!a.closest('.bottom-nav') && !a.classList.contains('avatar')) a.href += '?next=' + encodeURIComponent(NEXT);
  });
}

// ---------- Helpers ----------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function showAlert(msg, ok = false) {
  alertBox.textContent = msg;
  alertBox.classList.toggle('ok', ok);
  alertBox.hidden = !msg;
}
function fieldError(id, msg) {
  const input = document.getElementById(id);
  const err = document.getElementById(id + 'Error');
  if (input) input.classList.toggle('err', !!msg);
  if (err) { err.textContent = msg || ''; err.classList.toggle('show', !!msg); }
  return !msg;
}
function clearErrors() {
  form.querySelectorAll('.inp').forEach((i) => fieldError(i.id, ''));
  showAlert('');
}
function setBusy(on) {
  submitBtn.disabled = on;
  submitBtn.textContent = on ? 'Please wait…' : submitLabel;
}
async function api(url, body) {
  let res;
  try {
    res = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), credentials: 'same-origin',
    });
  } catch (e) {
    throw new Error('Could not reach the server. Please check your connection.');
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 404 && !data.error) throw new Error('Login needs the site to run with "node server.js".');
  if (!res.ok) { const err = new Error(data.error || 'Something went wrong.'); err.field = data.field; throw err; }
  return data;
}

// Clear a field's error as the user types
form.querySelectorAll('.inp').forEach((i) => i.addEventListener('input', () => fieldError(i.id, '')));

// Show / hide password
document.querySelectorAll('[data-toggle]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.toggle);
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.classList.toggle('on', show);
    btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  });
});

// Mobile: digits only
const mobileInput = document.getElementById('mobile');
if (mobileInput) mobileInput.addEventListener('input', () => { mobileInput.value = mobileInput.value.replace(/\D/g, '').slice(0, 10); });

// ---------- Log in ----------
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    let ok = fieldError('email', EMAIL_RE.test(email) ? '' : 'Please enter a valid email address.');
    ok = fieldError('password', password ? '' : 'Please enter your password.') && ok;
    if (!ok) return;
    setBusy(true);
    try {
      await api('/api/login', { email, password });
      showAlert('Logged in! Taking you back…', true);
      location.href = NEXT;
    } catch (err) {
      showAlert(err.message);
      setBusy(false);
    }
  });
}

// ---------- Sign up ----------
if (signupForm) {
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const mobile = mobileInput.value.trim();
    const password = document.getElementById('password').value;
    let ok = fieldError('name', name.length >= 2 ? '' : 'Please enter your full name.');
    ok = fieldError('email', EMAIL_RE.test(email) ? '' : 'Please enter a valid email address.') && ok;
    ok = fieldError('mobile', !mobile || /^[6-9]\d{9}$/.test(mobile) ? '' : 'Enter a valid 10-digit mobile number.') && ok;
    ok = fieldError('password', password.length >= 8 ? '' : 'Password must be at least 8 characters.') && ok;
    if (!ok) return;
    setBusy(true);
    try {
      await api('/api/signup', { name, email, mobile, password });
      showAlert('Account created! Taking you back…', true);
      location.href = NEXT;
    } catch (err) {
      if (err.field) fieldError(err.field, err.message); else showAlert(err.message);
      setBusy(false);
    }
  });
}

// ---------- Already logged in? ----------
fetch('/api/me', { credentials: 'same-origin' })
  .then((r) => (r.ok ? r.json() : null))
  .then((data) => {
    if (!data || !data.user) return;
    document.getElementById('meName').textContent = data.user.name.split(' ')[0];
    document.getElementById('meEmail').textContent = data.user.email;
    document.getElementById('signedIn').hidden = false;
    form.hidden = true;
  })
  .catch(() => {});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  try { await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }); } catch (e) {}
  location.reload();
});

// ---------- Header bits ----------

document.querySelectorAll('img[data-ph], img[data-hide-on-error]').forEach((img) => {
  const hide = () => { if (img.hasAttribute('data-hide-on-error')) img.style.display = 'none'; else img.style.opacity = 0; };
  if (img.complete && img.naturalWidth === 0) hide();
  img.addEventListener('error', hide);
});
