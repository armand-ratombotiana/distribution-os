import assert from "node:assert/strict";
import { test } from "node:test";

import {
  addRule,
  createRuleEngine,
  evaluateFirstMatch,
  evaluateMatchingRules,
  evaluateRules,
  makeRule,
  type RuleResult,
} from "../lib/rule-engine-pure.ts";

type AccountFacts = {
  balance: number;
  withdrawalAmount: number;
  isFrozen: boolean;
  isVerified: boolean;
};

test("createRuleEngine returns an engine with no rules", () => {
  const engine = createRuleEngine<AccountFacts>();
  assert.equal(engine.rules.length, 0);
});

test("addRule returns a new engine and leaves the input untouched", () => {
  const engine = createRuleEngine<AccountFacts>();
  const next = addRule(engine, makeRule("r1", () => true));
  assert.equal(engine.rules.length, 0);
  assert.equal(next.rules.length, 1);
});

test("addRule orders rules by priority descending with stable tiebreaks", () => {
  let engine = createRuleEngine<AccountFacts>();
  engine = addRule(engine, makeRule("low", () => true, { priority: 1 }));
  engine = addRule(engine, makeRule("high", () => true, { priority: 10 }));
  engine = addRule(engine, makeRule("mid", () => true, { priority: 5 }));
  engine = addRule(engine, makeRule("high-2", () => true, { priority: 10 }));
  assert.deepEqual(
    engine.rules.map((r) => r.id),
    ["high", "high-2", "mid", "low"],
  );
});

test("evaluateRules returns one result per rule with matched flag", () => {
  const engine = addRule(
    createRuleEngine<AccountFacts>(),
    makeRule<AccountFacts>("overdraft", (c) => c.withdrawalAmount > c.balance, {
      severity: "high",
      reason: "withdrawal exceeds balance",
    }),
  );
  const results = evaluateRules(engine, { balance: 100, withdrawalAmount: 150, isFrozen: false, isVerified: true });
  assert.equal(results.length, 1);
  const r = results[0] as RuleResult;
  assert.equal(r.ruleId, "overdraft");
  assert.equal(r.matched, true);
  assert.equal(r.severity, "high");
  assert.match(r.reason ?? "", /exceeds balance/);
});

test("evaluateRules reports matched:false for non-matching rules", () => {
  const engine = addRule(
    createRuleEngine<AccountFacts>(),
    makeRule<AccountFacts>("overdraft", (c) => c.withdrawalAmount > c.balance),
  );
  const results = evaluateRules(engine, { balance: 500, withdrawalAmount: 100, isFrozen: false, isVerified: true });
  assert.equal(results[0]?.matched, false);
  assert.equal(results[0]?.severity, undefined);
});

test("evaluateRules runs the action only for matching rules", () => {
  const engine = addRule(
    addRule(
      createRuleEngine<AccountFacts>(),
      makeRule<AccountFacts>("frozen", (c) => c.isFrozen, {
        action: () => ({ block: true }),
      }),
    ),
    makeRule<AccountFacts>("verified", (c) => !c.isVerified, {
      action: () => ({ requireKyc: true }),
    }),
  );
  const results = evaluateRules(engine, {
    balance: 100,
    withdrawalAmount: 50,
    isFrozen: false,
    isVerified: true,
  });
  assert.equal(results[0]?.ruleId, "frozen");
  assert.equal(results[0]?.matched, false);
  assert.equal(results[0]?.output, undefined);
  assert.equal(results[1]?.ruleId, "verified");
  assert.equal(results[1]?.matched, false);
  assert.equal(results[1]?.output, undefined);
});

test("evaluateMatchingRules filters out non-matching results", () => {
  let engine = createRuleEngine<AccountFacts>();
  engine = addRule(engine, makeRule("a", () => true));
  engine = addRule(engine, makeRule("b", () => false));
  engine = addRule(engine, makeRule("c", () => true));
  const matches = evaluateMatchingRules(engine, {
    balance: 0,
    withdrawalAmount: 0,
    isFrozen: false,
    isVerified: false,
  });
  assert.equal(matches.length, 2);
  assert.deepEqual(
    matches.map((m) => m.ruleId),
    ["a", "c"],
  );
});

