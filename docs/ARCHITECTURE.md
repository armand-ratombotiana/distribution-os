# Distribution OS — Architecture

> Canonical architecture reference for the agentic marketing & distribution
> operating system. This document is the source of truth for the runtime
> stack, data model, API surface, UI surface, pure-logic modules, security
> layers, state machines, attribution models, the AI CMO orchestrator, and
> GDPR compliance posture.

Distribution OS turns a single public website URL into a continuously
improving go-to-market mission. Six specialist agents share one mission,
one memory (the evidence ledger) and one measurable objective: the first
attributable verified payment. Every external action is approval-gated.
Every cycle produces revenue evidence or new information that feeds the
next iteration.

---

## Table of contents

1. [High-level diagram](#high-level-diagram)
2. [Runtime stack](#runtime-stack)
3. [Request lifecycle](#request-lifecycle)
4. [Data model — 16 logical tables (21 physical)](#data-model)
5. [API surface — 28+ endpoints](#api-surface)
6. [Workspace UI — 12 panels](#workspace-ui)
7. [Pure business-logic modules — 31+ modules](#pure-modules)
8. [Security layers](#security-layers)
9. [State machines](#state-machines)
10. [Attribution models](#attribution-models)
11. [AI CMO orchestrator](#ai-cmo-orchestrator)
12. [GDPR compliance posture](#gdpr-compliance-posture)
13. [Observability](#observability)
14. [Related documents](#related-documents)

---

## High-level diagram

```
                       ┌──────────────────────────────────────┐
                       │   ChatGPT hosting control plane       │
                       │   (injects identity headers)          │
                       └─────────────────┬────────────────────┘
                                         │ HTTPS
                                         ▼
                ┌──────────────────────────────────────────────────┐
                │   Cloudflare Worker (worker/index.ts)            │
                │   • Image optimisation endpoint                  │
                │   • Delegates to vinext App Router handler       │
                └─────────────────┬────────────────────────────────┘
                                  │
                                  ▼
                ┌──────────────────────────────────────────────────┐
                │   Next.js 16 App Router (vinext + vite-plugin-rsc)│
                │                                                  │
                │   app/api/**         Route handlers (28+ routes) │
                │   app/workspace/**   12-panel operator UI         │
                │   app/page.tsx       Public landing page          │
                │   app/chatgpt-auth.* Identity header parsing      │
                └─────────────────┬────────────────────────────────┘
                                  │
            ┌─────────────────────┼─────────────────────┐
            ▼                     ▼                     ▼
   ┌─────────────────┐  ┌──────────────────┐  ┌────────────────────┐
   │  lib/*-pure.ts  │  │   db/*.ts        │  │  External services │
   │  31+ pure       │  │  D1 access layer │  │  OpenAI / Stripe / │
   │  business rules │  │  + *-pure.ts     │  │  social connectors │
   └─────────────────┘  └────────┬─────────┘  └────────────────────┘
                                 │
                                 ▼
                ┌──────────────────────────────────────────────────┐
                │   Cloudflare D1 (SQLite)                          │
                │   21 tables across 16 logical groups              │
                │   • workspaces, missions, evidence, payments,     │
                │     experiments, actions, contacts, content,      │
                │     connectors, agents, audit, organizations      │
                └──────────────────────────────────────────────────┘
```

---

## Runtime stack

| Layer              | Technology                                                              |
| ------------------ | ----------------------------------------------------------------------- |
| Runtime            | Cloudflare Workers (`@cloudflare/vite-plugin` + `worker/index.ts`)      |
| Web framework      | Next.js 16 (App Router, React Server Components) via `vinext`           |
| Build              | Vite 8 + `vinext` + `@vitejs/plugin-rsc`                                |
| Database           | Cloudflare D1 (SQLite) via Drizzle ORM 0.45                             |
| Migrations         | Drizzle Kit (`db/schema.ts` → `drizzle/*.sql`)                          |
| Auth               | ChatGPT-hosted identity headers (no own password store)                 |
| LLM                | OpenAI Responses API with strict JSON schema (`mode: live` or `simulation`) |
| UI kit             | shadcn@4.13.0 + Tailwind CSS 4 (`vendor/shadcn-tailwind-4.13.0.css`)    |
| Validation         | Zod 3                                                                    |
| Language           | TypeScript 5.9 (strict mode)                                            |
| Linting            | ESLint 9 + `eslint-config-next`                                         |
| Tests              | `node:test` + `node:assert/strict`                                      |
| Sites runtime      | `scripts/sites-env.sh` — isolated HOME, npm cache, wrangler registry    |

The Sites runtime shim (`scripts/sites-env.sh`) sets up an isolated home,
npm cache and wrangler registry under `.sites-runtime/` so builds are
deterministic and do not pollute the developer's `$HOME`.

---

## Request lifecycle

```
Operator pastes URL
   │
   ▼
POST /api/mission
   │
   ├─▶ requireRequestIdentity(request)      # reads oai-* headers
   │       └─▶ ensureWorkspace(identity)    # creates workspaces row on first call
   │
   ├─▶ Zod validation                       # website_url: url().max(500)
   │
   ├─▶ validatePublicUrl(url)               # lib/url-safety.ts → SSRF guard
   │       • reject non-HTTP(S), credentials, non-standard ports
   │       • reject localhost, .local, .internal
   │       • reject private / reserved / multicast IPv4
   │       • reject ULA / link-local / loopback IPv6
   │
   ├─▶ fetchWithRedirectLimit(url)          # manual redirect handling
   │       • MAX_REDIRECTS = 5
   │       • REQUEST_TIMEOUT_MS = 10_000
   │       • MAX_BODY_BYTES = 120_000
   │       • re-validates every Location header through validatePublicUrl
   │
   ├─▶ prepareExternalContent(html)         # lib/content-sanitize-pure.ts
   │       1. stripHtml          — drop tags, scripts, styles, iframes
   │       2. sanitizeForModel   — neutralise 12 prompt-injection patterns
   │       3. truncateForModel   — byte-accurate UTF-8 truncation (8 000 B)
   │       4. wrapAsDataSection  — `<data:website-text>…</data:website-text>`
   │
   ├─▶ OpenAI Responses API (mode=live)     # OR demoMission (mode=simulation)
   │       • strict JSON schema, see `missionSchema` in route.ts
   │       • 6 agents, 3 experiments, 5 content_queue items, ICP, strategy…
   │
   ├─▶ saveMission(workspaceId, mission)    # db/missions.ts
   │       • writes `missions` row
   │       • writes 2 `mission_events` rows (observation, decision)
   │
   └─▶ Best-effort side effects (try/catch):
           • INSERT evidence row (state=observed, source_type=website)
           • INSERT audit_events row (event_type=mission.created.live)
           • return { mission, mode, inspected, state, events }
```

---

## Data model

The D1 schema lives in `db/schema.ts` and is migrated with Drizzle Kit
(`npm run db:generate`). There are 21 physical tables grouped into 16
logical domains:

```
                                          ┌──────────────┐
                                          │  workspaces  │  (1)
                                          └──────┬───────┘
              ┌────────────────────────────┬─────┴──────────────┬──────────────────────────┐
              ▼                            ▼                    ▼                          ▼
       ┌──────────────┐        ┌──────────────────┐    ┌──────────────────┐      ┌──────────────────┐
       │   missions   │        │ workspace_       │    │  workspace_      │      │ organizations    │
       └──────┬───────┘        │ connections      │    │  settings        │      └──────┬───────────┘
              │                └──────────────────┘    └──────────────────┘             │
   ┌──────────┼──────────────────────────────────────────────────────────┐              │
   ▼          ▼            ▼              ▼           ▼          ▼         ▼              ▼
┌─────────┐┌──────────┐┌──────────┐┌──────────┐┌─────────┐┌─────────┐┌─────────┐┌──────────────────────┐
│mission_ ││mission_  ││strategy_ ││ evidence ││experi-  ││action_  ││content_ ││organization_         │
│events   ││versions  ││versions  ││          ││ments    ││queue    ││assets   ││ memberships          │
└─────────┘└──────────┘└──────────┘└────┬─────┘└─────────┘└────┬────┘└─────────┘└──────────────────────┘
                                       │                       │                                │
                                       │                       │                                ▼
                                       │              ┌────────┴──────┐               ┌──────────────────────┐
                                       │              │   payments    │               │organization_         │
                                       │              └──────┬────────┘               │ invitations          │
                                       │                     │                        └──────────────────────┘
                                       ▼                     ▼
                                ┌──────────────┐       ┌──────────────┐
                                │ touchpoints  │       │  contacts    │
                                └──────────────┘       └──────────────┘

                 ┌───────────────┐         ┌───────────────┐         ┌───────────────┐
                 │  agent_runs   │─────┐   │  audit_events │         │ connector_    │
                 └──────┬────────┘     │   └───────────────┘         │ installations │
                        ▼              │                             └───────────────┘
                 ┌───────────────┐     │
                 │  agent_steps  │     │  (audit_events written BEFORE
                 └───────────────┘     │   data-deletion cascade so it
                                       │   survives the wipe)
```

### Logical groups

| # | Group               | Tables                                                          |
| - | ------------------- | --------------------------------------------------------------- |
| 1 | Workspace           | `workspaces`                                                    |
| 2 | Connections         | `workspace_connections`, `connector_installations`              |
| 3 | Settings            | `workspace_settings`                                            |
| 4 | Missions            | `missions`, `mission_events`                                    |
| 5 | Versioning          | `mission_versions`, `strategy_versions`                         |
| 6 | Evidence            | `evidence`                                                      |
| 7 | Experiments         | `experiments`                                                   |
| 8 | Actions             | `action_queue`                                                  |
| 9 | Content             | `content_assets`                                                |
| 10| Payments            | `payments`, `touchpoints`                                       |
| 11| Contacts            | `contacts`                                                      |
| 12| Agents              | `agent_runs`, `agent_steps`                                     |
| 13| Audit               | `audit_events`                                                  |
| 14| Organizations       | `organizations`, `organization_memberships`, `organization_invitations` |

See [`DATABASE.md`](./DATABASE.md) for the full column-by-column reference,
indexes, and migration history.

---

## API surface

All routes live under `/api/*` and run on the Cloudflare Workers runtime.
Mutating routes require a signed-in ChatGPT user (identity headers injected
by the hosting control plane). See [`API_REFERENCE.md`](./API_REFERENCE.md)
for the canonical reference and [`API_EXAMPLES.md`](./API_EXAMPLES.md) for
curl recipes.

| #  | Method            | Path                                                  | Purpose                                          |
| -- | ----------------- | ----------------------------------------------------- | ------------------------------------------------ |
| 1  | `GET`             | `/api/workspace`                                      | Workspace snapshot (creates workspace on first access). |
| 2  | `GET`             | `/api/workspace/settings`                             | Workspace budget / brand-voice / retention settings. |
| 3  | `PATCH`           | `/api/workspace/settings`                             | Update workspace settings.                       |
| 4  | `POST`            | `/api/mission`                                        | Analyze a website URL → AI CMO → D1.             |
| 5  | `GET`             | `/api/mission`                                        | Return the workspace's latest mission.           |
| 6  | `POST`            | `/api/mission/action`                                 | Advance or approve the current mission.          |
| 7  | `GET`             | `/api/connectors`                                     | List workspace connections.                      |
| 8  | `POST`            | `/api/connectors`                                     | Record a workspace-scoped connector request.     |
| 9  | `GET`/`PATCH`     | `/api/connectors/[provider]`                          | Read or update a single connector.               |
| 10 | `GET`/`POST`      | `/api/connector-installations`                        | List / upsert detailed connector installations.  |
| 11 | `POST`            | `/api/webhooks/[provider]`                            | Stripe-style webhook receiver (HMAC verified).   |
| 12 | `GET`             | `/api/audit`                                          | Filterable audit-event feed (redacted).          |
| 13 | `POST`            | `/api/data-export`                                    | GDPR-style JSON export of workspace data.        |
| 14 | `POST`            | `/api/data-deletion`                                  | Wipe all workspace-scoped data (FK-safe order).  |
| 15 | `GET`/`POST`      | `/api/organizations`                                  | List / create organizations.                     |
| 16 | `GET`/`POST`      | `/api/contacts`                                       | List / create contacts.                          |
| 17 | `PATCH`           | `/api/contacts/[contact_id]/status`                   | Transition a contact's lifecycle status.         |
| 18 | `POST`            | `/api/evidence/[evidence_id]/state`                   | Transition an evidence row to a new state.       |
| 19 | `POST`            | `/api/experiments/[experiment_id]/status`             | Transition an experiment's status.               |
| 20 | `POST`            | `/api/actions/[action_id]/approve`                    | Move an action `prepared → approved`.            |
| 21 | `POST`            | `/api/actions/[action_id]/reject`                     | Move an action `prepared → rejected`.            |
| 22 | `POST`            | `/api/actions/[action_id]/execute`                    | Move an action `approved → executed`.            |
| 23 | `GET`/`POST`      | `/api/missions/[mission_id]/events`                   | List / append mission events.                    |
| 24 | `GET`/`POST`      | `/api/missions/[mission_id]/evidence`                 | List / create evidence rows.                     |
| 25 | `GET`/`POST`      | `/api/missions/[mission_id]/experiments`              | List / create experiments.                       |
| 26 | `GET`/`POST`      | `/api/missions/[mission_id]/actions`                  | List / enqueue actions.                          |
| 27 | `GET`             | `/api/missions/[mission_id]/runs`                     | List agent runs (observability).                 |
| 28 | `GET`             | `/api/missions/[mission_id]/touchpoints`              | List attribution touchpoints.                    |
| 29 | `GET`             | `/api/missions/[mission_id]/payments`                 | List Stripe-verified payments.                   |
| 30 | `GET`             | `/api/missions/[mission_id]/versions`                 | List mission & strategy version history.         |
| 31 | `GET`/`POST`      | `/api/missions/[mission_id]/content`                  | List / create content assets.                    |

> Conventions: JSON request bodies, JSON responses, epoch-ms time fields,
> integer cents for money, `{ "error": string }` error envelope, HTTP
> status codes 400/401/404/409/422/429/500/502. `Idempotency-Key`
> accepted on mutating endpoints.

---

## Workspace UI

`app/workspace/workspace-client.tsx` is a single-page sidebar application
that drives the API above. Sidebar views:

| #  | View          | Panel                  | Primary data source                              |
| -- | ------------- | ---------------------- | ------------------------------------------------ |
| 1  | `overview`    | (composite + ActionQueue) | `GET /api/mission`, `GET /api/workspace`      |
| 2  | `strategy`    | StrategyPanel          | `GET /api/mission`                               |
| 3  | `content`     | ContentPanel           | `GET /api/mission`, `GET /api/missions/.../content` |
| 4  | `experiments` | ExperimentsPanel       | `GET /api/missions/.../experiments`              |
| 5  | `connectors`  | ConnectorsPanelV2      | `GET /api/workspace`, `POST /api/connectors`     |
| 6  | `revenue`     | RevenuePanel           | `GET /api/missions/.../payments`                 |
| 7  | `memory`      | MemoryPanel            | `GET /api/mission`, `GET /api/missions/.../runs` |
| 8  | `actions`     | ActionQueuePanel       | `GET /api/missions/.../actions`                  |
| 9  | `evidence`    | EvidencePanel          | `GET /api/missions/.../evidence`                 |
| 10 | `versions`    | VersionsPanel          | `GET /api/missions/.../versions`                 |
| 11 | `contacts`    | ContactsPanel          | `GET /api/contacts`                              |
| 12 | `settings`    | SettingsPanel          | `GET /api/workspace/settings`                    |

Auxiliary panels (rendered inside other views): `AuditPanel`,
`AgentRunsPanel`, `OrganizationsPanel`, `KpiCard`. The sidebar
additionally surfaces `BudgetPanel` and `AttributionPanel` as composite
sections of `overview` / `revenue`.

---

## Pure modules

Distribution OS is built around a strict separation between **pure
business logic** (no I/O, no globals, side-effect free) and the **runtime
adapters** (route handlers, workers, D1 access). Pure modules are
trivially unit-testable in plain Node and run in any JS runtime. There
are 33 pure modules today:

### `lib/*` (21 modules)

| Module                                | Purpose                                                          |
| ------------------------------------- | ---------------------------------------------------------------- |
| `lib/url-safety.ts`                   | SSRF validation, redirect-limited fetch, body cap.               |
| `lib/content-sanitize-pure.ts`        | HTML stripping + 12-pattern prompt-injection neutraliser.        |
| `lib/mission-lifecycle-pure.ts`       | 5-stage mission loop, readiness scoring, auto-advance rules.     |
| `lib/connector-catalog.ts`            | 100+ connectors across 8 categories.                             |
| `lib/orchestrator-pure.ts`            | 15-agent registry, topological scheduler, dependency gating.     |
| `lib/attribution-model-pure.ts`       | 5 attribution models (first/last/linear/time-decay/position).    |
| `lib/webhook-signature-pure.ts`       | Stripe-style HMAC verification + replay window.                  |
| `lib/webhook-router-pure.ts`          | Multi-source webhook classification + dedup key builder.         |
| `lib/api-errors-pure.ts`              | Typed API error envelope with HTTP status map.                   |
| `lib/rate-limit-pure.ts`              | Token-bucket rate limiter (deterministic, injectable now).       |
| `lib/idempotency-pure.ts`             | Idempotency key, TTL, payload hash, retry classification.        |
| `lib/budget-pure.ts`                  | Monthly/daily/per-action budget enforcement + severity scoring.  |
| `lib/brand-safety-pure.ts`            | 15 forbidden-claim patterns + content sanitizer.                 |
| `lib/token-cost-pure.ts`              | Per-model token pricing + optimal model selection.               |
| `lib/content-variants-pure.ts`        | A/B variant statistics (CTR, CVR, score).                        |
| `lib/pagination-pure.ts`              | page/limit parsing + offset computation + cursor helpers.        |
| `lib/observability-pure.ts`           | Metrics + log entry builders + latency histograms.               |
| `lib/datetime-pure.ts`                | Relative time / quiet-hours / epoch formatting.                  |
| `lib/accessibility-pure.ts`           | ARIA id generation, status labels, focus helpers.                |
| `lib/validation-pure.ts`              | String/number/email validation primitives.                       |
| `lib/utils.ts`                        | `cn` class merge + small shared helpers.                         |

### `db/*-pure.ts` (12 modules)

| Module                                | Purpose                                                          |
| ------------------------------------- | ---------------------------------------------------------------- |
| `db/audit-pure.ts`                    | Audit row builder, IP SHA-256 hash, time/category filters.       |
| `db/evidence-pure.ts`                 | Evidence state machine + content hash + canonical JSON.          |
| `db/actions-pure.ts`                  | Action status machine + payload hash + idempotency key.          |
| `db/experiments-pure.ts`              | Experiment status machine + kill-rule predicate.                 |
| `db/contacts-pure.ts`                 | Contact lifecycle + email validation + redacted summary.         |
| `db/content-assets-pure.ts`           | Content status machine + variant chain validation.               |
| `db/attribution-pure.ts`             | Payment lifecycle + touchpoint matching + confidence scoring.    |
| `db/agent-runs-pure.ts`               | Agent run/step state machine + cost calculator + display summary.|
| `db/connectors-pure.ts`               | Connector lifecycle + token expiry + health-check scheduler.     |
| `db/versions-pure.ts`                 | Mission/strategy versioning + diff renderer.                     |
| `db/workspace-settings-pure.ts`       | Budget policy + quiet-hours + forbidden-claims blocklist.        |
| `db/organizations-pure.ts`            | Slug normalization + role hierarchy + invitation token hashing. |

Each `*-pure.ts` module has a sibling `tests/*.test.ts` exercising it in
isolation (33 test files today).

---

## Security layers

Distribution OS uses defense-in-depth. Each layer is independently
testable and independently bypassable only by an explicit code change
(reviewable in PR). See [`SECURITY.md`](./SECURITY.md) for the full audit.

```
┌────────────────────────────────────────────────────────────────────┐
│  1. Identity  (ChatGPT headers → requireRequestIdentity)            │
├────────────────────────────────────────────────────────────────────┤
│  2. Tenant isolation  (every query scoped by workspace_id)          │
├────────────────────────────────────────────────────────────────────┤
│  3. SSRF guard  (validatePublicUrl + fetchWithRedirectLimit)        │
├────────────────────────────────────────────────────────────────────┤
│  4. Prompt-injection neutraliser  (12 patterns in sanitizeForModel) │
├────────────────────────────────────────────────────────────────────┤
│  5. Approval boundary  (missions.approved gates act stage)          │
├────────────────────────────────────────────────────────────────────┤
│  6. Webhook signatures  (HMAC-SHA256 + 5-min replay window)         │
├────────────────────────────────────────────────────────────────────┤
│  7. Rate limiting  (token bucket per IP / workspace / route scope)  │
├────────────────────────────────────────────────────────────────────┤
│  8. Budget enforcement  (monthly / daily / per-action caps in cents)│
├────────────────────────────────────────────────────────────────────┤
│  9. Brand safety  (15 forbidden-claim patterns, severity gated)     │
├────────────────────────────────────────────────────────────────────┤
│ 10. Audit trail  (audit_events written before mutating cascade)     │
├────────────────────────────────────────────────────────────────────┤
│ 11. Data redaction  (summarizeForDisplay drops PII / tokens / IPs)  │
├────────────────────────────────────────────────────────────────────┤
│ 12. Idempotency  (Idempotency-Key + payload hash dedup)             │
├────────────────────────────────────────────────────────────────────┤
│ 13. GDPR  (data-export + data-deletion + retention_days)            │
└────────────────────────────────────────────────────────────────────┘
```

---

## State machines

Every long-lived entity has an explicit, code-defined state machine. See
[`STATE_MACHINES.md`](./STATE_MACHINES.md) for the full transition tables
and diagrams.

| Entity        | Statuses | Module                                |
| ------------- | -------- | ------------------------------------- |
| Action        | 7        | `db/actions-pure.ts`                  |
| Evidence      | 7        | `db/evidence-pure.ts`                 |
| Experiment    | 5        | `db/experiments-pure.ts`              |
| Payment       | 5        | `db/attribution-pure.ts`              |
| Connector     | 8        | `db/connectors-pure.ts`               |
| Contact       | 8        | `db/contacts-pure.ts`                 |
| Content       | 7        | `db/content-assets-pure.ts`           |
| Agent run     | 4        | `db/agent-runs-pure.ts`               |
| Mission stage | 5        | `lib/mission-lifecycle-pure.ts`       |

Each machine exposes `canTransition(from, to)` and `isTerminal(status)`
predicates that the runtime layer calls before any UPDATE.

---

## Attribution models

`lib/attribution-model-pure.ts` exposes 5 models, each producing a list
of `{ touchpoint, credit }` pairs whose credits sum to 1:

| Model            | Rule                                                        |
| ---------------- | ----------------------------------------------------------- |
| `first_touch`    | 100% credit to the earliest touchpoint.                     |
| `last_touch`     | 100% credit to the latest touchpoint.                       |
| `linear`         | Equal credit to every touchpoint.                           |
| `time_decay`     | Exponential decay with configurable half-life (default 7d). |
| `position_based` | U-shaped: 40% first / 40% last / 20% split across middle.   |

`db/attribution-pure.ts` adds **confidence scoring** on a 0–100 scale:

| # matching touchpoints | Confidence |
| ---------------------- | ---------- |
| 0                      | 0          |
| 1                      | 90         |
| 2+                     | 75         |
| 0 matches (ambiguous)  | 20         |

A touchpoint matches a payment when they share a `mission_id` or an
`action_id` (the latter representing a direct causal link).

```
   touchpoint ───┐                 ┌─── payment
                  ▼                 ▼
       attribution_confidence ∈ {0, 20, 75, 90}
                  │
                  ▼
       runAttribution(model, touchpoints, options)
                  │
                  ▼
       [{ touchpoint, credit }]  (credits sum to 1)
```

---

## AI CMO orchestrator

`lib/orchestrator-pure.ts` defines a registry of 15 specialist agents
that cooperate to take a mission from observation to first payment. The
orchestrator is pure: given a context (what artefacts already exist)
and a set of completed agent ids, it deterministically picks the next
best agent and produces a topological execution order.

```
   scout (research, prio 100)
      │
      ▼
   analyst (analysis, prio 90)  ◀─── strategist (strategy, prio 95)
                                          │
                            ┌─────────────┼─────────────┐
                            ▼             ▼             ▼
                       copywriter     designer         ads
                       (writing)      (design)        (publish, requires budget)
                            │             │
                            ▼             ▼
                          seo        developer (code)
                       (optimize)        │
                            │            ▼
                            ▼            qa (test)
                       social ──── requires audienceReady
                       email
                            │
                            ▼
                       analytics ← qa     ops ← developer
                            │                │
                            ▼                ▼
                          finance ←──── ads
                            │
                            ▼
                       coordinator (monitor, prio 10, always runnable)
```

Selection rule (in `getNextBestAction`):

1. Filter agents whose `dependsOn` are all in `completed` AND whose
   `requires(context)` predicate passes.
2. Sort by `priority DESC, name ASC`.
3. Return the first.

`getExecutionOrder(context)` repeats until no further agent can run
(cycle-safe via a `maxIterations = total * 4 + 1` guard).

Each agent run is persisted as an `agent_runs` row with token / cost /
latency metrics; each tool call inside a run is an `agent_steps` row.

---

## GDPR compliance posture

Distribution OS implements the three core GDPR data-subject rights
end-to-end:

| Right                       | Endpoint                  | Behaviour                                        |
| --------------------------- | ------------------------- | ------------------------------------------------ |
| Right of access (Art. 15)   | `POST /api/data-export`   | Returns JSON download of every tenant-scoped table for the caller, with `ip_hash`, `token_reference`, `token_hash` redacted. |
| Right to erasure (Art. 17)  | `POST /api/data-deletion` | Wipes 16 tenant tables in FK-safe order. Audit row written BEFORE the cascade so the deletion intent is durable. The `workspaces` row is preserved so the user can still sign in. |
| Data minimisation (Art. 5)  | `workspace_settings.retention_days` | Default 365 days; sweep job (roadmap) will purge evidence / events older than the retention window. |

```jsonc
// data-deletion FK-safe cascade order
[
  "agent_steps", "agent_runs", "mission_events", "mission_versions",
  "strategy_versions", "evidence", "payments", "touchpoints",
  "content_assets", "experiments", "action_queue", "contacts",
  "workspace_settings", "workspace_connections",
  "connector_installations", "missions"
]
```

The audit row (`event_category = "deletion"`,
`event_type = "workspace.data_deleted"`) is inserted **before** the
cascade, so even though `audit_events` is itself workspace-scoped via
`ON DELETE CASCADE`, the deletion-intent record survives long enough to
be replicated / exported by the compliance pipeline.

---

## Observability

Three complementary channels:

1. **`audit_events` table** — every mutating route writes a row
   (best-effort, wrapped in try/catch). Categories: `auth`, `role`,
   `approval`, `connector`, `action`, `payment`, `export`, `deletion`,
   `security`, `config`. `ip_hash` is SHA-256 of the client IP.
2. **`agent_runs` / `agent_steps` tables** — per-agent token, cost (in
   cents), latency and status for the AI CMO loop. Surfaced in the
   workspace `memory` view.
3. **`lib/observability-pure.ts`** — structured metrics and log entries
   (correlation id, mission id, workspace id, level). Used by the worker
   to emit Workers Tail Worker logs.

---

## Related documents

| Document                              | Scope                                                |
| ------------------------------------- | ---------------------------------------------------- |
| [`SECURITY.md`](./SECURITY.md)        | Threat model + per-layer audit.                      |
| [`DEPLOYMENT.md`](./DEPLOYMENT.md)    | Cloudflare Workers + D1 deployment guide.            |
| [`TESTING.md`](./TESTING.md)          | Test structure, patterns, coverage goals.            |
| [`CONTRIBUTING.md`](./CONTRIBUTING.md)| Code style, PR process, commit conventions.          |
| [`CHANGELOG.md`](./CHANGELOG.md)      | Wave-by-wave release history.                        |
| [`DATABASE.md`](./DATABASE.md)        | Column-by-column schema reference + migration guide. |
| [`STATE_MACHINES.md`](./STATE_MACHINES.md) | Transition tables + ASCII diagrams for 8 machines. |
| [`API_REFERENCE.md`](./API_REFERENCE.md)   | Canonical HTTP API reference.                  |
| [`API_EXAMPLES.md`](./API_EXAMPLES.md)     | Curl recipes for every major endpoint.         |
