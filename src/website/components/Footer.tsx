import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from './Icon';
import { useToast } from './Toast';
import { api } from '../lib/api';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const POLICIES = ['Privacy Policy', 'Terms & Conditions', 'Refund Policy', 'Disclaimer', 'Inappropriate Requests Policy'];
const TREATMENTS = ['Swedish Massage', 'Deep Tissue', 'Aromatherapy', 'Hot Stone Therapy', 'Thai Massage', 'Foot Reflexology'];

export function Footer() {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  // Newsletter → saved in MongoDB (shows up live on the admin dashboard)
  const subscribe = async (e: FormEvent) => {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) { setMsg('Please enter a valid email address.'); return; }
    setBusy(true);
    try {
      const r = await api.subscribe(email.trim());
      setMsg(r.already ? "You're already subscribed – thank you!" : 'Thanks for subscribing!');
      setEmail('');
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div>
          <div className="f-brand">
            <svg viewBox="0 0 40 24" className="f-logo" aria-hidden="true"><path d="M2 22 14 6l6 8 4-5 14 13Z" /></svg>
            <div><b>APKASPA</b><small>RELAX • REJUVENATE • RENEW</small></div>
          </div>
          <p>Premium spa experiences delivered to your home or hotel in Indore since 2016.</p>
          <a href="https://www.instagram.com/apkaspaindore" className="f-social" aria-label="Instagram"><Icon name="instagram" /></a>
        </div>
        <div>
          <h5>Quick Links</h5>
          <Link to="/">Home</Link><Link to="/#services">Services</Link><Link to="/#massages">Massages</Link>
          <Link to="/offers">Membership</Link><Link to="/#why">About</Link><Link to="/#contact">Contact</Link>
        </div>
        <div>
          <h5>Treatments</h5>
          {TREATMENTS.map((t) => <Link key={t} to="/book-now">{t}</Link>)}
        </div>
        <div>
          <h5>Contact</h5>
          <p className="f-row"><Icon name="mail" />hello@apkaspa.com</p>
          <p className="f-row"><Icon name="pin" />Vijay Nagar, Indore</p>
          <p className="f-row"><Icon name="clock" />Daily, 10 AM - 10 PM</p>
          <p className="f-small">Get wellness tips in your inbox</p>
          <form className="newsletter" onSubmit={subscribe} noValidate>
            <input type="email" placeholder="your@email.com" aria-label="Email address" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button type="submit" disabled={busy}>Join</button>
          </form>
          <p className="f-small newsletter-msg" role="status">{msg}</p>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} APKASPA. All rights reserved.</span>
        <nav>
          {POLICIES.map((p) => (
            <a key={p} href="#" onClick={(e) => { e.preventDefault(); toast(`${p} page is coming soon`); }}>
              {p === 'Terms & Conditions' ? 'Terms' : p}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
