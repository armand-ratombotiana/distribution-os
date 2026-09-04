/**
 * Edge-case tests for the contacts pure logic (db/contacts-pure.ts).
 *
 * Each test exercises a boundary: null email, very long name, invalid email,
 * duplicate email, consent toggle, unsubscribe terminal, etc.
 *
 * Run:  npx tsx --test tests/edge-contacts.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";

import { CONTACT_STATUSES } from "../db/schema";
import {
  CONTACT_TRANSITIONS,
  buildContactId,
  canTransition,
  isTerminal,
  parseQualificationSignals,
  summarizeForDisplay,
  validateContact,
  validateEmail,
  type ContactRow,
} from "../db/contacts-pure";

function baseRow(overrides: Partial<ContactRow> = {}): ContactRow {
  return {
    id: "contact_1",
    workspace_id: "ws_1",
    mission_id: "msn_1",
    email: "founder@example.com",
    name: "Ada Lovelace",
    company: "Analytical Engines Inc",
    role: "CEO",
    source: "outreach",
    status: "new",
    consent_given: 1,
    qualification_signals_json: '{"icp_fit":"high","company_size":50}',
    last_contacted_at: null,
    converted_at: null,
    created_at: 1_700_000_000,
    updated_at: 1_700_000_000,
    ...overrides,
  };
}

test("edge: validateContact accepts a null email (email is optional)", () => {
  const result = validateContact(baseRow({ email: null }));
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test("edge: validateContact accepts an empty-string email (treated as absent)", () => {
  // The validator only runs the email regex when email is non-empty.
  const result = validateContact(baseRow({ email: "" }));
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test("edge: validateContact rejects a name longer than 200 characters", () => {
  const long = "x".repeat(201);
  const result = validateContact(baseRow({ name: long }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("name")));
  // Boundary at 200 chars is accepted.
  const at = validateContact(baseRow({ name: "x".repeat(200) }));
  assert.equal(at.valid, true);
});

test("edge: validateEmail rejects a 255-character email (just over the 254 RFC limit)", () => {
  // 255 chars total — `x` * (255 - "@example.com".length) + "@example.com".
  const local = "x".repeat(255 - "@example.com".length);
  const email = `${local}@example.com`;
  assert.equal(email.length, 255);
  assert.equal(validateEmail(email), false);
  // Boundary at exactly 254 chars is accepted.
  const local254 = "x".repeat(254 - "@example.com".length);
  const email254 = `${local254}@example.com`;
  assert.equal(email254.length, 254);
  assert.equal(validateEmail(email254), true);
});

test("edge: validateEmail rejects malformed addresses commonly produced by form bugs", () => {
  // The simplified regex /^[^\s@]+@[^\s@]+\.[^\s@]+$/ is intentionally lenient
  // about the local-part characters — it accepts dots and many other symbols.
  // Cases it MUST still reject: missing @, missing domain, spaces, double @.
  for (const bad of [
    "plainaddress",
    "@missinglocal.com",
    "missingdomain@",
    "spaces in@example.com",
    "double@@example.com",
    "missing.comma@example,com",
  ]) {
    assert.equal(validateEmail(bad), false, `${bad} should be invalid`);
  }
  // Documented leniency: dots in the local part are accepted.
  assert.equal(validateEmail("ada.lövelace@example.com"), true);
  assert.equal(validateEmail(".leading@example.com"), true); // accepted (lenient)
});

test("edge: duplicate emails are not detected by the pure validator (caller's responsibility)", () => {
  // The pure module has no DB access; duplicate detection is the persistence
  // layer's job. Two distinct rows with the same email both pass validation.
  const a = validateContact(baseRow({ email: "dup@example.com" }));
  const b = validateContact(baseRow({ email: "dup@example.com" }));
  assert.equal(a.valid, true);
  assert.equal(b.valid, true);
});

test("edge: consent toggle — consent_given is preserved as boolean in the summary", () => {
  // consent_given=1 → true in summary
  const yesSummary = summarizeForDisplay(baseRow({ consent_given: 1 }));
  assert.equal(yesSummary.consent_given, true);
  // consent_given=0 → false in summary
  const noSummary = summarizeForDisplay(baseRow({ consent_given: 0 }));
  assert.equal(noSummary.consent_given, false);
});

test("edge: unsubscribe is terminal — no recovery path out of unsubscribed", () => {
  assert.equal(isTerminal("unsubscribed"), true);
  for (const target of CONTACT_STATUSES) {
    assert.equal(canTransition("unsubscribed", target), false);
  }
  assert.deepEqual(CONTACT_TRANSITIONS.unsubscribed, []);
});

test("edge: unsubscribed is NOT reachable from the documented transitions (only via explicit set)", () => {
  // The state machine does not list 'unsubscribed' as a target of any state.
  // It can only be set externally (e.g. by a webhook from the ESP).
  for (const from of CONTACT_STATUSES) {
    if (from === "unsubscribed") continue;
    assert.equal(
      canTransition(from, "unsubscribed"),
      false,
      `${from} → unsubscribed should not be a documented transition`,
    );
  }
});

test("edge: contacted → qualified loop-back is permitted (re-qualification)", () => {
  assert.equal(canTransition("contacted", "qualified"), true);
  // And qualified → contacted is also permitted (forward progress).
  assert.equal(canTransition("qualified", "contacted"), true);
  // The full loop new → qualified → contacted → qualified is valid.
  assert.equal(
    canTransition("new", "qualified") &&
      canTransition("qualified", "contacted") &&
      canTransition("contacted", "qualified"),
    true,
  );
});

test("edge: validateContact requires last_contacted_at when status is contacted", () => {
  const without = validateContact(baseRow({ status: "contacted", last_contacted_at: null }));
  assert.equal(without.valid, false);
  assert.ok(without.errors.some((e) => e.includes("last_contacted_at")));
  // A positive timestamp satisfies the rule.
  const withTs = validateContact(baseRow({ status: "contacted", last_contacted_at: 1_700_000_000 }));
  assert.equal(withTs.valid, true);
  // Zero or negative timestamps are rejected.
  const zero = validateContact(baseRow({ status: "contacted", last_contacted_at: 0 }));
  assert.equal(zero.valid, false);
});

test("edge: validateContact requires converted_at when status is converted (boundary)", () => {
  // Without converted_at → invalid.
  const without = validateContact(baseRow({ status: "converted", converted_at: null }));
  assert.equal(without.valid, false);
  // With converted_at=0 → invalid (must be > 0).
  const zero = validateContact(baseRow({ status: "converted", converted_at: 0 }));
  assert.equal(zero.valid, false);
  // With converted_at=1 → valid (boundary).
  const one = validateContact(baseRow({ status: "converted", converted_at: 1 }));
  assert.equal(one.valid, true);
});

test("edge: parseQualificationSignals accepts deeply-nested signal objects", () => {
  const json = JSON.stringify({
    icp_fit: "high",
    signals: {
      tech_stack: ["next", "drizzle"],
      funding: { series: "A", amount: 5_000_000 },
    },
  });
  const parsed = parseQualificationSignals(json);
  assert.equal(parsed.icp_fit, "high");
  assert.deepEqual(parsed.signals, {
    tech_stack: ["next", "drizzle"],
    funding: { series: "A", amount: 5_000_000 },
  });
  // signal_count counts top-level keys only.
  const summary = summarizeForDisplay(baseRow({ qualification_signals_json: json }));
  assert.equal(summary.signal_count, 2);
});

test("edge: summarizeForDisplay counts 0 signals when qualification_signals_json is invalid", () => {
  // Broken JSON → 0 signals, not a crash.
  const summary = summarizeForDisplay(
    baseRow({ qualification_signals_json: "{not-json" }),
  );
  assert.equal(summary.signal_count, 0);
  assert.equal(summary.qualification_signals, "redacted");
  // Arrays are also treated as 0 signals (only objects count keys).
  const arrSummary = summarizeForDisplay(
    baseRow({ qualification_signals_json: "[1,2,3]" }),
  );
  assert.equal(arrSummary.signal_count, 0);
});

test("edge: buildContactId is stable in shape across rapid successive calls (uniqueness)", () => {
  // Generate 50 ids quickly — they must all be unique and prefixed.
  const ids = new Set<string>();
  for (let i = 0; i < 50; i++) {
    const id = buildContactId();
    assert.ok(id.startsWith("contact_"));
    assert.match(id, /^[a-z0-9_]+$/);
    ids.add(id);
  }
  assert.equal(ids.size, 50);
});
