# Backend (Node.js + MongoDB)

Everything that runs on the server lives in this folder. It serves both the **website** and the **admin dashboard**.

| File | What it does |
|---|---|
| `server.js` | The server: serves the built site (`dist/`) and every `/api/…` address listed below |
| `db.js` | Connects to MongoDB (Atlas or local), creates indexes, imports old JSON data once |

Run it from the project folder:

```
npm start            # same as: node backend/server.js  → http://localhost:5500  (admin: /admin)
```

Settings come from the `.env` file in the **project folder** (one level up). On Vercel they come from
Settings → Environment Variables, and `api/index.js` (Vercel needs it in that place) simply loads `backend/server.js`.

## Website API (used by `src/website/`)

| Address | What it does |
|---|---|
| `GET /api/config` | Which payment gateway is on (Cashfree / Razorpay) |
| `GET /api/catalog` | Therapists, prices, offers and contact details to show (edited in the admin) |
| `GET /api/locate?lat=&lon=` | Turns the customer's location into a city name (OpenStreetMap; coordinates not stored) |
| `POST /api/signup`, `/api/login`, `/api/logout`, `GET /api/me` | Customer accounts (scrypt-hashed passwords, 30-day login cookie, 5 wrong tries = 15 min lock); saves the detected city |
| `POST /api/subscribe` | Newsletter sign-up |
| `POST /api/create-order` | **Pay button**: prices the booking on the server (Pay Online = treatment + ₹149 visiting charge), saves it as *Awaiting payment*, creates the Cashfree order |
| `POST /api/cashfree-verify` | After paying: asks Cashfree if the order is really paid (right amount), then marks it **Paid** |
| `POST /api/cashfree-webhook` | Cashfree tells the server about payments directly (signature checked) |
| `GET /api/notifications` | Logged-in customer's *Payment pending* reminders |
| `POST /api/resume-payment` | *Pay now* from a reminder – reopens Cashfree for the same booking |
| `POST /api/my-bookings` | My Bookings page (this device + this account) |
| `POST /api/booking-request` | Older WhatsApp-style request (no longer used by the Pay button) |
| `POST /api/verify-payment`, `/api/razorpay-webhook` | Same as above for Razorpay, if you use it instead |
| `GET /api/health` | Shows which settings are present (yes/no only) and if the database is connected |

## Admin API (used by `src/admin/`) – all need the admin login

| Address | What it does |
|---|---|
| `POST /api/admin/login`, `/api/admin/logout`, `GET /api/admin/me` | Admin sign-in (12-hour cookie, rate-limited) |
| `GET /api/admin/stream` | **Live updates** (Server-Sent Events; MongoDB change streams on Atlas/Vercel) |
| `GET /api/admin/summary` | The stat tiles |
| `GET /api/admin/bookings` | Bookings list with filter/search |
| `PATCH /api/admin/bookings/:id` | Change a booking's status (customer sees it on My Bookings) |
| `GET /api/admin/analytics?days=` | Data for the charts |
| `GET` / `PUT /api/admin/catalog` | Therapists, offers & contact details editor (Drive photo links converted, numbers/emails cleaned, everything validated) |
| `GET /api/admin/customers`, `/api/admin/subscribers`, `/api/admin/events` | Customers, newsletter list, activity feed |

## Where things are in `server.js`

Search for these headings in the file:

- `Catalog: therapists, offers & prices` – reading/saving the catalog, Drive photo links, validation
- `Cashfree API` / `Razorpay API` – payment gateway calls, `markPaid`, `confirmCashfree`
- `Live updates for the admin dashboard` – activity log + live stream
- `Routes` – every address above, website first, then `===== Admin =====`

## Database (MongoDB, database `apkaspa`)

`users`, `bookings`, `subscribers`, `events` (activity, auto-deleted after 90 days), `settings` (document `catalog`).
