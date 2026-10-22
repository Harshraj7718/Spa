// Typed access to shared/catalog.json (therapists, offers, prices).
// The server reads the same JSON and recalculates every price, so a customer can't change them.
import data from './catalog.json';

export type TherapistType = 'basic' | 'therapist' | 'premium';

export interface TherapistBase {
  name: string;
  rating: number;
  reviews: number;
  speciality: string;
  price: number;
  photo: string;
  experience?: string;
  specializes?: string;
  languages?: string;
  about?: string;
}
export interface Therapist extends Required<TherapistBase> {
  type: TherapistType;
  id: number;
}

export interface Offer {
  code: string;
  title: string;
  desc: string;
  kind: 'percent' | 'flat';
  value: number;
  max?: number;
  hidden?: boolean;
}

export const VISIT_CHARGE: number = data.visitCharge;
export const BUSINESS_WHATSAPP: string = data.businessWhatsapp;
export const OFFERS = data.offers as Offer[];
export const THERAPISTS = data.therapists as Record<TherapistType, TherapistBase[]>;
export const TYPES: TherapistType[] = ['basic', 'therapist', 'premium'];
export const PHOTO_DIR = '/assets/images/therapists/';

export const isTherapistType = (t: string): t is TherapistType => (TYPES as string[]).includes(t);

export function getTherapist(type: string, id: number): Therapist | null {
  if (!isTherapistType(type)) return null;
  const base = THERAPISTS[type][id];
  if (!base) return null;
  return { ...data.therapistDefaults, ...base, type, id } as Therapist;
}

/** ₹ discount for an offer code on a given price (0 if the code isn't valid). Mirrors server.js. */
export function discountFor(code: string, price: number): number {
  const offer = OFFERS.find((o) => o.code === String(code || '').trim().toUpperCase());
  if (!offer) return 0;
  let off = offer.kind === 'percent' ? Math.round((price * offer.value) / 100) : offer.value;
  if (offer.max) off = Math.min(off, offer.max);
  return Math.min(off, price);
}
