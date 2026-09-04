# Distribution OS — Testing Guide

> How we test Distribution OS. Covers test structure, running tests,
> writing new tests, common patterns, and coverage goals.

Distribution OS is built around a strict separation between **pure
business logic** (in `lib/*-pure.ts` and `db/*-pure.ts`) and **runtime
adapters** (route handlers, the Worker entry point, the D1 access
layer). The test suite leans into this separation: every pure module
has a sibling `tests/*.test.ts` that exercises it in isolation, with
no D1 binding, no network, no wall clock.

---

## Table of contents

1. [Test runner](#test-runner)
2. [Test structure](#test-structure)
3. [Running tests](#running-tests)
4. [Writing a new test](#writing-a-new-test)
5. [Common patterns](#common-patterns)
6. [Coverage goals](#coverage-goals)
7. [Test inventory](#test-inventory)
8. [CI integration](#ci-integration)

---

## Test runner

We use the Node.js built-in test runner (`node:test`) with
`node:assert/strict`. No Jest, no Mocha, no Vitest — the built-in runner
is fast, has zero install cost, and integrates cleanly with
`node --test`.

| Concern             | Choice                                                |
| ------------------- | ----------------------------------------------------- |
| Runner              | `node:test` (built into Node ≥22.13)                  |
| Assertions          | `node:assert/strict`                                  |
| File extension      | `.test.ts` (pure-logic) / `.test.mjs` (rendered HTML) |
| Build prerequisite  | `npm run build` (TypeScript → JS)                     |
| Test discovery      | `node --test tests/*.test.mjs`                        |

The build step transpiles `.ts` test files to `.mjs` in the build
output; `node --test tests/*.test.mjs` then runs them. The `.mjs`
extension on the glob is intentional — it filters out the `.ts` source
files that have not been transpiled yet.

---

## Test structure

```
tests/
├── accessibility.test.ts        ← lib/accessibility-pure.ts
├── actions.test.ts              ← db/actions-pure.ts
├── agent-runs.test.ts           ← db/agent-runs-pure.ts
├── api-errors.test.ts           ← lib/api-errors-pure.ts
├── attribution-model.test.ts    ← lib/attribution-model-pure.ts
├── attribution.test.ts          ← db/attribution-pure.ts (+ db/payments.ts)
├── audit.test.ts                ← db/audit-pure.ts
├── brand-safety.test.ts         ← lib/brand-safety-pure.ts
├── budget.test.ts               ← lib/budget-pure.ts
├── connectors.test.ts           ← db/connectors-pure.ts
├── content-assets.test.ts       ← db/content-assets-pure.ts
├── content-sanitize.test.ts     ← lib/content-sanitize-pure.ts
├── content-variants.test.ts     ← lib/content-variants-pure.ts
├── contacts.test.ts             ← db/contacts-pure.ts
├── datetime.test.ts             ← lib/datetime-pure.ts
├── evidence.test.ts             ← db/evidence-pure.ts
├── experiments.test.ts          ← db/experiments-pure.ts
├── idempotency.test.ts          ← lib/idempotency-pure.ts
├── mission-lifecycle.test.ts    ← lib/mission-lifecycle-pure.ts
├── observability.test.ts        ← lib/observability-pure.ts
├── orchestrator.test.ts         ← lib/orchestrator-pure.ts
├── organizations.test.ts        ← db/organizations.ts (slug, role hierarchy)
├── pagination.test.ts           ← lib/pagination-pure.ts
├── rate-limit.test.ts           ← lib/rate-limit-pure.ts
├── rendered-html.test.mjs       ← landing-page HTML structure (post-build)
├── token-cost.test.ts           ← lib/token-cost-pure.ts
├── ui-components.test.mjs       ← shadcn registry smoke tests (post-build)
├── url-safety.test.ts           ← lib/url-safety.ts
├── validation.test.ts           ← lib/validation-pure.ts
├── versions.test.ts             ← db/versions-pure.ts
├── webhook-router.test.ts       ← lib/webhook-router-pure.ts
├── webhook-signature.test.ts    ← lib/webhook-signature-pure.ts
└── workspace-settings.test.ts   ← db/workspace-settings-pure.ts
```

Each test file mirrors its source module's name. Pure-logic tests are
`.test.ts`; integration / build-dependent tests are `.test.mjs`.

---

## Running tests

### Full suite (build + test)

```bash
npm run test
```

This runs `npm run build && node --test tests/*.test.mjs`. The build is
required because the `.ts` tests are transpiled to `.mjs` during the
build.

### Tests only (skipping the build)

If you've already built (e.g. via `npm run dev` or a previous
`npm run build`), you can skip the build:

```bash
node --test tests/*.test.mjs
```

### Filter by name

```bash
node --test --test-name-pattern="state machine" tests/*.test.mjs
```

### Filter by file

```bash
node --test tests/url-safety.test.mjs
```

### Watch mode

Node's built-in test runner does not yet have a watch mode. Use
`nodemon` or rerun manually:

```bash
nodemon --exec "node --test tests/url-safety.test.mjs" -- tests/ lib/url-safety.ts
```

### Verbose output

```bash
node --test --test-reporter=spec tests/*.test.mjs
```

### TAP output (for CI)

```bash
node --test --test-reporter=tap tests/*.test.mjs > test-results.tap
```

---

## Writing a new test

### 1. Identify the source module

Every pure module is in `lib/*-pure.ts` or `db/*-pure.ts`. If the
function you're testing has any I/O (D1, fetch, `Date.now()`,
`Math.random()`), it should either:

- Be moved into the pure module with an injectable dependency (e.g.
  `nowMs: number` parameter), OR
- Live in the runtime adapter (`db/*.ts` or `app/api/**/route.ts`) and
  be tested via an integration test.

### 2. Create the test file

The test file should be named `tests/<module-name>.test.ts` (drop the
`-pure` suffix for clarity). For example, `lib/foo-pure.ts` →
`tests/foo.test.ts`.

### 3. Use the standard scaffold

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { /* exports under test */ } from "../lib/foo-pure";

test("foo() returns the expected value for typical input", () => {
  const result = foo("input");
  assert.equal(result, "expected");
});

test("foo() throws on invalid input", () => {
  assert.throws(() => foo(""), /non-empty/);
});

test("foo() is deterministic across calls", () => {
  const a = foo("input");
  const b = foo("input");
  assert.equal(a, b);
});
```

### 4. Run the new test

```bash
node --test tests/foo.test.mjs    # after a build
# OR
npm run test                       # full build + test
```

### 5. Assert the new file is picked up

The `npm run test` glob is `tests/*.test.mjs`, so any `.test.ts` file
in `tests/` will be transpiled and discovered automatically.

---

## Common patterns

### Pattern 1 — Pure function with explicit `now`

Pure modules that need time take `nowMs` as an explicit parameter so the
test is deterministic without mocking the wall clock:

```ts
// lib/idempotency-pure.ts
export function isRecordValid(record: IdempotencyRecord, nowMs: number): boolean {
  return nowMs < record.expiresAtMs;
}

// tests/idempotency.test.ts
test("isRecordValid returns false at expiry boundary", () => {
  const record = { expiresAtMs: 1000 } as IdempotencyRecord;
  assert.equal(isRecordValid(record, 999), true);
  assert.equal(isRecordValid(record, 1000), false);
  assert.equal(isRecordValid(record, 1001), false);
});
```

### Pattern 2 — Injectable fetch for SSRF tests

`fetchWithRedirectLimit` accepts a `fetchImpl` override so tests can
simulate redirect chains, timeouts, and oversized bodies without
network:

```ts
test("rejects when Location points at a private IP", async () => {
  const fakeFetch = async (url: string) =>
    new Response(null, {
      status: 302,
      headers: { location: "http://169.254.169.254/" },
    });
  await assert.rejects(
    () => fetchWithRedirectLimit("https://example.com", { fetchImpl: fakeFetch }),
    /Private\/reserved/,
  );
});
```

### Pattern 3 — State-machine transition table

Every state machine exposes `canTransition(from, to)` and
`isTerminal(status)`. Tests iterate every permitted and forbidden
transition:

```ts
test("every permitted transition returns true", () => {
  for (const [from, targets] of Object.entries(ALLOWED_TRANSITIONS)) {
    for (const to of targets) {
      assert.equal(canTransition(from as ActionStatus, to as ActionStatus), true);
    }
  }
});

test("terminal statuses have no outgoing transitions", () => {
  for (const status of ACTION_STATUSES) {
    assert.equal(
      isTerminal(status),
      ALLOWED_TRANSITIONS[status].length === 0,
    );
  }
});
```

### Pattern 4 — Constant-time comparison

For HMAC verification, tests assert that length-mismatched inputs
return `false` immediately and that the comparison is constant-time
(no early-exit on first-byte mismatch):

```ts
test("timingSafeEqual returns false for different-length inputs", () => {
  assert.equal(timingSafeEqual("abc", "abcd"), false);
});

test("timingSafeEqual returns true for equal inputs", () => {
  assert.equal(timingSafeEqual("abc", "abc"), true);
});
```

### Pattern 5 — Redaction assertions

For `summarizeForDisplay` projections, assert that every sensitive field
is gone and every safe field is preserved:

```ts
test("summarizeForDisplay redacts token_reference and workspace_id", () => {
  const summary = summarizeForDisplay(row);
  assert.equal("token_reference" in summary, false);
  assert.equal("workspace_id" in summary, false);
  assert.equal(summary.provider, row.provider);
  assert.equal(summary.status, row.status);
});
```

### Pattern 6 — Build-dependent `.test.mjs`

For tests that need the built output (e.g. rendered HTML, shadcn
component smoke tests), use `.test.mjs` and import from the build
output:

```js
// tests/rendered-html.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("landing page contains the hero CTA", () => {
  const html = readFileSync("./dist/index.html", "utf-8");
  assert.match(html, /Launch a mission/);
});
```

---

## Coverage goals

| Surface                          | Goal          | Current                                       |
| -------------------------------- | ------------- | --------------------------------------------- |
| Pure modules (`lib/*-pure.ts`)   | 100% line     | 33 test files covering all 21 lib modules     |
| Pure modules (`db/*-pure.ts`)    | 100% line     | 12 test files covering all 12 db pure modules |
| State-machine transition tables  | 100% branches | Every (from, to) pair asserted                |
| Sanitisation / redaction helpers | 100% line     | Every `summarizeForDisplay` asserted          |
| Route handlers                   | Smoke         | Manual + 1 build-dependent HTML test          |
| D1 access layer (`db/*.ts`)      | Manual        | Not unit-tested (requires D1 binding)         |

We do not currently enforce a coverage percentage in CI. The
expectation is that **every new pure function** ships with a sibling
test, and **every new state machine** ships with a transition-table
test.

### How to check coverage manually

```bash
node --test --experimental-test-coverage tests/*.test.mjs
```

This prints per-file line coverage. Investigate any file below 90%.

---

## Test inventory

| Test file                          | Source module                              | Focus                                              |
| ---------------------------------- | ------------------------------------------ | -------------------------------------------------- |
| `accessibility.test.ts`            | `lib/accessibility-pure.ts`                | ARIA id generation, status labels.                 |
| `actions.test.ts`                  | `db/actions-pure.ts`                       | 7-status machine, payload hash, idempotency key.   |
| `agent-runs.test.ts`               | `db/agent-runs-pure.ts`                    | 4-status machine, cost calculator, latency.        |
| `api-errors.test.ts`               | `lib/api-errors-pure.ts`                   | HTTP status map, serialization, fromThrownError.   |
| `attribution-model.test.ts`        | `lib/attribution-model-pure.ts`            | 5 attribution models + edge cases.                 |
| `attribution.test.ts`              | `db/attribution-pure.ts`                   | Payment lifecycle, touchpoint matching, confidence.|
| `audit.test.ts`                    | `db/audit-pure.ts`                         | Row builder, IP hash, time/category filters.       |
| `brand-safety.test.ts`             | `lib/brand-safety-pure.ts`                 | 15 forbidden claims + custom claims + sanitizer.   |
| `budget.test.ts`                   | `lib/budget-pure.ts`                       | Severity bands, monthly/daily reset, formatting.   |
| `connectors.test.ts`               | `db/connectors-pure.ts`                    | 8-status machine, token expiry, health check.      |
| `content-assets.test.ts`           | `db/content-assets-pure.ts`                | 7-status machine, variant chain, validation.       |
| `content-sanitize.test.ts`         | `lib/content-sanitize-pure.ts`             | HTML strip + 12 injection patterns.                |
| `content-variants.test.ts`         | `lib/content-variants-pure.ts`             | CTR / CVR / variant score.                         |
| `contacts.test.ts`                 | `db/contacts-pure.ts`                      | 8-status lifecycle, email validation, redaction.   |
| `datetime.test.ts`                 | `lib/datetime-pure.ts`                     | Relative time, quiet-hours wrap, formatting.       |
| `evidence.test.ts`                 | `db/evidence-pure.ts`                      | 7-state machine, content hash, canonical JSON.     |
| `experiments.test.ts`              | `db/experiments-pure.ts`                   | 5-status machine, kill rule, validation.           |
| `idempotency.test.ts`              | `lib/idempotency-pure.ts`                  | Key, TTL, payload hash, error classification.      |
| `mission-lifecycle.test.ts`        | `lib/mission-lifecycle-pure.ts`            | 5-stage loop, readiness, auto-advance.             |
| `observability.test.ts`            | `lib/observability-pure.ts`                | Metric + log entry builders, level filter.         |
| `orchestrator.test.ts`             | `lib/orchestrator-pure.ts`                 | 15-agent registry, topological scheduling.         |
| `organizations.test.ts`            | `db/organizations.ts`                      | Slug uniqueness, role hierarchy, invitations.      |
| `pagination.test.ts`               | `lib/pagination-pure.ts`                   | page/limit parsing, clamping, offset.              |
| `rate-limit.test.ts`               | `lib/rate-limit-pure.ts`                   | Token bucket refill, denial, retry-after.          |
| `rendered-html.test.mjs`           | `app/page.tsx` (build output)              | Landing page HTML structure.                       |
| `token-cost.test.ts`               | `lib/token-cost-pure.ts`                   | Per-model pricing, optimal selection, formatting.  |
| `ui-components.test.mjs`           | `components/ui/**` (build output)          | shadcn registry smoke tests.                       |
| `url-safety.test.ts`               | `lib/url-safety.ts`                        | SSRF ranges, redirect chains, body cap, timeout.   |
| `validation.test.ts`               | `lib/validation-pure.ts`                   | String / email / number primitives.                |
| `versions.test.ts`                 | `db/versions-pure.ts`                      | Mission/strategy versioning, diff renderer.        |
| `webhook-router.test.ts`           | `lib/webhook-router-pure.ts`               | Multi-source classification, dedup keys.           |
| `webhook-signature.test.ts`        | `lib/webhook-signature-pure.ts`            | HMAC, replay window, constant-time compare.        |
| `workspace-settings.test.ts`       | `db/workspace-settings-pure.ts`            | Budget policy, quiet-hours, forbidden claims.      |

That's **34 test files** covering **33 pure modules** + 2 build-
dependent integration tests.

---

## CI integration

The `npm run test` script is the single entry point for CI. A typical
GitHub Actions step:

```yaml
- name: Install
  run: npm run install:ci

- name: Lint
  run: npm run lint

- name: Test
  run: npm run test
```

### Parallelisation

`node --test` runs files in parallel by default (one process per CPU
core). No special configuration needed.

### Test artifacts

For TAP-compatible CI dashboards:

```bash
node --test --test-reporter=tap tests/*.test.mjs > test-results.tap
```

### Failure exit code

`node --test` exits non-zero if any test fails. CI should treat any
non-zero exit as a build break.

### Build dependency

Because `npm run test` runs `npm run build` first, a TypeScript compile
error will fail the test step before any test runs. This is intentional
— type errors are test failures.
