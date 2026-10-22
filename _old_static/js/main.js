// Show a labelled placeholder when a photo file is not in assets/images yet
document.querySelectorAll('img[data-ph]').forEach((img) => {
  const markMissing = () => {
    if (img.hasAttribute('data-hide-on-error')) { img.style.display = 'none'; return; }
    const box = img.closest('.media');
    if (box) {
      box.classList.add('missing');
      box.setAttribute('data-ph', 'assets/images/' + img.dataset.ph);
    } else {
      img.style.opacity = 0;
    }
  };
  if (img.complete && img.naturalWidth === 0) markMissing();
  img.addEventListener('error', markMissing);
});

// Same for the hero video in assets/videos
const heroVideo = document.querySelector('.hero-media');
if (heroVideo) {
  // Keep the background video silent
  heroVideo.muted = true;
  heroVideo.volume = 0;
  heroVideo.addEventListener('volumechange', () => { heroVideo.muted = true; });
  const source = heroVideo.querySelector('source');
  const markMissing = () => document.querySelector('.hero').classList.add('missing-video');
  if (heroVideo.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) markMissing();
  source.addEventListener('error', markMissing);
}


// Massage carousel arrows
const track = document.getElementById('massageTrack');
document.querySelectorAll('[data-scroll]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const card = track.querySelector('.massage-card');
    track.scrollBy({ left: Number(btn.dataset.scroll) * (card.offsetWidth + 26), behavior: 'smooth' });
  });
});

// Reveal on scroll
const io = new IntersectionObserver((entries) => {
  entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
}, { threshold: 0.15 });
document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

// Bottom nav active state
document.querySelectorAll('.bottom-nav a').forEach((a) => {
  a.addEventListener('click', () => {
    document.querySelectorAll('.bottom-nav a').forEach((x) => x.classList.remove('active'));
    a.classList.add('active');
  });
});

document.getElementById('year').textContent = new Date().getFullYear();

// Newsletter → saved in the database (shows up live on the admin dashboard)
const newsletter = document.getElementById('newsletterForm');
if (newsletter) {
  const input = newsletter.querySelector('input');
  const button = newsletter.querySelector('button');
  const msg = document.createElement('p');
  msg.className = 'f-small newsletter-msg';
  msg.setAttribute('role', 'status');
  newsletter.after(msg);
  newsletter.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = input.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { msg.textContent = 'Please enter a valid email address.'; input.focus(); return; }
    button.disabled = true;
    try {
      const res = await fetch('/api/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not subscribe right now.');
      msg.textContent = data.already ? "You're already subscribed – thank you!" : 'Thanks for subscribing!';
      newsletter.reset();
    } catch (err) {
      msg.textContent = err.message === 'Failed to fetch' ? 'Could not reach the server. Please try again.' : err.message;
    } finally {
      button.disabled = false;
    }
  });
}
