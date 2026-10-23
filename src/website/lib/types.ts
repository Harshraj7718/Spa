export type BookingStatus = 'requested' | 'pending_payment' | 'paid' | 'confirmed' | 'completed' | 'cancelled';
export type PayMethod = 'online' | 'cod';

export interface User {
  name: string;
  email: string;
  mobile?: string;
}

export interface CustomerBooking {
  bookingId: string;
  createdAt: string;
  status: BookingStatus;
  source?: 'online' | 'whatsapp';
  therapist: { name?: string; speciality?: string };
  payment: {
    method?: PayMethod | '';
    paidOnline?: number;
    cashOnService?: number;
    total?: number;
    referral?: string;
    paymentId?: string;
  };
  customer: { stay?: string; date?: string; time?: string; address?: string };
}

/** What the checkout sends to the server */
export interface BookingDetails {
  type: string;
  id: string;
  pay: PayMethod | '';
  code: string;
  deviceId: string;
  customer: {
    name: string; mobile: string; stay: string; date: string; time: string;
    address: string; flat: string; floor: string; landmark: string; pin: string;
  };
}
