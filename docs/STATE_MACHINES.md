# Distribution OS — State Machines

> Reference for every long-lived entity's state machine in Distribution
> OS. Each machine is defined as code (in the `*-pure.ts` module) and
> enforced by the runtime layer before any UPDATE.

Every state machine exposes three guarantees:

1. **`canTransition(from, to)`** — predicate the runtime calls before
   any UPDATE. Returns `false` for forbidden transitions.
2. **`isTerminal(status)`** — predicate that returns `true` for
   statuses with no outgoing transitions.
3. **Append-only transition log** — every transition is recorded as an
   `audit_events` row (best-effort) or a domain-specific event row
   (`mission_events`, etc.).

There are **8 state machines** plus the mission-stage cycle (which is
not strictly a state machine because it loops). Together they govern
the entire lifecycle of every tenant-scoped entity.

---

## Table of contents

1. [Action](#action)
2. [Evidence](#evidence)
3. [Experiment](#experiment)
4. [Payment](#payment)
5. [Connector](#connector)
6. [Contact](#contact)
7. [Content](#content)
8. [Agent run](#agent-run)
9. [Mission stage cycle](#mission-stage-cycle)
10. [Common invariants](#common-invariants)

---

## Action

**Module:** `db/actions-pure.ts`
**Table:** `action_queue`
**Statuses (7):** `prepared`, `approved`, `rejected`, `blocked`,
`expired`, `executed`, `failed`.

### Transition diagram

```
                       ┌──────────┐
                       │ prepared │  (initial)
                       └────┬─────┘
                            │
       ┌─────────┬──────────┼──────────┬─────────┐
       │         │          │          │         │
       ▼         ▼          ▼          ▼         ▼
  ┌────────┐ ┌────────┐ ┌────────┐ ┌─────────┐ ┌───────┐
  │approved│ │rejected│ │blocked │ │ expired │ │ failed│
  └───┬────┘ └────────┘ └────────┘ └─────────┘ └───────┘
      │         (terminal) (terminal) (terminal)  (terminal)
      │
      ├──────────┬──────────┐
      ▼          ▼          ▼
  ┌─────────┐ ┌─────────┐ ┌─────────┐
  │executed │ │ failed  │ │ blocked │
  └─────────┘ └─────────┘ │ expired │
  (terminal)  (terminal)  └─────────┘
                          (terminal)
```

### Transition table

```ts
export const ALLOWED_TRANSITIONS: Record<ActionStatus, ActionStatus[]> = {
  prepared:  ["approved", "rejected", "blocked", "expired", "failed"],
  approved:  ["executed", "failed", "blocked", "expired"],
  rejected:  [],   // terminal
  blocked:   [],   // terminal
  expired:   [],   // terminal
  executed:  [],   // terminal
  failed:    [],   // terminal
};
```

### Terminal statuses

`rejected`, `blocked`, `expired`, `executed`, `failed` — five
terminal states.

### Runtime enforcement

| Endpoint                                      | Transition             |
| --------------------------------------------- | ---------------------- |
| `POST /api/actions/[action_id]/approve`       | `prepared → approved`  |
| `POST /api/actions/[action_id]/reject`        | `prepared → rejected`  |
| `POST /api/actions/[action_id]/execute`       | `approved → executed`  |

The `expired` transition is triggered by a sweep job (roadmap) when
`expires_at < now`. The `failed` transition is triggered by the
adapter when a provider call returns a permanent error.

### Idempotency

Every action has a deterministic `idempotency_key` =
`${workspaceId}:${missionId}:${payloadHash}` (unique index). A second
INSERT with the same key is rejected, preventing double-enqueue of the
same payload.

---

## Evidence

**Module:** `db/evidence-pure.ts`
**Table:** `evidence`
**States (7):** `observed`, `inferred`, `needed`, `verified`,
`contradicted`, `stale`, `rejected`.

### Transition diagram

```
                ┌──────────┐
                │ observed │  (initial)
                └────┬─────┘
                     │
       ┌─────────────┼──────────────┬──────────────┬─────────┐
       ▼             ▼              ▼              ▼         ▼
  ┌─────────┐  ┌──────────┐  ┌────────────┐  ┌───────┐  ┌─────────┐
  │inferred │  │ verified │  │contradicted│  │ stale │  │ rejected│
  └────┬────┘  └────┬─────┘  └─────┬──────┘  └───┬───┘  └─────────┘
       │            │              │             │       (terminal)
       ├────────────┼──────────────┤             │
       │            ▼              ▼             │
       │       ┌────────┐    ┌──────────┐       │
       │       │ stale  │    │ verified │       │
       │       └────────┘    └──────────┘       │
       │                                       │
       ▼                                       ▼
  ┌──────────┐                           ┌──────────┐
  │ verified │                           │ observed │  (re-observe)
  └──────────┘                           └──────────┘

                ┌───────┐
                │ needed│  (alternative initial — pre-observation)
                └───┬───┘
                    │
            ┌───────┴───────┐
            ▼               ▼
       ┌──────────┐   ┌─────────┐
       │ observed │   │ rejected│
       └──────────┘   └─────────┘
                      (terminal)
```

### Transition table

```ts
export const EVIDENCE_TRANSITIONS: Record<EvidenceState, EvidenceState[]> = {
  observed:    ["inferred", "verified", "contradicted", "stale", "rejected"],
  inferred:    ["verified", "contradicted", "rejected", "stale"],
  needed:      ["observed", "rejected"],
  verified:    ["stale", "contradicted"],
  contradicted:["verified", "stale"],
  stale:       ["observed", "rejected"],
  rejected:    [],   // terminal
};
```

### Terminal status

`rejected` — single terminal state.

### Runtime enforcement

| Endpoint                                    | Transition                       |
| ------------------------------------------- | -------------------------------- |
| `POST /api/evidence/[evidence_id]/state`    | any permitted transition         |

### Content hash

Every evidence row has a `content_hash` (SHA-256 of canonical JSON of
`extracted_facts`). Two evidence rows with the same content hash are
the same observation; downstream code can deduplicate.

### `contradiction_of_id`

When a new evidence row contradicts an existing one, the new row's
`contradiction_of_id` points at the contradicted row, and the
contradicted row transitions to `contradicted`.

---

## Experiment

**Module:** `db/experiments-pure.ts`
**Table:** `experiments`
**Statuses (5):** `draft`, `running`, `completed`, `stopped`,
`blocked`.

### Transition diagram

```
        ┌───────┐
        │ draft │  (initial)
        └───┬───┘
            │
      ┌─────┴─────┐
      ▼           ▼
 ┌─────────┐  ┌────────┐
 │ running │  │blocked │
 └────┬────┘  └────┬───┘
      │            │
   ┌──┼──────┐     │
   ▼  ▼      ▼     │
┌──────────┐┌──────┐│
│completed ││stopped││
└──────────┘└──────┘│
(terminal)  (terminal)│
                     │
                     ▼
              ┌─────────────┐
              │ draft       │  (recoverable back to draft or running)
              │ or running  │
              └─────────────┘
```

### Transition table

```ts
export const EXPERIMENT_TRANSITIONS: Record<ExperimentStatus, ExperimentStatus[]> = {
  draft:     ["running", "blocked"],
  running:   ["completed", "stopped", "blocked"],
  completed: [],   // terminal
  stopped:   [],   // terminal
  blocked:   ["draft", "running"],
};
```

### Terminal statuses

`completed`, `stopped` — two terminal states.

### Runtime enforcement

| Endpoint                                            | Transition                     |
| --------------------------------------------------- | ------------------------------ |
| `POST /api/experiments/[experiment_id]/status`      | any permitted transition       |

### Kill rule

`shouldKill({ currentMetric, threshold, result })` returns `true` when
`currentMetric < threshold && result === null`. When the kill rule
fires, the adapter transitions the experiment to `stopped` and records
a `mission_events` row.

### Decision field

The `decision` column (`continue` / `change` / `stop` / `blocked` /
`pending`) is orthogonal to `status` — it captures the analyst's
recommendation, not the lifecycle position.

---

## Payment

**Module:** `db/attribution-pure.ts`
**Table:** `payments`
**Statuses (5):** `pending`, `succeeded`, `refunded`, `disputed`,
`failed`.

### Transition diagram

```
        ┌─────────┐
        │ pending │  (initial)
        └────┬────┘
             │
        ┌────┴────┐
        ▼         ▼
  ┌───────────┐ ┌───────┐
  │ succeeded │ │ failed│
  └─────┬─────┘ └───────┘
        │         (terminal)
   ┌────┴────┐
   ▼         ▼
┌─────────┐┌──────────┐
│refunded ││disputed  │
└─────────┘└──────────┘
(terminal) (terminal)
```

### Transition table

```ts
export const PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  pending:   ["succeeded", "failed"],
  succeeded: ["refunded", "disputed"],
  refunded:  [],   // terminal
  disputed:  [],   // terminal
  failed:    [],   // terminal
};
```

### Terminal statuses

`refunded`, `disputed`, `failed` — three terminal states.

### Runtime enforcement

| Source                              | Transition                |
| ----------------------------------- | ------------------------- |
| Stripe webhook `payment_intent.succeeded` | `pending → succeeded` |
| Stripe webhook `charge.refunded`    | `succeeded → refunded`    |
| Stripe webhook `charge.disputed.created` | `succeeded → disputed` |
| Stripe webhook `payment_intent.payment_failed` | `pending → failed` |

`recordPayment` (in `db/payments.ts`) upserts by the natural key
`(workspace_id, provider, provider_payment_id)` and refuses illegal
transitions via `canTransition`.

### Attribution confidence

When a payment reaches `succeeded`, `calculateAttributionConfidence`
scores the attribution on a 0–100 scale based on the number of
matching touchpoints:

| # matching touchpoints | Confidence |
| ---------------------- | ---------- |
| 0                      | 0          |
| 1                      | 90         |
| 2+                     | 75         |
| 0 matches (ambiguous)  | 20         |

A touchpoint matches when it shares a `mission_id` or `action_id` with
the payment.

---

## Connector

**Module:** `db/connectors-pure.ts`
**Table:** `connector_installations`
**Statuses (8):** `setup_required`, `authorized`, `connected`,
`healthy`, `degraded`, `disconnected`, `revoked`, `error`.

### Transition diagram

```
        ┌───────────────┐
        │ setup_required│  (initial)
        └───────┬───────┘
                │
       ┌────────┴────────┐
       ▼                 ▼
 ┌───────────┐    ┌──────────────┐
 │ authorized│    │ disconnected │
 └─────┬─────┘    └──────┬───────┘
       │                 │
       ├──────────┐      │
       ▼          ▼      ▼
 ┌───────────┐  ┌─────────┐
 │ connected │  │  error  │
 └─────┬─────┘  └────┬────┘
       │             │
   ┌───┴────┐        │
   ▼        ▼        │
┌────────┐┌────────┐ │
│healthy ││degraded│ │
└───┬────┘└───┬────┘ │
    │          │      │
    └────┬─────┘      │
         │            │
         ▼            ▼
   ┌──────────────┐  ┌──────────────┐
   │ disconnected │  │ authorized   │  (recoverable)
   │ or revoked   │  └──────────────┘
   │ or error     │
   └──────────────┘

              ┌─────────┐
              │ revoked │  (terminal — only reachable explicitly)
              └─────────┘
```

### Transition table

```ts
export const CONNECTOR_TRANSITIONS: Record<ConnectorStatus, ConnectorStatus[]> = {
  setup_required: ["authorized", "disconnected"],
  authorized:     ["connected", "disconnected", "error"],
  connected:      ["healthy", "degraded", "disconnected", "error"],
  healthy:        ["degraded", "disconnected", "error"],
  degraded:       ["healthy", "disconnected", "error"],
  disconnected:   ["setup_required"],
  revoked:        [],   // terminal
  error:          ["authorized", "disconnected"],
};
```

### Terminal status

`revoked` — single terminal state.

### Runtime enforcement

| Endpoint                                            | Transition                     |
| --------------------------------------------------- | ------------------------------ |
| `POST /api/connector-installations`                 | creates with `setup_required`  |
| `GET/PATCH /api/connectors/[provider]`              | any permitted transition       |
| `GET/POST /api/connector-installations`             | upsert + health-check          |

### Token expiry

`isTokenExpired(expiresAt, now)` returns `true` when `expiresAt <= now`
(null expiry = never expires). When a token expires, the adapter
transitions the connector to `degraded` and writes `last_error =
"token_expired"`.

### Health check

`needsHealthCheck(row, now, intervalMs = 5 * 60 * 1000)` returns
`true` when the connector is in an actively-serving state
(`connected`, `healthy`, `degraded`) and either has never been
health-checked or the last check is older than `intervalMs`. A sweep
job (roadmap) will use this to schedule periodic health checks.

---

## Contact

**Module:** `db/contacts-pure.ts`
**Table:** `contacts`
**Statuses (8):** `new`, `qualified`, `contacted`, `replied`,
`meeting`, `converted`, `rejected`, `unsubscribed`.

### Transition diagram

```
        ┌─────┐
        │ new │  (initial)
        └──┬──┘
           │
   ┌───────┼──────────┐
   ▼       ▼          ▼
┌──────────┐┌──────────┐┌──────────┐
│qualified ││contacted ││ rejected │
└────┬─────┘└────┬─────┘└──────────┘
     │           │       (terminal)
     └──┐        │
        ▼        │
   ┌──────────┐  │
   │contacted │◀─┘
   └────┬─────┘
        │
   ┌────┼────────┐
   ▼    ▼        ▼
┌──────┐┌──────────┐┌──────────┐
│replied││rejected  ││qualified │
└──┬───┘└──────────┘└──────────┘
   │    (terminal)
   ├─────────┐
   ▼         ▼
┌─────────┐┌──────────┐
│ meeting ││converted │
└────┬────┘└──────────┘
     │     (terminal)
     ├─────────┐
     ▼         ▼
┌──────────┐┌──────────┐
│converted ││ rejected │
└──────────┘└──────────┘
(terminal)   (terminal)

   ┌──────────────┐
   │unsubscribed  │  (terminal — reachable from any state via explicit opt-out)
   └──────────────┘
```

### Transition table

```ts
export const CONTACT_TRANSITIONS: Readonly<Record<string, readonly string[]>> = {
  new:          ["qualified", "contacted", "rejected"],
  qualified:    ["contacted", "rejected"],
  contacted:    ["replied", "rejected", "qualified"],
  replied:      ["meeting", "converted", "rejected"],
  meeting:      ["converted", "rejected"],
  converted:    [],   // terminal
  rejected:     [],   // terminal
  unsubscribed: [],   // terminal
};
```

### Terminal statuses

`converted`, `rejected`, `unsubscribed` — three terminal states.

### Runtime enforcement

| Endpoint                                            | Transition               |
| --------------------------------------------------- | ------------------------ |
| `POST /api/contacts`                                | creates with `new`       |
| `PATCH /api/contacts/[contact_id]/status`           | any permitted transition |

### Validation invariants

- `status = converted` requires `converted_at > 0`.
- `status = contacted` requires `last_contacted_at > 0`.
- `email` (when provided) must pass `validateEmail`.
- `qualification_signals_json` must parse to a JSON object (not array).

### Redaction

`summarizeForDisplay` always returns `qualification_signals:
"redacted"` and exposes only a `signal_count`. The raw signals may
contain PII / sensitive inferences and must never leak to the UI.

---

## Content

**Module:** `db/content-assets-pure.ts`
**Table:** `content_assets`
**Statuses (7):** `draft`, `in_review`, `approved`, `scheduled`,
`published`, `failed`, `archived`.

### Transition diagram

```
        ┌───────┐
        │ draft │  (initial)
        └───┬───┘
            │
       ┌────┴─────┐
       ▼          ▼
 ┌──────────┐ ┌──────────┐
 │in_review │ │archived  │
 └────┬─────┘ └──────────┘
      │       (terminal)
   ┌──┼──────┐
   ▼  ▼      ▼
┌────────┐┌───────┐┌──────────┐
│approved││ draft ││archived  │
└───┬────┘└───────┘└──────────┘
    │
   ┌┼─────────┐
   ▼          ▼
┌──────────┐┌──────────┐
│scheduled ││published │
└────┬─────┘└────┬─────┘
     │           │
     ├──┐        ▼
     │  ▼    ┌──────────┐
     │  ┌──────────┐    │
     │  │published │    │
     │  └────┬────┘    │
     │       │         │
     ▼       ▼         ▼
┌──────────┐    ┌──────────┐
│ failed   │    │archived  │
└────┬─────┘    └──────────┘
     │          (terminal)
     ▼
┌───────┐
│ draft │  (recoverable from failed)
└───────┘
```

### Transition table

```ts
export const CONTENT_TRANSITIONS: Readonly<Record<string, readonly string[]>> = {
  draft:     ["in_review", "archived"],
  in_review: ["approved", "draft", "archived"],
  approved:  ["scheduled", "published", "archived"],
  scheduled: ["published", "approved", "failed"],
  published: ["archived"],
  failed:    ["draft", "archived"],
  archived:  [],   // terminal
};
```

### Terminal status

`archived` — single terminal state.

### Runtime enforcement

| Endpoint                                            | Transition               |
| --------------------------------------------------- | ------------------------ |
| `POST /api/missions/[mission_id]/content`           | creates with `draft`     |
| (workflow endpoint — roadmap)                       | any permitted transition |

### Validation invariants

- `status = approved` requires `approved_by` AND `approved_at > 0`.
- `status = scheduled` requires `scheduled_at > 0`.
- `status = published` requires `published_at > 0`.
- `hook` ≤ 280 chars; `body` ≤ 5000 chars.

### Variant chain

`variant_of_id` self-references the parent content asset for A/B
variants. Variants inherit the parent's `mission_id` and `platform`.

---

## Agent run

**Module:** `db/agent-runs-pure.ts`
**Table:** `agent_runs` and `agent_steps`
**Statuses (4):** `running`, `completed`, `failed`, `cancelled`.

### Transition diagram

```
        ┌─────────┐
        │ running │  (initial)
        └────┬────┘
             │
   ┌─────────┼─────────┐
   ▼         ▼         ▼
┌──────────┐┌───────┐┌──────────┐
│completed ││failed ││cancelled │
└──────────┘└───────┘└──────────┘
(terminal)  (terminal)(terminal)
```

### Transition table

```ts
// Run
const TERMINAL_RUN_STATUSES: AgentRunStatus[] = ["completed", "failed", "cancelled"];
const RUN_TRANSITIONS_FROM_RUNNING: AgentRunStatus[] = ["completed", "failed", "cancelled"];

export function canTransitionRun(from: AgentRunStatus, to: AgentRunStatus): boolean {
  if (TERMINAL_RUN_STATUSES.includes(from)) return false;
  if (from === "running") return RUN_TRANSITIONS_FROM_RUNNING.includes(to);
  return false;
}

// Step — mirrors the run machine
export const STEP_STATUSES = ["running", "completed", "failed", "cancelled"] as const;
```

### Terminal statuses

`completed`, `failed`, `cancelled` — three terminal states (for both
runs and steps).

### Runtime enforcement

Agent runs are created by the AI CMO orchestrator (in
`lib/orchestrator-pure.ts`). The adapter:

1. Inserts an `agent_runs` row with `status = running` and
   `started_at = now`.
2. Inserts `agent_steps` rows as the agent executes tool calls.
3. On completion, updates `status = completed`,
   `completed_at = now`, `latency_ms = completed_at - started_at`,
   `tokens_input`, `tokens_output`, `cost_cents` (via
   `calculateCost`).
4. On failure, updates `status = failed`, `error = message`.
5. On cancellation (operator abort), updates `status = cancelled`.

### Cost calculation

```ts
// gpt-4: 0.003 / 0.006 cents per input/output token
// gpt-5: 0.005 / 0.01  cents per input/output token
// unknown model: falls back to gpt-4 pricing
calculateCost(model, tokensInput, tokensOutput) → number (cents)
```

### Redaction

`summarizeRunForDisplay` strips `workspace_id`, `input_refs_json`,
`output_refs_json`. `summarizeStepForDisplay` strips
`tool_input_json`, `tool_output_json` (which frequently contain raw
API responses).

---

## Mission stage cycle

**Module:** `lib/mission-lifecycle-pure.ts`
**Stages (5):** `observe`, `decide`, `act`, `measure`, `learn`.

Unlike the 8 state machines above, the mission stage **cycles** —
`learn` transitions back to `observe`, incrementing `cycle_number`.

### Cycle diagram

```
        ┌──────────┐
        │ observe  │  (initial)
        └────┬─────┘
             │
             ▼
        ┌──────────┐
        │ decide   │
        └────┬─────┘
             │
             ▼
        ┌──────────┐
        │  act     │  ◀── requires missions.approved = true
        └────┬─────┘
             │
             ▼
        ┌──────────┐
        │ measure  │  ◀── requires ≥1 open experiment
        └────┬─────┘
             │
             ▼
        ┌──────────┐
        │  learn   │
        └────┬─────┘
             │
             │  cycle_number++
             ▼
        ┌──────────┐
        │ observe  │  (next cycle)
        └──────────┘
```

### Transition table

```ts
export const STAGE_TRANSITIONS: Record<MissionStage, MissionStage> = {
  observe: "decide",
  decide:  "act",
  act:     "measure",
  measure: "learn",
  learn:   "observe",
};

export function shouldIncrementCycle(from: string, to: string): boolean {
  return from === "learn" && to === "observe";
}
```

### Readiness rules

`getMissionReadiness(mission, { pendingApprovals, openExperiments })`
returns:

- `can_advance: boolean` — `true` when no blocking reasons.
- `requires_approval: boolean` — `true` when the `act` stage is
  blocked by missing approval.
- `blocking_reasons: string[]` — human-readable list.
- `readiness_score: number` — `100 - 25 * blocking_reasons.length`,
  clamped to `[0, 100]`.

### Blocking reasons

- `act` stage with `approved = false` → blocks (requires human
  approval).
- `pendingApprovals > 0` → blocks (action queue has pending items).
- `measure` stage with `openExperiments === 0` → blocks (need at least
  one running experiment to measure).

### Auto-advance

`shouldAutoAdvance(mission, conditions)` returns `true` only when:

- `pendingApprovals === 0`,
- the `act` stage is approved (or current stage isn't `act`),
- the `measure` stage has at least one open experiment (or current
  stage isn't `measure`),
- `paymentCount === 0` (the loop stops auto-advancing once the first
  payment is verified).

### Progress

`getMissionProgress(mission)` returns:

- `100` when `payment_count > 0` (objective achieved).
- Otherwise `min(99, round((stageIndex + 1) / 5 * 100))` — never
  reports 100% until the first payment is confirmed.

---

## Common invariants

### All machines

1. **`canTransition` is the only gate.** The runtime layer must call
   `canTransition(current, next)` before any UPDATE. A `false` return
   yields an HTTP `409 Conflict` (or domain-specific error).
2. **Terminal statuses have no outgoing transitions.** Once an entity
   is terminal, the only way to "restart" it is to create a new row
   (e.g. a new contact, a new content asset).
3. **Every transition is audited.** Best-effort `audit_events` row
   written by the adapter, with `event_category` matching the entity
   (e.g. `action`, `payment`, `connector`).
4. **State enums are `as const` arrays in `db/schema.ts`** and
   re-exported from the `*-pure.ts` module. Adding a status is a
   schema change → migration → test update.

### Test coverage

Every state machine has a transition-table test in `tests/*.test.ts`
that asserts:

- Every permitted transition returns `true`.
- Every forbidden transition returns `false`.
- Terminal statuses have `ALLOWED_TRANSITIONS[status].length === 0`.

See [`TESTING.md`](./TESTING.md#pattern-3--state-machine-transition-table)
for the test pattern and [`tests/actions.test.ts`](../tests/actions.test.ts)
for the canonical example.
