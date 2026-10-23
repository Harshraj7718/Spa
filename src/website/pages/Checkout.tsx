import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Photo } from '../components/Photo';
import { MapPicker, type LatLng } from '../components/MapPicker';
import { api, ApiError, type CashfreeMode, type RazorpayResponse } from '../lib/api';
import { loadRazorpay } from '../lib/razorpay';
import { loadCashfree } from '../lib/cashfree';
import { copyText, useBodyClass, useEscape, useTitle } from '../lib/hooks';
import { favourite, getDeviceId, savedOffer } from '../lib/storage';
import { hourLabel, longDate, rupee, shortDate, toISODate } from '../lib/format';
import type { BookingDetails, PayMethod } from '../lib/types';
import { photoLabel, photoUrl, type Therapist } from '../../../shared/catalog';
import { useCatalog } from '../lib/catalog';
import '../../styles/book.css';
import '../../styles/therapist.css';

// ---- Settings you may want to change ----
const OPEN_HOUR = 10;  // first slot 10 AM
const CLOSE_HOUR = 21; // last slot 9 PM (service ends 10 PM)
const FLOORS = ['Ground Floor', '1st Floor', '2nd Floor', '3rd Floor', '4th Floor', '5th Floor+'];

type Stay = 'Home Stay' | 'Hotel Stay';
type Errors = Partial<Record<'time' | 'address' | 'mobile' | 'name', boolean>>;
interface Sheet { bookingId: string; paymentId: string }

function firstDay() {
  const d = new Date();
  if (d.getHours() + 1 > CLOSE_HOUR) d.setDate(d.getDate() + 1); // no slots left today
  return toISODate(d);
}

export default function Checkout() {
  useBodyClass('book-page checkout-page');
  const params = useParams();
  const { getTherapist, ready } = useCatalog();
  const t = getTherapist(params.type || 'basic', params.id || '0');
  if (!t) {
    return ready ? (
      <main className="container" style={{ padding: '80px 16px', textAlign: 'center' }}>
        <h1 style={{ color: 'var(--ink)', fontSize: 26 }}>Therapist not available</h1>
        <p style={{ margin: '10px 0 20px' }}>This therapist isn't taking bookings right now. Please choose another one.</p>
        <Link to="/book-now" className="btn btn-primary">Choose a therapist</Link>
      </main>
    ) : null;
  }
  return <CheckoutPage key={`${t.type}/${t.id}`} t={t} />;
}

