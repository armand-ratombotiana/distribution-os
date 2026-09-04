/**
 * Pure feature-flag evaluation.
 *
 * A flag is a typed rule that decides whether a feature is enabled for a
 * given context (user id, attributes, environment). Flags support
 * percentage rollouts, allow/deny lists, attribute matchers, and an
 * environment gate (e.g. only enabled in `staging`).
 *
 * All evaluation is pure: the same (flag, context) pair always yields
 * the same result. The caller supplies a deterministic hash function for
 * percentage bucketing (default uses a simple FNV-1a-style hash on
 * `${flagKey}:${userId}`).
 */

export type FlagEnvironment = "development" | "staging" | "production" | "test";

export type FlagMatcherOperator =
  | "eq"
  | "neq"
  | "in"
  | "not_in"
  | "gt"
  | "lt"
  | "gte"
  | "lte"
  | "contains";

export interface FlagMatcher {
  /** Attribute key on the FlagContext.attributes object. */
  attribute: string;
  op: FlagMatcherOperator;
  value: unknown;
}

export interface FlagContext {
  /** Stable user identifier used for percentage bucketing. */
  userId?: string;
  /** Optional session/account id, used as a fallback for bucketing. */
  sessionId?: string;
  environment: FlagEnvironment;
  /** Free-form attributes used by matchers (e.g. { region: "EU", plan: "pro" }). */
  attributes?: Record<string, unknown>;
}

export type FlagRollout =
  | { type: "boolean"; enabled: boolean }
  | { type: "percentage"; percentage: number };

export interface FeatureFlag {
  key: string;
  /** Optional human-readable name. */
  name?: string;
  /** Environments in which the flag is active. Empty/missing = all envs. */
  environments?: ReadonlyArray<FlagEnvironment>;
  /** Rollout strategy. */
  rollout: FlagRollout;
  /** User ids explicitly allowed (overrides percentage). */
  allowList?: ReadonlyArray<string>;
  /** User ids explicitly denied (overrides everything else). */
  denyList?: ReadonlyArray<string>;
  /** Attribute matchers that must all pass for the flag to be enabled. */
  matchers?: ReadonlyArray<FlagMatcher>;
  /** Optional version for cache-busting. */
  version?: number;
}

export interface FlagEvaluation {
  flagKey: string;
  enabled: boolean;
  /** Reason the flag resolved the way it did. */
  reason:
    | "deny_list"
    | "allow_list"
    | "env_gate"
    | "matcher_fail"
    | "percentage"
    | "boolean"
    | "default";
}

/**
 * Default bucketing hash. Uses FNV-1a 32-bit and returns the hash as a
 * number in [0, 100). Pure and deterministic.
 */
export function defaultBucketHash(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    // FNV prime (32-bit) — multiply via Math.imul to stay in 32-bit range.
    hash = Math.imul(hash, 0x01000193);
  }
  // Convert to unsigned and scale to [0, 100).
  return (hash >>> 0) % 100;
}

/**
 * Evaluate a feature flag against a context. Returns the decision plus
 * a human-readable reason.
 *
 * Evaluation order:
 *   1. denyList  → disabled, reason `deny_list`
 *   2. allowList → enabled,  reason `allow_list`
 *   3. env gate  → disabled, reason `env_gate`
 *   4. matchers  → disabled, reason `matcher_fail` (any matcher fails)
 *   5. rollout   → boolean / percentage bucket, reason `boolean` / `percentage`
 *
 * The default reason (no flag found / unknown case) is `default`.
 */
export function evaluateFlag(
  flag: FeatureFlag,
  context: FlagContext,
  bucketHash: (input: string) => number = defaultBucketHash,
): FlagEvaluation {
  const bucketId = context.userId ?? context.sessionId ?? "";

  // 1. deny list wins over everything.
  if (flag.denyList && bucketId && flag.denyList.includes(bucketId)) {
    return { flagKey: flag.key, enabled: false, reason: "deny_list" };
  }

  // 2. allow list wins over rollout.
  if (flag.allowList && bucketId && flag.allowList.includes(bucketId)) {
    return { flagKey: flag.key, enabled: true, reason: "allow_list" };
  }

  // 3. environment gate.
  if (
    flag.environments &&
    flag.environments.length > 0 &&
    !flag.environments.includes(context.environment)
  ) {
    return { flagKey: flag.key, enabled: false, reason: "env_gate" };
  }

  // 4. attribute matchers.
  if (flag.matchers) {
    for (const matcher of flag.matchers) {
      if (!applyMatcher(matcher, context.attributes ?? {})) {
        return { flagKey: flag.key, enabled: false, reason: "matcher_fail" };
      }
    }
  }

  // 5. rollout strategy.
  if (flag.rollout.type === "boolean") {
    return {
      flagKey: flag.key,
      enabled: flag.rollout.enabled,
      reason: "boolean",
    };
  }
  // percentage
  const bucket = bucketHash(`${flag.key}:${bucketId}`);
  return {
    flagKey: flag.key,
    enabled: bucket < flag.rollout.percentage,
    reason: "percentage",
  };
}

/**
 * Apply a single attribute matcher to a context's attributes object.
 */
export function applyMatcher(
  matcher: FlagMatcher,
  attributes: Record<string, unknown>,
): boolean {
  const actual = attributes[matcher.attribute];
  switch (matcher.op) {
    case "eq":
      return actual === matcher.value;
    case "neq":
      return actual !== matcher.value;
    case "in":
      return Array.isArray(matcher.value) && matcher.value.includes(actual);
    case "not_in":
      return Array.isArray(matcher.value) && !matcher.value.includes(actual);
    case "gt":
      return typeof actual === "number" && typeof matcher.value === "number" && actual > matcher.value;
    case "lt":
      return typeof actual === "number" && typeof matcher.value === "number" && actual < matcher.value;
    case "gte":
      return typeof actual === "number" && typeof matcher.value === "number" && actual >= matcher.value;
    case "lte":
      return typeof actual === "number" && typeof matcher.value === "number" && actual <= matcher.value;
    case "contains":
      return typeof actual === "string" && typeof matcher.value === "string" && actual.includes(matcher.value);
    default:
      return false;
  }
}

/**
 * Convenience helper: returns just the boolean decision.
 */
export function isEnabled(
  flag: FeatureFlag,
  context: FlagContext,
  bucketHash?: (input: string) => number,
): boolean {
  return evaluateFlag(flag, context, bucketHash).enabled;
}

/**
 * Convenience helper: evaluate multiple flags at once against the same
 * context, returning a `{ [flagKey]: boolean }` map.
 */
export function evaluateFlags(
  flags: ReadonlyArray<FeatureFlag>,
  context: FlagContext,
  bucketHash?: (input: string) => number,
): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const flag of flags) {
    out[flag.key] = evaluateFlag(flag, context, bucketHash).enabled;
  }
  return out;
}
