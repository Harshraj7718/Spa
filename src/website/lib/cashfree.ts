// Loads Cashfree Checkout only when it's needed (keys set on the server).
import type { CashfreeMode } from './api';

export interface CashfreeResult {
  error?: { message?: string; code?: string };
  redirect?: boolean;
  paymentDetails?: { paymentMessage?: string };
}
interface CashfreeInstance {
  checkout: (opts: { paymentSessionId: string; redirectTarget: '_self' | '_modal' | '_blank' | '_top' }) => Promise<CashfreeResult>;
}
declare global {
  interface Window { Cashfree?: (opts: { mode: CashfreeMode }) => CashfreeInstance; }
}

let loading: Promise<boolean> | null = null;
export async function loadCashfree(mode: CashfreeMode): Promise<CashfreeInstance | null> {
  if (!window.Cashfree && !loading) {
    loading = new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
      s.onload = () => resolve(Boolean(window.Cashfree));
      s.onerror = () => { loading = null; resolve(false); };
      document.head.appendChild(s);
    });
  }
  if (loading) await loading;
  return window.Cashfree ? window.Cashfree({ mode }) : null;
}
