export type AccountType = "consumer" | "business" | "hotel";

export type VerificationStatus =
  | "not_required"
  | "not_started"
  | "pending"
  | "approved"
  | "rejected"
  | "needs_changes"
  | "in_review"
  | string;

export type IncidentStatus = "open" | "in_review" | "resolved";
export type IncidentPriority = "low" | "medium" | "high";
export type PlatformFeedbackCategory = "suggestion" | "bug" | "other";
export type PlatformFeedbackStatus = "new" | "in_review" | "resolved" | "closed";
export type InternalTaskStatus = "todo" | "in_progress" | "blocked" | "done";
export type InternalTaskPriority = "low" | "medium" | "high" | "urgent";
export type InternalNoteCategory = "announcement" | "decision" | "reminder" | "resource";

export interface AdminRecord {
  id: string;
  user_id: string;
  role: string;
  permissions: Record<string, boolean> | null;
  is_active: boolean;
  created_at: string | null;
}

export interface AdminContext {
  id: string;
  email: string;
  role: string;
  permissions: Record<string, boolean> | null;
}

export interface UserRow {
  id: string;
  full_name: string | null;
  username: string;
  email: string | null;
  account_type: AccountType;
  verification_status: VerificationStatus;
  effective_verification_status?: VerificationStatus;
  has_real_pending_verification_request?: boolean;
  created_at: string | null;
  last_seen_at: string | null;
}

export interface UserDetail {
  profile: UserRow;
  businessDetails: Record<string, unknown> | null;
  hotelDetails: Record<string, unknown> | null;
  products: Array<Record<string, unknown>>;
  reservations: Array<Record<string, unknown>>;
  notes: AdminNote[];
  flags: AdminFlag[];
}

export interface VerificationRequestPayloadAddress {
  street?: string | null;
  street_number?: string | null;
  postal_code?: string | null;
  city?: string | null;
}

export interface VerificationRequestPayloadOpeningHours {
  mon_fri?: string | null;
  saturday?: string | null;
  sunday?: string | null;
}

export interface VerificationRequestPayloadContact {
  phone?: string | null;
}

export interface VerificationRequestPayload {
  source?: string | null;
  request_kind?: string | null;
  category?: string | null;
  address?: VerificationRequestPayloadAddress | null;
  opening_hours?: VerificationRequestPayloadOpeningHours | null;
  contact?: VerificationRequestPayloadContact | null;
  [key: string]: unknown;
}

export type VerificationRequestDecision = "approve" | "reject" | "needs_changes";

export interface VerificationRequestRow {
  id: string;
  user_id: string;
  user_full_name: string | null;
  user_username: string | null;
  login_email: string | null;
  current_account_type: AccountType | string | null;
  requested_account_type: "business" | "hotel";
  legal_name: string;
  tax_id: string;
  company_email: string | null;
  company_phone: string | null;
  payload: VerificationRequestPayload;
  source: string;
  request_kind: string | null;
  status: VerificationStatus;
  submitted_at: string | null;
  last_submitted_at: string | null;
  last_admin_email_sent_at: string | null;
  last_email_action: string | null;
  reminder_count: number;
  updated_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_note: string | null;
  review_notes: string | null;
  admin_notes: string | null;
  rejected_reason: string | null;
}

export interface ReservationRow {
  id: string;
  product_id: string | null;
  user_id: string | null;
  status: string | null;
  start_date: string;
  end_date: string;
  created_at: string | null;
  importe: number | null;
  payment_intent_id: string | null;
  payment_captured: boolean | null;
  user_name: string | null;
  user_email: string | null;
  product_title: string | null;
}

export interface IncidentRow {
  id: string;
  reservation_id: string | null;
  reporter_user_id: string | null;
  affected_user_id: string | null;
  title: string;
  description: string;
  status: IncidentStatus;
  priority: IncidentPriority;
  assigned_admin_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlatformFeedbackRow {
  id: string;
  created_at: string;
  user_id: string | null;
  display_name: string | null;
  email: string | null;
  category: PlatformFeedbackCategory | string;
  subject: string;
  message: string;
  source: string;
  status: PlatformFeedbackStatus | string;
  handled_by: string | null;
  handled_at: string | null;
  admin_notes: string | null;
}

export interface InternalHubMember {
  user_id: string;
  full_name: string | null;
  username: string | null;
  role: string;
}

export interface InternalTaskRow {
  id: string;
  title: string;
  description: string | null;
  status: InternalTaskStatus;
  priority: InternalTaskPriority;
  assignee_user_id: string | null;
  assignee_name: string | null;
  created_by_user_id: string;
  created_by_name: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface InternalNoteRow {
  id: string;
  title: string;
  body: string;
  category: InternalNoteCategory | string;
  pinned: boolean;
  created_by_user_id: string;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminNote {
  id: string;
  entity_type: string;
  entity_id: string;
  note: string;
  created_by_admin_id: string;
  created_at: string;
}

export interface AdminFlag {
  id: string;
  entity_type: string;
  entity_id: string;
  flag_type: string;
  severity: "low" | "medium" | "high";
  reason: string;
  is_active: boolean;
  created_by_admin_id: string;
  created_at: string;
}

export interface AuditLogRow {
  id: string;
  admin_user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface DashboardMetrics {
  totalUsers: number;
  totalBusinesses: number;
  totalHotels: number;
  totalReservations: number;
  activeReservations: number;
  pendingVerifications: number;
  openIncidents: number;
}

export interface RecentActivityItem {
  id: string;
  source: "audit" | "verification" | "reservation";
  action: string;
  entity_type: string;
  entity_id: string;
  created_at: string;
  metadata?: Record<string, unknown>;
}
