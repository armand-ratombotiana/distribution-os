/**
 * Pure rule engine.
 *
 * A rule is a named condition over a fact context. The engine walks the
 * rules in priority order (higher first; ties broken by registration
 * order) and either fires all matching rules (`evaluateRules`) or stops
 * at the first match (`evaluateFirstMatch`). Rule conditions are pure
 * predicates; side effects live in the action callback.
 */

export type RuleSeverity = "info" | "low" | "medium" | "high" | "critical";

export interface FactContext {
  [key: string]: unknown;
}

export interface RuleResult {
  ruleId: string;
  matched: boolean;
  /** Severity inherited from the rule when matched. */
  severity?: RuleSeverity;
  /** Output of the rule's action (if any), returned when matched. */
  output?: unknown;
  /** Human-readable reason for the match. */
  reason?: string;
}

export interface Rule<C extends FactContext = FactContext> {
  id: string;
  description?: string;
  severity?: RuleSeverity;
  /** Higher priority runs first. Defaults to 0. */
  priority?: number;
  /** Predicate over the fact context. Pure. */
  condition: (context: C) => boolean;
  /** Optional action run when the condition matches. Pure. */
  action?: (context: C) => unknown;
  /** Optional reason returned in the result when matched. */
  reason?: string;
}

export interface RuleEngine<C extends FactContext = FactContext> {
  rules: ReadonlyArray<Rule<C>>;
}

/**
 * Create an empty rule engine.
 */
export function createRuleEngine<C extends FactContext = FactContext>(): RuleEngine<C> {
  return { rules: [] };
}

/**
 * Add a rule to the engine. The engine is immutable; a new engine is
 * returned. Rules are kept in priority-descending order with stable
 * registration-order tiebreaks.
 */
export function addRule<C extends FactContext = FactContext>(
  engine: RuleEngine<C>,
  rule: Rule<C>,
): RuleEngine<C> {
  const rules = [...engine.rules, rule];
  // Stable sort by priority (desc), preserving registration order on ties.
  rules.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  return { rules };
}

/**
 * Evaluate every rule in priority order. Returns one `RuleResult` per
 * rule with `matched: true|false`. Actions only run on matching rules.
 */
export function evaluateRules<C extends FactContext = FactContext>(
  engine: RuleEngine<C>,
  context: C,
): RuleResult[] {
  return engine.rules.map((rule) => {
    const matched = safeCondition(rule, context);
    if (!matched) {
      return { ruleId: rule.id, matched: false };
    }
    const output = rule.action ? safeAction(rule, context) : undefined;
    return {
      ruleId: rule.id,
      matched: true,
      severity: rule.severity,
      output,
      reason: rule.reason,
    };
  });
}

/**
 * Evaluate rules in priority order and return only the results for the
 * rules whose conditions matched.
 */
export function evaluateMatchingRules<C extends FactContext = FactContext>(
  engine: RuleEngine<C>,
  context: C,
): RuleResult[] {
  return evaluateRules(engine, context).filter((r) => r.matched);
}

/**
 * Evaluate rules in priority order; return the first matching rule's
 * result, or `null` when no rule matches.
 */
export function evaluateFirstMatch<C extends FactContext = FactContext>(
  engine: RuleEngine<C>,
  context: C,
): RuleResult | null {
  for (const rule of engine.rules) {
    if (safeCondition(rule, context)) {
      const output = rule.action ? safeAction(rule, context) : undefined;
      return {
        ruleId: rule.id,
        matched: true,
        severity: rule.severity,
        output,
        reason: rule.reason,
      };
    }
  }
  return null;
}

/**
 * Build a rule from a synchronous condition + action pair.
 */
export function makeRule<C extends FactContext = FactContext>(
  id: string,
  condition: (context: C) => boolean,
  options: {
    description?: string;
    severity?: RuleSeverity;
    priority?: number;
    action?: (context: C) => unknown;
    reason?: string;
  } = {},
): Rule<C> {
  return {
    id,
    description: options.description,
    severity: options.severity,
    priority: options.priority,
    condition,
    action: options.action,
    reason: options.reason,
  };
}

function safeCondition<C extends FactContext>(
  rule: Rule<C>,
  context: C,
): boolean {
  try {
    return rule.condition(context);
  } catch {
    return false;
  }
}

function safeAction<C extends FactContext>(
  rule: Rule<C>,
  context: C,
): unknown {
  try {
    return rule.action ? rule.action(context) : undefined;
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
