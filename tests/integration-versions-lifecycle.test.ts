import assert from "node:assert/strict";
import test from "node:test";

// Integration: mission/strategy versioning ↔ mission lifecycle stages
//
// The mission loop progresses through 5 stages (observe → decide → act →
// measure → learn) and bumps a `cycle_number` each time learn wraps to
// observe. Every meaningful change to the mission or its strategy must be
// persisted as an append-only version row. These tests exercise how the
// versioning helpers compose with the lifecycle helpers.

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

import {
  STAGE_ORDER,
  STAGE_TRANSITIONS,
  getEstimatedTimeToPayment,
  getMissionProgress,
  getMissionReadiness,
  getNextStage,
  getStageDescription,
  isStageCompleteable,
  shouldAutoAdvance,
  shouldIncrementCycle,
} from "../lib/mission-lifecycle-pure";

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

const baseMission = {
  current_stage: "observe",
  cycle_number: 1,
  payment_count: 0,
  approved: false,
};

test("nextVersionNumber returns 1 for null input AND STAGE_ORDER has 5 stages", () => {
  assert.equal(nextVersionNumber(null), 1);
  assert.equal(nextVersionNumber(undefined), 1);
  assert.equal(nextVersionNumber(0), 1);
  assert.equal(nextVersionNumber(NaN), 1);
  assert.equal(nextVersionNumber(5), 6);

  assert.equal(STAGE_ORDER.length, 5);
  assert.deepEqual([...STAGE_ORDER], ["observe", "decide", "act", "measure", "learn"]);
});

test("validateChangeReason accepts valid reason AND getStageDescription returns non-empty description", () => {
  assert.equal(validateChangeReason("Initial mission draft").valid, true);
  assert.equal(validateChangeReason("Pivot to enterprise after interviews").valid, true);

  for (const stage of STAGE_ORDER) {
    const desc = getStageDescription(stage);
    assert.ok(typeof desc === "string" && desc.length > 0);
  }
  assert.match(getStageDescription("observe"), /intelligence/i);
});

test("diffVersions detects added fields AND shouldIncrementCycle is true for learn→observe", () => {
  const diff = diffVersions('{"a":1}', '{"a":1,"b":2,"c":3}');
  assert.deepEqual(diff.added, ["b", "c"]);
  assert.equal(diff.has_changes, true);

  assert.equal(shouldIncrementCycle("learn", "observe"), true);
  assert.equal(shouldIncrementCycle("observe", "decide"), false);
  assert.equal(shouldIncrementCycle("decide", "act"), false);
});

test("summarizeVersionForDisplay includes is_initial flag AND getNextStage returns 'decide' for 'observe'", () => {
  const initial = summarizeVersionForDisplay(baseMissionVersion({ version_number: 1 }));
  assert.equal(initial.is_initial, true);
  assert.equal(initial.mission_field_count, 2);
  assert.equal(initial.change_reason, "Initial mission draft");
  const later = summarizeVersionForDisplay(baseMissionVersion({ version_number: 5 }));
  assert.equal(later.is_initial, false);
  assert.equal(later.version_number, 5);

  assert.equal(getNextStage("observe"), "decide");
  assert.equal(getNextStage("decide"), "act");
  assert.equal(getNextStage("act"), "measure");
  assert.equal(getNextStage("measure"), "learn");
  assert.equal(getNextStage("learn"), "observe");
});

test("isConfidenceChangeSignificant uses default 10-point threshold AND getMissionReadiness blocks unapproved act stage", () => {
  assert.equal(isConfidenceChangeSignificant(50, 65), true); // delta 15 >= 10
  assert.equal(isConfidenceChangeSignificant(50, 58), false); // delta 8 < 10
  assert.equal(isConfidenceChangeSignificant(60, 50), true); // absolute 10

  const readiness = getMissionReadiness({
    current_stage: "act",
    cycle_number: 1,
    payment_count: 0,
    approved: false,
  });
  assert.equal(readiness.can_advance, false);
  assert.equal(readiness.requires_approval, true);
  assert.ok(readiness.blocking_reasons.length >= 1);
  assert.ok(readiness.readiness_score < 100);
});

test("nextVersionNumber returns N+1 for valid input AND STAGE_TRANSITIONS maps each stage to next", () => {
  assert.equal(nextVersionNumber(7), 8);
  assert.equal(nextVersionNumber(42.9), 43);

  assert.equal(STAGE_TRANSITIONS.observe, "decide");
  assert.equal(STAGE_TRANSITIONS.decide, "act");
  assert.equal(STAGE_TRANSITIONS.act, "measure");
  assert.equal(STAGE_TRANSITIONS.measure, "learn");
  assert.equal(STAGE_TRANSITIONS.learn, "observe");
});

test("diffVersions reports no changes for identical JSON AND shouldIncrementCycle is false for non-wrapping transitions", () => {
  const same = diffVersions('{"a":1,"b":2}', '{"a":1,"b":2}');
  assert.equal(same.has_changes, false);
  assert.deepEqual(same.added, []);
  assert.deepEqual(same.removed, []);
  assert.deepEqual(same.changed, []);

  assert.equal(shouldIncrementCycle("learn", "decide"), false);
  assert.equal(shouldIncrementCycle("learn", "act"), false);
});

