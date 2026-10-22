// Therapist data lives in js/therapists.js
const grid = document.getElementById('therapistGrid');
const tabs = document.querySelectorAll('.type-tab');

function render(type) {
  grid.innerHTML = '';
  THERAPISTS[type].forEach((t, i) => {
    const card = document.createElement('article');
    card.className = 't-card';
    card.style.animationDelay = `${i * 40}ms`;
    card.innerHTML = `
      <div class="t-photo media">
        <img src="${PHOTO_DIR + t.photo}" alt="${t.name}" loading="lazy" />
      </div>
      <p class="t-status">Available</p>
      <h3 class="t-name">${t.name}</h3>
      <p class="t-rating"><i>★</i> ${t.rating} (${t.reviews})</p>
      <div class="t-foot">
        <span class="t-tag">${t.speciality}</span>
        <span class="t-price">₹${t.price}</span>
      </div>`;
    const img = card.querySelector('img');
    img.addEventListener('error', () => {
      const box = img.parentElement;
      box.classList.add('missing');
      box.setAttribute('data-ph', 'therapists/' + t.photo);
    });
    card.addEventListener('click', () => { location.href = `therapist.html?type=${type}&id=${i}`; });
    grid.appendChild(card);
  });
}

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    tabs.forEach((x) => { x.classList.remove('active'); x.setAttribute('aria-selected', 'false'); });
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');
    render(tab.dataset.type);
    history.replaceState(null, '', '#' + tab.dataset.type);
  });
});

// Small confirmation popup
let toastEl;
function toast(msg) {
  if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'toast'; document.body.appendChild(toastEl); }
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastEl._t);
  toastEl._t = setTimeout(() => toastEl.classList.remove('show'), 2000);
}

// Open the tab from the URL (e.g. book-now.html#premium), default Basic
const start = location.hash.slice(1);
const startTab = [...tabs].find((t) => t.dataset.type === start) || tabs[0];
startTab.click();
