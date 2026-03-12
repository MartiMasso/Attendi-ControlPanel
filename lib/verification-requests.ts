import type { VerificationRequestDecision, VerificationRequestPayload, VerificationStatus } from "@/types";

export type VerificationSourceFilter = "all" | "settings_upgrade" | "settings_verified_update" | "register" | "other";

export interface ParsedVerificationPayload {
  source: string;
  source_bucket: Exclude<VerificationSourceFilter, "all">;
  request_kind: string | null;
  category: string | null;
  address: {
    street: string | null;
    street_number: string | null;
    postal_code: string | null;
    city: string | null;
  };
  opening_hours: {
    mon_fri: string | null;
    saturday: string | null;
    sunday: string | null;
  };
  contact: {
    phone: string | null;
  };
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function toOptionalText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function normalizeVerificationSource(value: unknown): string {
  return (toOptionalText(value) ?? "").toLowerCase();
}

export function mapVerificationSourceBucket(source: string): Exclude<VerificationSourceFilter, "all"> {
  if (source === "settings_upgrade") {
    return "settings_upgrade";
  }

  if (source === "settings_verified_update") {
    return "settings_verified_update";
  }

  if (source === "register") {
    return "register";
  }

  return "other";
}

export function matchesVerificationSourceFilter(source: string, filter: VerificationSourceFilter): boolean {
  if (filter === "all") {
    return true;
  }

  if (filter === "other") {
    return mapVerificationSourceBucket(source) === "other";
  }

  return source === filter;
}

export function parseVerificationPayload(payload: unknown): ParsedVerificationPayload {
  const root = toRecord(payload);
  const address = toRecord(root?.address);
  const openingHours = toRecord(root?.opening_hours);
  const contact = toRecord(root?.contact);
  const source = normalizeVerificationSource(root?.source);

  return {
    source,
    source_bucket: mapVerificationSourceBucket(source),
    request_kind: toOptionalText(root?.request_kind),
    category: toOptionalText(root?.category),
    address: {
      street: toOptionalText(address?.street),
      street_number: toOptionalText(address?.street_number),
      postal_code: toOptionalText(address?.postal_code),
      city: toOptionalText(address?.city)
    },
    opening_hours: {
      mon_fri: toOptionalText(openingHours?.mon_fri),
      saturday: toOptionalText(openingHours?.saturday),
      sunday: toOptionalText(openingHours?.sunday)
    },
    contact: {
      phone: toOptionalText(contact?.phone)
    }
  };
}

export function isRealPendingVerificationRequest(status: unknown, payload: VerificationRequestPayload | Record<string, unknown> | null) {
  return String(status ?? "").toLowerCase() === "pending" && parseVerificationPayload(payload).source !== "register";
}

export function deriveEffectiveVerificationStatus(profileVerificationStatus: unknown, hasRealPendingVerificationRequest: boolean): VerificationStatus {
  const normalized = String(profileVerificationStatus ?? "").toLowerCase();

  if (normalized !== "pending") {
    return (profileVerificationStatus as VerificationStatus) || "not_required";
  }

  return hasRealPendingVerificationRequest ? "pending" : "not_started";
}

export function mapVerificationDecisionToStatus(decision: VerificationRequestDecision): VerificationStatus {
  if (decision === "approve") {
    return "approved";
  }

  if (decision === "reject") {
    return "rejected";
  }

  return "needs_changes";
}

export function getRequestLastActivityDate(lastSubmittedAt?: string | null, updatedAt?: string | null, submittedAt?: string | null) {
  return lastSubmittedAt ?? updatedAt ?? submittedAt ?? null;
}
