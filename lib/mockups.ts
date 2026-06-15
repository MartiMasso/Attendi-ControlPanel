export const MOCKUP_DEFAULT_PASSWORD = "Attendi12345@";

export type MockupAccountType = "hotel" | "business";

export interface MockupAccountRow {
  id: string;
  email: string | null;
  fullName: string | null;
  username: string;
  accountType: MockupAccountType;
  businessName: string | null;
  verificationStatus: string | null;
  canPublish: boolean | null;
  companySetupComplete: boolean | null;
  isMockup: boolean;
  mockupCreatedAt: string | null;
  mockupConvertedAt: string | null;
  productCount: number;
  /** True when this mockup was created by converting a pre-existing account. */
  convertedFromExisting: boolean;
  /** Stripe account id saved before conversion, restored when reverting to normal. */
  originalStripeAccountId: string | null;
}

/** A pre-existing (non-mockup) hotel/company account that can be converted to a mockup. */
export interface ConvertibleAccountRow {
  id: string;
  fullName: string | null;
  username: string;
  accountType: MockupAccountType;
  businessName: string | null;
  email: string | null;
  stripeAccountId: string | null;
}

export interface MockupListResult {
  rows: MockupAccountRow[];
  schemaReady: boolean;
  schemaMessage?: string;
}
