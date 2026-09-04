import assert from "node:assert/strict";
import test from "node:test";

// Integration: contacts ↔ content-assets
//
// The outreach lifecycle (contacts) and the content asset lifecycle both
// follow the same shape: a draft-style initial state, forward-only
// transitions toward a terminal "converted"/"published"/"archived" sink,
// and a parallel set of status-dependent timestamp invariants.

import {
  CONTACT_TRANSITIONS,
  buildContactId,
  canTransition as canTransitionContact,
  isTerminal as isTerminalContact,
  parseQualificationSignals,
  summarizeForDisplay as summarizeContact,
  validateContact,
  validateEmail,
  type ContactRow,
} from "../db/contacts-pure";

import {
  CONTENT_TRANSITIONS,
  buildContentId,
  canTransition as canTransitionContent,
  isTerminal as isTerminalContent,
  summarizeForDisplay as summarizeContent,
  validateContent,
  type ContentAssetRow,
} from "../db/content-assets-pure";

import { CONTACT_STATUSES, CONTENT_STATUSES } from "../db/schema";

const baseContact: ContactRow = {
  id: "contact_1",
  workspace_id: "ws_1",
  mission_id: "m_1",
  email: "founder@example.com",
  name: "Ada Lovelace",
  company: "Acme Inc.",
  role: "Founder",
  source: "manual",
  status: "new",
  consent_given: 0,
  qualification_signals_json: '{"icp":"saas","arr":500000}',
  last_contacted_at: null,
  converted_at: null,
  created_at: 1_700_000_000,
  updated_at: 1_700_000_001,
};

const baseContent: ContentAssetRow = {
  id: "content_1",
  workspace_id: "ws_1",
  mission_id: "m_1",
  action_id: null,
  platform: "linkedin",
  format: "post",
  hook: "Stop guessing your ICP.",
  body: "Here is a 3-step framework for finding your ideal customer profile.",
  cta: "Book a call",
  status: "draft",
  variant_of_id: null,
  approved_by: null,
  approved_at: null,
  scheduled_at: null,
  published_at: null,
  provider_id: null,
  created_at: 1_700_000_000,
  updated_at: 1_700_000_001,
};

test("a contact with status 'converted' requires converted_at; a content asset with status 'published' requires published_at — both modules enforce timestamp invariants", () => {
  const badContact = validateContact({
    ...baseContact,
    status: "converted",
    converted_at: null,
  });
  assert.equal(badContact.valid, false);
  assert.ok(badContact.errors.some((e) => e.includes("converted_at")));

  const badContent = validateContent({
    ...baseContent,
    status: "published",
    published_at: null,
  });
  assert.equal(badContent.valid, false);
  assert.ok(badContent.errors.some((e) => e.includes("published_at")));
});

test("contact 'new'→'qualified' and content 'draft'→'in_review' transitions are both allowed", () => {
  assert.equal(canTransitionContact("new", "qualified"), true);
  assert.equal(canTransitionContent("draft", "in_review"), true);
});

test("contact terminal states (converted/rejected/unsubscribed) and content terminal state (archived) cannot be revived", () => {
  for (const s of ["converted", "rejected", "unsubscribed"] as const) {
    assert.equal(isTerminalContact(s), true);
  }
  assert.equal(isTerminalContent("archived"), true);
  assert.equal(canTransitionContact("converted", "new"), false);
  assert.equal(canTransitionContent("archived", "draft"), false);
});

test("validateContact rejects empty workspace_id; validateContent rejects empty workspace_id and mission_id", () => {
  const badContact = validateContact({ ...baseContact, workspace_id: "" });
  assert.equal(badContact.valid, false);
  assert.ok(badContact.errors.some((e) => e.includes("workspace_id")));

  const badContent = validateContent({ ...baseContent, workspace_id: "", mission_id: "" });
  assert.equal(badContent.valid, false);
  assert.ok(badContent.errors.some((e) => e.includes("workspace_id")));
  assert.ok(badContent.errors.some((e) => e.includes("mission_id")));
});

test("validateContact requires a valid email when email is set; validateContent requires non-empty hook, body, cta", () => {
  const badEmailContact = validateContact({ ...baseContact, email: "not-an-email" });
  assert.equal(badEmailContact.valid, false);
  assert.ok(badEmailContact.errors.some((e) => e.includes("email")));

  const badHookContent = validateContent({ ...baseContent, hook: "" });
  assert.equal(badHookContent.valid, false);
  assert.ok(badHookContent.errors.some((e) => e.includes("hook")));

  const badBodyContent = validateContent({ ...baseContent, body: "" });
  assert.equal(badBodyContent.valid, false);
  assert.ok(badBodyContent.errors.some((e) => e.includes("body")));

  const badCtaContent = validateContent({ ...baseContent, cta: "" });
  assert.equal(badCtaContent.valid, false);
  assert.ok(badCtaContent.errors.some((e) => e.includes("cta")));
});

test("summarizeForDisplay for contact redacts qualification_signals while summarizeForDisplay for content shows a body preview", () => {
  const contactSummary = summarizeContact(baseContact);
  assert.equal(contactSummary.qualification_signals, "redacted");
  assert.equal(contactSummary.signal_count, 2);
  assert.equal(contactSummary.is_terminal, false);

  const contentSummary = summarizeContent(baseContent);
  assert.ok(contentSummary.preview.length > 0);
  assert.ok(contentSummary.preview.length <= 140);
  assert.equal(contentSummary.is_terminal, false);
});

