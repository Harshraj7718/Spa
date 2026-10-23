# APKASPA – Spa Website

The website and the admin dashboard are built with **React + TypeScript** (bundled by **Vite**).
A small **Node.js** server (`server.js`) serves them, stores everything in **MongoDB**, and takes payments with **Cashfree** (Razorpay also supported).

## Quick start

```
npm install          # once
npm run build        # builds the website + admin into dist/
node server.js       # then open http://localhost:5500  (admin: http://localhost:5500/admin)
```

Run `npm run build` again after changing anything in `src/`, `shared/` or `public/`. The server reads `dist/`.

### While developing (live reload)
Run these in two terminals:
```
node server.js       # API + database on http://localhost:5500
npm run dev          # React with instant reload on http://localhost:5173  (admin: /admin/)
```
`npm run dev` forwards `/api` calls to the server, so logins, bookings and the live admin feed all work.
`npm run typecheck` checks all TypeScript without building.

## Project layout

```
spa/
├── index.html              ← entry page for the website
├── admin/index.html        ← entry page for the admin dashboard
├── src/
│   ├── website/            ← website (React + TypeScript)
│   │   ├── App.tsx         ← pages & addresses (routes)
│   │   ├── pages/          ← Home, BookNow, Checkout, Offers, Bookings, Auth (login + sign-up)
│   │   ├── components/     ← Header (menu, notifications, city), BottomNav, Footer, Photo, MapPicker…
│   │   └── lib/            ← server calls, login state, browser storage, helpers
│   ├── admin/              ← admin dashboard (React + TypeScript): bookings, analytics charts, live feed
│   └── styles/             ← the stylesheets (same design as before)
├── shared/catalog.json     ← therapists, prices, offers, visiting charge (used by website AND server)
├── public/assets/          ← your photos & video (copied into the build as /assets/…)
├── server.js, db.js        ← Node server + MongoDB
├── dist/                   ← the built site (created by npm run build – don't edit)
└── _old_static/            ← the previous plain-HTML version, kept for reference (safe to delete)
```

## Pages

| Address | Page |
|---|---|
| `/` | Home |
| `/book-now` (`#basic`, `#therapist`, `#premium` open a tab) | Choose booking type & therapist |
| `/therapist/basic/0` (type / position in the list, from 0) | Therapist details & checkout |
| `/offers` | Offers |
| `/bookings` | My Bookings |
| `/login`, `/signup` | Log in / Create account (`?next=/bookings` returns there after login) |
| `/payment-return` | Where Cashfree sends customers after paying (shows confirmed / failed) |
| `/admin` | Admin dashboard |

Old addresses (`index.html`, `book-now.html`, `therapist.html?type=…&id=…`, `offers.html`, `login.html`…) redirect to the new ones automatically.

## Where to put your photos and video

Put files in `public/assets/` with **exactly these names**, then run `npm run build`. Until a file exists, the site shows a green placeholder with the expected path.

```
public/assets/
├── videos/hero.mp4                  ← hero background video (always silent)
└── images/
    ├── hero-poster.jpg              ← still shown while the video loads
    ├── logo.png                     ← logo above "APKASPA" (a gold lotus is drawn until it exists)
    ├── avatar.jpg                   ← round picture, top-left of the header
    ├── home-service.jpg, hotel-service.jpg, therapist.jpg      ← home page service cards
    ├── full-body.jpg, head-neck-shoulder.jpg, foot-reflexology.jpg  ← massage cards
    ├── login-bg.jpg                 ← photo behind the login page's left panel (desktop)
    ├── notice-banner.jpg            ← optional banner above the time slots (e.g. holiday closure)
    └── therapists/
        ├── basic-1.jpg … basic-14.jpg
        ├── therapist-1.jpg … therapist-5.jpg
        └── premium-1.jpg … premium-3.jpg
```

## Therapists, prices and offers (edit them in the admin)

Open **Admin → Therapists** or **Admin → Offers**. Changes are saved in MongoDB and show on the website straight away –
no rebuild or redeploy needed.

