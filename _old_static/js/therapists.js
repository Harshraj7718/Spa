// ============================================================
// THERAPIST LIST – shared by book-now.html and therapist.html.
// Edit names, prices, ratings and photos here.
// Photos go in: assets/images/therapists/<photo file name>
//
// Optional per therapist (defaults below are used if left out):
//   experience, specializes, languages, about
// ============================================================
const THERAPISTS = {
  basic: [
    { name: 'Subhi',   rating: 4.9, reviews: 128, speciality: 'Relaxation Massage', price: 999,  photo: 'basic-1.jpg' },
    { name: 'Nisha',   rating: 4.9, reviews: 22,  speciality: 'Wellness Massage',   price: 1399, photo: 'basic-2.jpg' },
    { name: 'Pihu',    rating: 4.9, reviews: 10,  speciality: 'Swedish Massage',    price: 1499, photo: 'basic-3.jpg' },
    { name: 'Yanvi',   rating: 4.8, reviews: 25,  speciality: 'Full body massage',  price: 999,  photo: 'basic-4.jpg' },
    { name: 'Riya',    rating: 4.9, reviews: 33,  speciality: 'Full body massage',  price: 999,  photo: 'basic-5.jpg' },
    { name: 'Ankita',  rating: 4.8, reviews: 69,  speciality: 'Relaxed',            price: 899,  photo: 'basic-6.jpg' },
    { name: 'Trisha',  rating: 5.0, reviews: 69,  speciality: 'Relaxed',            price: 1499, photo: 'basic-7.jpg' },
    { name: 'Ayushi',  rating: 4.9, reviews: 38,  speciality: 'Full body massage',  price: 2499, photo: 'basic-8.jpg' },
    { name: 'Priya',   rating: 4.9, reviews: 69,  speciality: 'Full body massage',  price: 999,  photo: 'basic-9.jpg' },
    { name: 'Vanya',   rating: 5.0, reviews: 29,  speciality: 'Relaxed',            price: 1999, photo: 'basic-10.jpg' },
    { name: 'Nandni',  rating: 5.0, reviews: 66,  speciality: 'Relaxed',            price: 1299, photo: 'basic-11.jpg' },
    { name: 'Shreya',  rating: 4.9, reviews: 12,  speciality: 'Head massage',       price: 1699, photo: 'basic-12.jpg' },
    { name: 'Aruhi',   rating: 4.8, reviews: 16,  speciality: 'Relaxed',            price: 999,  photo: 'basic-13.jpg' },
    { name: 'Harshita',rating: 4.8, reviews: 19,  speciality: 'Relaxed',            price: 1299, photo: 'basic-14.jpg' },
  ],
  therapist: [
    { name: 'Joya',    rating: 4.9, reviews: 44,  speciality: 'Foot Reflexology',   price: 2999, photo: 'therapist-1.jpg' },
    { name: 'Cheiin',  rating: 4.9, reviews: 53,  speciality: 'Relaxation Massage', price: 2999, photo: 'therapist-2.jpg' },
    { name: 'Lekki',   rating: 4.9, reviews: 66,  speciality: 'Thai Massage',       price: 2999, photo: 'therapist-3.jpg' },
    { name: 'Yesshi',  rating: 4.9, reviews: 66,  speciality: 'Full body massage',  price: 2999, photo: 'therapist-4.jpg' },
    { name: 'Pema',    rating: 4.9, reviews: 103, speciality: 'Hot Stone Massage',  price: 2999, photo: 'therapist-5.jpg' },
  ],
  premium: [
    { name: 'Kriti',   rating: 4.9, reviews: 63,  speciality: 'Relaxed',            price: 14999, photo: 'premium-1.jpg' },
    { name: 'Shashi',  rating: 5.0, reviews: 12,  speciality: 'Relaxed',            price: 9999,  photo: 'premium-2.jpg' },
    { name: 'Anuradha',rating: 5.0, reviews: 44,  speciality: 'Relaxed',            price: 8999,  photo: 'premium-3.jpg' },
  ],
};

const THERAPIST_DEFAULTS = {
  experience: '2+ years',
  specializes: 'Relaxation',
  languages: 'Hindi, English',
  about: 'A certified massage therapist trained in relaxation and stress-relief therapies, known for gentle techniques and personalised care.',
};

const PHOTO_DIR = 'assets/images/therapists/';
const VISIT_CHARGE = 149;          // Cash on Delivery visiting charge (₹)
const BUSINESS_WHATSAPP = '919244092230';
// ============================================================
// OFFERS – shown on offers.html and accepted at checkout (the server checks them too).
//   kind: 'percent' (value = % off) or 'flat' (value = ₹ off)
//   max:  optional cap in ₹ for percent offers
//   hidden: true → code works at checkout but isn't listed on the Offers page
// ============================================================
const OFFERS = [
  { code: 'SPA20',      title: 'Spa Offer',      desc: 'Get 20% off your at-home massage booking.', kind: 'percent', value: 20 },
  { code: 'WELCOME100', title: 'Welcome Offer',  desc: 'Flat ₹100 off your first booking with us.', kind: 'flat',    value: 100 },
  { code: 'APKA200',    title: 'Referral Bonus', desc: 'Referred by a friend? Take ₹200 off any session.', kind: 'flat', value: 200 },
];

// Returns the ₹ discount for a code on a given price (0 if the code isn't valid)
function discountFor(code, price) {
  const offer = OFFERS.find((o) => o.code === String(code || '').trim().toUpperCase());
  if (!offer) return 0;
  let off = offer.kind === 'percent' ? Math.round(price * offer.value / 100) : offer.value;
  if (offer.max) off = Math.min(off, offer.max);
  return Math.min(off, price);
}

// ---------- "My Bookings" helpers (used by checkout + bookings.html) ----------
// A random ID for this browser, so the server can show "bookings made on this device"
function getDeviceId() {
  try {
    let id = localStorage.getItem('apkaspa:device');
    if (!id || !/^[a-f0-9-]{20,64}$/.test(id)) {
      id = (crypto.randomUUID ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join(''));
      localStorage.setItem('apkaspa:device', id);
    }
    return id;
  } catch (e) { return ''; }
}
// WhatsApp booking requests never reach the server, so they're kept on this device
const LOCAL_BOOKINGS_KEY = 'apkaspa:requests';
function readLocalBookings() { try { return JSON.parse(localStorage.getItem(LOCAL_BOOKINGS_KEY)) || []; } catch (e) { return []; } }
function saveLocalBooking(b) {
  try { localStorage.setItem(LOCAL_BOOKINGS_KEY, JSON.stringify([b, ...readLocalBookings()].slice(0, 50))); } catch (e) {}
}

function getTherapist(type, index) {
  const list = THERAPISTS[type];
  if (!list || !list[index]) return null;
  return { ...THERAPIST_DEFAULTS, ...list[index] };
}
