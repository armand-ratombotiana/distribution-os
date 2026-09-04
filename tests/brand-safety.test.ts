import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_FORBIDDEN_CLAIMS,
  checkClaims,
  shouldBlockContent,
  sanitizeContent,
  addCustomClaim,
  getClaimsByCategory,
  getClaimsBySeverity,
} from "../lib/brand-safety-pure";

test("DEFAULT_FORBIDDEN_CLAIMS has exactly 15 entries", () => {
  assert.equal(DEFAULT_FORBIDDEN_CLAIMS.length, 15);
});

test("each forbidden claim has a unique id", () => {
  const ids = new Set(DEFAULT_FORBIDDEN_CLAIMS.map((c) => c.id));
  assert.equal(ids.size, DEFAULT_FORBIDDEN_CLAIMS.length);
});

test("each forbidden claim has a valid severity", () => {
  const valid = new Set(["low", "medium", "high"]);
  for (const claim of DEFAULT_FORBIDDEN_CLAIMS) {
    assert.ok(
      valid.has(claim.severity),
      `${claim.id} should have a valid severity`
    );
  }
});

test("checkClaims finds the guaranteed revenue claim", () => {
  const matches = checkClaims("Get guaranteed revenue with our system!");
  assert.ok(matches.length >= 1);
  assert.equal(matches[0].claim.id, "guaranteed_revenue");
  assert.equal(matches[0].match.toLowerCase(), "guaranteed revenue");
});

test("checkClaims finds multiple matches in the same text", () => {
  const text =
    "Enjoy risk-free guaranteed revenue and an overnight success story.";
  const matches = checkClaims(text);
  assert.ok(matches.length >= 3);
  const ids = matches.map((m) => m.claim.id);
  assert.ok(ids.includes("guaranteed_revenue"));
  assert.ok(ids.includes("risk_free"));
  assert.ok(ids.includes("overnight_success"));
});

test("checkClaims returns an empty array for clean text", () => {
  const matches = checkClaims("Hello world, this is a normal product update.");
  assert.deepEqual(matches, []);
});

test("shouldBlockContent returns true for high-severity claims", () => {
  assert.equal(
    shouldBlockContent("Earn guaranteed revenue today!"),
    true
  );
});

test("shouldBlockContent returns false for clean text", () => {
  assert.equal(
    shouldBlockContent("A normal announcement about our latest release."),
    false
  );
});

test("shouldBlockContent respects the blockAtSeverity option", () => {
  const text = "Trusted by thousands of happy customers";
  // Low-severity match: should not block at default (medium) threshold.
  assert.equal(shouldBlockContent(text), false);
  // Lower the threshold to low and the same content should block.
  assert.equal(shouldBlockContent(text, { blockAtSeverity: "low" }), true);
  // Raise the threshold to high and even high-severity text blocks.
  assert.equal(
    shouldBlockContent("Guaranteed revenue!", { blockAtSeverity: "high" }),
    true
  );
});

test("sanitizeContent replaces matched phrases with the safe replacement", () => {
  const original = "Get guaranteed revenue with zero effort!";
  const sanitized = sanitizeContent(original);
  assert.ok(!/guaranteed revenue/i.test(sanitized));
  assert.ok(!/zero effort/i.test(sanitized));
  assert.ok(sanitized.length > 0);
});

test("sanitizeContent returns the original text when nothing matches", () => {
  const original = "A normal product update with no forbidden claims.";
  assert.equal(sanitizeContent(original), original);
});

test("addCustomClaim adds a new claim to the catalog", () => {
  const custom = {
    id: "custom_pyramid_scheme",
    pattern: /pyramid\s+scheme/gi,
    description: "Pyramid scheme language.",
    category: "regulatory" as const,
    severity: "high" as const,
    replacement: "tiered program",
  };
  const next = addCustomClaim(DEFAULT_FORBIDDEN_CLAIMS, custom);
  assert.equal(next.length, DEFAULT_FORBIDDEN_CLAIMS.length + 1);
  assert.ok(next.some((c) => c.id === "custom_pyramid_scheme"));
});

test("addCustomClaim replaces an existing claim with the same id", () => {
  const original = DEFAULT_FORBIDDEN_CLAIMS.find(
    (c) => c.id === "risk_free"
  )!;
  const updated = {
    ...original,
    description: "Updated description.",
    replacement: "safer",
  };
  const next = addCustomClaim(DEFAULT_FORBIDDEN_CLAIMS, updated);
  assert.equal(next.length, DEFAULT_FORBIDDEN_CLAIMS.length);
  const riskFree = next.find((c) => c.id === "risk_free")!;
  assert.equal(riskFree.description, "Updated description.");
  assert.equal(riskFree.replacement, "safer");
});

test("getClaimsByCategory filters claims by category", () => {
  const regulatory = getClaimsByCategory(
    DEFAULT_FORBIDDEN_CLAIMS,
    "regulatory"
  );
  assert.ok(regulatory.length >= 1);
  for (const claim of regulatory) {
    assert.equal(claim.category, "regulatory");
  }
  assert.ok(
    getClaimsByCategory(DEFAULT_FORBIDDEN_CLAIMS, "sensitive").length >= 1
  );
});

test("getClaimsBySeverity filters claims by severity", () => {
  const high = getClaimsBySeverity(DEFAULT_FORBIDDEN_CLAIMS, "high");
  assert.ok(high.length >= 1);
  for (const claim of high) {
    assert.equal(claim.severity, "high");
  }
  const low = getClaimsBySeverity(DEFAULT_FORBIDDEN_CLAIMS, "low");
  for (const claim of low) {
    assert.equal(claim.severity, "low");
  }
});
