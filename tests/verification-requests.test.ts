import assert from "node:assert/strict";
import test from "node:test";

import {
  deriveEffectiveVerificationStatus,
  isRealPendingVerificationRequest,
  mapVerificationDecisionToStatus,
  parseVerificationPayload
} from "../lib/verification-requests";

test("parseVerificationPayload parses nested payload safely", () => {
  const parsed = parseVerificationPayload({
    source: "Settings_Upgrade",
    request_kind: "upgrade_account",
    category: "nautical",
    address: {
      street: "Main Street",
      street_number: "10",
      postal_code: "08001",
      city: "Barcelona"
    },
    opening_hours: {
      mon_fri: "09:00-19:00",
      saturday: "10:00-14:00",
      sunday: "closed"
    },
    contact: {
      phone: "+34111222333"
    }
  });

  assert.equal(parsed.source, "settings_upgrade");
  assert.equal(parsed.request_kind, "upgrade_account");
  assert.equal(parsed.address.city, "Barcelona");
  assert.equal(parsed.opening_hours.sunday, "closed");
  assert.equal(parsed.contact.phone, "+34111222333");
});

test("parseVerificationPayload tolerates null and partial payload", () => {
  const parsed = parseVerificationPayload({
    source: null,
    address: "invalid",
    opening_hours: {
      saturday: "11:00-13:00"
    }
  });

  assert.equal(parsed.source, "");
  assert.equal(parsed.request_kind, null);
  assert.equal(parsed.address.street, null);
  assert.equal(parsed.opening_hours.saturday, "11:00-13:00");
  assert.equal(parsed.contact.phone, null);
});

test("isRealPendingVerificationRequest filters legacy register pending requests", () => {
  assert.equal(isRealPendingVerificationRequest("pending", { source: "register" }), false);
  assert.equal(isRealPendingVerificationRequest("pending", { source: "settings_upgrade" }), true);
  assert.equal(isRealPendingVerificationRequest("pending", {}), true);
  assert.equal(isRealPendingVerificationRequest("approved", { source: "settings_upgrade" }), false);
});

test("mapVerificationDecisionToStatus maps admin transitions", () => {
  assert.equal(mapVerificationDecisionToStatus("approve"), "approved");
  assert.equal(mapVerificationDecisionToStatus("reject"), "rejected");
  assert.equal(mapVerificationDecisionToStatus("needs_changes"), "needs_changes");
});

test("deriveEffectiveVerificationStatus avoids fake pending defaults", () => {
  assert.equal(deriveEffectiveVerificationStatus("pending", false), "not_started");
  assert.equal(deriveEffectiveVerificationStatus("pending", true), "pending");
  assert.equal(deriveEffectiveVerificationStatus("approved", false), "approved");
});
