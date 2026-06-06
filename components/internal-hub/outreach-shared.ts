import type {
  InternalCompanyContactRow,
  InternalCompanyListType,
  InternalCompanyNextStep,
  InternalCompanyPriority,
  InternalCompanyStatus,
  InternalHubMember
} from "@/types";

// ---------------------------------------------------------------------------
// Client-side model
// ---------------------------------------------------------------------------

export interface OutreachMember {
  id: string;
  name: string;
  initials: string;
  color: string;
}

export interface OutreachContact {
  id: string;
  listType: InternalCompanyListType;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  location: string;
  category: string;
  status: InternalCompanyStatus;
  priority: InternalCompanyPriority;
  ownerId: string;
  nextStep: InternalCompanyNextStep;
  followUpDate: string;
  lastEmailAt: string;
}

// ---------------------------------------------------------------------------
// Constants & metadata
// ---------------------------------------------------------------------------

export const COMPANY_STATUSES: InternalCompanyStatus[] = [
  "Por contactar",
  "Contactado",
  "Interesado",
  "En negociación",
  "Cerrado",
  "Descartado"
];

export const COMPANY_PRIORITIES: InternalCompanyPriority[] = ["Baja", "Media", "Alta"];

export const COMPANY_NEXT_STEPS: InternalCompanyNextStep[] = [
  "Enviar email",
  "Llamar",
  "Agendar demo",
  "Enviar propuesta",
  "Esperar respuesta",
  "Cerrar"
];

/** Statuses that still need follow-up work (not closed/discarded). */
export const ACTIVE_STATUSES: InternalCompanyStatus[] = ["Por contactar", "Contactado", "Interesado", "En negociación"];

export const statusClass: Record<InternalCompanyStatus, string> = {
  "Por contactar": "bg-slate-100 text-slate-700",
  Contactado: "bg-blue-100 text-blue-800",
  Interesado: "bg-emerald-100 text-emerald-800",
  "En negociación": "bg-amber-100 text-amber-800",
  Cerrado: "bg-green-100 text-green-800",
  Descartado: "bg-rose-100 text-rose-800"
};

export const priorityClass: Record<InternalCompanyPriority, string> = {
  Baja: "bg-slate-100 text-slate-700",
  Media: "bg-amber-100 text-amber-800",
  Alta: "bg-rose-100 text-rose-800"
};

export const priorityDotClass: Record<InternalCompanyPriority, string> = {
  Baja: "bg-emerald-500",
  Media: "bg-amber-400",
  Alta: "bg-rose-500"
};