test("contact 'contacted' requires last_contacted_at; content 'scheduled' requires scheduled_at — parallel invariant patterns", () => {
  const badContact = validateContact({
    ...baseContact,
    status: "contacted",
    last_contacted_at: null,
  });
  assert.equal(badContact.valid, false);
  assert.ok(badContact.errors.some((e) => e.includes("last_contacted_at")));

  const badContent = validateContent({
    ...baseContent,
    status: "scheduled",
    scheduled_at: null,
  });
  assert.equal(badContent.valid, false);
  assert.ok(badContent.errors.some((e) => e.includes("scheduled_at")));
});

test("buildContactId and buildContentId both produce URL-safe identifiers prefixed with their entity type", () => {
  const contactId = buildContactId("Acme Inc. 2024");
  assert.ok(contactId.startsWith("contact_"));
  assert.match(contactId, /^[a-z0-9_]+$/);
  assert.ok(contactId.includes("acme_inc_2024"));

  const contentId = buildContentId("Q3 Launch Post");
  assert.ok(contentId.startsWith("content_"));
  assert.match(contentId, /^[a-z0-9_]+$/);
  assert.ok(contentId.includes("q3_launch_post"));
});

test("validateContent requires approved_by and approved_at when status is 'approved'", () => {
  const badApproved = validateContent({
    ...baseContent,
    status: "approved",
    approved_by: null,
    approved_at: null,
  });
  assert.equal(badApproved.valid, false);
  assert.ok(badApproved.errors.some((e) => e.includes("approved_by")));
  assert.ok(badApproved.errors.some((e) => e.includes("approved_at")));

  const goodApproved = validateContent({
    ...baseContent,
    status: "approved",
    approved_by: "user_42",
    approved_at: 1_700_000_000,
  });
  assert.equal(goodApproved.valid, true);
});

test("validateContact and validateContent both reject status values not in their respective enums", () => {
  const badContactStatus = validateContact({ ...baseContact, status: "frozen" });
  assert.equal(badContactStatus.valid, false);
  assert.ok(badContactStatus.errors.some((e) => e.includes("status")));

  const badContentStatus = validateContent({ ...baseContent, status: "live" });
  assert.equal(badContentStatus.valid, false);
  assert.ok(badContentStatus.errors.some((e) => e.includes("status")));
});

test("parseQualificationSignals handles invalid JSON gracefully; content preview truncates long body text", () => {
  const sigs = parseQualificationSignals('{"icp":"saas"}');
  assert.deepEqual(sigs, { icp: "saas" });
  const bad = parseQualificationSignals("not-json");
  assert.deepEqual(bad, {});
  const empty = parseQualificationSignals(null);
  assert.deepEqual(empty, {});

  const longBody = "x".repeat(500);
  const longContent: ContentAssetRow = { ...baseContent, body: longBody };
  const summary = summarizeContent(longContent);
  assert.equal(summary.preview.length, 140);
  assert.ok(summary.preview.endsWith("..."));
});

test("canTransition(contact, 'meeting'→'converted') AND canTransition(content, 'approved'→'published') both represent conversion flows", () => {
  assert.equal(canTransitionContact("meeting", "converted"), true);
  assert.equal(canTransitionContent("approved", "published"), true);
});

test("validateEmail accepts valid emails and rejects malformed ones (shared email validation rule)", () => {
  assert.equal(validateEmail("founder@example.com"), true);
  assert.equal(validateEmail("a@b.co"), true);
  assert.equal(validateEmail(null), false);
  assert.equal(validateEmail("not-an-email"), false);
  assert.equal(validateEmail(""), false);
  assert.equal(validateEmail("a@b"), false);
});

test("CONTACT_STATUSES and CONTENT_STATUSES expose their full enum lists with the documented sizes", () => {
  assert.equal(CONTACT_STATUSES.length, 8);
  assert.deepEqual(
    [...CONTACT_STATUSES].sort(),
    [
      "contacted",
      "converted",
      "meeting",
      "new",
      "qualified",
      "rejected",
      "replied",
      "unsubscribed",
    ],
  );
  assert.equal(CONTENT_STATUSES.length, 7);
  assert.deepEqual(
    [...CONTENT_STATUSES].sort(),
    [
      "approved",
      "archived",
      "draft",
      "failed",
      "in_review",
      "published",
      "scheduled",
    ],
  );
});

test("CONTACT_TRANSITIONS and CONTENT_TRANSITIONS expose their transition maps with the documented shapes", () => {
  assert.deepEqual(CONTACT_TRANSITIONS.new, ["qualified", "contacted", "rejected"]);
  assert.deepEqual(CONTACT_TRANSITIONS.converted, []);
  assert.deepEqual(CONTACT_TRANSITIONS.rejected, []);
  assert.deepEqual(CONTACT_TRANSITIONS.unsubscribed, []);

  assert.deepEqual(CONTENT_TRANSITIONS.draft, ["in_review", "archived"]);
  assert.deepEqual(CONTENT_TRANSITIONS.published, ["archived"]);
  assert.deepEqual(CONTENT_TRANSITIONS.archived, []);
  assert.deepEqual(CONTENT_TRANSITIONS.failed, ["draft", "archived"]);
});
