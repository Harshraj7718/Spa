// Loads Razorpay Checkout only when it's needed (keys set on the server).
import type { RazorpayResponse } from './api';

export interface RazorpayOptions {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  prefill: { name: string; contact: string };
  notes: Record<string, string>;
  theme: { color: string };
  handler: (resp: RazorpayResponse) => void;
  modal: { ondismiss: () => void };
}
interface RazorpayInstance {
  open: () => void;
  on: (event: 'payment.failed', cb: (resp: { error?: { description?: string } }) => void) => void;
}
declare global {
  interface Window { Razorpay?: new (opts: RazorpayOptions) => RazorpayInstance; }
}

let loading: Promise<boolean> | null = null;
export function loadRazorpay(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true);
  if (!loading) {
    loading = new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      s.onload = () => resolve(Boolean(window.Razorpay));
      s.onerror = () => { loading = null; resolve(false); };
      document.head.appendChild(s);
    });
  }
  return loading;
}