test("evaluateFirstMatch returns the highest-priority match", () => {
  let engine = createRuleEngine<AccountFacts>();
  engine = addRule(engine, makeRule("low-prio", () => true, { priority: 1 }));
  engine = addRule(engine, makeRule("high-prio", () => true, { priority: 100, action: () => "stop" }));
  engine = addRule(engine, makeRule("never", () => true, { priority: 0 }));
  const result = evaluateFirstMatch(engine, {
    balance: 0,
    withdrawalAmount: 0,
    isFrozen: false,
    isVerified: false,
  });
  assert.equal(result?.ruleId, "high-prio");
  assert.equal(result?.matched, true);
  assert.equal(result?.output, "stop");
});

test("evaluateFirstMatch returns null when nothing matches", () => {
  const engine = addRule(
    createRuleEngine<AccountFacts>(),
    makeRule<AccountFacts>("never", () => false),
  );
  const result = evaluateFirstMatch(engine, {
    balance: 0,
    withdrawalAmount: 0,
    isFrozen: false,
    isVerified: false,
  });
  assert.equal(result, null);
});

test("evaluateRules treats a thrown condition as a non-match", () => {
  const engine = addRule(
    createRuleEngine<AccountFacts>(),
    makeRule<AccountFacts>("throws", () => {
      throw new Error("cond-fail");
    }),
  );
  const results = evaluateRules(engine, {
    balance: 0,
    withdrawalAmount: 0,
    isFrozen: false,
    isVerified: false,
  });
  assert.equal(results[0]?.matched, false);
});

test("evaluateRules captures a thrown action as an error output", () => {
  const engine = addRule(
    createRuleEngine<AccountFacts>(),
    makeRule<AccountFacts>("bad-action", () => true, {
      action: () => {
        throw new Error("action-fail");
      },
    }),
  );
  const results = evaluateRules(engine, {
    balance: 0,
    withdrawalAmount: 0,
    isFrozen: false,
    isVerified: false,
  });
  assert.equal(results[0]?.matched, true);
  assert.deepEqual(results[0]?.output, { error: "action-fail" });
});

test("rules compose a realistic account-withdrawal gate", () => {
  let engine = createRuleEngine<AccountFacts>();
  engine = addRule(
    engine,
    makeRule<AccountFacts>("frozen-account", (c) => c.isFrozen, {
      priority: 100,
      severity: "critical",
      action: () => ({ block: true, reason: `account frozen` }),
    }),
  );
  engine = addRule(
    engine,
    makeRule<AccountFacts>("overdraft", (c) => c.withdrawalAmount > c.balance, {
      priority: 50,
      severity: "high",
      action: () => ({ block: true, reason: "insufficient funds" }),
    }),
  );
  engine = addRule(
    engine,
    makeRule<AccountFacts>("ok", (c) => !c.isFrozen && c.withdrawalAmount <= c.balance, {
      priority: 1,
      severity: "info",
      action: () => ({ block: false }),
    }),
  );
  // Frozen account: highest-priority rule wins.
  const frozen = evaluateFirstMatch(engine, {
    balance: 100,
    withdrawalAmount: 10,
    isFrozen: true,
    isVerified: true,
  });
  assert.equal(frozen?.ruleId, "frozen-account");
  assert.deepEqual(frozen?.output, { block: true, reason: "account frozen" });
  // Healthy withdrawal: only the ok rule matches.
  const ok = evaluateMatchingRules(engine, {
    balance: 100,
    withdrawalAmount: 10,
    isFrozen: false,
    isVerified: true,
  });
  assert.equal(ok.length, 1);
  assert.equal(ok[0]?.ruleId, "ok");
});
