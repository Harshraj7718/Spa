import { useEffect, useRef, type ReactNode } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useSearchParams } from 'react-router-dom';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { Footer } from './components/Footer';
import { ToastProvider } from './components/Toast';
import { AuthProvider } from './lib/auth';
import { CatalogProvider } from './lib/catalog';
import Home from './pages/Home';
import BookNow from './pages/BookNow';
import Checkout from './pages/Checkout';
import Offers from './pages/Offers';
import Bookings from './pages/Bookings';
import { Login, Signup } from './pages/Auth';
import PaymentReturn from './pages/PaymentReturn';

/** Which shared parts a page shows (same as the original site). */
function Page({ header = true, footer = false, nav = true, children }: { header?: boolean; footer?: boolean; nav?: boolean; children: ReactNode }) {
  return (
    <>
      {header && <Header />}
      {children}
      {footer && <Footer />}
      {nav && <BottomNav />}
    </>
  );
}

/** Scrolls to "#section" links (e.g. /#contact), and to the top when the page changes. */
function ScrollManager() {
  const { pathname, hash } = useLocation();
  const lastPath = useRef(pathname);
  useEffect(() => {
    const target = hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
    if (target) {
      requestAnimationFrame(() => target.scrollIntoView({ behavior: lastPath.current === pathname ? 'smooth' : 'auto', block: 'start' }));
    } else if (lastPath.current !== pathname) {
      window.scrollTo(0, 0);
    }
    lastPath.current = pathname;
  }, [pathname, hash]);
  return null;
}

// ---- Old .html addresses keep working ----
function LegacyRedirect({ to }: { to: string }) {
  const { hash } = useLocation();
  const [params] = useSearchParams();
  const next = params.get('next');
  const query = next ? `?next=${encodeURIComponent('/' + next.replace(/\.html.*$/, '').replace(/^\/?(index)?$/, ''))}` : '';
  return <Navigate to={to + query + hash} replace />;
}
function LegacyTherapist() {
  const [params] = useSearchParams();
  return <Navigate to={`/therapist/${params.get('type') || 'basic'}/${Number(params.get('id') || 0)}`} replace />;
}

function NotFound() {
  return (
    <main className="container" style={{ padding: '80px 16px', textAlign: 'center' }}>
      <h1 style={{ color: 'var(--ink)', fontSize: 28 }}>Page not found</h1>
      <p style={{ margin: '10px 0 20px' }}>The page you're looking for doesn't exist.</p>
      <Link to="/" className="btn btn-primary">Go to the home page</Link>
    </main>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
      <CatalogProvider>
        <ToastProvider>
          <ScrollManager />
          <Routes>
            <Route path="/" element={<Page footer><Home /></Page>} />
            <Route path="/book-now" element={<Page header={false}><BookNow /></Page>} />
            <Route path="/therapist/:type/:id" element={<Page header={false} nav={false}><Checkout /></Page>} />
            <Route path="/offers" element={<Page><Offers /></Page>} />
            <Route path="/bookings" element={<Page><Bookings /></Page>} />
            <Route path="/login" element={<Page><Login /></Page>} />
            <Route path="/signup" element={<Page><Signup /></Page>} />
            <Route path="/payment-return" element={<Page><PaymentReturn /></Page>} />

            <Route path="/index.html" element={<LegacyRedirect to="/" />} />
            <Route path="/book-now.html" element={<LegacyRedirect to="/book-now" />} />
            <Route path="/therapist.html" element={<LegacyTherapist />} />
            <Route path="/offers.html" element={<LegacyRedirect to="/offers" />} />
            <Route path="/bookings.html" element={<LegacyRedirect to="/bookings" />} />
            <Route path="/login.html" element={<LegacyRedirect to="/login" />} />
            <Route path="/signup.html" element={<LegacyRedirect to="/signup" />} />

            <Route path="*" element={<Page><NotFound /></Page>} />
          </Routes>
        </ToastProvider>
      </CatalogProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
