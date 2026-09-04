/**
 * Pure policy engine.
 *
 * A policy is a named predicate over an evaluation context. Each policy
 * returns a `PolicyResult` (allow/deny) plus an optional reason and
 * severity. Policies can be combined with explicit combinators
 * (`allOf`, `anyOf`, `firstMatch`) so callers can compose fine-grained
 * rules into coarse-grained gates.
 *
 * No I/O. Everything is a pure function of (policy, context).
 */

export type PolicyEffect = "allow" | "deny";

export type PolicySeverity = "info" | "low" | "medium" | "high" | "critical";

export interface PolicyContext {
  [key: string]: unknown;
}

export interface PolicyResult {
  effect: PolicyEffect;
  /** Id of the policy that produced this result. */
  policyId: string;
  /** Human-readable explanation. */
  reason?: string;
  severity?: PolicySeverity;
}

export interface Policy<C extends PolicyContext = PolicyContext> {
  id: string;
  description?: string;
  severity?: PolicySeverity;
  evaluate: (context: C) => PolicyResult | Promise<PolicyResult>;
}

/**
 * Create an allow result that inherits the policy id.
 */
export function allow(policyId: string, reason?: string, severity?: PolicySeverity): PolicyResult {
  return { effect: "allow", policyId, reason, severity };
}

/**
 * Create a deny result that inherits the policy id.
 */
export function deny(policyId: string, reason?: string, severity?: PolicySeverity): PolicyResult {
  return { effect: "deny", policyId, reason, severity };
}

/**
 * Evaluate a single policy against a context. Errors thrown by the
 * policy's predicate are converted into a `deny` result with the error
 * message as the reason and severity `high`.
 */
export async function evaluatePolicy<C extends PolicyContext = PolicyContext>(
  policy: Policy<C>,
  context: C,
): Promise<PolicyResult> {
  try {
    const result = await policy.evaluate(context);
    // Normalise: always carry the policy id.
    return { ...result, policyId: policy.id };
  } catch (err) {
    return {
      effect: "deny",
      policyId: policy.id,
      reason: err instanceof Error ? err.message : String(err),
      severity: "high",
    };
  }
}

/**
 * Combine policies with an `allOf` (AND) strategy: every policy must
 * `allow`. Returns the first `deny` encountered, otherwise an allow.
 */
export async function combinePoliciesAllOf<C extends PolicyContext = PolicyContext>(
  policies: ReadonlyArray<Policy<C>>,
  context: C,
): Promise<PolicyResult> {
  for (const policy of policies) {
    const result = await evaluatePolicy(policy, context);
    if (result.effect === "deny") return result;
  }
  return {
    effect: "allow",
    policyId: "allOf",
    reason: "All policies allowed",
  };
}

/**
 * Combine policies with an `anyOf` (OR) strategy: at least one policy
 * must `allow`. Returns the first `allow`, otherwise the last deny.
 */
export async function combinePoliciesAnyOf<C extends PolicyContext = PolicyContext>(
  policies: ReadonlyArray<Policy<C>>,
  context: C,
): Promise<PolicyResult> {
  let lastDeny: PolicyResult | null = null;
  for (const policy of policies) {
    const result = await evaluatePolicy(policy, context);
    if (result.effect === "allow") return result;
    lastDeny = result;
  }
  if (lastDeny) return lastDeny;
  return {
    effect: "deny",
    policyId: "anyOf",
    reason: "No policies registered",
  };
}

/**
 * Combine policies with a `firstMatch` strategy: returns the first
 * policy whose `effect` is not `allow` (i.e. the first deny). If every
 * policy allows, returns an allow result.
 *
 * This is identical to `allOf` but the returned `policyId` reflects the
 * combining strategy for diagnostics.
 */
export async function combinePoliciesFirstMatch<C extends PolicyContext = PolicyContext>(
  policies: ReadonlyArray<Policy<C>>,
  context: C,
): Promise<PolicyResult> {
  for (const policy of policies) {
    const result = await evaluatePolicy(policy, context);
    if (result.effect === "deny") return result;
  }
  return {
    effect: "allow",
    policyId: "firstMatch",
    reason: "No deny matched",
  };
}

/**
 * Generic `combinePolicies` entry point. Defaults to `allOf` semantics.
 * Pass `strategy: "anyOf"` or `strategy: "firstMatch"` to switch.
 */
export async function combinePolicies<C extends PolicyContext = PolicyContext>(
  policies: ReadonlyArray<Policy<C>>,
  context: C,
  strategy: "allOf" | "anyOf" | "firstMatch" = "allOf",
): Promise<PolicyResult> {
  if (strategy === "anyOf") return combinePoliciesAnyOf(policies, context);
  if (strategy === "firstMatch") return combinePoliciesFirstMatch(policies, context);
  return combinePoliciesAllOf(policies, context);
}

/**
 * Helper to build a policy from a synchronous predicate.
 */
export function makePolicy<C extends PolicyContext = PolicyContext>(
  id: string,
  predicate: (context: C) => boolean,
  options: {
    description?: string;
    severity?: PolicySeverity;
    reason?: string;
  } = {},
): Policy<C> {
  return {
    id,
    description: options.description,
    severity: options.severity,
    evaluate: (context) =>
      predicate(context)
        ? allow(id, options.reason ? `Allowed: ${options.reason}` : undefined, options.severity)
        : deny(id, options.reason ? `Denied: ${options.reason}` : "Predicate returned false", options.severity),
  };
}
