import assert from "node:assert/strict";
import test from "node:test";

import {
  buildVersionId,
  diffVersions,
  isConfidenceChangeSignificant,
  nextVersionNumber,
  summarizeStrategyVersionForDisplay,
  summarizeVersionForDisplay,
  validateChangeReason,
  type MissionVersionRow,
  type StrategyVersionRow,
} from "../db/versions-pure";

function baseMissionVersion(overrides: Partial<MissionVersionRow> = {}): MissionVersionRow {
  return {
    id: "mission_version_1",
    workspace_id: "ws_1",
    mission_id: "msn_1",
    version_number: 1,
    mission_json: '{"product_name":"Acme","audience":"founders"}',
    change_reason: "Initial mission draft",
    created_by: "user_1",
    created_at: 1_700_000_000,
    ...overrides,
  };
}

function baseStrategyVersion(overrides: Partial<StrategyVersionRow> = {}): StrategyVersionRow {
  return {
    id: "strategy_version_1",
    workspace_id: "ws_1",
    mission_id: "msn_1",
    version_number: 1,
    strategy_json: '{"channels":["linkedin"],"cadence":"daily"}',
    hypothesis: "Founders will engage with distribution teardowns",
    confidence: 55,
    change_reason: "Initial strategy",
    created_by: "user_1",
    created_at: 1_700_000_000,
    ...overrides,
  };
}

test("buildVersionId prefixes mission/strategy, is url-safe and unique", () => {
  const m = buildVersionId("mission");
  const s = buildVersionId("strategy");
  assert.ok(m.startsWith("mission_version_"));
  assert.ok(s.startsWith("strategy_version_"));
  assert.notEqual(m, buildVersionId("mission"));
  assert.match(m, /^[a-z0-9_]+$/);
  assert.match(s, /^[a-z0-9_]+$/);
});

test("buildVersionId embeds a sanitized seed", () => {
  const id = buildVersionId("strategy", "Q3 2024 Pivot!!");
  assert.ok(id.includes("q3_2024_pivot"));
});

test("validateChangeReason accepts valid reasons", () => {
  assert.equal(validateChangeReason("Initial mission draft").valid, true);
  assert.equal(validateChangeReason("Pivot to enterprise after interviews").valid, true);
});

test("validateChangeReason rejects empty, too short and too long input", () => {
  assert.equal(validateChangeReason("").valid, false);
  assert.equal(validateChangeReason(null).valid, false);
  assert.equal(validateChangeReason(undefined).valid, false);
  assert.equal(validateChangeReason("ab").valid, false);
  assert.equal(validateChangeReason("   ").valid, false);
  assert.equal(validateChangeReason("x".repeat(501)).valid, false);
});

test("diffVersions detects added fields", () => {
  const diff = diffVersions('{"a":1}', '{"a":1,"b":2,"c":3}');
  assert.deepEqual(diff.added, ["b", "c"]);
  assert.deepEqual(diff.removed, []);
  assert.equal(diff.has_changes, true);
});

test("diffVersions detects removed fields", () => {
  const diff = diffVersions('{"a":1,"b":2}', '{"a":1}');
  assert.deepEqual(diff.removed, ["b"]);
  assert.deepEqual(diff.added, []);
  assert.equal(diff.has_changes, true);
});

test("diffVersions detects changed and unchanged fields", () => {
  const diff = diffVersions('{"a":1,"b":"old","c":[1,2]}', '{"a":1,"b":"new","c":[1,2,3]}');
  assert.deepEqual(diff.unchanged, ["a"]);
  assert.equal(diff.changed.length, 2);
  const bChange = diff.changed.find((c) => c.key === "b");
  assert.equal(bChange?.before, "old");
  assert.equal(bChange?.after, "new");
  const cChange = diff.changed.find((c) => c.key === "c");
  assert.deepEqual(cChange?.before, [1, 2]);
  assert.deepEqual(cChange?.after, [1, 2, 3]);
});

test("diffVersions reports no changes for identical and invalid JSON inputs", () => {
  const same = diffVersions('{"a":1,"b":2}', '{"a":1,"b":2}');
  assert.equal(same.has_changes, false);
  assert.deepEqual(same.added, []);
  assert.deepEqual(same.removed, []);
  assert.deepEqual(same.changed, []);
  const invalidBoth = diffVersions("not json", "also not json");
  assert.equal(invalidBoth.has_changes, false);
  const nullPrev = diffVersions(null, '{"a":1}');
  assert.deepEqual(nullPrev.added, ["a"]);
});

test("summarizeVersionForDisplay returns mission summary with is_initial flag", () => {
  const initial = summarizeVersionForDisplay(baseMissionVersion({ version_number: 1 }));
  assert.equal(initial.is_initial, true);
  assert.equal(initial.mission_field_count, 2);
  assert.equal(initial.change_reason, "Initial mission draft");
  const later = summarizeVersionForDisplay(baseMissionVersion({ version_number: 5 }));
  assert.equal(later.is_initial, false);
  assert.equal(later.version_number, 5);
  const broken = summarizeVersionForDisplay(baseMissionVersion({ mission_json: "not json" }));
  assert.equal(broken.mission_field_count, 0);
});

test("summarizeStrategyVersionForDisplay includes confidence_band and strategy_field_count", () => {
  const summary = summarizeStrategyVersionForDisplay(baseStrategyVersion({ confidence: 55 }));
  assert.equal(summary.confidence_band, "medium");
  assert.equal(summary.strategy_field_count, 2);
  assert.equal(summary.is_initial, true);
  const high = summarizeStrategyVersionForDisplay(baseStrategyVersion({ confidence: 85, version_number: 3 }));
  assert.equal(high.confidence_band, "high");
  assert.equal(high.is_initial, false);
  const low = summarizeStrategyVersionForDisplay(baseStrategyVersion({ confidence: 12 }));
  assert.equal(low.confidence_band, "low");
});

test("nextVersionNumber returns 1 for null/undefined/invalid and N+1 for valid input", () => {
  assert.equal(nextVersionNumber(null), 1);
  assert.equal(nextVersionNumber(undefined), 1);
  assert.equal(nextVersionNumber(0), 1);
  assert.equal(nextVersionNumber(-5), 1);
  assert.equal(nextVersionNumber(NaN), 1);
  assert.equal(nextVersionNumber(1), 2);
  assert.equal(nextVersionNumber(7), 8);
  assert.equal(nextVersionNumber(42.9), 43);
});

test("isConfidenceChangeSignificant respects default and custom thresholds and rejects invalid input", () => {
  assert.equal(isConfidenceChangeSignificant(50, 65), true); // delta 15 >= 10
  assert.equal(isConfidenceChangeSignificant(50, 58), false); // delta 8 < 10
  assert.equal(isConfidenceChangeSignificant(60, 50), true); // absolute 10
  assert.equal(isConfidenceChangeSignificant(50, 65, 20), false); // delta 15 < 20
  assert.equal(isConfidenceChangeSignificant(50, 75, 20), true); // delta 25 >= 20
  assert.equal(isConfidenceChangeSignificant(NaN, 50), false);
  assert.equal(isConfidenceChangeSignificant(50, NaN), false);
  assert.equal(isConfidenceChangeSignificant(50, 60, -1), false);
});
