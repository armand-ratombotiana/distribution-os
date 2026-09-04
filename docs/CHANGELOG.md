# Changelog

> Wave-by-wave release history for Distribution OS. Dates are
> illustrative; the canonical record is the git log. This document
> summarises what each wave shipped and why.

The format is loosely based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Each wave groups related features shipped together.

---

## Table of contents

- [Wave 6 — Documentation & operations](#wave-6--documentation--operations)
- [Wave 5 — Security hardening & GDPR](#wave-5--security-hardening--gdpr)
- [Wave 4 — Connectors, content & compliance](#wave-4--connectors-content--compliance)
- [Wave 3 — Attribution & revenue](#wave-3--attribution--revenue)
- [Wave 2 — Evidence ledger & versioning](#wave-2--evidence-ledger--versioning)
- [Wave 1 — Mission loop & workspace UI](#wave-1--mission-loop--workspace-ui)
- [Wave 0 — Foundation](#wave-0--foundation)

---

## Wave 6 — Documentation & operations

> Documentation, deployment, security audit, state-machine reference,
> API examples, contribution guide.

### Added

- `docs/ARCHITECTURE.md` — full architecture document with stack table,
  21 physical tables (16 logical groups), 28+ API endpoints, 12 UI
  panels, 31+ pure modules, security layer diagram, state-machine
  summary, attribution model reference, AI CMO orchestrator diagram,
  GDPR compliance posture, observability channels. Includes ASCII
  diagrams for high-level architecture, request lifecycle, data model,
  security stack, agent dependency graph.
- `docs/SECURITY.md` — defence-in-depth audit covering authentication,
  tenant isolation, SSRF, prompt injection, webhook signatures, rate
  limiting, budget enforcement, brand safety, audit trail, data
  redaction, idempotency, GDPR compliance, secrets management. Full
  test-coverage matrix mapping every threat to its test file.
- `docs/DEPLOYMENT.md` — Cloudflare Workers + D1 deployment guide:
  prerequisites, local dev, D1 creation, wrangler config, environment
  variables, migrations (generate / apply local / preview / prod),
  production deploy, preview deploys, monitoring, alerts, rollback,
  troubleshooting.
- `docs/TESTING.md` — test runner (`node:test` + `node:assert/strict`),
  test structure, running tests, writing new tests, six common test
  patterns, coverage goals, test inventory (34 files covering 33 pure
  modules), CI integration.
- `docs/CONTRIBUTING.md` — structural rules (pure logic vs runtime
  adapters), code style, commit conventions (Conventional Commits),
  PR process, testing requirements, database-change workflow, security
  review surface, release process.
- `docs/CHANGELOG.md` — this file.
- `docs/DATABASE.md` — column-by-column schema reference for all 21
  tables, indexes, relationships, migration guide.
- `docs/STATE_MACHINES.md` — transition tables + ASCII diagrams for 8
  state machines (actions, evidence, experiments, payments, connectors,
  contacts, content, agent runs).
- `docs/API_EXAMPLES.md` — curl recipes for every major API endpoint.
- `.env.example` — updated with `OPENAI_API_KEY`, `OPENAI_MODEL`,
  `STRIPE_WEBHOOK_SECRET`, and the `DB` binding reference.

### Changed

- `README.md` table of contents now links to the expanded docs set.

---

## Wave 5 — Security hardening & GDPR

> SSRF guard, prompt-injection neutraliser, webhook signature
> verification, audit trail, GDPR data-export + data-deletion.

### Added

- `lib/url-safety.ts` — `validatePublicUrl`, `fetchWithRedirectLimit`,
  `ALLOWED_PORTS`, `MAX_REDIRECTS = 5`, `REQUEST_TIMEOUT_MS = 10_000`,
  `MAX_BODY_BYTES = 120_000`. Replaces the legacy `assertPublicUrl`.
- `lib/content-sanitize-pure.ts` — `prepareExternalContent` pipeline:
  `stripHtml → sanitizeForModel → truncateForModel → wrapAsDataSection`.
  Twelve prompt-injection / smuggling patterns neutralised.
- `lib/webhook-signature-pure.ts` — Stripe-style HMAC-SHA256
  verification with 5-minute replay window (`STRIPE_TOLERANCE_SECONDS =
  300`), constant-time comparison, dedup key builder, event classifier.
- `lib/rate-limit-pure.ts` — token-bucket limiter with five scopes
  (global / workspace / ip / authenticated / write), injectable `nowMs`,
  IETF `RateLimit-*` headers.
- `lib/idempotency-pure.ts` — `buildKey`, `computePayloadHash`,
  `isRecordValid` (24h TTL), `classifyError`, `shouldRetry`,
  `calculateBackoff` (full-jitter).
- `lib/api-errors-pure.ts` — typed error envelope with HTTP status map,
  `fromThrownError` normaliser, `toResponse` serializer.
- `lib/budget-pure.ts` — monthly / daily / per-action budget policy,
  severity bands (`ok / warning / critical / exceeded`), `formatCents`,
  `formatBudgetUsage`, `shouldResetMonthly` / `shouldResetDaily`.
- `lib/brand-safety-pure.ts` — 15 forbidden-claim patterns across 6
  categories, `checkClaims`, `shouldBlockContent`, `sanitizeContent`,
  `addCustomClaim`.
- `lib/token-cost-pure.ts` — per-model pricing table, `calculateCostCents`,
  `estimateTokens`, `selectOptimalModel`, `getBudgetStatus`.
- `db/audit-pure.ts` — `buildAuditEntry`, `hashIp` (SHA-256),
  `summarizeForDisplay` (redacts `ip_hash`), `filterByCategory`,
  `filterByTimeRange`, `validateCategory`.
- `app/api/audit/route.ts` — `GET /api/audit` filterable by
  `category`, `from`, `to`, `limit`.
- `app/api/data-export/route.ts` — `POST /api/data-export` returns JSON
  download of every tenant-scoped table with PII / tokens / IP hashes
  redacted (GDPR Art. 15).
- `app/api/data-deletion/route.ts` — `POST /api/data-deletion` wipes
  16 tenant tables in FK-safe order; audit row written BEFORE the
  cascade so the deletion intent is durable (GDPR Art. 17).
- `app/api/webhooks/[provider]/route.ts` — Stripe-style webhook
  receiver with HMAC verification, event classification, payment
  recording.
- 14 new test files covering every pure module above.

### Changed

- `POST /api/mission` now uses `fetchWithRedirectLimit` + 
  `prepareExternalContent` instead of the legacy fetch + entity-decode
  pipeline.

---

## Wave 4 — Connectors, content & compliance

> Connector catalog, connector installations, content assets, contacts,
> experiments, agent runs.

### Added

- `lib/connector-catalog.ts` — 100+ connectors across 8 categories
  (Social & Community, Email & Outreach, Analytics & Attribution, CRM
  & Sales, Commerce & Revenue, Content & Creative, Data & Research,
  Automation & Dev).
- `db/connectors-pure.ts` — 8-status connector lifecycle
  (`setup_required → authorized → connected → healthy | degraded ↔
  disconnected → revoked`), `isTokenExpired`, `needsHealthCheck`,
  `summarizeForDisplay` (redacts `token_reference`).
- `db/connector-installations.ts` — D1 persistence layer with
  `upsertInstallation`, `getInstallation`, `listInstallations`,
  `updateStatus`.
- `db/content-assets-pure.ts` — 7-status content lifecycle
  (`draft → in_review → approved → scheduled → published → archived`
  with `failed` recovery), variant chain validation, `validateContent`,
  `summarizeForDisplay`.
- `db/contacts-pure.ts` — 8-status contact lifecycle
  (`new → qualified → contacted → replied → meeting → converted` with
  `rejected` and `unsubscribed` terminal), `validateEmail`,
  `validateContact`, `summarizeForDisplay` (redacts
  `qualification_signals_json`).
- `db/experiments-pure.ts` — 5-status experiment lifecycle
  (`draft → running → completed | stopped | blocked`), kill-rule
  predicate, validation.
- `db/agent-runs-pure.ts` — 4-status run/step lifecycle
  (`running → completed | failed | cancelled`), `calculateCost`,
  `calculateLatencyMs`, `summarizeRunForDisplay`,
  `summarizeStepForDisplay`.
- `db/workspace-settings-pure.ts` — budget policy, quiet-hours wrap,
  forbidden-claims blocklist, retention days, `isWithinBudget`,
  `isQuietHours`, `validateSettings`.
- `lib/content-variants-pure.ts` — A/B variant statistics (`calculateCtr`,
  `calculateConversionRate`, `calculateVariantScore`).
- API routes:
  - `GET/POST /api/connectors` and `GET/PATCH /api/connectors/[provider]`
  - `GET/POST /api/connector-installations`
  - `GET/POST /api/contacts` and `PATCH /api/contacts/[contact_id]/status`
  - `POST /api/evidence/[evidence_id]/state`
  - `POST /api/experiments/[experiment_id]/status`
  - `POST /api/actions/[action_id]/approve` / `reject` / `execute`
  - `GET/POST /api/missions/[mission_id]/events`
  - `GET/POST /api/missions/[mission_id]/evidence`
  - `GET/POST /api/missions/[mission_id]/experiments`
  - `GET/POST /api/missions/[mission_id]/actions`
  - `GET /api/missions/[mission_id]/runs`
  - `GET /api/missions/[mission_id]/touchpoints`
  - `GET /api/missions/[mission_id]/payments`
  - `GET /api/missions/[mission_id]/versions`
  - `GET/POST /api/missions/[mission_id]/content`
  - `GET/POST /api/organizations`
  - `GET/POST /api/workspace/settings`
- Workspace panels: `content-panel.tsx`, `evidence-panel.tsx`,
  `experiments-panel.tsx`, `connectors-panel-v2.tsx`, `revenue-panel.tsx`,
  `contacts-panel.tsx`, `versions-panel.tsx`, `agent-runs-panel.tsx`,
  `audit-panel.tsx`, `organizations-panel.tsx`, `settings-panel.tsx`.
- Drizzle migration `0004_loose_spacker_dave.sql` adding 19 new
  tables.

### Changed

- Workspace UI expanded from 4 views to 14 views.

---

## Wave 3 — Attribution & revenue

> Touchpoints, payments, attribution models, payment lifecycle.

### Added

- `lib/attribution-model-pure.ts` — five attribution models:
  `first_touch`, `last_touch`, `linear`, `time_decay` (configurable
  half-life, default 7 days), `position_based` (U-shaped 40/20/40).
  Pure dispatcher `runAttribution(model, touchpoints, options)`.
- `db/attribution-pure.ts` — payment lifecycle (5 statuses: `pending →
  succeeded → refunded | disputed | failed`), `touchpointMatchesPayment`,
  `calculateAttributionConfidence` (0/20/75/90 scale),
  `summarizePaymentForDisplay`, `summarizeTouchpointForDisplay`,
  `buildPaymentIdempotencyKey`.
- `db/payments.ts` — D1 persistence layer with `recordPayment`
  (upsert by natural key `(workspace_id, provider,
  provider_payment_id)`), `getPayment`, `listPayments`,
  `updatePaymentStatus`, `recordTouchpoint` (idempotent by
  `provider_event_id`), `listTouchpoints`.
- API routes:
  - `GET /api/missions/[mission_id]/payments`
  - `GET /api/missions/[mission_id]/touchpoints`

### Changed

- Mission `status` field now includes a `revenue` stage after the first
  `succeeded` payment.

---

## Wave 2 — Evidence ledger & versioning

> Evidence table, content hashing, mission_versions, strategy_versions.

### Added

- `db/evidence-pure.ts` — 7-state evidence machine (`observed → inferred
  | verified | contradicted | stale | rejected` with `needed` as a
  pre-observation state), `canonicalJson`, `hashContent` (SHA-256 via
  Web Crypto), `summarizeForDisplay` (redacts `extracted_facts_json`
  and `provenance_json`), `buildEvidenceId`.
- `db/versions-pure.ts` — append-only versioning for missions and
  strategies. `mission_versions` and `strategy_versions` tables.
- `lib/mission-lifecycle-pure.ts` — 5-stage mission loop
  (`observe → decide → act → measure → learn → observe`), cycle
  increment on wrap, `getMissionReadiness` (blocking reasons +
  readiness score), `shouldAutoAdvance`, `getEstimatedTimeToPayment`.
- API routes:
  - `POST /api/evidence/[evidence_id]/state`
  - `GET /api/missions/[mission_id]/versions`
- Workspace panels: `evidence-panel.tsx`, `versions-panel.tsx`.

### Changed

- `POST /api/mission/action` now writes a `mission_versions` row on
  every advance and an `audit_events` row on every approval.

---

## Wave 1 — Mission loop & workspace UI

> URL → AI CMO → D1 pipeline, action queue, workspace sidebar.

### Added

- `app/api/mission/route.ts` — `POST /api/mission` (URL → SSRF fetch →
  content-sanitise → OpenAI Responses API with strict JSON schema →
  D1 persistence). Falls back to deterministic `demoMission` in
  simulation mode when `OPENAI_API_KEY` is unset.
- `app/api/mission/action/route.ts` — `POST /api/mission/action`
  (`advance` / `approve`).
- `app/api/workspace/route.ts` — `GET /api/workspace` (creates
  workspace on first access).
- `app/api/connectors/route.ts` — `POST /api/connectors`.
- `app/workspace/page.tsx` + `app/workspace/workspace-client.tsx` —
  server-component auth gate + single-page sidebar UI with 14 views.
- `app/chatgpt-auth.ts` — `getChatGPTUser` /
  `requireChatGPTUser(returnTo)` for RSC identity consumption.
- `db/workspaces.ts` — `requireRequestIdentity`, `ensureWorkspace`,
  `getWorkspaceSnapshot`.
- `db/missions.ts` — `saveMission`, `getLatestMission`, `getMission`,
  `advanceMission`, `approveMission`.
- `db/actions.ts` + `db/actions-pure.ts` — action queue with 7-status
  machine, `enqueueAction`, `listActions`, `updateActionStatus`,
  `buildIdempotencyKey`, `hashPayload`.
- Workspace panels: `action-queue.tsx`, `kpi-card.tsx`, plus initial
  versions of strategy / overview / budget / attribution panels.
- Drizzle migrations `0000_grey_christian_walker.sql`,
  `0001_youthful_greymalkin.sql`,
  `0002_sharp_the_santerians.sql`,
  `0003_aberrant_mister_sinister.sql`.

### Changed

- `worker/index.ts` wired to delegate to the vinext App Router handler.

---

## Wave 0 — Foundation

> Repo scaffolding, Sites runtime, build pipeline.

### Added

- Cloudflare Workers + Next.js 16 + vinext + Vite 8 stack.
- `worker/index.ts` — Worker entry point with image optimisation
  endpoint.
- `vite.config.ts` — Vite + vinext + `@cloudflare/vite-plugin` with
  local D1 / R2 bindings read from `.openai/hosting.json`.
- `scripts/sites-env.sh` — Sites runtime shim (isolated HOME, npm
  cache, wrangler registry under `.sites-runtime/`).
- `scripts/install-ci.sh` — bounded, flock-protected, integrity-pinned
  `npm ci` wrapper.
- `scripts/build-verified.sh` — bounded `vinext build` wrapper.
- `db/index.ts` — `getDb()` / `getRawDb()` D1 access primitives.
- `db/schema.ts` — initial Drizzle schema.
- `drizzle.config.ts`, `tsconfig.json`, `eslint.config.mjs`,
  `postcss.config.mjs`, `next.config.ts`, `components.json`.
- `components/ui/**` — shadcn@4.13.0 registry vendored into the repo
  (60+ components).
- `vendor/shadcn-tailwind-4.13.0.css` + LICENSE.
- `app/layout.tsx`, `app/page.tsx`, `app/globals.css` — root layout,
  public landing page, design tokens.
- `package.json` with the full dependency set (Next 16, React 19,
  Drizzle 0.45, Zod 3, Tailwind 4, etc.).
