# APKASPA – Spa Website

Open `index.html` in any browser. No build step needed.

## Where to put your photos and video

Drop your files into these folders using **exactly these names** — the site picks them up automatically.
Until a file is added, the site shows a green placeholder with the expected path.

```
spa/
├── index.html
├── css/style.css
├── js/main.js
└── assets/
    ├── videos/
    │   └── hero.mp4                 ← Hero background video (top of page)
    └── images/
        ├── hero-poster.jpg          ← Still image shown while hero video loads
        ├── logo.png                 ← Small logo icon above "APKASPA" in header
        ├── avatar.jpg               ← Round profile picture (top-left)
        ├── home-service.jpg         ← "Home Service" card
        ├── hotel-service.jpg        ← "Hotel Service" card
        ├── therapist.jpg            ← "Book a Therapist" card
        ├── full-body.jpg            ← "Full Body" massage card
        ├── head-neck-shoulder.jpg   ← "Head, Neck & Shoulder" massage card
        ├── foot-reflexology.jpg     ← "Foot Reflexology" massage card
        └── therapists/              ← Photos for the Book Now page (book-now.html)
            ├── basic-1.jpg … basic-14.jpg        ← "Basic Therapist" tab
            ├── therapist-1.jpg … therapist-5.jpg ← "Therapist" tab
            └── premium-1.jpg … premium-3.jpg     ← "Premium Therapist" tab
```

## Book Now page

`book-now.html` is the "Choose Booking Type" page. Every Book button on the home page opens it.
To change therapist names, ratings, specialities, prices or photo file names, edit the list in `js/therapists.js`.
You can also give each therapist `experience`, `specializes`, `languages` and `about` text there.
Link straight to one tab with `book-now.html#basic`, `#therapist` or `#premium`.

Want a different file name? Search `index.html` for `PHOTO:` or `VIDEO:` comments — each one marks the exact line to change.

## Therapist details & checkout page

Clicking a therapist opens `therapist.html?type=basic&id=0` (type = basic / therapist / premium, id = position in the list, starting at 0).
It has: therapist profile → Home/Hotel stay, date and time slot → address, map pin, contact, referral code → payment method → bill.

- **Settings** (top of `js/therapist.js`): opening hours for time slots, map centre, referral codes.
- **Visiting charge and WhatsApp number**: `js/therapists.js` (`VISIT_CHARGE`, `BUSINESS_WHATSAPP`).
- **Optional notice banner** (e.g. holiday closure): add `assets/images/notice-banner.jpg` and it shows above the time slots. Delete the file to hide it.
- **Offer / referral codes**: the `OFFERS` list in `js/therapists.js` (see below).

## Offers page

