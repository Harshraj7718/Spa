// Calls to server.js. Errors carry the server's message (and optional field/code).
import type { BookingDetails, CustomerBooking, User } from './types';

export class ApiError extends Error {
  status: number;
  field?: string;
  code?: string;
  constructor(message: string, status: number, field?: string, code?: string) {
    super(message);
    this.status = status;
    this.field = field;
    this.code = code;
  }
}

async function request<T>(path: string, body?: unknown, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: body === undefined ? undefined : JSON.stringify(body),
      ...init,
    });
  } catch {
    throw new ApiError('Could not reach the server. Please check your connection.', 0);
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new ApiError(String(data.error || 'Something went wrong.'), res.status, data.field as string | undefined, data.code as string | undefined);
  }
  return data as T;
}

export const api = {
  config: () => request<{ provider: 'cashfree' | 'razorpay' | null; razorpay: boolean; keyId: string | null; cashfreeMode: CashfreeMode | null }>('/api/config'),
  me: () => request<{ user: User | null }>('/api/me'),
  login: (email: string, password: string) => request<{ user: User }>('/api/login', { email, password }),
  signup: (b: { name: string; email: string; mobile: string; password: string }) => request<{ user: User }>('/api/signup', b),
  logout: () => request<{ ok: true }>('/api/logout', {}),
  subscribe: (email: string) => request<{ ok: true; already: boolean }>('/api/subscribe', { email }),
  myBookings: (deviceId: string) => request<{ bookings: CustomerBooking[] }>('/api/my-bookings', { deviceId }),
  bookingRequest: (d: BookingDetails) => request<{ bookingId: string }>('/api/booking-request', d, { keepalive: true }),
  createOrder: (d: BookingDetails) => request<RazorpayOrder | CashfreeOrder>('/api/create-order', d),
  cashfreeVerify: (orderId: string) => request<CashfreeStatus>('/api/cashfree-verify', { orderId }),
  verifyPayment: (r: RazorpayResponse) => request<{ bookingId: string }>('/api/verify-payment', r),
};

export interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export type CashfreeMode = 'sandbox' | 'production';
export interface RazorpayOrder { provider: 'razorpay'; orderId: string; amount: number; currency: string; keyId: string; bookingId: string }
export interface CashfreeOrder { provider: 'cashfree'; orderId: string; amount: number; bookingId: string; paymentSessionId: string; mode: CashfreeMode }
export interface CashfreeStatus {
  status: 'paid' | 'pending' | 'failed';
  message: string;
  bookingId: string;
  paymentId: string;
  amount?: number;
  method?: string;
  therapist?: string;
  slot?: string;
}