function CheckoutPage({ t }: { t: Therapist }) {
  const { BUSINESS_WHATSAPP, VISIT_CHARGE, discountFor } = useCatalog();
  useTitle(`Book ${t.name} – APKASPA`);

  // ---- Form state ----
  const [stay, setStay] = useState<Stay>('Home Stay');
  const [date, setDate] = useState(firstDay);
  const [time, setTime] = useState('');
  const [address, setAddress] = useState('');
  const [landmark, setLandmark] = useState('');
  const [mobile, setMobile] = useState('');
  const [name, setName] = useState('');
  const [flat, setFlat] = useState('');
  const [floor, setFloor] = useState('');
  const [pin, setPin] = useState<LatLng | null>(null);
  const [pinZoom, setPinZoom] = useState<number | undefined>();
  const [codeInput, setCodeInput] = useState('');
  const [code, setCode] = useState('');
  const [discount, setDiscount] = useState(0);
  const [codeMsg, setCodeMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [pay, setPay] = useState<PayMethod | ''>('');
  const [errors, setErrors] = useState<Errors>({});
  const [locating, setLocating] = useState(false);
  const [paying, setPaying] = useState(false);
  const [gateway, setGateway] = useState<{ provider: 'cashfree' | 'razorpay' | null; mode: CashfreeMode }>({ provider: null, mode: 'sandbox' });
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [fav, setFav] = useState(() => favourite.has(`${t.type}:${t.name}`));
  const [aboutOpen, setAboutOpen] = useState(false);
  const [aboutLong, setAboutLong] = useState(true);
  const [bannerOk, setBannerOk] = useState(true);
  const aboutRef = useRef<HTMLParagraphElement>(null);
  const slotsRef = useRef<HTMLDivElement>(null);
  const payRef = useRef<HTMLLabelElement>(null);
  const fieldRefs = { address: useRef<HTMLInputElement>(null), mobile: useRef<HTMLInputElement>(null), name: useRef<HTMLInputElement>(null) };

  const treatment = Math.max(t.price - discount, 0);
  const hotel = stay === 'Hotel Stay';
  const gatewayName = gateway.provider === 'razorpay' ? 'Razorpay' : 'Cashfree (UPI, cards, netbanking)';

  // Customer pressed Back on Cashfree's page: the browser may restore this page as it was, so re-enable Pay
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => { if (e.persisted) setPaying(false); };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, []);
  useEffect(() => {
    api.config().then((c) => setGateway({ provider: c.provider || (c.razorpay ? 'razorpay' : null), mode: c.cashfreeMode || 'sandbox' })).catch(() => {});
  }, []);
  useLayoutEffect(() => { const p = aboutRef.current; if (p) setAboutLong(p.scrollHeight > p.clientHeight + 2); }, [t.about]);

  // ---- Offer codes ----
  const applyCode = useCallback((raw: string) => {
    const c = raw.trim().toUpperCase();
    if (!c) return;
    const off = discountFor(c, t.price);
    if (off > 0) { setCode(c); setDiscount(off); setCodeMsg({ text: `Code applied – ₹${off} off!`, ok: true }); }
    else { setCode(''); setDiscount(0); setCodeMsg({ text: 'This code is not valid.', ok: false }); }
  }, [t.price]);
  // Auto-apply an offer picked on the Offers page
  useEffect(() => {
    const saved = savedOffer.get();
    if (saved && discountFor(saved, t.price) > 0) { setCodeInput(saved); applyCode(saved); }
  }, [t.price, applyCode]);

  // ---- Time slots (need at least 1 hour notice today) ----
  const slots = useMemo(() => {
    const now = new Date();
    const isToday = date === toISODate(now);
    const list = [];
    for (let h = OPEN_HOUR; h <= CLOSE_HOUR; h++) list.push({ label: hourLabel(h), disabled: isToday && h <= now.getHours() + 1 });
    return list;
  }, [date]);
  const minDate = toISODate(new Date());
  const maxDate = toISODate(new Date(Date.now() + 30 * 864e5));

  // ---- Use Location ----
  const locateMe = () => {
    if (!navigator.geolocation) { alert('Location is not supported on this device.'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const ll: LatLng = [pos.coords.latitude, pos.coords.longitude];
      setPin(ll); setPinZoom(17);
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${ll[0]}&lon=${ll[1]}`);
        const j = await r.json();
        if (j.display_name) { setAddress(j.display_name); setErrors((e) => ({ ...e, address: false })); }
      } catch { /* the pin is enough */ }
      setLocating(false);
    }, () => {
      setLocating(false);
      alert('Could not get your location. Please allow location access or type your address.');
    }, { enableHighAccuracy: true, timeout: 10000 });
  };

  // ---- Booking details sent to the server ----
  const details = (): BookingDetails => ({
    type: t.type, id: t.id, pay, code, deviceId: getDeviceId(),
    customer: {
      name: name.trim(), mobile: mobile.trim(), stay, date, time, address: address.trim(), flat: flat.trim(), floor,
      landmark: landmark.trim(), pin: pin ? `${pin[0].toFixed(6)},${pin[1].toFixed(6)}` : '',
    },
  });

  const validate = () => {
    const e: Errors = {
      time: !time,
      address: address.trim().length < 5,
      mobile: !/^[6-9]\d{9}$/.test(mobile),
      name: name.trim().length < 2,
    };
    setErrors(e);
    const first = e.time ? slotsRef.current : e.address ? fieldRefs.address.current : e.mobile ? fieldRefs.mobile.current
      : e.name ? fieldRefs.name.current : !pay ? payRef.current : null;
    first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return !first;
  };

  // ---- Summary rows (sheet + WhatsApp message) ----
  const rows = (): [string, string][] => {
    const r: [string, string][] = [
      ['Therapist', `${t.name} (${t.speciality})`],
      ['Service', stay],
      ['Date & Time', `${longDate(date)}, ${time}`],
      ['Name', name.trim()],
      ['Mobile', '+91 ' + mobile],
      ['Address', [flat.trim(), floor, address.trim()].filter(Boolean).join(', ')],
    ];
    if (landmark.trim()) r.push(['Landmark', landmark.trim()]);
    if (pin) r.push(['Map pin', `https://maps.google.com/?q=${pin[0].toFixed(6)},${pin[1].toFixed(6)}`]);
    if (code) r.push(['Offer code', `${code} (−${rupee(discount)})`]);
    if (pay === 'online') r.push(['Payment', 'Pay Online'], ['Total', rupee(treatment)]);
    else r.push(['Payment', 'Cash on Delivery'], ['Pay now (visiting)', rupee(VISIT_CHARGE)], ['Cash after service', rupee(treatment)]);
    return r;
  };
  const waLink = (prefix: string) => {
    const msg = `${prefix} – APKASPA\n\n` + rows().map(([k, v]) => `${k}: ${v}`).join('\n');
    return `https://wa.me/${BUSINESS_WHATSAPP}?text=${encodeURIComponent(msg)}`;
  };

  // ---- Pay: always through the payment gateway ----
  const PAY_DOWN = 'Online payment is not available right now. Please try again in a minute.';
  const startPayment = async () => {
    setPaying(true);
    const d = details();
    let opened = false; // once Razorpay's window is open (or we're leaving for Cashfree), the button is reset elsewhere
    try {
      // Tapped before the page knew which gateway to use: ask the server now
      let gw = gateway;
      if (!gw.provider) {
        const c = await api.config();
        gw = { provider: c.provider || (c.razorpay ? 'razorpay' : null), mode: c.cashfreeMode || 'sandbox' };
        setGateway(gw);
      }
      if (!gw.provider) { alert('Online payment is not set up on this website yet. Please try again later.'); return; }
      if (gw.provider === 'cashfree') {
        const cf = await loadCashfree(gw.mode);
        if (!cf) { alert('Could not open the payment page. Please check your internet connection and try again.'); return; }
        const order = await api.createOrder(d);
        if (order.provider !== 'cashfree') throw new ApiError('Please refresh the page and try again.', 409);
        // Opens Cashfree's secure payment page; afterwards Cashfree sends the customer to /payment-return
        const result = await cf.checkout({ paymentSessionId: order.paymentSessionId, redirectTarget: '_self' });
        if (result?.error) alert('Payment could not start: ' + (result.error.message || 'please try again.'));
        else opened = true; // leaving for Cashfree – keep the button disabled
        return;
      }
      if (!(await loadRazorpay()) || !window.Razorpay) { alert('Could not open the payment window. Please check your internet connection and try again.'); return; }
      const order = await api.createOrder(d);
      if (order.provider !== 'razorpay') throw new ApiError('Please refresh the page and try again.', 409);
      const rzp = new window.Razorpay({
        key: order.keyId, order_id: order.orderId, amount: order.amount, currency: order.currency, name: 'APKASPA',
        description: pay === 'online' ? `${t.name} – ${t.speciality}` : `Visiting charge – ${t.name}`,
        prefill: { name: d.customer.name, contact: '+91' + d.customer.mobile },
        notes: { booking_id: order.bookingId },
        theme: { color: '#6e8240' },
        handler: (resp) => { verify(resp); },
        modal: { ondismiss: () => setPaying(false) },
      });
      rzp.on('payment.failed', (resp) => { setPaying(false); alert('Payment failed: ' + (resp.error?.description || 'please try again.')); });
      rzp.open();
      opened = true;
    } catch (err) {
      const e = err as ApiError;
      alert(e.code === 'payment_unavailable' || e.status >= 500 ? PAY_DOWN : e.message);
    } finally {
      if (!opened) setPaying(false);
    }
  };
  const verify = async (resp: RazorpayResponse) => {
    try {
      const r = await api.verifyPayment(resp);
      setSheet({ bookingId: r.bookingId, paymentId: resp.razorpay_payment_id });
    } catch {
      alert(`We received your payment (ID ${resp.razorpay_payment_id}) but could not confirm it automatically. Please share this ID with us on WhatsApp.`);
    } finally {
      setPaying(false);
    }
  };
  const onPay = () => {
    if (!validate() || !pay) return;
    startPayment();
  };

  const closeSheet = useCallback(() => setSheet(null), []);
  useEscape(sheet !== null, closeSheet);
  useEffect(() => { document.body.style.overflow = sheet ? 'hidden' : ''; return () => { document.body.style.overflow = ''; }; }, [sheet]);

  const share = async () => {
    const url = location.href;
    if (navigator.share) { try { await navigator.share({ title: `Book ${t.name} – APKASPA`, url }); } catch { /* cancelled */ } return; }
    if (await copyText(url, 'Copy this link to share:')) alert('Link copied!');
  };
  const toggleFav = () => { setFav((f) => { favourite.set(`${t.type}:${t.name}`, !f); return !f; }); };

  // ---- Sticky bar text ----
  const when = time ? `${time} · ${shortDate(date)}` : 'Select a time';

  return (
    <>
      <main className="book-wrap">
        <div className="book-top">
          <Link to={`/book-now#${t.type}`} className="circle-btn" aria-label="Back"><Icon name="arrowLeft" /></Link>
          <div className="top-right">
            <button className={`circle-btn ${fav ? 'on' : ''}`} id="favBtn" aria-label="Add to favourites" aria-pressed={fav} onClick={toggleFav}><Icon name="heart" /></button>
            <Link to="/#contact" className="circle-btn ring" aria-label="Help"><Icon name="help" /></Link>
            <button className="circle-btn" aria-label="Share" onClick={share}><Icon name="share" /></button>
          </div>
        </div>

        {/* Therapist profile */}
        <section className="card profile-card">
          <div className="profile-head">
            <Photo src={photoUrl(t.photo)} alt={t.name} className="p-photo" label={photoLabel(t.photo)}>
              <span className="online-dot" />
            </Photo>
            <div className="p-info">
              <h1>{t.name}</h1>
              <p className="p-role">{t.speciality} Therapist</p>
              <p className="p-rating"><i>★</i> <b>{t.rating}</b> <span>({t.reviews} reviews)</span></p>
              <div className="p-meta">
                <div><small><Icon name="award" />Experience</small><b>{t.experience}</b></div>
                <div><small><Icon name="sparkle" />Specializes in</small><b>{t.specializes}</b></div>
                <div><small><Icon name="languages" />Languages</small><b>{t.languages}</b></div>
              </div>
            </div>
          </div>
          <div className="about">
            <h3>About {t.name}</h3>
            <p ref={aboutRef} className={aboutOpen ? '' : 'clamp'}>{t.about}</p>
            {aboutLong && <button className="read-more" type="button" onClick={() => setAboutOpen((o) => !o)}>{aboutOpen ? 'Show less' : 'Read more'}</button>}
          </div>
        </section>

        <form noValidate onSubmit={(e) => e.preventDefault()}>
          {/* 1. Service, Date & Time */}
          <section className="card step">
            <h2 className="step-title"><span>1</span>Service, Date &amp; Time</h2>
            <div className="stay-tabs">
              {(['Home Stay', 'Hotel Stay'] as Stay[]).map((s) => (
                <button key={s} type="button" className={`type-tab ${stay === s ? 'active' : ''}`} onClick={() => setStay(s)}>
                  <Icon name={s === 'Home Stay' ? 'homeDoor' : 'hotel'} />
                  <b>{s}</b><small>{s === 'Home Stay' ? 'We come to your home' : 'Service at your hotel'}</small>
                </button>
              ))}
            </div>

            <div className="time-head">
              <label className="lbl-icon" htmlFor="date"><Icon name="clock" />Preferred Time <em>*</em></label>
              <label className="date-pill">
                <Icon name="calendar" />
                <input type="date" id="date" required aria-label="Date" value={date} min={minDate} max={maxDate}
                  onChange={(e) => { setDate(e.target.value); setTime(''); }} />
              </label>
            </div>

            {/* PHOTO (optional notice banner, e.g. holiday closure): public/assets/images/notice-banner.jpg */}
            {bannerOk && <img src="/assets/images/notice-banner.jpg" alt="" className="notice-banner" onError={() => setBannerOk(false)} />}

            <div className="slots" ref={slotsRef}>
              {slots.every((s) => s.disabled)
                ? <p className="slots-empty">No slots left for this day. Please pick another date.</p>
                : slots.map((s) => (
                  <button key={s.label} type="button" className={`slot ${time === s.label ? 'on' : ''}`} disabled={s.disabled}
                    onClick={() => { setTime(s.label); setErrors((e) => ({ ...e, time: false })); }}>{s.label}</button>
                ))}
            </div>
            <p className={`field-error ${errors.time ? 'show' : ''}`}>Please choose a time slot.</p>
          </section>

          {/* 2. Address & Contact */}
          <section className="card step">
            <h2 className="step-title"><span>2</span>Address &amp; Contact</h2>
            <label className="lbl" htmlFor="address">{hotel ? 'Hotel Name & Address' : 'Full Address'}</label>
            <div className="row-2 addr-row">
              <input ref={fieldRefs.address} className={`inp ${errors.address ? 'err' : ''}`} id="address" required autoComplete="street-address"
                placeholder={hotel ? 'Hotel name, area...' : 'Apartment, street...'} value={address}
                onChange={(e) => { setAddress(e.target.value); setErrors((x) => ({ ...x, address: false })); }} />
              <button type="button" className={`outline-btn ${locating ? 'loading' : ''}`} onClick={locateMe}>
                <Icon name="pin" /><span>{locating ? 'Locating...' : 'Use Location'}</span>
              </button>
            </div>
            <p className={`field-error ${errors.address ? 'show' : ''}`}>Please enter your address.</p>

            <label className="lbl">Exact Location (Optional, but helps the therapist find you)</label>
            <MapPicker pin={pin} zoom={pinZoom} onPick={(ll) => { setPin(ll); setPinZoom(undefined); }} />
            <p className={`hint ${pin ? 'ok' : ''}`}>{pin ? `Pin dropped at ${pin[0].toFixed(5)}, ${pin[1].toFixed(5)}` : 'Tap the map to drop a pin at the exact spot'}</p>

            <label className="lbl" htmlFor="landmark">Landmark (Optional)</label>
            <input className="inp" id="landmark" value={landmark} onChange={(e) => setLandmark(e.target.value)} />

            <div className="row-2">
              <div>
                <label className="lbl" htmlFor="mobile">Mobile Number</label>
                <input ref={fieldRefs.mobile} className={`inp ${errors.mobile ? 'err' : ''}`} id="mobile" type="tel" inputMode="numeric" maxLength={10}
                  required autoComplete="tel-national" value={mobile}
                  onChange={(e) => { setMobile(e.target.value.replace(/\D/g, '').slice(0, 10)); setErrors((x) => ({ ...x, mobile: false })); }} />
                <p className={`field-error ${errors.mobile ? 'show' : ''}`}>Enter a valid 10-digit number.</p>
              </div>
              <div>
                <label className="lbl" htmlFor="fullName">Full Name</label>
                <input ref={fieldRefs.name} className={`inp ${errors.name ? 'err' : ''}`} id="fullName" required autoComplete="name" value={name}
                  onChange={(e) => { setName(e.target.value); setErrors((x) => ({ ...x, name: false })); }} />
                <p className={`field-error ${errors.name ? 'show' : ''}`}>Please enter your name.</p>
              </div>
            </div>

            <div className="row-2">
              <div>
                <label className="lbl" htmlFor="flat">{hotel ? 'Room No. (Optional)' : 'Flat/House No. (Optional)'}</label>
                <input className="inp" id="flat" value={flat} onChange={(e) => setFlat(e.target.value)} />
              </div>
              <div>
                <label className="lbl" htmlFor="floor">Floor (Optional)</label>
                <select className="inp" id="floor" value={floor} onChange={(e) => setFloor(e.target.value)}>
                  <option value="">Select floor</option>
                  {FLOORS.map((f) => <option key={f}>{f}</option>)}
                </select>
              </div>
            </div>

            <label className="lbl" htmlFor="referral">Have an offer or referral code? (Optional)</label>
            <div className="row-2 addr-row">
              <input className="inp upper" id="referral" placeholder="ENTER CODE" value={codeInput} onChange={(e) => setCodeInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyCode(codeInput); } }} />
              <button type="button" className={`outline-btn muted ${codeInput.trim() ? 'ready' : ''}`} onClick={() => applyCode(codeInput)}>
                <Icon name="tag" /><span>Apply</span>
              </button>
            </div>
            {codeMsg && <p className={`hint ${codeMsg.ok ? 'ok' : 'bad'}`}>{codeMsg.text}</p>}
          </section>

          {/* 3. Payment Method */}
          <section className="card step">
            <h2 className="step-title"><span>3</span>Payment Method</h2>
            <label className="pay-opt" ref={payRef}>
              <input type="radio" name="pay" value="online" checked={pay === 'online'} onChange={() => setPay('online')} />
              <span className="pay-icon"><Icon name="card" /></span>
              <span className="pay-text">
                <b>Pay Online <em className="rec">Recommended</em></b>
                <small>Secure, instant confirmation via card, UPI or netbanking. No extra charges.</small>
              </span>
              <span className="radio" />
            </label>
            <label className="pay-opt">
              <input type="radio" name="pay" value="cod" checked={pay === 'cod'} onChange={() => setPay('cod')} />
              <span className="pay-icon"><Icon name="cash" /></span>
              <span className="pay-text">
                <b>Cash on Delivery</b>
                <small>Pay a {rupee(VISIT_CHARGE)} visiting charge online now to confirm; pay the treatment amount in cash when the therapist arrives.</small>
              </span>
              <span className="radio" />
            </label>
            <p className={`secure-note ${pay ? 'show' : ''}`}>
              <Icon name="shield" />
              <span>{pay === 'cod'
                ? `The ${rupee(VISIT_CHARGE)} visiting charge is processed securely via ${gatewayName}; the therapist collects the treatment amount in person.`
                : `Payments are processed securely via ${gatewayName}.`}</span>
            </p>
          </section>

          {/* 4. Bill Details */}
          <section className="card step">
            <h2 className="step-title"><span>4</span>Bill Details</h2>
            {!pay && <p className="hint">Choose a payment method above to see your bill.</p>}
            {pay === 'online' && <>
              <div className="bill-row"><span>Treatment Amount</span><b>{rupee(t.price)}</b></div>
              {discount > 0 && <div className="bill-row discount"><span>Offer ({code})</span><b>−{rupee(discount)}</b></div>}
              <div className="bill-row total"><span>Total Payable</span><b>{rupee(treatment)}</b></div>
            </>}
            {pay === 'cod' && <>
              <div className="bill-row"><span>Treatment Amount (Cash on Delivery)</span><b>{rupee(t.price)}</b></div>
              {discount > 0 && <div className="bill-row discount"><span>Offer ({code})</span><b>−{rupee(discount)}</b></div>}
              <div className="bill-row"><span>Visiting / Travel Charge (Pay Online Now)</span><b>{rupee(VISIT_CHARGE)}</b></div>
              <div className="bill-row total"><span>Total Payable</span><b>{rupee(treatment + VISIT_CHARGE)}</b></div>
              <p className="bill-note">Pay the {rupee(VISIT_CHARGE)} visiting charge online now to confirm your booking. The remaining {rupee(treatment)} treatment amount is paid in cash to the therapist at the time of service.</p>
              <div className="pay-now"><span><small>PAY NOW</small><b>{rupee(VISIT_CHARGE)}</b></span><span>{rupee(treatment)} + {rupee(VISIT_CHARGE)} = {rupee(treatment + VISIT_CHARGE)} total</span></div>
            </>}
          </section>
        </form>
      </main>

      {/* Sticky checkout bar */}
      <div className="checkout-bar">
        <div className="cb-left">
          {!pay && <span className="hint">Select a payment method</span>}
          {pay === 'online' && <><b>{rupee(treatment)}</b><small>{when}</small></>}
          {pay === 'cod' && <><b>{rupee(VISIT_CHARGE)}</b><small>Pay {rupee(VISIT_CHARGE)} now · {rupee(treatment)} after service</small></>}
        </div>
        <button className={`btn btn-primary cb-btn ${paying ? 'loading' : ''}`} type="button" disabled={paying} onClick={onPay}>
          {paying ? 'Please wait…' : <>{pay === 'online' ? 'Pay Online' : pay === 'cod' ? 'Pay Visiting Charge' : 'Continue'} <span>→</span></>}
        </button>
      </div>

      {/* Payment received (Razorpay window; Cashfree shows this on /payment-return) */}
      {sheet && (
        <div className="sheet-backdrop" onClick={(e) => { if (e.target === e.currentTarget) closeSheet(); }}>
          <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheetTitle">
            <button className="sheet-close" aria-label="Close" onClick={closeSheet}>×</button>
            <h3 id="sheetTitle">Booking confirmed 🎉</h3>
            <div>
              <div className="success-box"><b>Booking ID: {sheet.bookingId}</b><small>Payment ID: {sheet.paymentId}</small></div>
              {rows().map(([k, v]) => <div key={k} className="sum-row"><span>{k}</span><span>{v}</span></div>)}
            </div>
            <Link className="btn btn-primary block" to="/bookings">View my bookings <span>→</span></Link>
            <p className="hint center">
              Payment received – your booking is confirmed. Our therapist will reach you at the chosen time.{' '}
              <a href={waLink(`Paid booking ${sheet.bookingId} (payment ${sheet.paymentId})`)} target="_blank" rel="noopener">Need help? WhatsApp us</a>
            </p>
          </div>
        </div>
      )}
    </>
  );
}
