export interface ResolvedStore {
  id: string;
  clientId: string;
  slug: string;
  domain: string | null;
  currency: string;
  notificationEmail: string | null;
  notificationPreferences: {
    newOrder?: boolean;
    returnRequested?: boolean;
    lowStock?: boolean;
    paymentFailed?: boolean;
  } | null;
  stripeAccountId: string | null;
  stripeChargesEnabled: boolean;
  stripePayoutsEnabled: boolean;
  stripeDetailsSubmitted: boolean;
  reservationTtlMinutes: number;
  fulfillmentType: "shipping" | "pickup";
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
  // Set by the client-sdk AccessGuard from token introspection. True for
  // SiteHaus first-party callers (e.g. the commerce admin), who may operate
  // across tenants via x-client-id. Merchant tokens are false.
  clientIsFirstParty: boolean;
}

declare global {
  namespace Express {
    interface Request {
      store?: ResolvedStore;
      user?: UserContext;
    }
  }
}