`offers.html` lists every offer from the `OFFERS` list in `js/therapists.js`. Each offer has:
`code`, `title`, `desc`, `kind` (`'percent'` or `'flat'`), `value`, and optionally `max` (₹ cap for percent offers) or `hidden: true` (the code works at checkout but isn't shown on the page).

- **Copy** copies the code, and the checkout page applies it automatically.
- **Book with this offer** / **Book with Offer** remembers the code and opens the booking page.
- The server uses the same list to work out the price, so a code typed at checkout gets the same discount when paying online.

Add, change or remove an offer in that one list. The Offers page, the checkout and the payment server all update together.

## Online payments (Razorpay)

The site runs through a small Node.js server (`server.js`) that takes real payments with Razorpay. Run `npm install` once first (see "Database (MongoDB) & admin dashboard" below).

### Setup
1. Install Node.js 18 or newer (https://nodejs.org).
2. Copy `.env.example` to `.env` and paste your keys from the Razorpay Dashboard → Account & Settings → API Keys.
   Start with **Test mode** keys (`rzp_test_...`).
3. In this folder run:
   ```
   node server.js
   ```
4. Open http://localhost:5500. The terminal shows `Razorpay: ON (TEST mode)`.

### How it works
- **Pay Online** charges the full treatment amount (minus any referral discount).
- **Cash on Delivery** charges only the visiting charge online (`VISIT_CHARGE`); the rest is paid in cash.
- The server works out the amount from `js/therapists.js`, so nobody can change the price in their browser.
- After payment the server checks Razorpay's signature, then marks the booking paid in MongoDB (`bookings` collection)
  and prints it in the terminal. You'll also see every payment in your Razorpay Dashboard.
- If the keys are missing, or the site is opened without `server.js`, the button falls back to the WhatsApp confirmation.

### Testing (test mode)
Use Razorpay's test details from https://razorpay.com/docs/payments/payments/test-card-details/ — for example UPI ID `success@razorpay`. No real money moves.

### Going live
1. Finish KYC/activation in the Razorpay Dashboard and generate **Live** keys (`rzp_live_...`).
2. Put the live keys in `.env` on your hosting server.
3. Host on something that runs Node.js (e.g. Render, Railway, a VPS) with HTTPS. Plain static hosting will not work for payments.
4. Never upload `.env` anywhere public. It is already listed in `.gitignore`.

## Login & accounts

`login.html` is a copy of the original Log In page, and `signup.html` is the matching Create Account page.
The avatar in the header and **Profile** in the bottom nav open the login page.

- Accounts only work when the site runs through `node server.js`.
- Accounts are saved in MongoDB (`users` collection). Passwords are stored only as secure scrypt hashes, never as plain text.
- Customers stay logged in for 30 days through a signed, HttpOnly cookie. A logged-in customer who opens the login page sees "Hi, name" with **Book a Session** and **Log Out**.
- After 5 wrong passwords for the same email, that email is locked out for 15 minutes.
- After logging in, customers go back to the home page, or to `?next=page.html` if given (e.g. `login.html?next=book-now.html`).
- **Therapist** and **hotel** "Log in here" links open a WhatsApp chat with you for now, because there are no partner accounts yet.
- **Not built yet:** "Forgot password". Back up the MongoDB database regularly; it holds your users and bookings.

## Header menu, notifications and city picker

All pages with the dark top bar load `js/header.js` + `css/header.css`:
- **☰ Menu** opens a full side menu (Home, Bookings, Book Now, Offers, Profile, Contact, About Us, and Legal & Policies). Edit the `MAIN` and `LEGAL` lists at the top of `js/header.js`. Legal pages with no link yet show "coming soon".
- **🔔 Notifications** opens the notifications panel. It's an empty state for now ("No notifications yet") with a **View all bookings** button.
- **📍 City pill** opens "Choose your city" (Indore, Delhi, Gurgaon; edit `CITIES` in `js/header.js`). The choice is remembered on that device. It doesn't change prices or therapists yet.

## My Bookings page

`bookings.html` (Bookings in the bottom nav and the menu) shows:
- **Paid bookings** made on this device, or by the logged-in account, read from MongoDB through the server.
- **WhatsApp booking requests** (marked *Requested*). These are now saved in MongoDB too, so the admin sees them; if the server can't be reached, a copy is kept in that browser instead.
- Bookings are split into **Upcoming** and **Past**. With none, it shows the original "You haven't booked with this device yet."

## Database (MongoDB) & admin dashboard

Everything the website collects is stored in **MongoDB**, in a database called `apkaspa`:

| Collection | What's in it |
|---|---|
| `users` | Customer accounts (passwords stored only as secure hashes) |
| `bookings` | Every booking: WhatsApp requests, online payments and cash-on-delivery |
| `subscribers` | Newsletter sign-ups from the footer |
| `events` | Activity log for the live feed (auto-deleted after 90 days) |

### First-time setup
1. Install packages once: `npm install`
2. Make sure MongoDB is running. On this PC it's the Windows **MongoDB** service on port 27017. For the cloud, use MongoDB Atlas and paste its connection string into `MONGODB_URI` in `.env`.
3. Open `.env` and note (or change) `ADMIN_PASSWORD`. It must be at least 10 characters.
4. Run `node server.js`. The terminal shows `MongoDB: connected` and the admin address.

If old `data/users.json` / `data/bookings.json` files exist, they are imported automatically the first time.

### Admin dashboard: http://localhost:5500/admin
Sign in with `ADMIN_USERNAME` / `ADMIN_PASSWORD` from `.env`. The session lasts 12 hours. After 5 wrong passwords, logins are blocked for 15 minutes.
- **Live:** new bookings, payments, sign-ups and subscribers appear instantly, with no refresh. The green **Live** dot shows the connection. Turn on **Sound** to hear a chime for new bookings and payments.
- **Stats:** bookings today, new requests waiting, upcoming sessions, money paid online, totals.
- **Bookings:** filter by status, search by name, mobile, ID or therapist, and tap Call / WhatsApp / map pin. Change a booking's **status** (Requested → Confirmed → Completed, or Cancelled); the customer sees the new status on their My Bookings page.
- **Analytics:** pick the last 7, 30 or 90 days.
  - Summary tiles: average booking value, money paid online, repeat customers, cancellation rate, offer use.
  - Charts: bookings per day, money paid online per day, busiest time slots, most booked therapists, how customers book, booking status, and offer codes used.
  - Hover or tab to any bar for its exact number, or press **Table** on a chart to see all its numbers. Charts update live as bookings come in.
- **Customers**, **Subscribers** (with *Copy all emails*) and the full **Activity** log.

### Hosting it online
Use a host that runs Node.js (Render, Railway, a VPS) with HTTPS, and MongoDB Atlas for the database. Set the same values from `.env` as environment variables there, including a `SESSION_SECRET`. Back up the database regularly; Atlas does this for you.

### Connecting to MongoDB Atlas
1. In Atlas, go to **Security → Network Access** and add your IP address (and later, your hosting server's).
2. In `.env`, set `MONGODB_URI` to your connection string with the password filled in (no `< >` brackets), and keep `/apkaspa` after `.mongodb.net` so the site uses its own database.
3. Run `node server.js`. It should say `MongoDB: connected (database "apkaspa")`.

If your network's DNS can't look up `mongodb+srv://` addresses (error `querySrv ECONNREFUSED`), the server retries with public DNS (8.8.8.8 / 1.1.1.1) and tells you so in the terminal. You can choose other servers with `DNS_SERVERS` in `.env`.
