import assert from "node:assert/strict";
import { test } from "node:test";

import {
  applyMatcher,
  defaultBucketHash,
  evaluateFlag,
  evaluateFlags,
  isEnabled,
  type FeatureFlag,
  type FlagContext,
} from "../lib/feature-flags-pure.ts";

const baseCtx: FlagContext = {
  userId: "u1",
  environment: "production",
  attributes: { region: "EU", plan: "pro", age: 30 },
};

test("evaluateFlag returns enabled=true for a simple boolean flag", () => {
  const flag: FeatureFlag = {
    key: "new-ui",
    rollout: { type: "boolean", enabled: true },
  };
  const r = evaluateFlag(flag, baseCtx);
  assert.equal(r.enabled, true);
  assert.equal(r.reason, "boolean");
});

test("evaluateFlag returns deny_list when the user is on the deny list", () => {
  const flag: FeatureFlag = {
    key: "new-ui",
    rollout: { type: "boolean", enabled: true },
    denyList: ["u1"],
  };
  const r = evaluateFlag(flag, baseCtx);
  assert.equal(r.enabled, false);
  assert.equal(r.reason, "deny_list");
});

test("evaluateFlag returns allow_list when the user is on the allow list", () => {
  const flag: FeatureFlag = {
    key: "new-ui",
    rollout: { type: "boolean", enabled: false },
    allowList: ["u1"],
  };
  const r = evaluateFlag(flag, baseCtx);
  assert.equal(r.enabled, true);
  assert.equal(r.reason, "allow_list");
});

test("evaluateFlag returns env_gate when the environment is not in the list", () => {
  const flag: FeatureFlag = {
    key: "new-ui",
    environments: ["staging"],
    rollout: { type: "boolean", enabled: true },
  };
  const r = evaluateFlag(flag, baseCtx);
  assert.equal(r.enabled, false);
  assert.equal(r.reason, "env_gate");
});

test("evaluateFlag returns matcher_fail when a matcher does not match", () => {
  const flag: FeatureFlag = {
    key: "eu-only",
    rollout: { type: "boolean", enabled: true },
    matchers: [{ attribute: "region", op: "eq", value: "EU" }],
  };
  const r = evaluateFlag(flag, {
    ...baseCtx,
    attributes: { region: "US" },
  });
  assert.equal(r.enabled, false);
  assert.equal(r.reason, "matcher_fail");
});

test("evaluateFlag uses percentage bucketing deterministically per user", () => {
  const flag: FeatureFlag = {
    key: "ab-test",
    rollout: { type: "percentage", percentage: 50 },
  };
  // Deterministic: same input → same output.
  const r1 = evaluateFlag(flag, baseCtx);
  const r2 = evaluateFlag(flag, baseCtx);
  assert.equal(r1.enabled, r2.enabled);
  assert.equal(r1.reason, "percentage");
});

test("evaluateFlag percentage respects the bucket boundary", () => {
  const flag: FeatureFlag = {
    key: "ab-test",
    rollout: { type: "percentage", percentage: 100 },
  };
  // 100% rollout → always enabled.
  assert.equal(evaluateFlag(flag, baseCtx).enabled, true);

  const flag0: FeatureFlag = {
    key: "ab-test",
    rollout: { type: "percentage", percentage: 0 },
  };
  // 0% rollout → always disabled.
  assert.equal(evaluateFlag(flag0, baseCtx).enabled, false);
});

test("defaultBucketHash is deterministic and in [0, 100)", () => {
  const a = defaultBucketHash("flag-1:u1");
  const b = defaultBucketHash("flag-1:u1");
  assert.equal(a, b);
  assert.ok(a >= 0 && a < 100);
  // Different inputs should generally produce different buckets.
  const c = defaultBucketHash("flag-1:u2");
  assert.ok(typeof c === "number");
});

test("applyMatcher supports eq, neq, in, gt, contains operators", () => {
  const attrs = { region: "EU", plan: "pro", age: 30, name: "Alice" };
  assert.equal(applyMatcher({ attribute: "region", op: "eq", value: "EU" }, attrs), true);
  assert.equal(applyMatcher({ attribute: "region", op: "neq", value: "US" }, attrs), true);
  assert.equal(applyMatcher({ attribute: "plan", op: "in", value: ["pro", "enterprise"] }, attrs), true);
  assert.equal(applyMatcher({ attribute: "age", op: "gt", value: 18 }, attrs), true);
  assert.equal(applyMatcher({ attribute: "name", op: "contains", value: "lic" }, attrs), true);
  assert.equal(applyMatcher({ attribute: "region", op: "eq", value: "US" }, attrs), false);
});

test("isEnabled and evaluateFlags return boolean decisions", () => {
  const flags: FeatureFlag[] = [
    { key: "f1", rollout: { type: "boolean", enabled: true } },
    { key: "f2", rollout: { type: "boolean", enabled: false } },
  ];
  assert.equal(isEnabled(flags[0]!, baseCtx), true);
  assert.equal(isEnabled(flags[1]!, baseCtx), false);
  assert.deepEqual(evaluateFlags(flags, baseCtx), { f1: true, f2: false });
});