**Therapists:** add, edit (name, speciality, price, rating, reviews, experience, languages, about), move up/down,
**Hide** (taken off the website but kept for later) or **Delete**. Use the *Type* box to move someone between
Basic / Therapist / Premium.

**Photos from Google Drive:**
1. Upload the photo to Google Drive.
2. Right-click it → **Share** → under *General access* choose **Anyone with the link** → **Copy link**.
3. Paste the link into the therapist's *Photo – Google Drive link* box. The preview shows the photo; if it says
   "Can't load", the photo isn't shared publicly yet. (A folder link won't work – it must be the photo's own link.)

The server turns the Drive link into a direct image address automatically. Any other `https://` image address also works,
and so does a file name in `public/assets/images/therapists/`.

**Offers:** add or edit the code, title, description, % or ₹ off and an optional maximum discount.
*Active* switches the code on/off at checkout; untick *Show on the Offers page* for a secret code that still works.

Every booking is priced by the server from these saved values, so nobody can change a price in their browser.
Each change is listed in the admin's Activity feed (🛠️).

`shared/catalog.json` is only the **starting copy**: it fills the database the first time the server runs, and the
website uses it for a moment until the live list arrives. After that, edit in the admin, not in the file.
The visiting charge (`visitCharge`) and WhatsApp number (`businessWhatsapp`) are also in this starting copy.

Other settings: time-slot hours at the top of `src/website/pages/Checkout.tsx`, menu links and cities in `src/website/components/Header.tsx`, the map's starting point in `src/website/components/MapPicker.tsx`.

## Online payments (Cashfree)

1. Put your keys in `.env` (see `.env.example`): `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`, `CASHFREE_ENV=sandbox`.
   Get them from the Cashfree Merchant Dashboard → **Developers → API Keys** (start with the **Test** keys).
2. Restart `node server.js` — it shows `Payments: Cashfree (SANDBOX test mode)`.

How it works:
- **Pay Online** charges the full treatment amount (minus any offer); **Cash on Delivery** charges only the ₹149 visiting charge online.
  The server calculates the amount itself from `shared/catalog.json` – a customer can't change it.
- The button saves the booking as *Awaiting payment* and sends the customer to Cashfree's secure page (UPI, cards, netbanking, wallets).
- Afterwards Cashfree returns them to `/payment-return`. That page asks the server, the server asks **Cashfree** whether the order is
  really `PAID` (and for the right amount), then marks the booking **Paid** – it appears in the admin instantly.
- Failed or cancelled payments show "Payment not completed" to the customer and a ⚠️ in the admin's Activity feed.
- If keys are missing or Cashfree is unreachable, the customer is offered **Confirm on WhatsApp** instead – never stuck.

**Testing in sandbox:** on Cashfree's page pay by UPI ID `testsuccess@gocash` (succeeds) or `testfailure@gocash` (fails),
or use the test cards listed in Cashfree's docs. No real money moves.

**Going live:** finish KYC in Cashfree, generate **Production** keys, set `CASHFREE_ENV=production` with those keys,
and add your website domain under Developers → **Whitelisted domains** (Cashfree only redirects to approved domains). HTTPS is required.

### Cashfree webhook (recommended)
Records a payment even if the customer closes the browser before returning to your site.
1. Cashfree Dashboard → **Developers → Webhooks → Add Webhook URL**: `https://YOUR-SITE/api/cashfree-webhook`, Payment events (success/failed).
2. Nothing else to set – the server checks Cashfree's signature with your `CASHFREE_SECRET_KEY`.
3. On Vercel also add `NODEJS_HELPERS=0` so the signature can be checked.

Checkout and webhook can both report the same payment safely – it's recorded once.

### Razorpay (optional alternative)
Add `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` instead of the Cashfree keys (or set `PAYMENT_PROVIDER=razorpay` when both are present).
Its webhook is `https://YOUR-SITE/api/razorpay-webhook` (events **payment.captured**, **payment.failed**) with its secret in `RAZORPAY_WEBHOOK_SECRET`.

