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

test("CONTACT_TRANSITIONS covers every CONTACT_STATUSES value", () => {
  for (const status of CONTACT_STATUSES) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(CONTACT_TRANSITIONS, status),
      `expected transition entry for ${status}`,
    );
  }
});

test("canTransition allows new -> qualified and new -> contacted", () => {
  assert.equal(canTransition("new", "qualified"), true);
  assert.equal(canTransition("new", "contacted"), true);
  assert.equal(canTransition("new", "rejected"), true);
});

test("canTransition allows meeting -> converted/rejected and contacted -> qualified loop-back", () => {
  assert.equal(canTransition("meeting", "converted"), true);
  assert.equal(canTransition("meeting", "rejected"), true);
  assert.equal(canTransition("contacted", "qualified"), true);
  assert.equal(canTransition("contacted", "replied"), true);
  assert.equal(canTransition("contacted", "rejected"), true);
});

test("canTransition rejects converted -> anything and unknown transitions", () => {
  for (const target of CONTACT_STATUSES) {
    assert.equal(canTransition("converted", target), false);
    assert.equal(canTransition("rejected", target), false);
    assert.equal(canTransition("unsubscribed", target), false);
  }
  assert.equal(canTransition("bogus", "new"), false);
  assert.equal(canTransition("new", "bogus"), false);
});

test("isTerminal distinguishes terminal vs non-terminal statuses", () => {
  for (const terminal of ["converted", "rejected", "unsubscribed"]) {
    assert.equal(isTerminal(terminal), true, `${terminal} should be terminal`);
  }
  for (const nonTerminal of ["new", "qualified", "contacted", "replied", "meeting"]) {
    assert.equal(isTerminal(nonTerminal), false, `${nonTerminal} should not be terminal`);
  }
  assert.equal(isTerminal("bogus"), false);
});

test("validateEmail accepts valid and rejects invalid addresses", () => {
  assert.equal(validateEmail("founder@example.com"), true);
  assert.equal(validateEmail("a.b+c@sub.example.co.uk"), true);
  assert.equal(validateEmail(null), false);
  assert.equal(validateEmail(""), false);
  assert.equal(validateEmail("not-an-email"), false);
  assert.equal(validateEmail("missing@domain"), false);
  assert.equal(validateEmail("missing@.com"), false);
  assert.equal(validateEmail("x".repeat(255) + "@example.com"), false);
});

test("validateContact passes a minimal valid row", () => {
  const result = validateContact(baseRow());
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test("validateContact reports missing required fields and invalid email", () => {
  const result = validateContact({
    ...baseRow(),
    workspace_id: "",
    source: "",
    email: "nope",
    status: "bogus",
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("workspace_id is required"));
  assert.ok(result.errors.includes("source is required"));
  assert.ok(result.errors.some((e) => e.includes("email")));
  assert.ok(result.errors.some((e) => e.includes("status")));
});

test("validateContact requires converted_at when status is converted", () => {
  const result = validateContact(baseRow({ status: "converted", converted_at: null }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("converted_at")));
  const ok = validateContact(baseRow({ status: "converted", converted_at: 1_700_000_000 }));
  assert.equal(ok.valid, true);
});

test("validateContact rejects malformed qualification_signals_json", () => {
  const result = validateContact(baseRow({ qualification_signals_json: "{not json" }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("qualification_signals_json")));
  const arrayJson = validateContact(baseRow({ qualification_signals_json: "[1,2,3]" }));
  assert.equal(arrayJson.valid, false);
});

test("summarizeForDisplay redacts qualification_signals_json and counts signals", () => {
  const summary = summarizeForDisplay(baseRow({ status: "meeting" }));
  assert.equal(summary.qualification_signals, "redacted");
  assert.equal(summary.signal_count, 2);
  assert.equal(summary.consent_given, true);
  assert.equal(summary.is_terminal, false);
  const empty = summarizeForDisplay(baseRow({ qualification_signals_json: "{}" }));
  assert.equal(empty.signal_count, 0);
  const terminal = summarizeForDisplay(baseRow({ status: "converted", converted_at: 123 }));
  assert.equal(terminal.is_terminal, true);
  assert.equal(terminal.converted_at, 123);
});

test("parseQualificationSignals parses valid JSON and falls back to {}", () => {
  assert.deepEqual(parseQualificationSignals('{"a":1,"b":2}'), { a: 1, b: 2 });
  assert.deepEqual(parseQualificationSignals(null), {});
  assert.deepEqual(parseQualificationSignals(undefined), {});
  assert.deepEqual(parseQualificationSignals(""), {});
  assert.deepEqual(parseQualificationSignals("not json"), {});
  assert.deepEqual(parseQualificationSignals("[1,2,3]"), {});
  assert.deepEqual(parseQualificationSignals('"string"'), {});
  assert.deepEqual(parseQualificationSignals("123"), {});
});

test("buildContactId is unique, prefixed, url-safe and embeds a sanitized seed", () => {
  const a = buildContactId();
  const b = buildContactId();
  assert.ok(a.startsWith("contact_"));
  assert.ok(b.startsWith("contact_"));
  assert.notEqual(a, b);
  assert.match(a, /^[a-z0-9_]+$/);
  assert.ok(a.length < 80);
  const seeded = buildContactId("Analytical Engines Inc!!");
  assert.ok(seeded.includes("analytical_engines_inc"));
});
