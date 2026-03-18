export interface ResolvedStore {
  id: string;
  clientId: string;
  slug: string;
  domain: string | null;
  currency: string;
  stripeAccountId: string | null;
  stripeChargesEnabled: boolean;
  stripePayoutsEnabled: boolean;
  stripeDetailsSubmitted: boolean;
  reservationTtlMinutes: number;
}

export interface StoreContext {
  storeId: string;
  userId?: string;
}

export interface UserContext {
  userId: string;
  clientId: string;
  email: string;
  firstName: string;
  lastName: string;
  isVerified: boolean;
  status: string;
  sessionId: string;
  permissions: string[];
}

declare global {
  namespace Express {
    interface Request {
      store?: ResolvedStore;
      user?: UserContext;
    }
  }
}