## Accounts

Customers can sign up and log in. Accounts are stored in MongoDB with passwords only as secure scrypt hashes; logins last 30 days (HttpOnly cookie); 5 wrong passwords lock that email for 15 minutes. Therapist/hotel "Log in here" links open WhatsApp for now. *Not built yet:* "Forgot password".

## Database (MongoDB) & admin dashboard

Everything is stored in the `apkaspa` database:

| Collection | What's in it |
|---|---|
| `users` | Customer accounts |
| `bookings` | Every booking: WhatsApp requests, online payments, cash on delivery |
| `subscribers` | Newsletter sign-ups |
| `settings` | Therapists, prices and offers (document `catalog`, edited in the admin) |
| `events` | Activity log for the live feed (auto-deleted after 90 days) |

**Admin dashboard — `/admin`:** sign in with `ADMIN_USERNAME` / `ADMIN_PASSWORD` from `.env` (10+ characters; session lasts 12 hours).
- **Live** updates with no refresh (green dot), optional sound for new bookings/payments.
- **Bookings:** filters, search, Call/WhatsApp/map links, change status (customers see it on My Bookings).
- **Therapists** and **Offers:** edit what the website shows (see above).
- **Analytics:** 7/30/90-day tiles and charts, each with a Table view.
- **Customers**, **Subscribers** (copy all emails) and **Activity**.

### MongoDB Atlas
1. Atlas → **Security → Network Access**: add your IP (and later your hosting server's).
2. In `.env`, set `MONGODB_URI` to your connection string with the password filled in (no `< >`), keeping `/apkaspa` after `.mongodb.net`.
3. `node server.js` should say `MongoDB: connected (database "apkaspa")`.

If your network's DNS can't look up `mongodb+srv://` addresses (`querySrv ECONNREFUSED`), the server retries with public DNS (8.8.8.8 / 1.1.1.1) automatically; change them with `DNS_SERVERS` in `.env`.

## Deploying to Vercel

The project is ready for Vercel: the website and admin are served as static files from `dist/`, and every `/api/…`
request runs `api/index.js` (the same code as `server.js`) as a serverless function. Settings are in `vercel.json`;
`.vercelignore` keeps `.env`, `data/` and `_old_static/` from ever being uploaded.

1. **Atlas → Security → Network Access → Add IP Address → Allow access from anywhere (`0.0.0.0/0`).**
   Vercel has no fixed IP addresses. Your database is then protected only by its password, so use a long, unique one.
2. **Make a session secret** (keeps customers logged in):
   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
3. **Deploy** with the Vercel CLI from this folder:
   ```
   npx vercel login
   npx vercel            # first time: creates the project (accept the detected settings)
   ```
   or push the folder to GitHub and use **Vercel → Add New → Project → Import**.
4. **Vercel → Project → Settings → Environment Variables** (Production): `MONGODB_URI`, `ADMIN_USERNAME`,
   `ADMIN_PASSWORD`, `SESSION_SECRET`, and for payments `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`, `CASHFREE_ENV`
   (plus `NODEJS_HELPERS=0` for the payment webhook).
5. Deploy to production: `npx vercel --prod` (or push to GitHub again).

How it behaves on Vercel:
- **Live admin updates** use MongoDB change streams (Atlas supports them). Each live connection lasts ~55 s, then the
  browser reconnects and reloads, so nothing is missed.
- **Login rate limits** (5 wrong passwords) are counted per server copy, so they're a little looser on Vercel.
- Vercel's free **Hobby** plan is for non-commercial use; a business site needs the **Pro** plan.

## Hosting it online (any Node.js host)
Use a host that runs Node.js (Render, Railway, a VPS) with HTTPS:
1. `npm install` → `npm run build` → `node server.js` (or `npm start`).
2. Set the values from `.env` as environment variables there, including a `SESSION_SECRET`.
3. Use MongoDB Atlas for the database, and back it up regularly.
