import assert from "node:assert/strict";
import { test } from "node:test";

import {
  allow,
  combinePolicies,
  combinePoliciesAllOf,
  combinePoliciesAnyOf,
  combinePoliciesFirstMatch,
  deny,
  evaluatePolicy,
  makePolicy,
  type Policy,
  type PolicyContext,
} from "../lib/policy-pure.ts";

type UserContext = PolicyContext & {
  userId?: string;
  roles?: string[];
  age?: number;
  region?: string;
};

test("allow / deny construct results that inherit the policy id", () => {
  const a = allow("p1");
  assert.equal(a.effect, "allow");
  assert.equal(a.policyId, "p1");
  assert.equal(a.reason, undefined);
  assert.equal(a.severity, undefined);

  const d = deny("p2", "no access", "high");
  assert.equal(d.effect, "deny");
  assert.equal(d.policyId, "p2");
  assert.equal(d.reason, "no access");
  assert.equal(d.severity, "high");
});

test("makePolicy builds a policy that returns allow when the predicate is true", async () => {
  const p = makePolicy<UserContext>("is-admin", (c) => (c.roles ?? []).includes("admin"));
  const result = await evaluatePolicy(p, { roles: ["admin"] });
  assert.equal(result.effect, "allow");
  assert.equal(result.policyId, "is-admin");
});

test("makePolicy returns deny with a reason when the predicate is false", async () => {
  const p = makePolicy<UserContext>("is-admin", (c) => (c.roles ?? []).includes("admin"), {
    reason: "user must be an admin",
    severity: "medium",
  });
  const result = await evaluatePolicy(p, { roles: ["user"] });
  assert.equal(result.effect, "deny");
  assert.equal(result.policyId, "is-admin");
  assert.match(result.reason ?? "", /Denied/);
  assert.equal(result.severity, "medium");
});

test("evaluatePolicy converts thrown errors into deny results", async () => {
  const p: Policy<UserContext> = {
    id: "p-throws",
    evaluate: () => {
      throw new Error("boom");
    },
  };
  const result = await evaluatePolicy(p, {});
  assert.equal(result.effect, "deny");
  assert.equal(result.reason, "boom");
  assert.equal(result.severity, "high");
});

test("evaluatePolicy supports async policies that return promises", async () => {
  const p: Policy<UserContext> = {
    id: "p-async",
    evaluate: async () => {
      await Promise.resolve();
      return allow("p-async");
    },
  };
  const result = await evaluatePolicy(p, {});
  assert.equal(result.effect, "allow");
});

test("combinePoliciesAllOf returns allow when every policy allows", async () => {
  const policies = [
    makePolicy<UserContext>("a", () => true),
    makePolicy<UserContext>("b", () => true),
  ];
  const result = await combinePoliciesAllOf(policies, {});
  assert.equal(result.effect, "allow");
  assert.equal(result.policyId, "allOf");
});

test("combinePoliciesAllOf returns the first deny when any policy denies", async () => {
  const policies = [
    makePolicy<UserContext>("a", () => true),
    makePolicy<UserContext>("b", () => false, { reason: "b-fail" }),
    makePolicy<UserContext>("c", () => false, { reason: "c-fail" }),
  ];
  const result = await combinePoliciesAllOf(policies, {});
  assert.equal(result.effect, "deny");
  assert.equal(result.policyId, "b");
  assert.match(result.reason ?? "", /b-fail/);
});

test("combinePoliciesAnyOf returns the first allow when any policy allows", async () => {
  const policies = [
    makePolicy<UserContext>("a", () => false),
    makePolicy<UserContext>("b", () => true),
    makePolicy<UserContext>("c", () => true),
  ];
  const result = await combinePoliciesAnyOf(policies, {});
  assert.equal(result.effect, "allow");
  assert.equal(result.policyId, "b");
});

test("combinePoliciesAnyOf returns the last deny when no policy allows", async () => {
  const policies = [
    makePolicy<UserContext>("a", () => false),
    makePolicy<UserContext>("b", () => false),
  ];
  const result = await combinePoliciesAnyOf(policies, {});
  assert.equal(result.effect, "deny");
  assert.equal(result.policyId, "b");
});

test("combinePoliciesFirstMatch stops at the first deny", async () => {
  const policies = [
    makePolicy<UserContext>("a", () => true),
    makePolicy<UserContext>("b", () => false, { reason: "b-fail" }),
    makePolicy<UserContext>("c", () => false, { reason: "c-fail" }),
  ];
  const result = await combinePoliciesFirstMatch(policies, {});
  assert.equal(result.effect, "deny");
  assert.equal(result.policyId, "b");
});

test("combinePolicies dispatcher routes by strategy (default allOf, explicit anyOf)", async () => {
  const policies = [
    makePolicy<UserContext>("a", () => false),
    makePolicy<UserContext>("b", () => true),
  ];
  // Default allOf: first deny stops the walk.
  const all = await combinePolicies(policies, {});
  assert.equal(all.effect, "deny");
  assert.equal(all.policyId, "a");
  // Explicit anyOf: first allow wins.
  const any = await combinePolicies(policies, {}, "anyOf");
  assert.equal(any.effect, "allow");
  assert.equal(any.policyId, "b");
});

test("policies compose a realistic age + region gate", async () => {
  const agePolicy = makePolicy<UserContext>("min-age", (c) => (c.age ?? 0) >= 18, {
    reason: "must be 18+",
    severity: "high",
  });
  const regionPolicy = makePolicy<UserContext>("region-eu", (c) => c.region === "EU", {
    reason: "must be in EU",
    severity: "medium",
  });
  const gate = await combinePoliciesAllOf([agePolicy, regionPolicy], {
    age: 21,
    region: "EU",
  });
  assert.equal(gate.effect, "allow");
  const blocked = await combinePoliciesAllOf([agePolicy, regionPolicy], {
    age: 16,
    region: "US",
  });
  assert.equal(blocked.effect, "deny");
  assert.equal(blocked.policyId, "min-age");
});
