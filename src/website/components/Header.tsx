import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Icon, type IconName } from './Icon';
import { useToast } from './Toast';
import { useAuth } from '../lib/auth';
import { useEscape } from '../lib/hooks';
import { savedCity } from '../lib/storage';

// ---- Menu items (edit links here). Legal pages with no link yet show "coming soon". ----
const MAIN: [string, string, IconName][] = [
  ['Home', '/', 'homeDoor'],
  ['Bookings', '/bookings', 'calendarDots'],
  ['Book Now', '/book-now', 'lotus'],
  ['Offers', '/offers', 'tag'],
  ['Profile', '/login', 'user'],
  ['Contact', '/#contact', 'chat'],
  ['About Us', '/#why', 'building'],
];
const LEGAL: [string, IconName][] = [
  ['Careers', 'briefcase'],
  ['Terms & Conditions', 'file'],
  ['Privacy Policy', 'shield'],
  ['Refund & Cancellation', 'undo'],
  ['Disclaimer', 'warn'],
  ['Inappropriate Requests Policy', 'shieldAlert'],
];
export const CITIES = ['Indore', 'Delhi', 'Gurgaon'];

function Lotus() {
  return (
    <svg className="brand-lotus" viewBox="0 0 40 22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 20c-3-3-4-7-4-10 0-3 2-6 4-8 2 2 4 5 4 8 0 3-1 7-4 10Z" />
      <path d="M20 20c-4-1-8-4-9-8 3 0 6 1 8 3M20 20c4-1 8-4 9-8-3 0-6 1-8 3" />
      <path d="M20 20c-5 1-11 0-15-4 3-1 7-1 10 1M20 20c5 1 11 0 15-4-3-1-7-1-10 1" />
      <path d="M2 20h11M27 20h11" />
    </svg>
  );
}

