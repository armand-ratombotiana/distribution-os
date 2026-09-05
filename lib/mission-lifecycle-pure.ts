// Pure mission-lifecycle helpers.
//
// The Distribution OS mission loop runs through six stages:
//   observe -> decide -> approve -> act -> measure -> learn -> observe.
// This module is intentionally side-effect free so it can be unit tested in
// isolation and reused by route handlers, workers, and the UI.

export type MissionStage = "observe" | "decide" | "approve" | "act" | "measure" | "learn";

export const STAGE_ORDER: readonly MissionStage[] = [
  "observe",
  "decide",
  "approve",
  "act",
  "measure",
  "learn",
] as const;

export const STAGE_TRANSITIONS: Record<MissionStage, MissionStage> = {
  observe: "decide",
  decide: "approve",
  approve: "act",
  act: "measure",
  measure: "learn",
  learn: "observe",
};

const STAGE_DESCRIPTIONS: Record<MissionStage, string> = {
  observe:
    "Capture website intelligence and refresh mission evidence for the current cycle.",
  decide:
    "Rank the next experiment against current evidence and the first-payment objective.",
  approve:
    "Wait for a human to approve one exact external action, payload and expiry.",
  act: "Prepare the next safe internal action; external publication remains approval-gated.",
  measure:
    "Open the measurement window and wait for attributable channel signals.",
  learn:
    "Compare the evidence ledger with the hypothesis and its kill rule before the next cycle.",
};

export type MissionStateSnapshot = {
  current_stage: string;
  cycle_number: number;
  payment_count: number;
  approved: boolean;
  status?: string;
};

export type MissionReadiness = {
  can_advance: boolean;
  requires_approval: boolean;
  blocking_reasons: string[];
  readiness_score: number;
};

function isMissionStage(stage: string): stage is MissionStage {
  return (STAGE_ORDER as readonly string[]).includes(stage);
}

export function getNextStage(stage: MissionStage | string): MissionStage {
  if (!isMissionStage(stage)) {
    return "observe";
  }
  return STAGE_TRANSITIONS[stage];
}

export function getStageDescription(stage: MissionStage | string): string {
  if (!isMissionStage(stage)) {
    return "Unknown mission stage.";
  }
  return STAGE_DESCRIPTIONS[stage];
}

// A cycle increments only when the loop wraps from "learn" back to "observe".
export function shouldIncrementCycle(from: string, to: string): boolean {
  return from === "learn" && to === "observe";
}

export function isStageCompleteable(
  stage: string,
  mission: MissionStateSnapshot
): boolean {
  if (!isMissionStage(stage)) return false;
  if (stage === "approve") return mission.approved === true;
  if (stage === "learn") return mission.cycle_number >= 1;
  return true;
}

export function getMissionReadiness(
  mission: MissionStateSnapshot,
  conditions?: {
    pendingApprovals?: number;
    approvedActions?: number;
    executedActions?: number;
    openExperiments?: number;
    measurementSignals?: number;
  }
): MissionReadiness {
  const blocking_reasons: string[] = [];
  let requires_approval = false;

  if (
    mission.current_stage === "approve" &&
    (conditions?.approvedActions ?? 0) === 0 &&
    (conditions?.executedActions ?? 0) === 0
  ) {
    const pending = conditions?.pendingApprovals ?? 0;
    blocking_reasons.push(
      pending > 0
        ? `${pending} exact action approval(s) pending.`
        : "Approve stage requires an action-specific approval.",
    );
    requires_approval = true;
  }

  if (
    mission.current_stage === "act" &&
    (conditions?.executedActions ?? 0) === 0
  ) {
    blocking_reasons.push("Act stage requires a provider-confirmed execution result.");
  }

  const openExperiments = conditions?.openExperiments ?? 0;
  if (mission.current_stage === "measure" && openExperiments === 0) {
    blocking_reasons.push(
      "Measure stage requires at least one open experiment before advancing."
    );
  }

  if (
    mission.current_stage === "measure" &&
    (conditions?.measurementSignals ?? 0) === 0
  ) {
    blocking_reasons.push(
      "Measure stage requires at least one attributable signal before learning.",
    );
  }

  const can_advance = blocking_reasons.length === 0;
  const readiness_score = Math.max(0, 100 - 25 * blocking_reasons.length);

  return { can_advance, requires_approval, blocking_reasons, readiness_score };
}

export function getMissionProgress(mission: MissionStateSnapshot): number {
  if (mission.payment_count > 0) return 100;
  const stageIndex = (STAGE_ORDER as readonly string[]).indexOf(
    mission.current_stage
  );
  if (stageIndex < 0) return 0;
  const cycleProgress = ((stageIndex + 1) / STAGE_ORDER.length) * 100;
  // Never report 100% until the first payment is confirmed.
  return Math.min(99, Math.round(cycleProgress));
}

export function shouldAutoAdvance(
  mission: MissionStateSnapshot,
  conditions: {
    pendingApprovals?: number;
    approvedActions?: number;
    executedActions?: number;
    openExperiments?: number;
    measurementSignals?: number;
    paymentCount?: number;
  }
): boolean {
  if (
    mission.current_stage === "approve" &&
    (conditions.approvedActions ?? 0) === 0 &&
    (conditions.executedActions ?? 0) === 0
  ) return false;
  if (mission.current_stage === "act" && (conditions.executedActions ?? 0) === 0) {
    return false;
  }
  if (
    mission.current_stage === "measure" &&
    (conditions.openExperiments ?? 0) === 0
  ) {
    return false;
  }
  if (
    mission.current_stage === "measure" &&
    (conditions.measurementSignals ?? 0) === 0
  ) return false;
  if ((conditions.paymentCount ?? mission.payment_count) > 0) return false;
  return true;
}

export function getEstimatedTimeToPayment(
  mission: MissionStateSnapshot,
  options?: { avgStageMs?: number; cycleNumber?: number }
): number {
  const avgStageMs = options?.avgStageMs ?? 24 * 60 * 60 * 1000; // 24h per stage
  const cycle = options?.cycleNumber ?? mission.cycle_number;
  const currentIndex = (STAGE_ORDER as readonly string[]).indexOf(
    mission.current_stage
  );
  if (currentIndex < 0) {
    return avgStageMs * STAGE_ORDER.length;
  }

  const remainingInCycle = STAGE_ORDER.length - currentIndex - 1;
  // Heuristic: first-payment test typically resolves within ~3 cycles of work.
  const estimatedCyclesRemaining = Math.max(0, 3 - cycle);
  const totalStagesRemaining =
    remainingInCycle + estimatedCyclesRemaining * STAGE_ORDER.length;

  return totalStagesRemaining * avgStageMs;
}
