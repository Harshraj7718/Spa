// ============================================================
// Shared header: side menu, notifications panel and city picker.
// Used by every page that has the dark top bar (index, offers, login, signup).
// ============================================================
(() => {
  const CITIES = ['Indore', 'Delhi', 'Gurgaon'];
  const CITY_KEY = 'apkaspa:city';

  const icon = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  const I = {
    home: icon('<path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M9 22V12h6v10"/>'),
    cal: icon('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>'),
    lotus: icon('<path d="M12 22v-9M12 13c-3 0-5-2-5-5 2 0 4 1 5 3 1-2 3-3 5-3 0 3-2 5-5 5Z"/><path d="M12 11c-1.5-2-1.5-5 0-8 1.5 3 1.5 6 0 8ZM9 18c-2 0-4-1-5-3M15 18c2 0 4-1 5-3"/>'),
    tag: icon('<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8Z"/><circle cx="7" cy="7" r="1.5"/>'),
    user: icon('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
    chat: icon('<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>'),
    building: icon('<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2M10 6h4M10 10h4M10 14h4M10 18h4"/>'),
    case: icon('<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>'),
    file: icon('<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v5h5M16 13H8M16 17H8M10 9H8"/>'),
    shield: icon('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/>'),
    undo: icon('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>'),
    warn: icon('<path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3"/><path d="M12 9v4M12 17h.01"/>'),
    shieldX: icon('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="M12 8v4M12 16h.01"/>'),
    bell: icon('<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>'),
    close: icon('<path d="M18 6 6 18M6 6l12 12"/>'),
    check: icon('<path d="M20 6 9 17l-5-5"/>'),
  };

  // ---------- Menu items (edit links here) ----------
  const MAIN = [
    ['Home', 'index.html', I.home],
    ['Bookings', 'bookings.html', I.cal],
    ['Book Now', 'book-now.html', I.lotus],
    ['Offers', 'offers.html', I.tag],
    ['Profile', 'login.html', I.user],
    ['Contact', 'index.html#contact', I.chat],
    ['About Us', 'index.html#why', I.building],
  ];
  // Pages not written yet → href '' shows "coming soon"
  const LEGAL = [
    ['Careers', '', I.case],
    ['Terms & Conditions', '', I.file],
    ['Privacy Policy', '', I.shield],
    ['Refund & Cancellation', '', I.undo],
    ['Disclaimer', '', I.warn],
    ['Inappropriate Requests Policy', '', I.shieldX],
  ];

  // Gold lotus above "APKASPA" until assets/images/logo.png is added
  const logoImg = document.querySelector('.brand .brand-icon');
  const addLotus = () => {
    if (document.querySelector('.brand .brand-lotus')) return;
    const span = document.querySelector('.brand span');
    if (span) span.insertAdjacentHTML('beforebegin', '<svg class="brand-lotus" viewBox="0 0 40 22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20c-3-3-4-7-4-10 0-3 2-6 4-8 2 2 4 5 4 8 0 3-1 7-4 10Z"/><path d="M20 20c-4-1-8-4-9-8 3 0 6 1 8 3M20 20c4-1 8-4 9-8-3 0-6 1-8 3"/><path d="M20 20c-5 1-11 0-15-4 3-1 7-1 10 1M20 20c5 1 11 0 15-4-3-1-7-1-10 1"/><path d="M2 20h11M27 20h11"/></svg>');
  };
  if (!logoImg || (logoImg.complete && logoImg.naturalWidth === 0)) addLotus();
  else logoImg.addEventListener('error', addLotus);

  const here = location.pathname.split('/').pop() || 'index.html';
  const link = ([label, href, ic], cls) => href
    ? `<a class="${cls}${href === here && label !== 'Profile' ? ' current' : ''}" href="${href}">${ic}<span>${label}</span></a>`
    : `<button type="button" class="${cls}" data-soon="${label}">${ic}<span>${label}</span></button>`;

  // ---------- Build the panels ----------
  document.body.insertAdjacentHTML('beforeend', `
    <div class="hd-overlay" id="hdOverlay" hidden></div>
    <aside class="hd-drawer" id="hdDrawer" aria-label="Menu" aria-hidden="true">
      <div class="hd-drawer-head">
        <span>MENU</span>
        <button type="button" class="hd-x" id="hdClose" aria-label="Close menu">${I.close}</button>
      </div>
      <nav class="hd-main">${MAIN.map((m) => link(m, 'hd-item')).join('')}</nav>
      <p class="hd-section">LEGAL &amp; POLICIES</p>
      <nav class="hd-legal">${LEGAL.map((m) => link(m, 'hd-item sm')).join('')}</nav>
    </aside>
    <div class="hd-toast" id="hdToast" role="status" aria-live="polite"></div>`);

  const inner = document.querySelector('.topbar-inner');
  inner.insertAdjacentHTML('beforeend', `
    <div class="hd-pop notif" id="hdNotif" role="dialog" aria-label="Notifications" hidden>
      <div class="notif-head">
        <span class="notif-bell">${I.bell}</span>
        <div><b>Notifications</b><small>Booking and payment updates</small></div>
        <span class="notif-count" id="notifCount">0 new</span>
      </div>
      <div class="notif-body">
        <div class="notif-empty">
          <span class="notif-ring"><span>${I.bell}</span></span>
          <b>No notifications yet</b>
          <p id="notifMsg">Log in or book a session to start receiving updates here.</p>
        </div>
      </div>
      <div class="notif-foot"><a href="bookings.html" class="btn btn-dark block" id="notifBtn">View all bookings</a></div>
    </div>
    <div class="hd-pop city" id="hdCity" role="listbox" aria-label="Choose your city" hidden>
      <p class="city-head">CHOOSE YOUR CITY</p>
      <div id="cityList"></div>
      <p class="city-note" id="cityNote">We couldn't place you automatically — pick the city you'd like service in.</p>
    </div>`);

  // ---------- Open / close helpers ----------
  const drawer = document.getElementById('hdDrawer');
  const overlay = document.getElementById('hdOverlay');
  const notif = document.getElementById('hdNotif');
  const cityPop = document.getElementById('hdCity');
  const menuBtn = document.getElementById('menuBtn');
  const bellBtn = document.querySelector('.topbar-actions .icon-btn[aria-label="Notifications"]');
  const cityBtn = document.querySelector('.city-pill');

  function closePops(except) {
    [[notif, bellBtn], [cityPop, cityBtn]].forEach(([pop, btn]) => {
      if (pop !== except) { pop.hidden = true; btn && btn.setAttribute('aria-expanded', 'false'); btn && btn.classList.remove('open'); }
    });
  }
  function togglePop(pop, btn) {
    const open = pop.hidden;
    closePops(pop);
    pop.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    btn.classList.toggle('open', open);
  }

  function openDrawer() {
    closePops();
    overlay.hidden = false;
    requestAnimationFrame(() => { drawer.classList.add('open'); overlay.classList.add('show'); });
    drawer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    document.getElementById('hdClose').focus();
  }
  function closeDrawer() {
    drawer.classList.remove('open');
    overlay.classList.remove('show');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    setTimeout(() => { if (!drawer.classList.contains('open')) overlay.hidden = true; }, 300);
  }

  if (menuBtn) menuBtn.addEventListener('click', (e) => { e.stopPropagation(); openDrawer(); });
  document.getElementById('hdClose').addEventListener('click', closeDrawer);
  overlay.addEventListener('click', closeDrawer);
  drawer.querySelectorAll('a').forEach((a) => a.addEventListener('click', closeDrawer));

  if (bellBtn) {
    bellBtn.setAttribute('aria-haspopup', 'dialog');
    bellBtn.addEventListener('click', (e) => { e.stopPropagation(); togglePop(notif, bellBtn); });
  }
  if (cityBtn) {
    cityBtn.setAttribute('aria-haspopup', 'listbox');
    cityBtn.addEventListener('click', (e) => { e.stopPropagation(); togglePop(cityPop, cityBtn); });
  }
  [notif, cityPop].forEach((p) => p.addEventListener('click', (e) => e.stopPropagation()));
  document.addEventListener('click', () => closePops());
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (drawer.classList.contains('open')) closeDrawer(); else closePops();
  });

  // ---------- "Coming soon" for pages not built yet ----------
  let toastTimer;
  function toast(msg) {
    const t = document.getElementById('hdToast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2000);
  }
  // Works for the menu and for footer links marked data-soon
  document.addEventListener('click', (e) => {
    const soon = e.target.closest('[data-soon]');
    if (!soon) return;
    e.preventDefault();
    toast(`${soon.dataset.soon} page is coming soon`);
  });

  // ---------- City picker ----------
  let city = null;
  try { city = localStorage.getItem(CITY_KEY); } catch (e) {}
  const chosen = CITIES.includes(city);
  if (!chosen) city = CITIES[0];

  function renderCities() {
    document.getElementById('cityList').innerHTML = CITIES.map((c) => `
      <button type="button" class="city-opt${c === city ? ' on' : ''}" role="option" aria-selected="${c === city}" data-city="${c}">
        <span>${c}</span>${c === city ? I.check : ''}
      </button>`).join('');
    if (cityBtn) {
      // Replace only the text node between the pin and the chevron
      const textNode = [...cityBtn.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
      if (textNode) textNode.textContent = ` ${city} `;
    }
  }
  document.getElementById('cityList').addEventListener('click', (e) => {
    const opt = e.target.closest('[data-city]');
    if (!opt) return;
    city = opt.dataset.city;
    try { localStorage.setItem(CITY_KEY, city); } catch (err) {}
    document.getElementById('cityNote').hidden = true;
    renderCities();
    closePops();
    toast(`Showing services in ${city}`);
  });
  document.getElementById('cityNote').hidden = chosen;
  renderCities();

  // ---------- Notifications (tailored to login state) ----------
  fetch('/api/me', { credentials: 'same-origin' })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (!data || !data.user) return;
      document.getElementById('notifMsg').textContent = 'Book a session to start receiving booking and payment updates here.';
    })
    .catch(() => {});

  // ---------- Dissolve the header while scrolling down, bring it back when scrolling up ----------
  const topbar = document.querySelector('.topbar');
  let lastY = window.scrollY;
  let ticking = false;
  function onScroll() {
    const y = window.scrollY;
    const panelOpen = !notif.hidden || !cityPop.hidden || drawer.classList.contains('open');
    if (y < 80 || panelOpen) topbar.classList.remove('hd-hidden');      // always show near the top / while a panel is open
    else if (y > lastY + 4) topbar.classList.add('hd-hidden');           // moving down → fade out
    else if (y < lastY - 4) topbar.classList.remove('hd-hidden');        // moving up → fade back in
    if (Math.abs(y - lastY) > 4) lastY = y;
    ticking = false;
  }
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  // Show it again if someone tabs to a header button with the keyboard
  topbar.addEventListener('focusin', () => topbar.classList.remove('hd-hidden'));
})();