const MEMBER_COLORS = ["#125fd6", "#1f8f52", "#d17e13", "#7c3aed", "#0891b2", "#cf3d48", "#475569"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "TM";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getTodayKey() {
  return toDateKey(new Date());
}

export function isValidDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function formatShortDate(value: string) {
  if (!isValidDateKey(value)) return "—";
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short" }).format(new Date(year, month - 1, day));
}

export function formatEmailDate(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

/** A contact is "due" when its follow-up date is today or in the past and it is still active. */
export function isDue(contact: OutreachContact, today = getTodayKey()) {
  return (
    ACTIVE_STATUSES.includes(contact.status) &&
    isValidDateKey(contact.followUpDate) &&
    contact.followUpDate <= today
  );
}

export function isOverdue(contact: OutreachContact, today = getTodayKey()) {
  return isDue(contact, today) && contact.followUpDate < today;
}

function metadataText(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" ? value : "";
}

export function contactFromRow(row: InternalCompanyContactRow): OutreachContact {
  return {
    id: row.id,
    listType: row.list_type ?? "empresa",
    companyName: row.company_name,
    contactName: metadataText(row.metadata, "contactName"),
    email: row.email,
    phone: row.phone,
    location: metadataText(row.metadata, "location"),
    category: row.category,
    status: row.status,
    priority: row.priority,
    ownerId: row.owner_member_id,
    nextStep: row.next_step,
    followUpDate: row.follow_up_date ?? "",
    lastEmailAt: metadataText(row.metadata, "lastEmailAt")
  };
}

export function membersFromRows(rows: InternalHubMember[]): OutreachMember[] {
  return rows.map((member, index) => {
    const name = member.full_name || member.username || member.user_id.slice(0, 8);
    return {
      id: member.user_id,
      name,
      initials: getInitials(name),
      color: MEMBER_COLORS[index % MEMBER_COLORS.length]
    };
  });
}

export const LIST_META: Record<InternalCompanyListType, { label: string; singular: string }> = {
  empresa: { label: "Contacto Empresas", singular: "empresa" },
  alojamiento: { label: "Contacto Alojamientos", singular: "alojamiento" }
};

// ---------------------------------------------------------------------------
// Email draft + Gmail compose
// ---------------------------------------------------------------------------

export interface EmailDraft {
  subject: string;
  body: string;
}

/** Shared outreach mailbox: all emails are sent from this Gmail account. */
export const OUTREACH_MAILBOX = "attendi.rent.app@gmail.com";

/**
 * Gmail compose URL that opens a new compose window with the fields prefilled.
 * `authuser` forces the shared outreach mailbox as the sending account.
 * Note: prefilled drafts only exist in Gmail's standalone compose window — the
 * normal inbox UI cannot be prefilled via URL.
 */
export function buildGmailComposeUrl(to: string, draft: EmailDraft) {
  const params = new URLSearchParams({
    authuser: OUTREACH_MAILBOX,
    view: "cm",
    fs: "1",
    to,
    su: draft.subject,
    body: draft.body
  });
  return `https://mail.google.com/mail/?${params.toString()}`;
}

/**
 * Opens the normal Gmail inbox filtered by this contact, so the full
 * conversation thread (and previous messages) is visible in context.
 */
export function buildGmailConversationUrl(contactEmail: string) {
  const query = contactEmail.trim();
  return `https://mail.google.com/mail/?authuser=${encodeURIComponent(OUTREACH_MAILBOX)}#search/${encodeURIComponent(query)}`;
}

// ---------------------------------------------------------------------------
// Persistence (client → API)
// ---------------------------------------------------------------------------

export async function createContactRequest(contact: OutreachContact) {
  return fetch("/api/internal/company-contacts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: contact.id,
      listType: contact.listType,
      companyName: contact.companyName,
      contactName: contact.contactName,
      email: contact.email,
      phone: contact.phone,
      location: contact.location,
      category: contact.category,
      status: contact.status,
      priority: contact.priority,
      ownerId: contact.ownerId,
      nextStep: contact.nextStep,
      followUpDate: contact.followUpDate || null
    })
  });
}

export async function patchContactRequest(id: string, patch: Partial<OutreachContact>) {
  const body: Record<string, unknown> = {};
  if (patch.listType !== undefined) body.listType = patch.listType;
  if (patch.companyName !== undefined) body.companyName = patch.companyName;
  if (patch.contactName !== undefined) body.contactName = patch.contactName;
  if (patch.email !== undefined) body.email = patch.email;
  if (patch.phone !== undefined) body.phone = patch.phone;
  if (patch.location !== undefined) body.location = patch.location;
  if (patch.category !== undefined) body.category = patch.category;
  if (patch.status !== undefined) body.status = patch.status;
  if (patch.priority !== undefined) body.priority = patch.priority;
  if (patch.ownerId !== undefined) body.ownerId = patch.ownerId;
  if (patch.nextStep !== undefined) body.nextStep = patch.nextStep;
  if (patch.followUpDate !== undefined) body.followUpDate = patch.followUpDate || null;

  return fetch(`/api/internal/company-contacts/${encodeURIComponent(id)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

export async function deleteContactRequest(id: string) {
  return fetch(`/api/internal/company-contacts/${encodeURIComponent(id)}`, { method: "DELETE" });
}