export function Header() {
  const toast = useToast();
  const { user } = useAuth();
  const [drawer, setDrawer] = useState(false);
  const [pop, setPop] = useState<'notif' | 'city' | null>(null);
  const [city, setCity] = useState(() => (CITIES.includes(savedCity.get() || '') ? savedCity.get()! : CITIES[0]));
  const [cityChosen, setCityChosen] = useState(() => CITIES.includes(savedCity.get() || ''));
  const [hidden, setHidden] = useState(false);
  const [logoOk, setLogoOk] = useState(true);
  const [avatarOk, setAvatarOk] = useState(true);
  const lastY = useRef(0);

  const closeAll = useCallback(() => { setDrawer(false); setPop(null); }, []);
  useEscape(drawer || pop !== null, closeAll);

  // Lock page scroll while the menu is open
  useEffect(() => {
    document.body.style.overflow = drawer ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawer]);

  // Close popovers on any outside click
  useEffect(() => {
    if (!pop) return;
    const h = () => setPop(null);
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, [pop]);

  // Dissolve while scrolling down, come back when scrolling up
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        if (y < 80 || drawer || pop) setHidden(false);
        else if (y > lastY.current + 4) setHidden(true);
        else if (y < lastY.current - 4) setHidden(false);
        if (Math.abs(y - lastY.current) > 4) lastY.current = y;
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [drawer, pop]);

  const togglePop = (e: MouseEvent, which: 'notif' | 'city') => {
    e.stopPropagation();
    setPop((p) => (p === which ? null : which));
  };
  const pickCity = (c: string) => {
    setCity(c); setCityChosen(true); savedCity.set(c); setPop(null);
    toast(`Showing services in ${c}`);
  };

  return (
    <>
      <header className={`topbar ${hidden ? 'hd-hidden' : ''}`} onFocus={() => setHidden(false)}>
        <div className="container topbar-inner">
          <Link to="/login" className="avatar" aria-label="Profile">
            {/* PHOTO: public/assets/images/avatar.jpg */}
            {avatarOk && <img src="/assets/images/avatar.jpg" alt="" onError={() => setAvatarOk(false)} />}
          </Link>

          <Link to="/" className="brand">
            {/* LOGO: public/assets/images/logo.png (a gold lotus is drawn until it exists) */}
            {logoOk ? <img src="/assets/images/logo.png" alt="" className="brand-icon" onError={() => setLogoOk(false)} /> : <Lotus />}
            <span>APKASPA</span>
          </Link>

          <div className="topbar-actions">
            <button className={`icon-btn ${pop === 'notif' ? 'open' : ''}`} aria-label="Notifications" aria-haspopup="dialog"
              aria-expanded={pop === 'notif'} onClick={(e) => togglePop(e, 'notif')}>
              <Icon name="bell" />
            </button>
            <button className="icon-btn" id="menuBtn" aria-label="Menu" onClick={(e) => { e.stopPropagation(); setPop(null); setDrawer(true); }}>
              <Icon name="menu" />
            </button>
            <button className={`city-pill ${pop === 'city' ? 'open' : ''}`} aria-haspopup="listbox" aria-expanded={pop === 'city'}
              onClick={(e) => togglePop(e, 'city')}>
              <Icon name="pin" /> {city} <Icon name="chevronDown" className="chev" />
            </button>
          </div>

          {pop === 'notif' && (
            <div className="hd-pop notif" role="dialog" aria-label="Notifications" onClick={(e) => e.stopPropagation()}>
              <div className="notif-head">
                <span className="notif-bell"><Icon name="bell" /></span>
                <div><b>Notifications</b><small>Booking and payment updates</small></div>
                <span className="notif-count">0 new</span>
              </div>
              <div className="notif-body">
                <div className="notif-empty">
                  <span className="notif-ring"><span><Icon name="bell" /></span></span>
                  <b>No notifications yet</b>
                  <p>{user ? 'Book a session to start receiving booking and payment updates here.' : 'Log in or book a session to start receiving updates here.'}</p>
                </div>
              </div>
              <div className="notif-foot"><Link to="/bookings" className="btn btn-dark block" onClick={() => setPop(null)}>View all bookings</Link></div>
            </div>
          )}

          {pop === 'city' && (
            <div className="hd-pop city" role="listbox" aria-label="Choose your city" onClick={(e) => e.stopPropagation()}>
              <p className="city-head">CHOOSE YOUR CITY</p>
              {CITIES.map((c) => (
                <button key={c} type="button" className={`city-opt ${c === city ? 'on' : ''}`} role="option" aria-selected={c === city} onClick={() => pickCity(c)}>
                  <span>{c}</span>{c === city && <Icon name="check" />}
                </button>
              ))}
              {!cityChosen && <p className="city-note">We couldn't place you automatically — pick the city you'd like service in.</p>}
            </div>
          )}
        </div>
      </header>

      {/* Side menu */}
      <div className={`hd-overlay ${drawer ? 'show' : ''}`} hidden={!drawer} onClick={() => setDrawer(false)} />
      <aside className={`hd-drawer ${drawer ? 'open' : ''}`} aria-label="Menu" aria-hidden={!drawer}>
        <div className="hd-drawer-head">
          <span>MENU</span>
          <button type="button" className="hd-x" aria-label="Close menu" onClick={() => setDrawer(false)}><Icon name="close" /></button>
        </div>
        <nav className="hd-main">
          {MAIN.map(([label, to, icon]) => (
            <NavLink key={label} to={to} end className={({ isActive }) => `hd-item ${isActive && label !== 'Profile' && !to.includes('#') ? 'current' : ''}`}
              onClick={() => setDrawer(false)}>
              <Icon name={icon} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <p className="hd-section">LEGAL &amp; POLICIES</p>
        <nav className="hd-legal">
          {LEGAL.map(([label, icon]) => (
            <button key={label} type="button" className="hd-item sm" onClick={() => toast(`${label} page is coming soon`)}>
              <Icon name={icon} /><span>{label}</span>
            </button>
          ))}
        </nav>
      </aside>
    </>
  );
}