test("validateChangeReason rejects too-short input AND isStageCompleteable gates act stage on approval", () => {
  assert.equal(validateChangeReason("ab").valid, false);
  assert.equal(validateChangeReason("").valid, false);
  assert.equal(validateChangeReason(null).valid, false);
  assert.equal(validateChangeReason(undefined).valid, false);
  assert.equal(validateChangeReason("   ").valid, false);

  const unapproved = {
    current_stage: "act",
    cycle_number: 1,
    payment_count: 0,
    approved: false,
  };
  assert.equal(isStageCompleteable("act", unapproved), false);
  const approved = { ...unapproved, approved: true };
  assert.equal(isStageCompleteable("act", approved), true);
});

test("buildVersionId prefixes 'mission_version'/'strategy_version' AND getMissionProgress returns 100 when payment_count > 0", () => {
  const m = buildVersionId("mission");
  const s = buildVersionId("strategy");
  assert.ok(m.startsWith("mission_version_"));
  assert.ok(s.startsWith("strategy_version_"));
  assert.match(m, /^[a-z0-9_]+$/);
  assert.match(s, /^[a-z0-9_]+$/);

  const mission = {
    current_stage: "observe",
    cycle_number: 5,
    payment_count: 1,
    approved: true,
  };
  assert.equal(getMissionProgress(mission), 100);
});

test("summarizeStrategyVersionForDisplay includes confidence_band AND getMissionReadiness includes blocking_reasons", () => {
  const summary = summarizeStrategyVersionForDisplay(baseStrategyVersion({ confidence: 55 }));
  assert.equal(summary.confidence_band, "medium");
  assert.equal(summary.strategy_field_count, 2);
  assert.equal(summary.is_initial, true);
  const high = summarizeStrategyVersionForDisplay(
    baseStrategyVersion({ confidence: 85, version_number: 3 }),
  );
  assert.equal(high.confidence_band, "high");
  assert.equal(high.is_initial, false);
  const low = summarizeStrategyVersionForDisplay(baseStrategyVersion({ confidence: 12 }));
  assert.equal(low.confidence_band, "low");

  const readiness = getMissionReadiness({
    current_stage: "act",
    cycle_number: 1,
    payment_count: 0,
    approved: false,
  });
  assert.ok(Array.isArray(readiness.blocking_reasons));
  assert.ok(readiness.blocking_reasons.length >= 1);
  assert.equal(readiness.readiness_score, Math.max(0, 100 - 25 * readiness.blocking_reasons.length));
});

test("diffVersions detects removed fields AND shouldAutoAdvance is false when act stage is not approved", () => {
  const diff = diffVersions('{"a":1,"b":2}', '{"a":1}');
  assert.deepEqual(diff.removed, ["b"]);
  assert.equal(diff.has_changes, true);

  const unapproved = {
    current_stage: "act",
    cycle_number: 1,
    payment_count: 0,
    approved: false,
  };
  assert.equal(shouldAutoAdvance(unapproved, {}), false);
  const approved = { ...unapproved, approved: true };
  assert.equal(shouldAutoAdvance(approved, {}), true);
});

test("nextVersionNumber handles NaN/0/-5 by returning 1 AND isConfidenceChangeSignificant respects custom threshold", () => {
  assert.equal(nextVersionNumber(NaN), 1);
  assert.equal(nextVersionNumber(0), 1);
  assert.equal(nextVersionNumber(-5), 1);
  assert.equal(nextVersionNumber(Number.POSITIVE_INFINITY), 1);

  assert.equal(isConfidenceChangeSignificant(50, 65, 20), false); // delta 15 < 20
  assert.equal(isConfidenceChangeSignificant(50, 75, 20), true); // delta 25 >= 20
  assert.equal(isConfidenceChangeSignificant(NaN, 50), false);
  assert.equal(isConfidenceChangeSignificant(50, NaN), false);
  assert.equal(isConfidenceChangeSignificant(50, 60, -1), false);
});

test("validateChangeReason rejects too-long input (>500 chars) AND getStageDescription returns 'Unknown' for invalid stage", () => {
  assert.equal(validateChangeReason("x".repeat(501)).valid, false);
  // 500 chars exactly is allowed
  assert.equal(validateChangeReason("x".repeat(500)).valid, true);

  assert.match(getStageDescription("invalid"), /unknown/i);
  assert.match(getStageDescription(""), /unknown/i);
});

test("summarizeVersionForDisplay includes mission_field_count AND getMissionProgress returns <100 when no payment", () => {
  const broken = summarizeVersionForDisplay(
    baseMissionVersion({ mission_json: "not json" }),
  );
  assert.equal(broken.mission_field_count, 0);

  const progress = getMissionProgress(baseMission);
  assert.ok(progress > 0);
  assert.ok(progress < 100);
  // observe is index 0 → ((0 + 1) / 5) * 100 = 20
  assert.equal(progress, 20);
});

test("diffVersions handles null previous JSON AND getEstimatedTimeToPayment decreases as cycles advance", () => {
  const nullPrev = diffVersions(null, '{"a":1}');
  assert.deepEqual(nullPrev.added, ["a"]);
  assert.equal(nullPrev.has_changes, true);

  const early = {
    current_stage: "observe",
    cycle_number: 1,
    payment_count: 0,
    approved: false,
  };
  const later = {
    current_stage: "observe",
    cycle_number: 3,
    payment_count: 0,
    approved: false,
  };
  const earlyEstimate = getEstimatedTimeToPayment(early);
  const laterEstimate = getEstimatedTimeToPayment(later);
  assert.ok(earlyEstimate > 0);
  assert.ok(laterEstimate > 0);
  assert.ok(laterEstimate < earlyEstimate);
});
