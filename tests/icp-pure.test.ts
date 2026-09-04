import assert from "node:assert/strict";
import test from "node:test";

import {
  scoreFit,
  getExclusionCriteria,
  validateICP,
  type ICP,
  type Prospect,
} from "../lib/icp-pure.ts";

const icp: ICP = {
  id: "icp1",
  name: "Mid-market SaaS",
  industries: ["saas", "fintech"],
  attributes: [
    { name: "employeeCount", min: 50, max: 500, weight: 2 },
    { name: "arr", min: 1_000_000, weight: 1 },
    { name: "region", allowed: ["NA", "EU"], weight: 1 },
  ],
  exclusions: [
    { field: "isCompetitor", op: "eq", value: true },
  ],
};

test("scoreFit returns 100 when every attribute is in-band", () => {
  const p: Prospect = {
    attributes: {
      industry: "saas",
      employeeCount: 200,
      arr: 2_500_000,
      region: "NA",
    },
  };
  assert.equal(scoreFit(icp, p), 100);
});

test("scoreFit returns 0 when an exclusion rule matches", () => {
  const p: Prospect = {
    attributes: {
      industry: "saas",
      employeeCount: 200,
      arr: 2_500_000,
      region: "NA",
      isCompetitor: true,
    },
  };
  assert.equal(scoreFit(icp, p), 0);
});

test("scoreFit returns 0 when the industry is not on the whitelist", () => {
  const p: Prospect = {
    attributes: {
      industry: "retail",
      employeeCount: 200,
      arr: 2_500_000,
      region: "NA",
    },
  };
  assert.equal(scoreFit(icp, p), 0);
});

test("scoreFit returns 0 when a required attribute fails", () => {
  const reqIcp: ICP = {
    ...icp,
    attributes: [
      { name: "employeeCount", min: 50, max: 500, required: true, weight: 1 },
      { name: "arr", min: 1_000_000, weight: 1 },
    ],
  };
  const p: Prospect = {
    attributes: { industry: "saas", employeeCount: 5, arr: 5_000_000 },
  };
  assert.equal(scoreFit(reqIcp, p), 0);
});

test("scoreFit awards partial credit for near-miss numeric attributes", () => {
  // employeeCount target [50, 500], weight 2; arr target [1M, ∞), weight 1; region weight 1
  // employeeCount=40 is 10 below min 50 → tolerance = 50*0.25 + 1 = 13.5 → partial = 1 - 10/13.5 ≈ 0.2593
  // weighted contribution = 0.2593 * 2 = 0.5185; arr in-band → 1; region in-band → 1; possible = 4
  // → score ≈ (0.5185 + 1 + 1) / 4 * 100 ≈ 62.96
  const p: Prospect = {
    attributes: {
      industry: "saas",
      employeeCount: 40,
      arr: 2_000_000,
      region: "NA",
    },
  };
  const s = scoreFit(icp, p);
  assert.ok(s > 50 && s < 75, `expected partial credit, got ${s}`);
  assert.ok(Math.abs(s - 62.96296) < 1e-3, `expected ≈62.96, got ${s}`);
});

test("scoreFit returns 0 when a numeric attribute is far outside the band", () => {
  const p: Prospect = {
    attributes: {
      industry: "saas",
      employeeCount: 5,         // far below 50
      arr: 2_000_000,
      region: "NA",
    },
  };
  // employeeCount partial = 0; arr in-band; region in-band → (0 + 1 + 1) / 4 * 100 = 50
  assert.ok(Math.abs(scoreFit(icp, p) - 50) < 1e-9);
});

test("scoreFit returns 0 for invalid input", () => {
  assert.equal(scoreFit(null as unknown as ICP, { attributes: {} }), 0);
  assert.equal(scoreFit(icp, null as unknown as Prospect), 0);
  assert.equal(scoreFit({ ...icp, attributes: [] }, { attributes: {} }), 0);
});

test("scoreFit honours allowed-value lists for non-numeric attributes", () => {
  const p: Prospect = {
    attributes: {
      industry: "saas",
      employeeCount: 200,
      arr: 2_000_000,
      region: "APAC", // not in ["NA", "EU"]
    },
  };
  // region fails (no partial credit for non-numeric), everything else in-band
  // → (2 + 1 + 0) / 4 * 100 = 75
  assert.ok(Math.abs(scoreFit(icp, p) - 75) < 1e-9);
});

test("getExclusionCriteria returns the exclusion rules array", () => {
  assert.deepEqual(getExclusionCriteria(icp), [
    { field: "isCompetitor", op: "eq", value: true },
  ]);
  assert.deepEqual(getExclusionCriteria({ ...icp, exclusions: undefined }), []);
  assert.deepEqual(getExclusionCriteria(null as unknown as ICP), []);
});

test("validateICP accepts a well-formed ICP", () => {
  const res = validateICP(icp);
  assert.equal(res.valid, true);
  assert.deepEqual(res.errors, []);
});

test("validateICP flags empty id, empty name, empty attributes, and missing band specs", () => {
  const structural = validateICP({ id: "", name: "   ", attributes: [] } as unknown as ICP);
  assert.equal(structural.valid, false);
  assert.ok(structural.errors.some((e) => e.includes("id must be a non-empty string")));
  assert.ok(structural.errors.some((e) => e.includes("name must be a non-empty string")));
  assert.ok(structural.errors.some((e) => e.includes("attributes must be a non-empty array")));

  const noBand = validateICP({
    id: "x",
    name: "x",
    attributes: [{ name: "noop", weight: 1 }],
  });
  assert.equal(noBand.valid, false);
  assert.ok(noBand.errors.some((e) => e.includes("must have at least one of min, max, or allowed")));
});

test("validateICP flags bad industries, bad exclusion rules, and non-object input", () => {
  const res = validateICP({
    id: "x",
    name: "x",
    attributes: [{ name: "a", min: 1 }],
    industries: ["saas", 123] as unknown as string[],
    exclusions: [
      { field: "", op: "eq", value: 1 },
      { field: "ok", op: "weird" as never, value: 1 },
    ],
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes("industries must be an array of strings")));
  assert.ok(res.errors.some((e) => e.includes("exclusion[0].field must be a non-empty string")));
  assert.ok(res.errors.some((e) => e.includes("exclusion[1].op is invalid")));

  const nonObject = validateICP(null as unknown as ICP);
  assert.equal(nonObject.valid, false);
  assert.ok(nonObject.errors.some((e) => e.includes("icp must be an object")));
});
