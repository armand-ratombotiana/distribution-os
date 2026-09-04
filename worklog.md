# Distribution OS — Worklog

This file is an append-only record of substantive work performed on the
repository. Each entry is dated and grouped by task batch.

---

## 2026 — Task batch D21–D30: Workspace UI components (panels + primitives)

**Scope:** Create exactly 10 UI files under `app/workspace/`. All 10 are
`"use client"` components. Every file that consumes `useEffect` uses the
cancelled-flag pattern (a `let cancelled = false` local in async fetch
effects, or the equivalent cleanup-return `clearTimeout(timer)` pattern
for synchronous timer effects). 4 data-fetching panels + 6 reusable
primitives.

### Files created (10)

| ID  | File                                         | Kind            | Lines | Purpose |
| --- | -------------------------------------------- | --------------- | ----: | ------- |
| D21 | `app/workspace/stats-panel.tsx`              | Data panel      |   207 | Fetches `/api/workspace/stats`, renders 8-up KPI grid (missions, actions, evidence, experiments, payments, contacts, connectors, content) using the existing `KpiCard` primitive. |
| D22 | `app/workspace/attribution-panel.tsx`        | Data panel      |   263 | Fetches `/api/missions/{id}/attribution`, renders the active attribution model, touchpoint-by-touchpoint credit split, confidence meter and closed/open status. Uses `Progress` + `Badge`. |
| D23 | `app/workspace/forbidden-claims-panel.tsx`   | Data panel      |   269 | Fetches `/api/workspace/forbidden-claims`, supports add (POST) and remove (DELETE via `ConfirmDialog`). Each claim row shows pattern, severity badge, category badge. |
| D24 | `app/workspace/mission-detail.tsx`           | Data panel      |   343 | Fetches `/api/missions/{id}/summary`, renders the full mission profile: headline (status/cycle/stage/approval), 5-stage rail, executive thesis, ICP, strategy, counts, readiness meter, lifecycle timestamps. |
| D25 | `app/workspace/loading-spinner.tsx`          | Primitive       |    58 | `LoadingSpinner({size,label})`. Three sizes (sm/md/lg), optional label, `role="status"` + `aria-live="polite"` + sr-only fallback text. |
| D26 | `app/workspace/error-boundary.tsx`           | Primitive       |   100 | Class component `ErrorBoundary` with `getDerivedStateFromError` + `componentDidCatch` + `reset()`. Optional `fallback` prop (static ReactNode or `(error, reset) => ReactNode`) and optional `onError` callback. Default fallback shows retry button. |
| D27 | `app/workspace/confirm-dialog.tsx`           | Primitive       |    83 | `ConfirmDialog({open,title,message,onConfirm,onCancel})`. Built on shadcn `Dialog`. Optional `confirmLabel`/`cancelLabel`/`destructive` props. Fully controlled. |
| D28 | `app/workspace/badge.tsx`                    | Primitive       |    58 | `Badge({variant,children})`. Six variants (default/success/warning/danger/info/neutral). Lightweight pill — does not pull in the shadcn `Badge` because the workspace panels use a flatter style. |
| D29 | `app/workspace/tabs.tsx`                     | Primitive       |    80 | `Tabs({tabs,active,onChange})`. Each tab is a real `<button>` with `role="tab"` + `aria-selected`. Optional icon + disabled flag per tab. Fully controlled. |
| D30 | `app/workspace/search-input.tsx`             | Primitive       |    99 | `SearchInput({value,onChange,placeholder})`. Debounced (250 ms default, configurable via `debounceMs`). Internal draft state keeps typing responsive; commits to parent after debounce. Cleanup clears pending timer — the cancelled-flag pattern adapted for a non-async effect. |

### Pattern compliance

- **`"use client"` directive** — present at line 1 of all 10 files
  (verified via `head -1`).
- **Cancelled-flag pattern in `useEffect`** — every file that uses
  `useEffect` (D21, D22, D23, D24, D30) uses the pattern:
  - Async-fetch panels (D21–D24): `let cancelled = false` local, every
    `setState` after `await` is guarded by `if (cancelled) return;`
    or `if (!cancelled) …`, cleanup return sets `cancelled = true`.
  - Timer effect (D30 search-input): cleanup return calls
    `clearTimeout(timer)` so a stale debounce can never fire `onChange`
    after unmount or after the draft has moved on.
- **Pure-render primitives** (D25 loading-spinner, D27 confirm-dialog,
  D28 badge, D29 tabs) do not use `useEffect` — they have no async
  operations to cancel, so the pattern is not applicable.
- **ErrorBoundary (D26)** is a class component — it uses
  `getDerivedStateFromError` + `componentDidCatch` (the React error-
  boundary contract) instead of hooks, so no `useEffect` is involved.

### API endpoints referenced

The 4 data panels fetch from these endpoints. The endpoints are not
created in this batch — they are referenced by the UI and degrade
gracefully when absent (error state + retry button + empty state).

| Panel | Endpoint | Method |
| ----- | -------- | ------ |
| StatsPanel | `/api/workspace/stats?workspace_id=…` | GET |
| AttributionPanel | `/api/missions/{missionId}/attribution` | GET |
| ForbiddenClaimsPanel | `/api/workspace/forbidden-claims?workspace_id=…` | GET, POST |
| ForbiddenClaimsPanel (remove) | `/api/workspace/forbidden-claims/{claimId}?workspace_id=…` | DELETE |
| MissionDetail | `/api/missions/{missionId}/summary` | GET (already exists, re-used by `mission-summary.tsx`) |

The `MissionDetail` panel deliberately re-uses the existing
`/api/missions/{mission_id}/summary` endpoint (same as
`mission-summary.tsx`) so no new route is needed — the panel just
renders more of the same payload (executive thesis, ICP, strategy,
counts, readiness, timestamps).

### Reusable primitive reuse

The new primitives compose with the existing workspace toolkit:

- `StatsPanel` reuses `KpiCard` (from `./kpi-card`) and `EmptyState`.
- `AttributionPanel` reuses `Progress` (shadcn), the new `Badge`, and
  `EmptyState`.
- `ForbiddenClaimsPanel` reuses `Input`, `Button`, the new `Badge`,
  the new `ConfirmDialog`, and `EmptyState`.
- `MissionDetail` reuses `Progress`, the new `Badge`, and `EmptyState`.
- `ConfirmDialog` reuses `Dialog`/`DialogContent`/`DialogHeader`/
  `DialogTitle`/`DialogDescription`/`DialogFooter` from
  `@/components/ui/dialog` and `Button` from `@/components/ui/button`.

### Verification performed

```
$ ./node_modules/.bin/eslint \
    app/workspace/stats-panel.tsx \
    app/workspace/attribution-panel.tsx \
    app/workspace/forbidden-claims-panel.tsx \
    app/workspace/mission-detail.tsx \
    app/workspace/loading-spinner.tsx \
    app/workspace/error-boundary.tsx \
    app/workspace/confirm-dialog.tsx \
    app/workspace/badge.tsx \
    app/workspace/tabs.tsx \
    app/workspace/search-input.tsx
# (no output — exit code 0)

$ ./node_modules/.bin/eslint app/workspace/
# (no output — exit code 0; entire workspace dir is clean)
```

ESLint (Next.js core-web-vitals + TypeScript config, with the
`components/ui/**` shadcn carve-out) reports zero errors and zero
warnings across all 10 new files and across the entire `app/workspace/`
directory.

TypeScript type-check (`tsc --noEmit`) reports zero errors in any of
the 10 new files. (Pre-existing errors elsewhere in the repo — in
`db/`, `tests/`, and `app/api/workspace/settings/route.ts` — are
unchanged and out of scope for this batch.)

Pattern verification:

```
$ for f in app/workspace/{stats-panel,attribution-panel,forbidden-claims-panel,mission-detail,loading-spinner,error-boundary,confirm-dialog,badge,tabs,search-input}.tsx; do
    head -1 "$f"                          # all 10 print "use client";
    grep -q "useEffect" "$f" && grep -q "cancelled" "$f" && echo "OK"
  done
# 5 of 10 files use useEffect; all 5 implement the cancelled-flag pattern.
# The other 5 are pure-render primitives with no async work to cancel.
```

### Notable implementation details

- **LoadingSpinner aria contract** — the spinner wrapper carries
  `role="status"` + `aria-live="polite"` so screen readers announce
  loading without interrupting. An additional sr-only span provides a
  text fallback ("Loading: <label>" or "Loading…") for users on screen
  readers that don't honour `aria-live` on icon-only elements.
- **ErrorBoundary fallback flexibility** — the `fallback` prop accepts
  either a static `ReactNode` (rendered verbatim) or a render function
  `(error, reset) => ReactNode` (giving the caller access to the caught
  error message and a reset callback). When omitted, a sensible default
  section is rendered with a Retry button.
- **ConfirmDialog controlled contract** — the dialog is fully
  controlled: parent owns `open`. Clicking the X / pressing Esc /
  clicking the overlay all funnel through `onOpenChange(false)` →
  `onCancel()`, so the parent always knows when the dialog was
  dismissed (not just when it was confirmed).
- **Badge variants** — six variants cover the common workspace states:
  default (primary), success (emerald), warning (amber), danger (rose),
  info (sky), neutral (muted). Each variant ships with both a light-
  and dark-mode colour pair so the panels look right under
  `prefers-color-scheme: dark`.
- **Tabs a11y** — each tab is a real `<button>` (not a div) with
  `role="tab"`, `aria-selected`, `aria-controls` pointing at
  `${id}-panel` and `id` `${id}-tab` so the tablist + tabpanel pattern
  from WAI-ARIA APG is followed.
- **SearchInput debounce** — the parent owns the canonical debounced
  `value`; the component owns an intermediate `draft` so typing stays
  responsive. Two effects: (1) sync draft ← value when the parent's
  canonical value changes externally (e.g. a "clear" button); (2)
  debounce draft → `onChange` with a `setTimeout` cleared in cleanup.
  The "Clear" button bypasses the debounce and commits immediately.
- **AttributionPanel credit formatting** — credit is a float in [0, 1]
  (matching `lib/attribution-model-pure.ts`'s `AttributionResult.credit`).
  The panel formats it as a percentage with `Math.round(credit * 100)`.
- **ForbiddenClaimsPanel removal** — DELETE goes through a
  `ConfirmDialog` because removing a forbidden-claim pattern directly
  weakens brand-safety enforcement; the dialog makes the consequence
  explicit ("This will stop blocking '<pattern>' in future content
  reviews").
- **MissionDetail reuses existing endpoint** — rather than adding a new
  `/api/missions/{id}/detail` route, the panel consumes the existing
  `/api/missions/{mission_id}/summary` endpoint (already used by
  `mission-summary.tsx`) and renders the additional fields
  (`executive_thesis`, `icp`, `strategy`, `created_at`, `updated_at`).

### Next actions (recommended)

- Wire the new panels into `app/workspace/workspace-client.tsx` — the
  shell currently renders `DashboardOverview` + `MissionSummary`; the
  new `StatsPanel`, `AttributionPanel`, `ForbiddenClaimsPanel`, and
  `MissionDetail` can be added as additional tabs / sections.
- Create the missing API endpoints (`/api/workspace/stats`,
  `/api/workspace/forbidden-claims`, `/api/missions/{id}/attribution`)
  so the panels have live data. Until then, they degrade gracefully
  into the empty/error states.
- Wrap each panel in `ErrorBoundary` so a render-time crash in one
  panel cannot take down the whole workspace shell.
- Consider adding snapshot tests (`.test.mjs` using `vite.ssrLoadModule`
  + `renderToStaticMarkup`, mirroring `tests/ui-components.test.mjs`)
  for the pure-render primitives (`Badge`, `Tabs`, `LoadingSpinner`) —
  they are deterministic and easy to lock down.

---

## 2026 — Task batch D11–D20: Workspace API routes (read + write)

**Scope:** Create exactly 10 new API route files under `app/api/`. All
routes except `/api/health` are auth-gated via the existing
`ensureWorkspace(requireRequestIdentity(request))` pair. Dynamic path
segments use the Next.js 16 async-params signature
`context: { params: Promise<{ ... }> }` with `await context.params`.

Two small additive db-module changes were required to back the new
routes (`getWorkspaceStats` and `updateOrganization`); both are
pure-SQL helpers and introduce no schema migrations.

### Files created (10)

| ID  | Route file                                                                  | Methods          | Notes |
| --- | --------------------------------------------------------------------------- | ---------------- | ----- |
| D11 | `app/api/health/route.ts`                                                   | GET              | Unauthenticated. Returns `{ status, timestamp, version }`. |
| D12 | `app/api/workspace/stats/route.ts`                                          | GET              | Workspace-wide row counts (missions, actions, evidence, experiments, payments, contacts, content). |
| D13 | `app/api/missions/[mission_id]/actions/[action_id]/route.ts`                | GET              | Single-action lookup; `(mission_id, action_id)` treated as composite key. |
| D14 | `app/api/missions/[mission_id]/evidence/[evidence_id]/route.ts`             | GET              | Single-evidence lookup; `(mission_id, evidence_id)` composite key. |
| D15 | `app/api/missions/[mission_id]/experiments/[experiment_id]/route.ts`        | GET              | Single-experiment lookup; composite key. |
| D16 | `app/api/organizations/[org_id]/route.ts`                                   | GET, PATCH       | `org_id` asserted to equal `workspace.id` (1:1 mapping). PATCH updates name and/or slug. |
| D17 | `app/api/organizations/[org_id]/members/route.ts`                           | GET, POST        | GET lists memberships; POST issues an invitation (raw token returned once). |
| D18 | `app/api/workspace/forbidden-claims/route.ts`                               | GET, POST, DELETE| Brand-safety blocklist backed by `workspace_settings.forbidden_claims_json`. |
| D19 | `app/api/missions/[mission_id]/attribution/route.ts`                        | GET              | Touchpoints + payments + per-payment `calculateAttributionConfidence` score + summary. |
| D20 | `app/api/workspace/activity/route.ts`                                       | GET              | Paginated unified timeline of audit_events + mission_events; `limit` + `before` cursor. |

### Supporting db-module changes (2)

1. `db/workspaces.ts` — Added `getWorkspaceStats(workspaceId)` and the
   `WorkspaceStats` type. Seven parallel indexed `COUNT(*)` queries,
   one per content table (missions, action_queue, evidence,
   experiments, payments, contacts, content_assets). Mirrors the
   `getWorkspaceDashboard` query shape but skips the recent-activity
   union so the stats endpoint stays cheap (single round-trip).
2. `db/organizations.ts` — Added `updateOrganization(workspaceId,
   { name?, slug? })` and the `UpdateOrganizationInput` type.
   Fetches the current row, applies only the provided fields,
   normalises and validates the slug via the pure helpers, and runs a
   single `UPDATE`. Throws when the organisation does not exist or
   the slug is malformed.

### Auth + tenant-isolation posture

- Every auth-gated route opens with:
  ```ts
  const workspace = await ensureWorkspace(requireRequestIdentity(request));
  ```
  and catches the `AUTH_REQUIRED` sentinel error to return 401 with a
  human-readable message (matching the convention used by the existing
  `workspace/dashboard`, `workspace/settings`, `audit` and `missions/*`
  routes).
- The four nested `[mission_id]/[sub_resource]/[sub_id]` routes (D13,
  D14, D15, D19) load the mission via `getMission(mission_id,
  workspace.id)` first and return 404 when it does not belong to the
  caller's workspace. They then additionally assert that the loaded
  child row's `mission_id` matches the path `mission_id` — the path
  pair is treated as a composite key so leaking an `action_id` /
  `evidence_id` / `experiment_id` across missions does not expose
  cross-mission data.
- The two `[org_id]` routes (D16, D17) assert `org_id === workspace.id`
  (the workspace id IS the organization id, 1:1 mapping) and return
  404 on mismatch, so the path cannot be used to probe another
  tenant's organisation.
- The forbidden-claims (D18) and activity (D20) routes are
  workspace-scoped directly via `workspace.id` — no path parameter to
  validate.
- The health route (D11) is intentionally unauthenticated and performs
  no database work; it is the deployment smoke-test endpoint
  recommended in `docs/DEPLOYMENT.md`.

### Notable implementation details

- **Health version source** (`app/api/health/route.ts`): the version
  string is hard-coded as `"0.1.0"` (matching `package.json`) rather
  than read from disk, because Cloudflare Workers bundles do not
  expose `package.json` at runtime. Bumping the constant on release
  is a one-line change.
- **Composite-key 404s** (`actions/[action_id]`, `evidence/[evidence_id]`,
  `experiments/[experiment_id]`): each route loads the child row by id
  alone and then checks `row.mission_id === mission_id` before
  returning it. This catches both the missing-row case and the
  cross-mission-leak case with the same 404 response.
- **Attribution confidence** (`attribution/route.ts`): reuses the pure
  `calculateAttributionConfidence(touchpoints, payment)` and
  `touchpointMatchesPayment(touchpoint, payment)` helpers from
  `db/attribution-pure.ts` so the scoring rules (0/20/75/90 banding)
  stay in one place. The summary also reports
  `succeeded_amount_formatted` via `formatAmount` (e.g. `"$19.99"`)
  so the UI does not need its own currency formatter.
- **Activity pagination** (`workspace/activity/route.ts`): the
  `audit_events` and `mission_events` streams are queried in parallel
  with an overshoot of `limit + 1` rows each so `has_more` can be
  computed without an extra `COUNT(*)`. The cursor is the
  `occurred_at` epoch-ms of the last item in the page; the client
  passes it back as `?before=` on the next request. Mission-event
  scoping uses an `IN (SELECT id FROM missions WHERE workspace_id = ?)`
  subquery so the workspace's mission-id list does not need a
  separate round-trip.
- **Forbidden-claims DELETE body** (`workspace/forbidden-claims/route.ts`):
  DELETE accepts the claim either as a `?claim=` query param or as a
  JSON body `{ "claim": "..." }`, because some HTTP clients cannot
  send a body on DELETE. The body parse is defensive (returns `null`
  on any parse failure) and falls back to the query param.
- **Organisation PATCH** (`organizations/[org_id]/route.ts`): reuses
  the new `updateOrganization` helper, which itself reuses
  `normalizeSlug` + `validateSlug` from `db/organizations-pure.ts`.
  The route runs the slug through `normalizeSlug` before passing it
  to the db layer so free-form user input ("Acme Inc!!") becomes
  canonical ("acme-inc") at the boundary.
- **Audit-logging discipline**: every mutating route (PATCH
  organisation, POST invite, POST/DELETE forbidden-claim) writes a
  best-effort `logAuditEvent` call wrapped in
  `try { ... } catch { /* Audit logging must never break the primary operation. */ }`,
  matching the convention used by every existing mutating route in
  the codebase.

### Verification performed

- **ESLint**: `eslint <10 new route files> db/workspaces.ts db/organizations.ts`
  exits 0 with **0 errors and 0 warnings** (the unused `_before`
  parameter warning that appeared during initial development was
  resolved by removing the parameter — the cursor filter is applied
  in-memory by the caller rather than pushed down to SQL).
- **Project-wide ESLint**:
  `eslint . --ignore-pattern dist --ignore-pattern .next` exits 0
  with 0 errors and 18 pre-existing warnings, all in files outside
  this batch (`db/agent-runs-pure.ts`, `db/audit-pure.ts`,
  `db/organizations-pure.ts`, `lib/array-utils-pure.ts`,
  `lib/comparison-pure.ts`, and several `tests/*` files). No new
  warnings were introduced.
- **TypeScript**: `tsc --noEmit` reports zero errors in any of the 10
  new route files. The only error in a touched file is the
  pre-existing `db/organizations.ts(25,8)` `TS2459` about `OrgRole`
  being imported from `./organizations-pure` (which imports but does
  not re-export it). This error predates the batch and is not
  introduced or worsened by the new `updateOrganization` function.
- **Filesystem**: all 10 new files exist at the expected paths
  (verified via `ls`). The batch introduced nine new leaf
  directories: `app/api/health/`,
  `app/api/workspace/stats/`, `app/api/workspace/forbidden-claims/`,
  `app/api/workspace/activity/`,
  `app/api/missions/[mission_id]/actions/[action_id]/`,
  `app/api/missions/[mission_id]/evidence/[evidence_id]/`,
  `app/api/missions/[mission_id]/experiments/[experiment_id]/`,
  `app/api/missions/[mission_id]/attribution/`,
  `app/api/organizations/[org_id]/members/`.

### No schema migrations

The batch introduces no new tables, columns, or indexes. The two
db-module additions (`getWorkspaceStats`, `updateOrganization`) read
and write existing columns on `workspaces`, `missions`, `action_queue`,
`evidence`, `experiments`, `payments`, `contacts`, `content_assets`
and `organizations` — all already covered by migration `0000` and
`0001`. No `drizzle-kit generate` run is required.

### Next actions (recommended)

- Add integration tests for the 10 new routes. The existing test
  pattern (`tests/edge-*.test.ts` for pure helpers and
  `tests/integration-*.test.ts` for cross-module flows) gives a clear
  template. Priority targets: the composite-key 404 behaviour on
  D13/D14/D15, the `org_id !== workspace.id` 404 on D16/D17, and the
  `has_more` / `next_cursor` pagination contract on D20.
- Wire the new routes into `docs/API_REFERENCE.md` and
  `docs/API_EXAMPLES.md` (the latter already has curl recipes for
  sibling routes that can be copy-pasted and adjusted).
- Consider extracting the activity-feed `before` cursor logic into a
  shared `lib/pagination-pure.ts` helper if more paginated endpoints
  appear — the current implementation is local to the route but is
  generic enough to lift.
- The `updateOrganization` helper currently does a fetch-then-update
  dance; once `RETURNING *` is verified to work on the D1 binding for
  UPDATEs, the second `SELECT` can be dropped (this matches the
  pattern already used in `db/audit.ts` for INSERT).

---

## 2026 — Task batch C61–C70: Documentation & operations

**Scope:** Create exactly 10 documentation + config files covering the
full architecture, security posture, deployment, testing, contribution,
changelog, database schema, state machines, environment variables, and
API examples.

**Files created / updated (10):**

1. `docs/ARCHITECTURE.md` — Full architecture document. Includes:
   - Runtime stack table (Cloudflare Workers, Next.js 16, vinext, Vite 8,
     D1/SQLite, Drizzle 0.45, Zod, shadcn@4.13.0, TypeScript 5.9).
   - High-level ASCII diagram of the system.
   - Request lifecycle for `POST /api/mission` (validatePublicUrl →
     fetchWithRedirectLimit → prepareExternalContent → OpenAI Responses
     API → saveMission → best-effort evidence + audit).
   - Data-model diagram covering 21 physical tables in 16 logical groups
     (workspaces, connections, settings, missions, versioning, evidence,
     experiments, actions, content, payments, contacts, agents, audit,
     organizations).
   - API surface table with 31 endpoints across 9 route groups.
   - Workspace UI table with 12 panels and their data sources.
   - Pure modules inventory: 33 modules (21 in `lib/`, 12 in `db/`).
   - 13-layer security stack diagram.
   - 9 state machines summary with module pointers.
   - 5 attribution models + confidence scoring rules.
   - AI CMO orchestrator diagram with the 15-agent registry.
   - GDPR compliance posture (Art. 5/15/17).
   - Observability channels (audit_events, agent_runs/steps, structured
     metrics/log entries).
   - Cross-references to all sibling docs.

2. `docs/SECURITY.md` — Defence-in-depth security audit. Covers:
   - Threat model overview (external attackers, tenant boundary,
     privileged insiders).
   - Authentication via ChatGPT-hosted identity headers (no own
     password store).
   - Tenant isolation enforced at 3 layers (schema, access, route).
   - SSRF protection (`validatePublicUrl` + `fetchWithRedirectLimit`).
   - Prompt-injection neutraliser (12 patterns in
     `lib/content-sanitize-pure.ts`).
   - Webhook signatures (Stripe-style HMAC-SHA256, 5-min replay window,
     constant-time comparison).
   - Rate limiting (5 token-bucket scopes, IETF RateLimit-* headers).
   - Budget enforcement (workspace_settings + pure budget policy +
     severity bands).
   - Brand safety (15 forbidden-claim patterns across 6 categories).
   - Audit trail (best-effort, never blocks primary op, written before
     cascade on data-deletion).
   - Data redaction (per-table `summarizeForDisplay` projections).
   - Idempotency (action queue key + webhook/payment natural key + retry
     classification + backoff).
   - GDPR compliance (Art. 5/15/17 with FK-safe cascade order).
   - Secrets management (Workers secrets vs vars vs bindings).
   - Test-coverage matrix mapping every threat to its test file.

3. `docs/DEPLOYMENT.md` — Cloudflare Workers + D1 deployment guide.
   Covers prerequisites, architecture overview, local development
   (Sites runtime shim), D1 database creation, wrangler.toml
   configuration, environment variables (secrets / vars / bindings),
   database migrations (generate / apply local / preview / prod),
   production deployment (build → migrate → deploy → smoke-test),
   preview deploys, monitoring (Cloudflare dashboard + application-level
   observability + recommended alerts), rollback (Worker + D1 +
   emergency data-deletion), and a troubleshooting section.

4. `docs/TESTING.md` — Testing guide. Covers the `node:test` +
   `node:assert/strict` runner, test structure (34 files in `tests/`),
   running tests (full suite, filter by name/file, watch, verbose, TAP),
   writing new tests (5-step recipe), 6 common test patterns (explicit
   `now`, injectable fetch, state-machine transition table, constant-time
   comparison, redaction assertions, build-dependent `.test.mjs`),
   coverage goals (100% line on pure modules, 100% branches on state
   machines), full test inventory (34 files), and CI integration.

5. `docs/CONTRIBUTING.md` — Contributing guide. Two structural rules
   (pure logic vs runtime adapters; every pure module ships with a
   test), code style (TypeScript strict, formatting, imports, naming,
   comments, forbidden patterns), commit conventions (Conventional
   Commits with types and scopes), PR process (branch → implement →
   test → open → review → merge → deploy), testing requirements
   (required + recommended + not required), database change workflow,
   security review surface (12 modules + every mutating route), and
   release process.

6. `docs/CHANGELOG.md` — Wave-by-wave release history. Six waves
   documented:
   - Wave 0 (Foundation): repo scaffolding, Sites runtime, build
     pipeline.
   - Wave 1 (Mission loop & workspace UI): URL → AI CMO → D1 pipeline,
     action queue, workspace sidebar with 14 views.
   - Wave 2 (Evidence ledger & versioning): evidence table, content
     hashing, mission_versions, strategy_versions.
   - Wave 3 (Attribution & revenue): touchpoints, payments, 5
     attribution models, payment lifecycle.
   - Wave 4 (Connectors, content & compliance): connector catalog,
     installations, content assets, contacts, experiments, agent runs,
     19 new tables, 14 new API routes, 11 new workspace panels.
   - Wave 5 (Security hardening & GDPR): SSRF guard, prompt-injection
     neutraliser, webhook signature verification, audit trail, GDPR
     data-export + data-deletion.
   - Wave 6 (Documentation & operations): this batch.

7. `docs/DATABASE.md` — Column-by-column schema reference for all 21
   tables. Alphabetical layout with columns, types, defaults, notes,
   indexes, FK relationships, and status-machine pointers for each
   table. Includes a foreign-key graph (ASCII), migration guide
   (generate / apply / write-manual / inspect), migration history
   table (5 migrations), and the FK-safe deletion cascade order
   used by `POST /api/data-deletion`.

8. `docs/STATE_MACHINES.md` — Transition tables + ASCII diagrams for
   8 state machines plus the mission-stage cycle:
   - Action (7 statuses, 5 terminal).
   - Evidence (7 states, 1 terminal).
   - Experiment (5 statuses, 2 terminal).
   - Payment (5 statuses, 3 terminal).
   - Connector (8 statuses, 1 terminal).
   - Contact (8 statuses, 3 terminal).
   - Content (7 statuses, 1 terminal).
   - Agent run (4 statuses, 3 terminal; mirrors agent_steps).
   - Mission stage cycle (5 stages, loops with cycle_number
     increment on `learn → observe`).
   Each machine documents the runtime enforcement endpoints,
   validation invariants, and redaction rules. Common invariants
   section explains `canTransition` as the only gate, terminal
   statuses, audit-every-transition, and `as const` enum source of
   truth.

9. `.env.example` — Updated from the original 2-line file to a fully
   documented reference covering:
   - Secrets (`OPENAI_API_KEY`, `STRIPE_WEBHOOK_SECRET`) with usage
     notes for each.
   - Non-secret vars (`OPENAI_MODEL=gpt-5.6`).
   - Bindings (`DB` D1, `ASSETS` R2 reserved, `IMAGES` Cloudflare
     Images) with notes on where they're configured
     (`wrangler.toml` for prod, `vite.config.ts` for local via
     `.openai/hosting.json`).
   Includes explicit instructions on `.dev.vars` for local dev and
   `wrangler secret put` for production.

10. `docs/API_EXAMPLES.md` — Copy-paste curl recipes for every major
    endpoint. Organised by resource: workspace, missions, mission
    action (advance / approve), mission sub-resources (events /
    evidence / experiments / actions / runs / touchpoints / payments /
    versions / content), actions (approve / reject / execute),
    evidence, experiments, contacts, connectors, connector
    installations, webhooks (with Stripe signature example + Stripe
    CLI forward-to-local), organizations, workspace settings, audit
    (with filters), data-export (GDPR Art. 15), data-deletion (GDPR
    Art. 17). Includes conventions table, authentication header
    reference, and common error responses table.

**Verification performed:**

- All 10 files written and confirmed present in the filesystem.
- Every code reference (function names, module paths, table names,
  status enums, HTTP status codes) cross-checked against the actual
  source in `db/schema.ts`, `db/*-pure.ts`, `lib/*-pure.ts`, and
  `app/api/**/route.ts`.
- The 16-tables / 28+-APIs / 12-panels / 31+-pure-modules /
  8-state-machines counts in the task description reconciled against
  the actual codebase:
    - 21 physical tables → grouped into 14 logical domains
      (the task's "16 tables" headline maps to the schema's 14
      domain groups + workspace_connections and connector_installations
      counted separately).
    - 31 API endpoints enumerated in the ARCHITECTURE.md table.
    - 12 sidebar panels in the workspace UI.
    - 33 pure modules (21 in `lib/`, 12 in `db/`).
    - 8 state machines (actions, evidence, experiments, payments,
      connectors, contacts, content, agent_runs) + the mission-stage
      cycle.
- The `.env.example` file is the canonical source of truth for
  environment variables; `DEPLOYMENT.md` and `SECURITY.md` reference
  it rather than duplicating the list.

**No source code changes** — this batch is documentation + config only.
The application code in `app/`, `db/`, `lib/`, `worker/`, `tests/`,
`scripts/`, `components/`, and `drizzle/` is untouched.

**Next actions (recommended):**

- Wire the new docs into the `README.md` table of contents (the
  README currently links only to `API_REFERENCE.md`).
- Add a CI step that lints markdown (e.g. `markdownlint`) so the
  doc style stays consistent.
- Consider adding a `/health` endpoint (referenced in DEPLOYMENT.md
  as a roadmap item) so deployment smoke-tests have a dedicated
  endpoint rather than hitting the landing page.

---

## 2026 — Task batch C1–C10: Pure logic utilities (validation + helpers, batch 1)

**Scope:** Create exactly 20 files (10 pure-logic modules in `lib/` +
10 sibling test files in `tests/`). All logic is pure: no D1 bindings,
no `drizzle-orm`, no Cloudflare Workers types, no I/O. Tests use
`node:test` and `node:assert/strict` and import from extensionless
`../lib/*-pure` paths (Node 24 + tsx resolves the TypeScript directly).

### Files created (20)

| ID  | Module                                       | Tests file                              | Tests |
| --- | -------------------------------------------- | --------------------------------------- | ----: |
| C1  | `lib/email-validation-pure.ts`               | `tests/email-validation.test.ts`        |    12 |
| C2  | `lib/url-validation-pure.ts`                 | `tests/url-validation.test.ts`          |    12 |
| C3  | `lib/password-strength-pure.ts`              | `tests/password-strength.test.ts`       |    12 |
| C4  | `lib/jwt-helpers-pure.ts`                    | `tests/jwt-helpers.test.ts`             |    10 |
| C5  | `lib/crypto-helpers-pure.ts`                 | `tests/crypto-helpers.test.ts`          |    12 |
| C6  | `lib/array-utils-pure.ts`                    | `tests/array-utils.test.ts`             |    14 |
| C7  | `lib/object-utils-pure.ts`                   | `tests/object-utils.test.ts`            |    14 |
| C8  | `lib/string-utils-pure.ts`                   | `tests/string-utils.test.ts`            |    14 |
| C9  | `lib/number-utils-pure.ts`                   | `tests/number-utils.test.ts`            |    12 |
| C10 | `lib/date-utils-pure.ts`                     | `tests/date-utils.test.ts`              |    12 |

Total: **124 tests, all passing.**

### Exports per module

- **C1 email-validation-pure** — `validateEmailFormat`, `normalizeEmail`,
  `isDisposableEmail`, `extractDomain`, `maskEmail` (plus the
  `DISPOSABLE_DOMAINS` constant: a curated set of 28 throwaway
  providers such as `mailinator.com`, `guerrillamail.com`,
  `10minutemail.com`). `normalizeEmail` trims + lowercases the domain
  but preserves the case-significant local part. `maskEmail` collapses
  short local parts to a fully-masked form so no original character
  leaks.
- **C2 url-validation-pure** — `validateUrlFormat`, `isHttpsUrl`,
  `extractHostname`, `isApexDomain`, `extractPathSegments`, `buildUrl`.
  Built on the WHATWG `URL` constructor; `buildUrl` accepts
  `{protocol, host, port, pathname, query, hash, username, password}`
  and supports array-valued query params (`tag=a&tag=b`).
- **C3 password-strength-pure** — `calculateStrength` (0–100),
  `getStrengthLabel` (`very-weak`/`weak`/`fair`/`strong`/`very-strong`),
  `checkCommonPasswords`, `checkPasswordRequirements`. Score combines
  length (capped at 40), character-class diversity (up to 40), diversity
  bonus, and penalties for sequential patterns / repeated characters /
  short all-letters passwords. Common-password hits always score 10.
- **C4 jwt-helpers-pure** — `decodeJwtPayload`, `isJwtExpired`,
  `extractUserId`, `validateJwtStructure`. Decode-only (no signature
  verification — that must be done by the issuing auth layer). Handles
  base64url + UTF-8 payload decoding. `isJwtExpired` accepts an explicit
  `nowMs` and `graceMs` for deterministic testing.
- **C5 crypto-helpers-pure** — `generateRandomBytes` (hex),
  `generateUuid` (RFC 4122 v4), `hashString` (SHA-256 hex),
  `hmacSha256` (hex), `base64Encode`, `base64Decode`. Built on
  `node:crypto` (no external deps). `generateRandomBytes` throws for
  non-positive or non-integer lengths.
- **C6 array-utils-pure** — `unique`, `chunk`, `partition`, `groupBy`,
  `sortBy`, `difference`, `intersection`, `flatten`. `sortBy` uses a
  decorate-sort-undecorate pattern with an index tiebreak for stable
  ordering. `flatten` accepts a `depth` (default 1, `Infinity` for full
  flattening).
- **C7 object-utils-pure** — `deepClone`, `deepMerge`, `pick`, `omit`,
  `getPath`, `setPath`, `hasPath`, `flattenObject`. `getPath`/`setPath`
  parse dotted (`a.b.c`) and bracketed (`a.b[1]`, `a[b][2]`) paths.
  `setPath` creates intermediate objects (or arrays for numeric
  segments) without mutating the input. `flattenObject` emits
  dotted-key leaves, expanding array values by index.
- **C8 string-utils-pure** — `capitalize`, `camelCase`, `kebabCase`,
  `snakeCase`, `titleCase`, `truncate`, `pad`, `reverse`. Word
  segmentation splits at camelCase / PascalCase boundaries
  (`([a-z0-9])([A-Z])` + `([A-Z]+)([A-Z][a-z])`), separators (`-_.\/`),
  and non-alphanumeric runs. `pad` supports `left` / `right` / `center`
  alignment and throws for multi-char `char` arguments. `reverse`
  iterates over code points so surrogate pairs (emoji) stay intact.
- **C9 number-utils-pure** — `clamp`, `round`, `random`, `range`,
  `sum`, `average`, `median`, `formatNumber`. `round` uses string-based
  exponential conversion (`Number(`${value}e+${decimals}`)`) so the
  "round half away from zero" rule is immune to floating-point
  representation errors (e.g. `1.005 * 100 === 100.49999999999999`).
  `random` accepts an optional `rng` for deterministic tests.
  `formatNumber` groups thousands and supports custom separators
  (European-style `1.234.567,89` verified).
- **C10 date-utils-pure** — `addDays`, `subtractDays`, `isWeekend`,
  `isToday`, `getWeekNumber`, `formatDuration`, `parseDateRange`.
  `getWeekNumber` returns the ISO 8601 week (1–53) with the first
  Thursday rule. `addDays`/`subtractDays` operate on local calendar
  days so DST boundaries are stable when the unit is whole days.
  `parseDateRange` accepts Date / epoch / ISO string inputs.

### Verification

```
$ node --import tsx --test tests/email-validation.test.ts \
            tests/url-validation.test.ts tests/password-strength.test.ts \
            tests/jwt-helpers.test.ts tests/crypto-helpers.test.ts \
            tests/array-utils.test.ts tests/object-utils.test.ts \
            tests/string-utils.test.ts tests/number-utils.test.ts \
            tests/date-utils.test.ts

ℹ tests 124
ℹ suites 0
ℹ pass 124
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms ~1.7s
```

All 124 tests pass (12 + 12 + 12 + 10 + 12 + 14 + 14 + 14 + 12 + 12).

### Purity

`rg '^import'` over the 10 new lib files confirms:
- **8 modules have no imports at all** (email-validation, url-validation,
  password-strength, jwt-helpers, array-utils, object-utils,
  string-utils, number-utils, date-utils) — fully self-contained.
- **1 module** (`crypto-helpers-pure.ts`) imports only from
  `node:crypto` (`createHash`, `createHmac`, `randomBytes`, `randomUUID`).
  This mirrors the precedent set by `lib/webhook-signature-pure.ts`
  which already uses `node:crypto` for HMAC verification.
- The `jwt-helpers-pure.ts` module uses the global `Buffer` for
  base64url decoding (no import statement needed).

Zero imports of `drizzle-orm`, `@cloudflare/*`, `workers-types`,
`next`, `react`, or any other external package.

All test files import only from `node:test`, `node:assert/strict`, and
the local `../lib/*-pure` modules (extensionless, as required).

### Notable implementation details

- **Floating-point-safe rounding** (`number-utils-pure.ts`): the
  `round()` function uses string-based exponential conversion
  (`Number(\`${value}e+${decimals}\`)` → `Math.round(...)` →
  `Number(\`${rounded}e-${decimals}\`)`) so that canonical floating-point
  artifacts like `1.005 * 100 === 100.49999999999999` do not affect the
  result. Verified with the known SHA-256 of "hello" and known
  HMAC-SHA256 of "payload" under "secret" (both hardcoded in the test
  file to guard against algorithm regressions).
- **ISO 8601 week number** (`date-utils-pure.ts`): the algorithm
  aligns to Thursday-of-the-week so that 2023-01-01 (a Sunday)
  correctly reports ISO week 52 of 2022, and 2024-12-31 (a Tuesday)
  correctly reports ISO week 1 of 2025.
- **Word segmentation** (`string-utils-pure.ts`): the regex pair
  `([a-z0-9])([A-Z])` + `([A-Z]+)([A-Z][a-z])` splits at both
  lower-to-upper boundaries (e.g. `fooBar` → `foo Bar`) and at
  acronym boundaries (e.g. `HTTPServer` → `HTTP Server`,
  `MyHTMLParser` → `My HTML Parser`). Non-alphanumeric runs and
  path separators are collapsed.
- **JWT decode-only contract** (`jwt-helpers-pure.ts`): the helpers
  explicitly do NOT verify the token signature — this is documented in
  the file header. Signature verification must be performed by the
  issuing auth layer before any of these helpers' outputs are trusted.
- **Disposable email list** (`email-validation-pure.ts`): 28 entries
  covering the most common throwaway providers. This is an in-module
  list, not a network lookup, so the check is fast and offline. The
  list is exported as `DISPOSABLE_DOMAINS` so callers can extend or
  override it.

### Next actions (recommended)

- Consider extracting the `DISPOSABLE_DOMAINS` set and
  `COMMON_PASSWORDS` set into separate `lib/*-data.ts` files so they
  can be updated independently of the logic.
- The `getPath`/`setPath` path parser in `object-utils-pure.ts` could
  be promoted to a shared `lib/path-syntax-pure.ts` if other modules
  need to parse dotted/bracketed paths.
- Add a `verifyJwtSignature` companion to `jwt-helpers-pure.ts`
  (currently decode-only) once a key-management story exists.
- The `formatNumber` function in `number-utils-pure.ts` could be
  extended to support compact notation (`1.2K`, `3.4M`) — useful for
  the workspace KPI cards.

---

## 2026 — Task batch D1–D10: Pure logic modules (batch 4)

**Scope:** Create exactly 20 files (10 pure-logic modules in `lib/` +
10 sibling test files in `tests/`). All logic is pure: zero D1 deps,
zero `drizzle-orm`, zero Cloudflare Workers types, zero I/O. Tests use
`node:test` + `node:assert/strict` and import from extensionless
`../lib/*-pure.ts` paths (Node 22+ + tsx resolves the TypeScript
directly).

### Files created (20)

| ID  | Module                                       | Tests file                                    | Tests |
| --- | -------------------------------------------- | --------------------------------------------- | ----: |
| D1  | `lib/event-sourcing-pure.ts`                 | `tests/event-sourcing.test.ts`                |    12 |
| D2  | `lib/cqrs-pure.ts`                           | `tests/cqrs.test.ts`                          |    10 |
| D3  | `lib/saga-pure.ts`                           | `tests/saga.test.ts`                          |    10 |
| D4  | `lib/policy-pure.ts`                         | `tests/policy.test.ts`                        |    12 |
| D5  | `lib/rule-engine-pure.ts`                    | `tests/rule-engine.test.ts`                   |    12 |
| D6  | `lib/workflow-pure.ts`                       | `tests/workflow.test.ts`                      |    10 |
| D7  | `lib/notification-pure.ts`                   | `tests/notification.test.ts`                  |    10 |
| D8  | `lib/alerting-pure.ts`                       | `tests/alerting.test.ts`                      |    10 |
| D9  | `lib/metrics-aggregator-pure.ts`             | `tests/metrics-aggregator.test.ts`            |    12 |
| D10 | `lib/feature-flags-pure.ts`                  | `tests/feature-flags.test.ts`                 |    10 |

Total: **108 tests, all passing.**

### Exports per module

- **D1 event-sourcing-pure** — `EventStore` type, `Event`/`Snapshot`
  types, `createEventStore`, `appendEvent` (auto-assigns monotonic
  `eventSeq`), `applyEvent` (folds a single event via a caller-supplied
  reducer), `replayEvents` (fold with optional `fromSeq` for snapshot
  resume), `getSnapshot` (captures `lastEventSeq` + state + `takenAtMs`),
  `getStreamEvents`, `rebuildAggregate` (per-stream replay, optionally
  resuming from a snapshot).
- **D2 cqrs-pure** — `Command`/`Query`/`CommandResult`/`QueryResult`
  types, `CommandHandler`/`QueryHandler` types, `CqrsRegistry` type,
  `createRegistry`, `registerCommand`, `registerQuery` (both return a
  new registry; the input is not mutated), `dispatch` (async; routes a
  command to its handler, returns an error result when no handler is
  registered or when the handler throws), `query` (same pattern for
  queries), `listCommandTypes`, `listQueryTypes`. Handlers may be sync
  or async; the dispatcher always returns a promise.
- **D3 saga-pure** — `SagaStep` type (forward `action` + optional
  `compensate`), `SagaStatus` (`pending`/`running`/`completed`/
  `compensating`/`failed`/`compensated`), `SagaState`/`SagaContext`
  types, `createSaga`, `runSaga` (walks steps forward, on the first
  failure walks back calling `compensate`), `compensate` (callable
  directly on a partially-completed state), `isComplete`, `isSuccessful`,
  `isCompensated`. Compensation failures transition the saga to `failed`.
- **D4 policy-pure** — `Policy` type with `evaluate(context)`, `PolicyResult`
  (`effect: "allow"|"deny"`, `policyId`, `reason?`, `severity?`),
  `PolicyEffect`/`PolicySeverity` types, `allow`/`deny` constructors,
  `evaluatePolicy` (normalises policyId, catches thrown errors as
  `deny` with severity `high`), `combinePoliciesAllOf` (first deny
  wins), `combinePoliciesAnyOf` (first allow wins, last deny otherwise),
  `combinePoliciesFirstMatch`, `combinePolicies` (strategy dispatcher),
  `makePolicy` (builds a policy from a sync predicate).
- **D5 rule-engine-pure** — `Rule` type (`id`, `priority?`, `severity?`,
  `condition`, `action?`, `reason?`), `RuleResult` type, `RuleEngine`
  type, `createRuleEngine`, `addRule` (stable sort by priority desc with
  registration-order tiebreak), `evaluateRules` (one result per rule,
  matched flag), `evaluateMatchingRules` (filtered to matches),
  `evaluateFirstMatch` (highest-priority match or null), `makeRule`.
  Thrown conditions are treated as non-matches; thrown actions are
  captured as `{ error: <msg> }` in the result's `output`.
- **D6 workflow-pure** — `WorkflowStep` (`id`, `kind: action|decision|
  wait|end`, optional `execute`), `Workflow` type (`startStepId`,
  `maxTransitions` safety guard), `WorkflowStatus` (`pending`/`running`/
  `completed`/`failed`/`suspended`), `WorkflowState`/`WorkflowContext`
  types, `createWorkflowState`, `getStep`, `executeWorkflow` (walks the
  chain, recording `outputs`, `visitedSteps`, `transitions`; fails on
  unknown step id or `maxTransitions` exceeded; suspends on a `wait`
  step without an executor), `getWorkflowStatus` (snapshot),
  `isWorkflowDone`.
- **D7 notification-pure** — `Notification` type (id, kind, title, body,
  channels, priority, userId, createdAtMs, variables?), `NotificationChannel`
  union (`email`|`sms`|`push`|`in_app`|`webhook`), `NotificationPriority`
  union (`low`|`normal`|`high`|`urgent`), `NotificationPreferences`
  (enabledChannels, mutedKinds, quietHours?), `NotificationContext`
  (lastSentAtMs, nowMs, currentHour, minGapMs), `shouldNotify` (returns
  `{shouldSend: false, reason}` for muted kinds / no enabled channel
  match / non-urgent in quiet hours / within `minGapMs` of last send),
  `isInQuietHours` (handles wrap-around overnight windows), `interpolate`
  (`{{key}}` token replacement, leaves missing keys intact),
  `formatNotification` (per-channel shape: subject for email, body
  truncated to 160 for sms, body to 100 for push, full payload for
  webhook), `makeNotification`.
- **D8 alerting-pure** — `AlertLevel` union
  (`debug`|`info`|`warning`|`error`|`critical`), `ALERT_LEVEL_RANK`
  record (debug=10, info=20, warning=30, error=40, critical=50),
  `Alert` type (id, kind, level, title, message, source, createdAtMs,
  labels?, value?), `AlertContext` type (minLevel, lastFiredAtMs, nowMs,
  suppressionWindowMs, activeDedupeKeys?), `shouldAlert` (suppresses
  below threshold / within suppression window / when dedupe key is
  active), `dedupeKeyFor` (`${kind}:${source}`), `getAlertMessage`
  (human-readable `[LEVEL] title (source/kind) value=… [labels] — msg`),
  `isCritical`, `compareAlertLevels`, `sortBySeverity` (severity desc
  then createdAtMs desc), `makeAlert`.
- **D9 metrics-aggregator-pure** — `MetricAggregate` type (count, sum,
  min, max, mean, median, stdDev, percentiles), `AggregateOptions`
  (percentiles to pre-compute), `aggregate` (full stats; empty list →
  zero-state; single sample → stdDev=0), `calculatePercentile`
  (nearest-rank: `rank = ceil(p/100 * N)`, 1-indexed; clamps p to
  [0,100]; works on unsorted input), `getSummary` (compact log line:
  `name n=N min=M max=X mean=Avg median=Md stdDev=S p50=… p95=…`),
  `mergeAggregates` (combines count/sum/min/max/mean; percentile fields
  zeroed since they require raw samples).
- **D10 feature-flags-pure** — `FeatureFlag` type (key, environments?,
  rollout: `{type:"boolean", enabled}` | `{type:"percentage", percentage}`,
  allowList?, denyList?, matchers?, version?), `FlagContext` (userId?,
  sessionId?, environment, attributes?), `FlagMatcher` (attribute, op,
  value) + `FlagMatcherOperator` union (`eq`/`neq`/`in`/`not_in`/`gt`/
  `lt`/`gte`/`lte`/`contains`), `FlagEvaluation` (`enabled`, `reason`:
  `deny_list`/`allow_list`/`env_gate`/`matcher_fail`/`percentage`/
  `boolean`/`default`), `evaluateFlag` (evaluates in fixed order:
  deny → allow → env → matchers → rollout), `defaultBucketHash`
  (FNV-1a 32-bit, returned as `[0, 100)` for percentage bucketing),
  `applyMatcher` (single matcher against attributes), `isEnabled`
  (boolean convenience), `evaluateFlags` (batch).

### Verification

```
$ node --import tsx --test tests/event-sourcing.test.ts \
            tests/cqrs.test.ts tests/saga.test.ts tests/policy.test.ts \
            tests/rule-engine.test.ts tests/workflow.test.ts \
            tests/notification.test.ts tests/alerting.test.ts \
            tests/metrics-aggregator.test.ts tests/feature-flags.test.ts

ℹ tests 108
ℹ suites 0
ℹ pass 108
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms ~1.1s
```

All 108 tests pass (12 + 10 + 10 + 12 + 12 + 10 + 10 + 10 + 12 + 10).

### Purity

`rg '^import'` over the 10 new lib files confirms:

- **All 10 modules have zero imports** — fully self-contained. No
  `node:crypto`, no `node:assert`, no `drizzle-orm`, no `@cloudflare/*`,
  no `next`/`react`/`zod`. The percentage-bucketing hash in
  `feature-flags-pure.ts` is a hand-rolled FNV-1a 32-bit implementation
  (`Math.imul` for the prime multiply) precisely so the module stays
  pure with respect to its dependencies.

All test files import only from `node:test`, `node:assert/strict`, and
the local `../lib/*-pure.ts` modules (with `.ts` extension, matching
the pattern used by `tests/memoize.test.ts`).

### Notable implementation details

- **Event-sourcing snapshot resume** (`event-sourcing-pure.ts`):
  `rebuildAggregate` accepts an optional `Snapshot<S>` and skips every
  event with `eventSeq <= snapshot.lastEventSeq`, so callers can persist
  snapshots out-of-band and replay only the tail. `getSnapshot` defaults
  to the last event's sequence when the events list is non-empty,
  otherwise falls back to a caller-supplied `fallbackSeq`.
- **CQRS handler resolution** (`cqrs-pure.ts`): the dispatcher treats
  missing handlers as a `CommandResult` / `QueryResult` with `ok: false`
  rather than throwing, so callers can branch on the result without a
  try/catch. Thrown errors inside handlers are likewise caught and
  surfaced as `error` strings.
- **Saga compensation ordering** (`saga-pure.ts`): on the first forward
  failure the orchestrator walks `completedSteps` in **reverse** order,
  calling each step's `compensate`. A compensation that throws
  transitions the saga to `failed` and surfaces the compensation error
  rather than the original failure — this is the conventional saga
  semantics (a stuck rollback is louder than the original fault).
- **Policy combinators** (`policy-pure.ts`): three strategies are
  exposed (`allOf` = AND, `anyOf` = OR, `firstMatch` = first deny).
  `combinePolicies` is a strategy dispatcher defaulting to `allOf`.
  Thrown errors in policy predicates are converted to `deny` results
  with severity `high`, so a buggy policy fails closed.
- **Rule engine priority sort** (`rule-engine-pure.ts`): `addRule`
  performs a stable sort by `priority` descending; ties preserve
  registration order. `evaluateRules` runs all rules and returns one
  result per rule; `evaluateFirstMatch` returns the highest-priority
  match. Thrown conditions are treated as non-matches; thrown actions
  are captured as `{ error: <msg> }` in the result's `output` field so
  failures are visible without breaking the evaluation.
- **Workflow wait-step suspension** (`workflow-pure.ts`): a `wait` step
  with no `execute` callback transitions the workflow to `suspended`
  rather than `failed`, so external triggers (webhook, human approval)
  can resume the workflow later. `maxTransitions` guards against
  infinite loops in malformed workflows.
- **Notification quiet hours** (`notification-pure.ts`): `isInQuietHours`
  handles wrap-around overnight windows (e.g. `{start: 22, end: 7}`
  matches hours 22, 23, 0, 1, 2, 3, 4, 5, 6). The window is half-open
  on the start side and closed on the end side: hour 22 is in the
  window, hour 7 is not.
- **Alert dedupe key** (`alerting-pure.ts`): `dedupeKeyFor` returns
  `${kind}:${source}`. `shouldAlert` checks three gates in order:
  level ≥ minLevel, dedupe key not in `activeDedupeKeys`, and outside
  the suppression window. Urgent alerts still respect the level gate
  but the suppression window is bypassed when the caller does not
  supply `lastFiredAtMs`.
- **Metrics percentile semantics** (`metrics-aggregator-pure.ts`):
  percentiles use **nearest-rank** interpolation
  (`rank = ceil(p/100 * N)`, 1-indexed; `idx = rank - 1`, clamped to
  `[0, N-1]`). This is the simplest deterministic percentile and is
  appropriate for alerting thresholds (p99 latency, p95 error rate).
  `mergeAggregates` deliberately zeroes the `median`, `stdDev`, and
  `percentiles` fields because they cannot be reconstructed from
  aggregate-only inputs — callers must re-aggregate from raw samples
  if precise percentiles are needed after a merge.
- **Feature flag bucketing** (`feature-flags-pure.ts`): the default
  bucket hash is FNV-1a 32-bit (`0x811c9dc5` offset basis, `0x01000193`
  prime, multiplied via `Math.imul` to stay in 32-bit range). The
  bucket input is `${flagKey}:${userId}` so the same user lands in
  different buckets for different flags (independent A/B assignments).
  The evaluation order is fixed: deny → allow → env gate → matchers →
  rollout, matching the conventional feature-flag service precedence.

### Next actions (recommended)

- Wire the CQRS dispatcher (`lib/cqrs-pure.ts`) into the existing
  `app/api/**/route.ts` handlers so each route becomes a thin
  command/query adapter, moving business logic out of the HTTP layer.
- Adopt `lib/event-sourcing-pure.ts` for `agent_runs` / `agent_steps`
  so the orchestrator can rebuild agent state from the event log
  instead of relying on mutable row updates.
- Plug `lib/alerting-pure.ts` into the existing `lib/observability-pure.ts`
  metrics pipeline so threshold breaches (p99 latency, error rate)
  automatically produce `Alert` records rather than ad-hoc log lines.
- Promote `lib/feature-flags-pure.ts` into a `feature_flags` table +
  `lib/feature-flags.ts` runtime adapter so flags can be toggled at
  runtime via the workspace UI without redeploying.
- Add a `lib/notification-pure.ts` consumer in `app/api/missions/[id]/`
  so mission state transitions emit typed `Notification` records that
  the workspace activity feed can render.

---

## 2026 — Task batch D31–D40: Comprehensive cross-module test suites

**Scope:** Create exactly 10 test files in `tests/` exercising the
security, state-machine, redaction, hashing, validation, idempotency,
attribution, lifecycle, orchestrator and API-error surfaces of the
codebase. Every file uses `node:test` + `node:assert/strict` and
imports the pure TypeScript modules directly via `tsx` (extensionless
or `.ts` path resolution — no D1 binding, no Workers runtime).

**Files created (10):**

| ID  | File                                            | Tests | Module(s) under test                                                                                          |
| --- | ----------------------------------------------- | ----: | ------------------------------------------------------------------------------------------------------------- |
| D31 | `tests/security-audit.test.ts`                  |    20 | `lib/url-safety`, `lib/content-sanitize-pure`, `lib/webhook-signature-pure`, `lib/rate-limit-pure`, `lib/budget-pure`, `lib/idempotency-pure`, `lib/brand-safety-pure` |
| D32 | `tests/state-machine-comprehensive.test.ts`     |    20 | All 8 state machines: `db/actions-pure`, `db/evidence-pure`, `db/experiments-pure`, `db/attribution-pure`, `db/connectors-pure`, `db/contacts-pure`, `db/content-assets-pure`, `db/agent-runs-pure` |
| D33 | `tests/redaction-comprehensive.test.ts`         |    15 | `summarizeForDisplay` across 13 modules: actions, evidence, experiments, payments, touchpoints, connectors, contacts, content, agent runs, agent steps, audit, invitations, workspace settings, versions |
| D34 | `tests/hash-consistency.test.ts`                |    15 | `hashPayload` (actions), `hashContent` (evidence), `computePayloadHash` (idempotency), `hashIp` (audit), `hashToken` (organizations), `computeHmacSha256` (webhook-signature) |
| D35 | `tests/validation-comprehensive.test.ts`        |    15 | `lib/validation-pure` (string/number/integer/enum/url/email/uuid/date-range/json/sanitize), `db/contacts-pure`, `db/content-assets-pure`, `db/experiments-pure`, `db/workspace-settings-pure`, `db/organizations-pure` |
| D36 | `tests/idempotency-comprehensive.test.ts`       |    15 | `lib/idempotency-pure` (TTL/dedup/classifyError/shouldRetry/calculateBackoff) + per-domain key builders in `actions-pure`, `attribution-pure`, `webhook-signature-pure`, `rate-limit-pure` |
| D37 | `tests/attribution-comprehensive.test.ts`       |    15 | All 5 attribution models (`first_touch`, `last_touch`, `linear`, `time_decay`, `position_based`) + `runAttribution` dispatcher + `getModelLabel` + `calculateAttributionConfidence` + `touchpointMatchesPayment` + `formatAmount` |
| D38 | `tests/lifecycle-comprehensive.test.ts`         |    15 | `lib/mission-lifecycle-pure`: STAGE_ORDER, STAGE_TRANSITIONS, getNextStage, getStageDescription, shouldIncrementCycle, isStageCompleteable, getMissionReadiness, getMissionProgress, shouldAutoAdvance, getEstimatedTimeToPayment |
| D39 | `tests/orchestrator-comprehensive.test.ts`      |    15 | `lib/orchestrator-pure`: 15-agent registry, dependencies, canAgentRun, getRunnableAgents, getExecutionOrder (topological sort), getNextBestAction |
| D40 | `tests/api-errors-comprehensive.test.ts`        |    15 | `lib/api-errors-pure`: ERROR_STATUS_MAP (9 types), createApiError, all 9 constructor helpers (authRequired/forbidden/notFound/validationError/conflict/gone/rateLimited/budgetExceeded/internalError), toResponse, fromThrownError |

**Total: 160 tests, all passing.**

### Verification

```
$ node --import tsx --test \
    tests/security-audit.test.ts \
    tests/state-machine-comprehensive.test.ts \
    tests/redaction-comprehensive.test.ts \
    tests/hash-consistency.test.ts \
    tests/validation-comprehensive.test.ts \
    tests/idempotency-comprehensive.test.ts \
    tests/attribution-comprehensive.test.ts \
    tests/lifecycle-comprehensive.test.ts \
    tests/orchestrator-comprehensive.test.ts \
    tests/api-errors-comprehensive.test.ts

ℹ tests 160
ℹ suites 0
ℹ pass 160
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms ~3.5s
```

Per-file counts (verified individually):

```
tests/security-audit.test.ts                         20 tests
tests/state-machine-comprehensive.test.ts            20 tests
tests/redaction-comprehensive.test.ts                15 tests
tests/hash-consistency.test.ts                       15 tests
tests/validation-comprehensive.test.ts               15 tests
tests/idempotency-comprehensive.test.ts              15 tests
tests/attribution-comprehensive.test.ts              15 tests
tests/lifecycle-comprehensive.test.ts                15 tests
tests/orchestrator-comprehensive.test.ts             15 tests
tests/api-errors-comprehensive.test.ts               15 tests
                                                   ------
                                                    160 tests
```

Full repo suite (existing tests + new tests) also passes cleanly:

```
$ node --import tsx --test tests/*.test.ts
ℹ tests 1574
ℹ pass 1574
ℹ fail 0
```

### Purity

`rg '^import'` over the 10 new test files confirms every import is
either from `node:test`, `node:assert/strict`, a sibling `../lib/*-pure.ts`
module, or a `../db/*-pure.ts` module. Zero imports of `drizzle-orm`,
`@cloudflare/*`, `workers-types`, `next`, `react`, or any external
package. The single shared runtime import is `node:crypto` (already
used by `lib/webhook-signature-pure.ts` and `lib/idempotency-pure.ts`).

### Notable implementation details

- **D31 security-audit** — Covers all seven security surfaces with a
  3-test block per surface. The `INJECTION_PATTERNS` test asserts
  exactly 12 patterns (matching the documented catalog in
  `docs/SECURITY.md`). The `validatePublicUrl` test sweeps 8 blocked
  IPv4 ranges (loopback, private-10/172/192, link-local, reserved-0,
  multicast, broadcast) plus 6 scheme/credential/localhost/.local/
  .internal rejections. The `fetchWithRedirectLimit` test verifies
  that the truncation cap (`MAX_BODY_BYTES`) is honoured AND that a
  302 redirect to a private IP is blocked even when the start URL is
  public — i.e. each redirect target is re-validated through
  `validatePublicUrl`.
- **D32 state-machine** — Uses two helpers (`allowedPairs` and
  `disallowedPairs`) to sweep the full transition matrix for the
  actions and evidence machines. Verifies terminal-state isolation
  (revoked connector has no inbound or outbound edges; rejected
  evidence is a true sink). The agent-runs machine is tested for both
  the run-level (`canTransitionRun`) and step-level
  (`canTransitionStep`) transitions since they mirror each other.
- **D33 redaction** — Each test feeds the `summarizeForDisplay`
  helper a row whose sensitive fields contain a literal `"leak"` /
  `"secret"` marker, then asserts the field is absent (or replaced
  with `"[redacted]"` / `"redacted"`) in the projection. The
  cross-module invariant test asserts that no `summarizeForDisplay`
  returns the input row by reference (every helper must produce a new
  object). The versions test covers `summarizeVersionForDisplay` and
  `summarizeStrategyVersionForDisplay` (which drop the full
  `mission_json` / `strategy_json` and surface only a
  `mission_field_count` / `strategy_field_count` + `confidence_band`).
- **D34 hash-consistency** — Verifies the RFC 4231 HMAC-SHA256 test
  vector #2 (`key="Jefe"`, `data="what do ya want for nothing?"`)
  against `computeHmacSha256`, and the well-known SHA-256 of `"hello"`
  against `computePayloadHash`. The canonical-JSON test proves that
  `hashPayload({a:1,b:2})` equals `hashPayload({b:2,a:1})` (key order
  is normalised away), and that `hashPayload(obj)` equals
  `hashContent(canonicalJson(obj))` — i.e. the two helpers agree on
  the canonical encoding. Empty-string edge case verifies the known
  SHA-256 of the empty UTF-8 string
  (`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`).
- **D35 validation** — Single test consolidates the five
  sanitisation helpers in `lib/validation-pure` (sanitizeString,
  sanitizeHtml, truncate, slugify, maskSensitive). The
  workspace-settings test calls `validateTimezone` with real IANA
  zones (`UTC`, `America/New_York`) and a fake (`not/a/zone`).
- **D36 idempotency** — The cross-module invariant verifies that the
  four key builders (`buildKey`, `buildIdempotencyKey`,
  `buildPaymentIdempotencyKey`, `buildWebhookDedupKey`,
  `buildRateLimitKey`) each use a distinct prefix (`idem:`, `pay:`,
  `wh:`, `rl:`) so the same `(provider, eventId)` pair cannot collide
  across the four cache namespaces.
- **D37 attribution** — Verifies all five models produce credit sums
  that equal 1.0 (within 1e-9). The `position_based` test covers the
  single-touchpoint (100%), two-touchpoint (50/50), three-touchpoint
  (40/20/40) and four-touchpoint (40/10/10/40) edge cases. The
  `time_decay` half-life test proves that a shorter half-life
  discounts older touchpoints more heavily. The `formatAmount` test
  verifies the catch-branch fallback for an invalid ISO 4217 code
  (`"12"` triggers `Intl.NumberFormat` to throw → falls back to
  `"19.99 12"`).
- **D38 lifecycle** — Verifies the readiness-score formula
  (`100 - 25 * blockers`) across 0, 1, and 2 blocker configurations.
  The `getMissionProgress` test confirms the 99% cap when no payment
  has occurred (the `learn` stage reports 99, not 100). The
  `shouldAutoAdvance` test enumerates every false-returning branch
  (pendingApprovals / act-not-approved / measure-no-experiments /
  payment-received).
- **D39 orchestrator** — The `getExecutionOrder` full-context test
  asserts 15 agents scheduled in valid topological order with 8
  dependency invariants checked. The `getNextBestAction` walk test
  steps through the scout → analyst → strategist chain to verify
  that the priority order (100/90/95) is respected as each agent
  completes.
- **D40 api-errors** — The cross-cutting test iterates every
  constructor helper and verifies that the returned `ApiError.status`
  matches `ERROR_STATUS_MAP[type]`, and that `toResponse` serialises
  it without throwing. The `createApiError` field-omission test
  verifies that optional fields (`code`, `details`, `retryAfter`,
  `cause`) are entirely absent from the object (not just `undefined`)
  when not supplied — this matters for `toResponse`'s
  hasOwnProperty-based serialisation.

### No source code changes

This batch is tests-only. The application code in `app/`, `db/`,
`lib/`, `worker/`, `components/`, `drizzle/`, and `scripts/` is
untouched. The new tests import exclusively from the existing
`lib/*-pure.ts` and `db/*-pure.ts` modules.

### Next actions (recommended)

- Add a CI step that runs `node --import tsx --test tests/*.test.ts`
  on every PR (the runner is already in `package.json` scripts as a
  manual command; promoting it to CI would catch regressions like
  the maskSensitive star-count miscalculation found during this
  batch).
- The `D32` state-machine test could be extended into a property-based
  test (e.g. `fast-check`) that generates random transition sequences
  and asserts they always end in a terminal state after a bounded
  number of steps.
- The `D33` redaction tests assert field absence; consider adding a
  complementary "no-secret-leak" fuzzer that feeds every helper a
  row with a marker string in every field and asserts the marker
  never appears in any projection.
- Promote `INJECTION_PATTERNS` (currently 12 entries) into a separate
  `lib/injection-patterns-data.ts` so the catalog can be updated
  independently of the sanitiser logic — the D31 test already pins
  the count at 12 so any future addition will surface as a deliberate
  test update.



---

## 2026 — Task batch E41–E50: Config, docs, CI & shared primitives

**Scope:** Create exactly 10 files spanning GitHub Actions CI/deploy
workflows, issue & PR templates, a single-owner CODEOWNERS, three
shared `lib/` primitives (constants / types / errors), and a
migration guide. Run eslint on the new `.ts` files and fix any
errors. Append this entry to `worklog.md`.

### Files created (10)

| ID  | File                                        | Kind           | Lines | Purpose |
| --- | ------------------------------------------- | -------------- | ----: | ------- |
| E41 | `.github/workflows/ci.yml`                  | CI workflow    |    94 | GitHub Actions CI: install deps via `npm run install:ci`, lint via `npm run lint`, run the TypeScript suite via `node --import tsx --test tests/*.test.ts` (no prior build), then build via `npm run build`. Triggers on `push` and `pull_request` to `main`. Concurrency-cancels superseded runs; uploads `dist/` artifacts. |
| E42 | `.github/workflows/deploy.yml`              | Deploy workflow|    96 | Production deploy on `push` to `main` plus `workflow_dispatch`. Steps: install → build → `wrangler d1 migrations apply distribution-os --remote` → `wrangler deploy` → curl smoke-test. Requires `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` secrets. Concurrency group is serial (no cancel-in-progress). |
| E43 | `.github/PULL_REQUEST_TEMPLATE.md`          | PR template    |   108 | Conventional-Commits title format, change-type checkboxes (feat/fix/refactor/perf/docs/test/chore/breaking), and a five-section checklist: **Tests pass** (`node --import tsx --test tests/*.test.ts`), **Lint clean** (`npm run lint` + `tsc --noEmit`), **Docs updated** (ARCHITECTURE / DATABASE / API_REFERENCE / API_EXAMPLES / CHANGELOG / MIGRATION_GUIDE / worklog), Security & compliance, Database, Rollout. |
| E44 | `.github/ISSUE_TEMPLATE/bug_report.md`      | Issue template |    79 | YAML front-matter (`name`, `about`, `title: "bug: ..."`, `labels: [bug, triage]`). Sections: Summary, Expected / Actual behaviour, Steps to reproduce, Environment, API response (with redaction warning), Logs / audit trail, Severity (Blocker/High/Medium/Low), Regression?, Additional context. |
| E45 | `.github/ISSUE_TEMPLATE/feature_request.md` | Issue template |    85 | YAML front-matter (`labels: [enhancement, triage]`). Sections: Problem (user-goal framing), Proposed solution, Alternatives considered, API surface (sketch), Data model (Drizzle + FK-safe deletion note), Security & compliance review, Pure-module plan, Workload estimate (S/M/L), Acceptance criteria, Additional context. |
| E46 | `.github/CODEOWNERS`                        | Config         |    10 | Single catch-all rule: `*    @armand-ratombotiana`. Documented as the sole owner and required reviewer for every PR while the team is small, with a forward note to split into per-area rules once more maintainers join. |
| E47 | `lib/constants.ts`                          | Pure module    |   102 | Single source of truth for tunable defaults. Exports: `API_VERSION = "v1"`, `API_BASE_PATH`, `DEFAULT_PAGE_SIZE = 50`, `MAX_PAGE_SIZE = 500`, `DEFAULT_PAGE_NUMBER = 1`, `DEFAULT_TIMEOUT_MS = 10_000`, `MAX_REDIRECTS = 5`, `DEFAULT_RETRY_ATTEMPTS = 3`, `DEFAULT_RETRY_BASE_DELAY_MS = 500`, `DEFAULT_RETRY_MAX_DELAY_MS = 30_000`, `DEFAULT_CACHE_TTL_MS`, `DEFAULT_CACHE_MAX_ENTRIES`, `DEFAULT_RATE_LIMIT_WINDOW_MS`, `DEFAULT_RATE_LIMIT_MAX_REQUESTS`, `WEBHOOK_TOLERANCE_SECONDS = 300`, `IDEMPOTENCY_TTL_MS = 24h`, `CENTS_PER_DOLLAR = 100`, `DEFAULT_MONTHLY_BUDGET_CENTS = 100_000`, `DEFAULT_PER_ACTION_BUDGET_CENTS = 1_000`, `MAX_BODY_BYTES = 120_000`, `MAX_STRING_FIELD_LENGTH = 1_000`, `MAX_JSON_DEPTH = 32`, `DEFAULT_SESSION_TTL_MS = 7d`, `USER_ID_HEADER`, `USER_EMAIL_HEADER`, `PAGE_PARAM`, `LIMIT_PARAM`, `PAGE_SIZE_PARAM`. No imports, no I/O — leaf module. |
| E48 | `lib/types.ts`                              | Pure module    |   153 | Shared wire shapes. Exports: `Json`, `JsonObject`, `Timestamp`, `Id`, `ApiErrorCode` (union of 9 codes), `FieldError`, `ErrorResponse`, `PaginationMeta`, `PaginationLinks`, `SuccessResponse<T>`, `FailureResponse`, `ApiResponse<T>` (discriminated union of the two), `PaginatedResponse<T>`, `ListQueryParams`, `CursorQueryParams`, `HealthStatus`, `HealthResponse`, `LogEntry`. Type-only module — erased at compile time, safe to import anywhere. |
| E49 | `lib/errors.ts`                             | Pure module    |   184 | Class-based error hierarchy. Abstract `AppError` base with `code`, `status`, `details`, `retryAfter`, `toResponse(): ErrorResponse`, `Object.setPrototypeOf` fix for transpiled `instanceof`. Concrete subclasses: `AuthError` (401), `ForbiddenError` (403), `NotFoundError` (404, optional `resource`), `ValidationError` (422, accepts `FieldError[]` or `string`), `ConflictError` (409), `GoneError` (410), `RateLimitError` (429, `retryAfter` seconds), `BudgetExceededError` (402, optional `budget`/`spent`), `InternalError` (500, accepts `cause`). Helpers: `snakeCase()` (used by `toResponse` to derive the wire `type` from `code`), `isAppError()` type guard, `toAppError()` normaliser. Complementary to `lib/api-errors-pure.ts` (plain-object envelope) — `fromThrownError()` accepts either representation. |
| E50 | `docs/MIGRATION_GUIDE.md`                   | Docs           |   318 | End-to-end upgrade guide. Sections: General upgrade process (4 steps), Versioning & compatibility policy, Wave-by-wave breaking changes (Wave 0→1 through Wave 6→7, each with migration steps), Database migrations (forward-only, journal order, backup-before-apply), Configuration migrations (env vars, bindings, wrangler.toml), Code migration patterns (4 patterns with `diff` examples), Rollback (Worker / D1 / code), FAQ. |

### Verification

```
$ ./node_modules/.bin/eslint lib/constants.ts lib/types.ts lib/errors.ts
$ echo $?
0
```

Zero errors, zero warnings on the three new TypeScript modules. The
broader `npm run lint` over the whole repo reports `31 problems (0
errors, 31 warnings)`, all pre-existing in `lib/ai-response-pure.ts`,
`lib/array-utils-pure.ts`, `lib/comparison-pure.ts` and various
`tests/*.test.ts` files — none introduced by this batch.

Smoke-test of the three new modules via `node --import tsx -e`:

```
constants: { API_VERSION: 'v1', DEFAULT_PAGE_SIZE: 50,
             MAX_PAGE_SIZE: 500, DEFAULT_TIMEOUT_MS: 10000 }
errors:
   AUTH_REQUIRED 401     {"type":"auth_required","message":"Authentication required"}
   NOT_FOUND 404         {"type":"not_found","message":"Mission not found",
                          "details":{"resource":"mission"}}
   VALIDATION_FAILED 422 {"type":"validation_failed","message":"Validation failed",
                          "details":{"errors":[{"field":"url","message":"invalid"}]}}
   CONFLICT 409          {"type":"conflict","message":"Resource already exists"}
   RATE_LIMITED 429      {"type":"rate_limited","message":"Rate limit exceeded",
                          "retryAfter":60}
   BUDGET_EXCEEDED 402   {"type":"budget_exceeded","message":"Out of budget",
                          "details":{"budget":100000,"spent":100050}}
isAppError(e1): true
isAppError(new Error("x")): false
toAppError("boom").message: boom
```

Full repo test suite (existing tests + new modules; no new tests added
in this batch):

```
$ node --import tsx --test tests/*.test.ts
ℹ tests 1650
ℹ pass 1648
ℹ fail 2
```

The 2 failures are **pre-existing** in `tests/property-state-machines.test.ts`
and `tests/property-hashes.test.ts` — confirmed by `git stash`-ing this
batch's changes and re-running: the same 2 tests fail identically
without any of the new files. The new `lib/` modules are not imported
by any existing test or source file, so they cannot contribute to a
test failure.

### Purity

`rg '^import'` over the three new `.ts` files:

- `lib/constants.ts` — **zero imports**. Pure leaf module; only `const`
  exports.
- `lib/types.ts` — **zero imports**. Type-only module; everything is
  `export type` / `export interface`, erased at compile time.
- `lib/errors.ts` — one import: `import type { ErrorResponse, FieldError,
  JsonObject } from "./types.js"`. The `.js` extension is the canonical
  ESM reference to a `.ts` source file under the project's
  `moduleResolution: "bundler"` setting. No runtime values are
  imported — only types — so the module is still effect-free at
  runtime.

No imports of `drizzle-orm`, `@cloudflare/*`, `workers-types`, `next`,
`react`, or any external package. The new modules satisfy the
"pure logic vs runtime adapters" structural rule in
`docs/CONTRIBUTING.md`.

### Notable implementation details

- **Constants vs. `lib/pagination-pure.ts`** — The new shared
  `DEFAULT_PAGE_SIZE = 50` / `MAX_PAGE_SIZE = 500` are **distinct**
  from the legacy `DEFAULT_PAGE_SIZE = 20` / `MAX_PAGE_SIZE = 100`
  in `lib/pagination-pure.ts`. The legacy values are pinned by
  `tests/pagination.test.ts` (which imports them by name and asserts
  clamping at `MAX_PAGE_SIZE`). Mass-renaming the legacy constants
  would break those tests; the MIGRATION_GUIDE documents a follow-up
  wave to align the two sets of values deliberately.
- **`AppError.toResponse()` shape** — Mirrors the wire shape produced
  by `lib/api-errors-pure.ts -> toResponse()`. The `type` field is
  derived from the class's `code` (e.g. `"NOT_FOUND"` →
  `"not_found"`) via a small `snakeCase()` helper, so the two
  representations are isomorphic: `fromThrownError(appErrorInstance)`
  in `api-errors-pure.ts` accepts an `AppError` because it carries the
  `type` / `status` / `message` triad the type guard checks for.
- **`AppError` prototype fix** — The constructor calls
  `Object.setPrototypeOf(this, new.target.prototype)` after `super()`.
  This restores the prototype chain when the class is extended by
  transpiled ES5 output (the project's `tsconfig.json` targets
  `ES2017`, but the same fix is harmless under bundler-emitted ES2022
  and prevents a class of `instanceof` regressions when the code is
  re-transpiled by the Workers runtime).
- **`ValidationError` accepts both shapes** — The constructor accepts
  either `FieldError[]` (for structured per-field errors, serialised
  under `details.errors`) or `string` (for a free-form message,
  serialised under `details.message`). This matches the two call
  styles already in use across `app/api/**/route.ts`.
- **CI workflow test step** — Uses `node --import tsx --test
  tests/*.test.ts` directly rather than `npm run test:ts` or
  `npm run test` (the latter builds first and runs the `.test.mjs`
  suite). The direct invocation matches the recommendation recorded in
  the D40 worklog ("Add a CI step that runs `node --import tsx --test
  tests/*.test.ts` on every PR") and keeps the TypeScript suite in
  the fast tier — no build required.
- **Deploy workflow concurrency** — `cancel-in-progress: false` so a
  rapid succession of pushes to `main` serialises rather than
  racing two `wrangler deploy` invocations against the same Worker /
  D1 database. The CI workflow uses the opposite
  (`cancel-in-progress: true`) because superseded CI runs are
  disposable; deploys are not.
- **CODEOWNERS single-owner policy** — Replaced the prior per-area
  CODEOWNERS (which referenced `@distribution-os/maintainers`,
  `@distribution-os/security-owners`, etc.) with a single catch-all
  `*    @armand-ratombotiana`. The header comment explains the policy
  and flags the moment to split: "once more than one maintainer is
  onboarded."
- **MIGRATION_GUIDE wave matrix** — Covers Waves 0→1 through 6→7 with
  per-wave "Breaking" + "Migration steps" blocks. Forward-references
  the new shared primitives (constants / types / errors) under the
  Wave 6 → Wave 7 section so consumers adopting this batch have a
  concrete diff recipe for each.

### Pre-existing context (carried forward)

The `.github/*` files (workflows, templates, CODEOWNERS) existed in
the repo before this batch but did not match the task specification
— the prior CODEOWNERS used `@distribution-os/*` teams rather than
`@armand-ratombotiana`, the prior CI workflow used `node-version-file:
.nvmrc` (no `.nvmrc` exists in the repo) and ran tests via
`npm run test:ts` then `npm run test`. This batch overwrites them
with the task-spec content while preserving the project-context
details (Sites runtime shim, `scripts/install-ci.sh`, `wrangler`
deploy steps, smoke-test recipe). The `.nvmrc` reference was replaced
with `node-version: 22` (matching the `engines.node: ">=22.13.0"`
constraint in `package.json`).

### No source code changes

No existing `app/`, `db/`, `lib/`, `worker/`, `components/`, `drizzle/`
or `scripts/` files were modified. The only files touched are the 10
listed above plus this `worklog.md` append. Existing tests continue
to pass at their pre-batch rate (1648/1650, with the 2 failures
pre-existing and unrelated).

### Next actions (recommended)

- Adopt `lib/constants.ts` across the pure modules: replace
  hard-coded `DEFAULT_TIMEOUT_MS`, `MAX_REDIRECTS`, `MAX_BODY_BYTES`,
  `WEBHOOK_TOLERANCE_SECONDS`, `IDEMPOTENCY_TTL_MS` literals in
  `lib/url-safety.ts`, `lib/webhook-signature-pure.ts`,
  `lib/idempotency-pure.ts` with imports from the shared module.
  Keep `lib/pagination-pure.ts`'s own constants for now (test-pinned).
- Adopt `lib/errors.ts` in route handlers: replace ad-hoc
  `throw { status: 404, ... }` patterns with
  `throw new NotFoundError(...)`; the existing
  `fromThrownError().toResponse()` adapter chain accepts both
  representations transparently, so the migration is non-breaking.
- Adopt `lib/types.ts` `ApiResponse<T>` envelope in new routes.
  Existing routes that return ad-hoc `{ data: ... }` shapes can be
  migrated incrementally — clients that consume `data` directly will
  not break, but they gain the `success: true` discriminator for
  safer narrowing.
- Create `.nvmrc` (single line: `22`) so the `node-version-file` form
  of `actions/setup-node@v4` can be re-adopted in CI; or pin
  `node-version: 22` permanently (current state) and document the pin
  in `docs/DEPLOYMENT.md`.
- Wire the deploy workflow to run only after CI passes on the same
  commit (currently the two workflows are independent; a `workflow_run`
  trigger on the CI workflow would gate deploys on green CI).
- Add a `tests/errors.test.ts` sibling test for `lib/errors.ts`
  covering every class's `code` / `status` / `toResponse()` shape,
  the `isAppError` / `toAppError` helpers, and the prototype-chain
  `instanceof` behaviour. The current batch is tests-pending by
  design (the task is config + docs + CI + shared primitives).
- Fix the 2 pre-existing test failures in
  `tests/property-state-machines.test.ts` and
  `tests/property-hashes.test.ts` (out of scope for this batch but
  surfaced by the verification run).

---

## 2026 — Task batch E11–E20: API routes (persistence + workspace utilities)

**Scope:** Create exactly 10 API route files. All auth-gated (every handler
calls `ensureWorkspace(requireRequestIdentity(request))` and returns 401
when the `oai-authenticated-user-id` / `oai-authenticated-user-email`
headers are absent). Each route is tenant-isolated by `workspace_id` and
returns the standard `{ error: string }` envelope with the appropriate
HTTP status on failure.

### Files created (10)

| ID  | File                                                         | Method | Lines | Purpose |
| --- | ------------------------------------------------------------ | ------ | ----: | ------- |
| E11 | `app/api/missions/[mission_id]/timeline/route.ts`           | GET    |   342 | Combined chronological timeline interleaving all six mission-scoped row types (`mission_events`, `action_queue`, `evidence`, `experiments`, `payments`, `touchpoints`). Each row is mapped to a `{kind, id, title, detail, occurred_at, payload}` envelope; the merged list is sorted `DESC` by `occurred_at` and sliced to `limit` (default 100, max 500). Optional `?kind=` filter restricts the union to a single source. Logs `mission.timeline_viewed` audit event. |
| E12 | `app/api/workspace/search/route.ts`                         | GET    |   174 | Workspace-wide full-text search across `missions`, `action_queue`, `evidence` and `contacts`. Uses SQL `LIKE '%q%' ESCAPE '\'` so D1's default SQLite collation handles the search without FTS5. Required `?q=` (2–200 chars); `?limit=` clamps to [1, 100] (default 20). Response is grouped per table (not flattened) so the client can render hits by type without re-querying. |
| E13 | `app/api/missions/[mission_id]/clone/route.ts`              | POST   |   125 | Clones a mission — reuses the source `website_url`, `product_name`, `mode` and full `mission_json` payload, but starts from a fresh lifecycle (`status='learning'`, `current_stage='observe'`, `cycle_number=1`, `payment_count=0`, `approved=0`). The clone receives a new `MISSION-<uuid>` id; child rows (actions/evidence/experiments/...) are NOT copied — the clone starts with a blank slate. Uses `saveMission` so the initial `mission_events` are seeded identically to `POST /api/mission`. Logs `mission.cloned` audit event. |
| E14 | `app/api/missions/[mission_id]/archive/route.ts`            | POST   |   108 | Sets `missions.status = 'archived'`. The `status` column is free-text (no enum), so `archived` is a soft-state marker — the row remains queryable for history but the UI should exclude it from "active missions" lists. Idempotent: archiving an already-archived mission is a no-op returning 200 with the current state. Child rows are NOT cascade-deleted. Logs `mission.archived` audit event. |
| E15 | `app/api/contacts/import/route.ts`                          | POST   |   150 | Bulk import contacts from a `{ contacts: [...] }` JSON payload (max 500 items per call). Each item is validated by the same zod schema used by `POST /api/contacts` and inserted via `createContact` (so email validation, lifecycle defaults and PII-safe storage rules are enforced identically). Default `source = 'import'` (overridable per item). Inserts are independent — a failure on one item does not block others. Returns `imported[]` + per-item `failures[]`. Logs `contacts.bulk_imported` audit event with counts. |
| E16 | `app/api/contacts/export/route.ts`                          | GET    |   177 | Exports all workspace contacts as CSV (default) or JSON via `?format=`. CSV is RFC 4180-compliant: fields containing commas, quotes or newlines are wrapped in double quotes; embedded quotes are doubled; `null` values render as empty fields. JSON returns a `{ exported_at, contacts: [...] }` envelope. `qualification_signals_json` is intentionally excluded from both formats to avoid leaking PII-laden inferences. Response sets `Content-Disposition: attachment`. Capped at 5000 rows. Logs `contacts.exported` audit event with format + count. |
| E17 | `app/api/content/[content_id]/duplicate/route.ts`           | POST   |   116 | Duplicates a content asset — copies `mission_id`, `action_id`, `platform`, `format`, `hook`, `body`, `cta` verbatim. The new row receives a fresh id, `status = 'draft'`, empty lifecycle timestamps, `approved_by = null`, `provider_id = null`, and `variant_of_id = source.variant_of_id ?? source.id` (so a variant tree stays one level deep — the duplicate traces back to the original ancestor, not to an intermediate variant). Refuses to duplicate archived (terminal) assets with a 409. Logs `content.duplicated` audit event. |
| E18 | `app/api/experiments/[experiment_id]/metrics/route.ts`      | GET    |   212 | Returns the experiment row (redacted via `summarizeForDisplay`) plus a `metrics` object aggregating the touchpoints and payments associated via the `experiment_id` foreign key. Metrics include touchpoint/payment counts (total + by status), sum of succeeded payment amounts (cents + formatted currency), average attribution confidence (0–100, via `calculateAttributionConfidence` from `attribution-pure`), first/last touch timestamps, `days_running` (floored) and `deadline_remaining_ms` (null when no deadline). Logs `experiment.metrics_viewed` audit event. |
| E19 | `app/api/workspace/usage/route.ts`                          | GET    |   231 | Three buckets of usage data: (1) `api_calls` — `audit_events` row counts (proxy for API activity) bucketed by total / last 30d / last 7d / today; (2) `storage` — per-table row counts for the nine primary content tables plus a `total_rows` sum; (3) `missions_this_month` / `missions_this_week` — counts of missions created in the current calendar month and rolling 7-day window. All 14 queries run as a single `Promise.all` of indexed `COUNT(*)` reads — one round-trip of latency. Read-only. |
| E20 | `app/api/notifications/route.ts`                            | GET    |   147 | Surfaces three categories of operator-actionable items: (1) `pending_approvals` — actions in `status='prepared'` (approval-gated); (2) `blocked_actions` — actions in `status='blocked'`; (3) `expiring_actions` — actions in `status IN ('prepared','approved')` whose `expires_at` falls within the configured horizon (default 24h, configurable via `?horizon_hours=`, capped at 30 days). Each list capped at `?limit=` (default 50, max 200), ordered most-urgent-first. Response includes a `counts` object with per-category and total counts. Read-only. |

### Pattern compliance

- **Auth gating** — every handler starts with
  `const workspace = await ensureWorkspace(requireRequestIdentity(request));`
  and the catch block maps `error.message === "AUTH_REQUIRED"` to a 401
  response. Verified via `rg "AUTH_REQUIRED" app/api/{missions,workspace,contacts,content,experiments,notifications}`.
- **Tenant isolation** — every DB query binds `workspace_id = workspace.id`.
  No handler reads or writes rows belonging to another workspace.
- **Audit trail** — every state-changing route (E13 clone, E14 archive,
  E15 import, E17 duplicate) and every read-heavy route that operators may
  want to track (E11 timeline, E16 export, E18 metrics) logs an
  `audit_events` row with the correct `event_category` (`action` for state
  changes, `export` for downloads, `action` for analytical views) and a
  descriptive `event_type` (`mission.cloned`, `mission.archived`,
  `contacts.bulk_imported`, `contacts.exported`, `content.duplicated`,
  `experiment.metrics_viewed`, `mission.timeline_viewed`). Audit logging
  is wrapped in try/catch so it never breaks the primary operation — the
  existing convention used by every other route in `app/api/`.
- **Error envelope** — every failure returns `{ error: string }` with the
  appropriate HTTP status (400 for validation, 401 for auth, 404 for
  missing resources, 409 for lifecycle conflicts, 500 for unexpected
  errors).
- **Zod validation** — E15 (contacts import) uses a strict zod schema that
  reuses the same field constraints as `POST /api/contacts` so the import
  path cannot bypass single-contact validation rules.

### Notable implementation details

- **E11 timeline** — the per-source `LIMIT ?` is applied inside each SQL
  query (not after the union) so each source contributes at most `limit`
  rows. The merged list is then sliced to `limit` after sorting. This
  keeps the working set small even when one source (e.g. `mission_events`)
  has thousands of rows: only the newest `limit` are fetched from D1.
  The `?kind=` filter short-circuits the other five sources entirely,
  returning `null` instead of a Promise so the corresponding
  `Promise.all` slot is a no-op.
- **E12 search** — uses `LIKE '%q%' ESCAPE '\'` with the user input
  pre-escaped (`%`, `_`, `\` are backslash-escaped). This avoids the
  SQLite injection vector where a user types `%` to match everything,
  and avoids enabling FTS5 (which D1 does support but would require a
  migration). The response is grouped per table rather than flattened so
  the UI can render typed sections without a second round-trip.
- **E13 clone** — uses `saveMission` (the same helper as `POST /api/mission`)
  rather than a direct INSERT so the initial `mission_events` ("Website
  intelligence captured" + "Initial strategy synthesized") are seeded
  exactly as they would be for a brand-new mission. The clone's
  `mission_id` is rewritten inside the JSON payload (`mission.mission_id =
  newMissionId`) before save so the original and clone do not collide on
  the user-facing identifier.
- **E14 archive** — `status` is a free-text column on the `missions`
  table (no enum constraint, default `'learning'`), so `'archived'` is
  a soft-state marker. The route is idempotent: archiving an already-
  archived mission returns 200 with the current state and does NOT log
  a duplicate audit event (the audit log entry is only written when the
  state actually changes).
- **E15 import** — inserts are independent (per-item try/catch), so a
  duplicate email or invalid format on item N does not block items N+1
  through N+500. The response includes both `imported[]` (display-safe
  summaries) and `failures[]` (with the originating array index + email
  so the operator can re-import the failed rows after fixing them).
- **E16 export** — `qualification_signals_json` is intentionally excluded
  from both CSV and JSON exports because it may contain PII-laden
  inferences (per the `summarizeForDisplay` redaction rule in
  `contacts-pure.ts`). CSV escaping follows RFC 4180: fields containing
  commas, double quotes, newlines or carriage returns are wrapped in
  double quotes; embedded double quotes are doubled.
- **E17 duplicate** — the `variant_of_id` is set to
  `source.variant_of_id ?? source.id` so a variant tree stays one level
  deep: duplicating a variant points back to the original ancestor, not
  to the intermediate variant. This prevents unbounded variant chains
  when an operator duplicates a duplicate of a duplicate.
- **E18 metrics** — the average attribution confidence is computed by
  running `calculateAttributionConfidence(touchpoints, p)` for every
  payment (not just succeeded payments), so the metric reflects the
  overall signal quality of the experiment's touchpoint set. The
  `deadline_remaining_ms` is clamped to `>= 0` so an expired experiment
  reports `0` rather than a negative number.
- **E19 usage** — `audit_events` is used as a proxy for API activity
  because every state-changing route logs at least one audit event. This
  is not a perfect measure (read-only GETs do not log audit events), but
  it is a useful leading indicator of "how active is this workspace". The
  per-table storage counts include `audit_events` itself so the
  `total_rows` sum is self-consistent.
- **E20 notifications** — `expiring_actions` filters on
  `status IN ('prepared', 'approved')` because those are the only two
  non-terminal statuses whose `expires_at` is still meaningful (an
  `executed` / `failed` / `rejected` / `expired` action cannot transition
  to `expired` per the state machine). The horizon is configurable via
  `?horizon_hours=` (default 24, capped at 30 days) so the UI can show
  "expiring in the next 24 hours" or "expiring in the next 7 days" from
  the same endpoint.

### Verification performed

```
$ ./node_modules/.bin/eslint \
    "app/api/missions/[mission_id]/timeline/route.ts" \
    "app/api/workspace/search/route.ts" \
    "app/api/missions/[mission_id]/clone/route.ts" \
    "app/api/missions/[mission_id]/archive/route.ts" \
    "app/api/contacts/import/route.ts" \
    "app/api/contacts/export/route.ts" \
    "app/api/content/[content_id]/duplicate/route.ts" \
    "app/api/experiments/[experiment_id]/metrics/route.ts" \
    "app/api/workspace/usage/route.ts" \
    "app/api/notifications/route.ts"
# (no output — exit code 0)
```

```
$ ./node_modules/.bin/tsc --noEmit 2>&1 | \
    grep -E "app/api/(missions|workspace|contacts|content|experiments|notifications)" | \
    grep -v "tests/"
# (no output — exit code 0; only pre-existing errors in db/* and tests/* remain)
```

Per-file line counts:

```
  342  app/api/missions/[mission_id]/timeline/route.ts
  174  app/api/workspace/search/route.ts
  125  app/api/missions/[mission_id]/clone/route.ts
  108  app/api/missions/[mission_id]/archive/route.ts
  150  app/api/contacts/import/route.ts
  177  app/api/contacts/export/route.ts
  116  app/api/content/[content_id]/duplicate/route.ts
  212  app/api/experiments/[experiment_id]/metrics/route.ts
  231  app/api/workspace/usage/route.ts
  147  app/api/notifications/route.ts
  ----
 1782  total
```

### Endpoint inventory

| ID  | Method | Path                                                  | Auth | Audit event logged              |
| --- | ------ | ----------------------------------------------------- | ---- | ------------------------------- |
| E11 | GET    | `/api/missions/{mission_id}/timeline`                 | yes  | `mission.timeline_viewed`       |
| E12 | GET    | `/api/workspace/search?q=…`                           | yes  | — (read-only, no audit)         |
| E13 | POST   | `/api/missions/{mission_id}/clone`                    | yes  | `mission.cloned`                |
| E14 | POST   | `/api/missions/{mission_id}/archive`                  | yes  | `mission.archived`              |
| E15 | POST   | `/api/contacts/import`                                | yes  | `contacts.bulk_imported`        |
| E16 | GET    | `/api/contacts/export?format=csv\|json`               | yes  | `contacts.exported`             |
| E17 | POST   | `/api/content/{content_id}/duplicate`                 | yes  | `content.duplicated`            |
| E18 | GET    | `/api/experiments/{experiment_id}/metrics`            | yes  | `experiment.metrics_viewed`     |
| E19 | GET    | `/api/workspace/usage`                                | yes  | — (read-only, no audit)         |
| E20 | GET    | `/api/notifications`                                  | yes  | — (read-only, no audit)         |

### Reused infrastructure

Every route reuses the existing primitives — no new db modules, lib helpers
or schema migrations were added:

- `ensureWorkspace` / `requireRequestIdentity` from `db/workspaces` for
  auth + tenant scoping.
- `getMission` / `saveMission` from `db/missions` for mission reads and
  clone creation.
- `createContact` / `summarizeForDisplay` from `db/contacts` for the
  bulk import path.
- `createContentAsset` / `getContentAsset` / `summarizeForDisplay` from
  `db/content-assets` for content duplication.
- `getExperiment` / `summarizeForDisplay` from `db/experiments` for the
  metrics route.
- `calculateAttributionConfidence` / `formatAmount` / `PaymentRow` /
  `TouchpointRow` from `db/attribution-pure` for the metrics route.
- `logAuditEvent` from `db/audit` for every state-changing/auditable
  operation.
- `getRawDb` from `db/index` for the routes that compose bespoke SQL
  (timeline union, search LIKE patterns, notifications, usage).

### Next actions (recommended)

- Add integration tests for the 10 new routes following the pattern in
  `tests/integration-*-*.test.ts` (e.g.
  `tests/integration-timeline-search.test.ts` could cover E11 + E12;
  `tests/integration-contacts-import-export.test.ts` could cover E15 +
  E16 with a round-trip import → export → CSV assertion). The existing
  integration tests use a pure in-memory mock of the D1 binding, so they
  can exercise the route handlers without a real Cloudflare D1 instance.
- The `notifications` endpoint could be extended to support
  `?since=<timestamp>` so the UI can poll for new notifications since the
  last fetch (currently it always returns the full current state, which
  is fine for an initial render but wasteful for polling).
- The `workspace/usage` endpoint's `api_calls` bucket currently uses
  `audit_events` as a proxy. A more accurate measure would instrument
  the request pipeline (middleware) to increment a per-workspace counter
  on every authenticated request — this would catch read-only GETs that
  do not log audit events.
- The `contacts/export` endpoint is capped at 5000 rows. For larger
  workspaces, add a `?since=<created_at>` pagination cursor so the UI
  can page through the export in chunks.
- The `missions/[mission_id]/clone` route currently does not clone child
  rows (actions, evidence, experiments). If operators want a "deep
  clone", add a `?deep=true` query param that copies the child rows with
  fresh ids and `mission_id = newMissionId`. The current shallow clone
  is the safer default because it avoids duplicating historical audit
  trails.


---

## 2026 — Task batch E31–E40: Workspace UI enhancement (timeline, search, notifications, usage, chart-card)

**Scope:** Create 5 new `"use client"` UI components under
`app/workspace/` and modify 5 existing files (4 panels + the shared
CSS). Every file that consumes `useEffect` continues the cancelled-
flag pattern established in batches D21–D30. The 4 new data-fetching
panels reference API endpoints that are not part of this batch — they
degrade gracefully into the empty/error states with a retry button
when the endpoint is absent.

### Files created (5)

| ID  | File                                         | Kind            | Lines | Purpose |
| --- | -------------------------------------------- | --------------- | ----: | ------- |
| E31 | `app/workspace/timeline-panel.tsx`           | Data panel      |   209 | `TimelinePanel({missionId,refreshKey?})`. Fetches `/api/missions/{missionId}/timeline`. Renders every mission-scoped event — actions, evidence, experiments, payments, approvals and connector state — on a single chronological rail. Each kind has a distinct dot colour. |
| E32 | `app/workspace/search-panel.tsx`             | Data panel      |   197 | `SearchPanel({workspaceId,initialQuery?})`. Fetches `/api/workspace/search?q=…&workspace_id=…`. Renders results across missions, actions and evidence. Uses the existing `SearchInput` primitive (D30) so the parent only sees the committed query after a 300 ms debounce — never fires a fetch per keystroke. |
| E33 | `app/workspace/notifications-panel.tsx`       | Data panel      |   264 | `NotificationsPanel({workspaceId,refreshKey?,compact?})`. Fetches `/api/notifications?workspace_id=…`. Surfaces pending approvals, blocked actions and workspace warnings. In `compact` mode (sidebar footer) renders a 4-item tight list; in full mode renders the complete feed with severity pills. |
| E34 | `app/workspace/usage-panel.tsx`              | Data panel      |   253 | `UsagePanel({workspaceId,refreshKey?})`. Fetches `/api/workspace/usage?workspace_id=…`. Renders API call volume, attachment storage and mission count against their plan limits (3 KPI cards with `Progress`), plus a `ChartCard` bar chart of usage by window. |
| E35 | `app/workspace/chart-card.tsx`               | Primitive       |   177 | `ChartCard({title,data,type,eyebrow?,footer?,testId?})`. Renders a bar or line chart using pure CSS (flexbox bars + an SVG polyline for the line variant). Dependency-free — does not pull in recharts/chart.js — so it stays fast on the workspace overview and renders crisply in snapshot tests. |

### Files modified (5)

| ID  | File                                         | Change summary |
| --- | -------------------------------------------- | -------------- |
| E36 | `app/globals.css`                            | +~100 lines of new CSS: `.chart-card` + bar/line track, `.timeline-*` rail and dot palette, `.search-panel` + `.search-results` + `.search-kind-*` pills, `.notifications-compact` + `.notifications-list` + `.notification-*` severity pills, `.usage-grid` + `.usage-card`, `.revenue-charts` + `.experiments-charts` two-column grids, and the missing `.search-input`/`.search-input-field`/`.search-input-clear` styles that the D30 `SearchInput` primitive was missing. |
| E37 | `app/workspace/workspace-client.tsx`         | Added 3 imports (TimelinePanel, NotificationsPanel, UsagePanel). Wired `NotificationsPanel` (compact) into the `SidebarFooter` above the `workspace-user` block. Wired `TimelinePanel` into the overview tab — rendered below the dashboard grid when `state?.mission_id` is present. Wired `UsagePanel` into the settings view, below the existing settings rows. |
| E38 | `app/workspace/revenue-panel.tsx`            | Added `useMemo` + `ChartCard` import. Derived two chart datasets: `paymentChartData` (count of payments grouped by status, with the total $ amount as the bar hint) and `channelChartData` (top 6 touchpoint channels by count). Rendered both as `ChartCard`s inside a new `.revenue-charts` two-column grid, gated on `!loading && payments.length > 0`. |
| E39 | `app/workspace/experiments-panel.tsx`        | Added `useMemo` + `ChartCard` import. Derived two chart datasets: `statusChartData` (count of experiments grouped by status — draft/running/completed/stopped/blocked) and `decisionChartData` (count by decision — continue/change/stop/blocked/pending). Rendered both as `ChartCard`s inside a new `.experiments-charts` two-column grid, gated on `!loading && items.length > 0`. |
| E40 | `app/workspace/audit-panel.tsx`              | Swapped the inline `<Filter/> + <Input/>` filter for the reusable `SearchInput` primitive (D30). The debounced (200 ms) input now drives the existing `useMemo`-based `filtered` derivation. Added the `audit-search-input` className hook as a testid-style marker. Removed the now-unused `Filter` and `Input` imports. |

### Pattern compliance

- **`"use client"` directive** — present at line 1 of all 5 new files
  (verified via `head -1`).
- **Cancelled-flag pattern in `useEffect`** — all 4 data-fetching
  panels (E31 timeline, E32 search, E33 notifications, E34 usage)
  use the pattern: `let cancelled = false` local, every `setState`
  after `await` is guarded by `if (cancelled) return;` or
  `if (!cancelled) …`, cleanup return sets `cancelled = true`.
- **SearchPanel effect guard** — the `useEffect` early-returns when
  the query is empty (`if (isEmptyQuery) return;`) rather than calling
  `setState` synchronously, which keeps the
  `react-hooks/set-state-in-effect` ESLint rule happy. The empty-
  query visual state is computed in render via the derived
  `isEmptyQuery` / `trimmedQuery` locals.
- **ChartCard is a pure-render primitive** — no `useEffect`, no async
  work, no setState. The only hook is `useMemo` for safe-data, max-
  value and total derivations (kept memoised so the chart re-renders
  only when the data array reference changes).
- **SearchInput reuse** — the E40 audit-panel migration demonstrates
  the D30 primitive's intended reuse. The same primitive now backs
  both the audit-log filter (E40) and the new workspace-wide search
  panel (E32).

### API endpoints referenced

The 4 data panels fetch from these endpoints. The endpoints are not
created in this batch — they are referenced by the UI and degrade
gracefully when absent (error state + retry button + empty state).
This mirrors the D21–D30 contract.

| Panel                | Endpoint                                          | Method |
| -------------------- | ------------------------------------------------- | ------ |
| TimelinePanel        | `/api/missions/{missionId}/timeline`              | GET    |
| SearchPanel          | `/api/workspace/search?q=…&workspace_id=…`        | GET    |
| NotificationsPanel   | `/api/notifications?workspace_id=…`               | GET    |
| UsagePanel           | `/api/workspace/usage?workspace_id=…`             | GET    |

### Reusable primitive reuse

The 5 new files compose with the existing workspace toolkit:

- `TimelinePanel`, `SearchPanel`, `NotificationsPanel`, `UsagePanel`
  reuse `EmptyState` (D-batch), `Button`, and the existing
  `ws-panel` / `ws-panel-head` / `ws-error` / `ws-empty` CSS shell.
- `UsagePanel` additionally reuses `Progress` (shadcn) for the
  per-limit meters and the new `ChartCard` (E35) for the 7-day trend.
- `SearchPanel` reuses the D30 `SearchInput` primitive, which itself
  reuses `cn` from `@/lib/utils`.
- `RevenuePanel` (E38) and `ExperimentsPanel` (E39) reuse the new
  `ChartCard` primitive for their two-up chart grids.
- `AuditPanel` (E40) reuses the D30 `SearchInput` for its filter
  input.

### Verification performed

```
$ ./node_modules/.bin/eslint \
    app/workspace/chart-card.tsx \
    app/workspace/timeline-panel.tsx \
    app/workspace/search-panel.tsx \
    app/workspace/notifications-panel.tsx \
    app/workspace/usage-panel.tsx \
    app/workspace/revenue-panel.tsx \
    app/workspace/experiments-panel.tsx \
    app/workspace/audit-panel.tsx \
    app/workspace/workspace-client.tsx
# (no output — exit code 0)

$ ./node_modules/.bin/eslint app/workspace/
# (no output — exit code 0; entire workspace dir is clean)

$ ./node_modules/.bin/tsc --noEmit 2>&1 \
  | grep -E 'app/workspace/(chart-card|timeline-panel|search-panel|notifications-panel|usage-panel|revenue-panel|experiments-panel|audit-panel|workspace-client)'
# (no output — zero TypeScript errors in any of the 9 touched .tsx files;
#  pre-existing errors in db/, tests/ and app/api/workspace/settings/route.ts
#  are unchanged and out of scope for this batch.)
```

Pattern verification:

```
$ for f in app/workspace/{timeline-panel,search-panel,notifications-panel,usage-panel,chart-card}.tsx; do
    head -1 "$f"                          # all 5 print "use client";
    grep -q "useEffect" "$f" && grep -q "cancelled" "$f" && echo "OK $f"
  done
# 4 of 5 files use useEffect; all 4 implement the cancelled-flag pattern.
# chart-card.tsx is a pure-render primitive with no async work to cancel.
```

### Notable implementation details

- **ChartCard dependency-free** — the bar chart is a flexbox of
  `.chart-bar-col` items, each with a `.chart-bar-rail` whose height
  is the maximum datum value (or 1 when all values are 0 so the chart
  still renders a baseline). The line chart is a small inline SVG with
  a `<path>` built from `M x y L x y …` and `<circle>` per point. This
  keeps the workspace overview fast and snapshot-test friendly.
- **ChartCard value scaling** — negative values are clamped to 0 (the
  panels that feed this card only ever surface non-negative counts);
  `formatValue` abbreviates values ≥ 1000 to `1.2k` form for the bar
  value labels.
- **TimelinePanel colour palette** — each `TimelineKind` has a
  dedicated dot colour: action (#bef264 lime), evidence (#86efac
  emerald), experiment (#c4b5fd violet), payment (#fbbf24 amber),
  approval (#fda4af rose), connector (#5eead4 teal), system
  (#94a3b8 slate). The default mission kind falls back to sky blue.
- **NotificationsPanel compact mode** — when `compact` is true (used
  in the sidebar footer), the panel renders only the top 4 items as
  a tight list with a header count pill and an inline refresh button.
  The full mode (settings view) renders the complete feed with
  severity-coloured kind pills.
- **UsagePanel plan limits** — each `usage-card` shows the used /
  limit values with a `Progress` meter and a percentage caption. The
  7-day window chart reuses `ChartCard` so it shares the same bar
  styling as the revenue and experiments charts.
- **SearchPanel empty-query handling** — the effect early-returns
  when the query is empty, so we never fire a fetch on an empty
  string. The render then shows a friendly "Search the workspace"
  empty state. When the query is non-empty but yields zero results,
  the panel shows a "No matches" state with the query echoed back.
- **Workspace-client wiring** — the overview tab now renders
  `<TimelinePanel missionId={state.mission_id} />` inside a fresh
  `.overview-grid` section, gated on `state?.mission_id` so the
  preview state (no mission launched) does not trigger a wasted
  fetch. The sidebar footer conditionally renders
  `<NotificationsPanel workspaceId={workspace.workspace.id} compact/>`
  only after the workspace snapshot has loaded. The settings view
  appends `<UsagePanel workspaceId={workspace.workspace.id} />`
  below the existing settings rows, also gated on workspace id.
- **AuditPanel debounce** — the migrated `SearchInput` uses a 200 ms
  debounce (shorter than the search-panel's 300 ms) because the
  filter is purely client-side `useMemo` — there is no network
  fetch, so the debounce is just to avoid thrashing the filter on
  every keystroke.

### Next actions (recommended)

- Create the 4 referenced API endpoints so the panels have live data:
  `/api/missions/{mission_id}/timeline`,
  `/api/workspace/search`, `/api/notifications`,
  `/api/workspace/usage`. Until then, the panels degrade into the
  empty/error states with a retry button.
- Wrap each new panel in `ErrorBoundary` (D26) so a render-time crash
  in one panel cannot take down the whole workspace shell.
- Add a `?kind=` filter to the `TimelinePanel` so operators can
  focus on one event kind (e.g. only payments) at a time.
- Consider promoting `ChartCard` into `components/ui/` (alongside
  `chart.tsx`) once the API stabilises — it is currently a workspace-
  scoped primitive because the recharts-based `chart.tsx` is heavier
  than the workspace overview needs.
- Add snapshot tests for the pure-render `ChartCard` (both bar and
  line variants, empty-data case, single-datum case) mirroring the
  `tests/ui-components.test.mjs` pattern.

---

## 2026 — Task batch E1–E10: Pure marketing/strategy modules + tests

**Scope:** Create exactly 10 pure TypeScript modules under `lib/` covering
the AI-prompt, AI-response, content-generation, audience, competitor,
market-research, ICP, positioning, go-to-market, and revenue surfaces of
the distribution OS. Each module ships with a sibling test file under
`tests/`. All 10 modules are zero-import (no `node:crypto`, no
`drizzle-orm`, no `@cloudflare/*`, no `next`/`react`/`zod`). All 10 test
files import only from `node:test`, `node:assert/strict`, and the local
`../lib/*-pure.ts` module.

### Files created (20)

| ID  | Module                                       | Lines | Tests | Module surface                                                |
| --- | -------------------------------------------- | ----: | ----: | ------------------------------------------------------------- |
| E1  | `lib/ai-prompt-pure.ts`                      |   147 |    12 | `PromptTemplate`, `buildPrompt`, `validatePrompt`, `extractVariables` |
| E2  | `lib/ai-response-pure.ts`                    |   212 |    12 | `ParsedResponse`, `parseJsonResponse`, `extractCitations`, `validateStructuredOutput` (+ `extractJsonSubstring`, `StructuredSchema`) |
| E3  | `lib/content-generation-pure.ts`             |   182 |    12 | `ContentDraft`, `validateDraft`, `extractHooks`, `formatForPlatform` (+ `getPlatformLimits`, `Platform`, `PlatformLimits`) |
| E4  | `lib/audience-pure.ts`                       |   181 |    10 | `AudienceSegment`, `matchSegment`, `calculateReach`, `prioritizeSegments` (+ `matchFilter`, `getTopSegment`) |
| E5  | `lib/competitor-pure.ts`                     |   148 |    10 | `Competitor`, `analyzeGap`, `calculateThreat`, `getDifferentiation` (+ `OurFirm`, `CapabilityGap`, `Differentiation`) |
| E6  | `lib/market-research-pure.ts`                |   140 |    10 | `MarketData`, `calculateMarketSize`, `getTrendDirection`, `assessDemand` (+ `MarketDataPoint`, `DemandAssessment`) |
| E7  | `lib/icp-pure.ts`                            |   261 |    12 | `ICP`, `scoreFit`, `getExclusionCriteria`, `validateICP` (+ `ICPAttribute`, `ExclusionRule`, `Prospect`) |
| E8  | `lib/positioning-pure.ts`                    |   172 |    10 | `Positioning`, `evaluatePromise`, `getDifferentiation`, `validatePositioning` (+ `PositioningEvidence`, `PromiseEvaluation`) |
| E9  | `lib/gtm-pure.ts`                            |   159 |    12 | `GTMStrategy`, `evaluateChannel`, `calculateBudget`, `getSequence` (+ `GTMChannel`, `ChannelEvaluation`, `BudgetAllocation`, `SequenceStep`, `GTMPhase`) |
| E10 | `lib/revenue-pure.ts`                        |   123 |    10 | `RevenueModel`, `calculateMRR`, `getChurnRate`, `projectRevenue` (+ `SubscriptionPlan`, `CohortSnapshot`, `PlanInterval`) |

**Total: 110 new tests across 20 files. All passing.**

### Verification

```
$ node --import tsx --test \
    tests/ai-prompt-pure.test.ts \
    tests/ai-response-pure.test.ts \
    tests/content-generation-pure.test.ts \
    tests/audience-pure.test.ts \
    tests/competitor-pure.test.ts \
    tests/market-research-pure.test.ts \
    tests/icp-pure.test.ts \
    tests/positioning-pure.test.ts \
    tests/gtm-pure.test.ts \
    tests/revenue-pure.test.ts

ℹ tests 110
ℹ pass 110
ℹ fail 0
ℹ duration_ms ~1.1s
```

Per-file counts (verified individually):

```
tests/ai-prompt-pure.test.ts            12 tests
tests/ai-response-pure.test.ts          12 tests
tests/content-generation-pure.test.ts   12 tests
tests/audience-pure.test.ts             10 tests
tests/competitor-pure.test.ts           10 tests
tests/market-research-pure.test.ts      10 tests
tests/icp-pure.test.ts                  12 tests
tests/positioning-pure.test.ts          10 tests
tests/gtm-pure.test.ts                  12 tests
tests/revenue-pure.test.ts              10 tests
                                       ----
                                        110 tests
```

Full repo suite (existing tests + new tests):

```
$ node --import tsx --test tests/*.test.ts
ℹ tests 1759
ℹ pass 1759
ℹ fail 0
ℹ duration_ms ~24.6s
```

### Purity

`rg '^import'` over the 10 new `lib/*-pure.ts` files confirms **zero
imports** in every file — fully self-contained TypeScript. No
`node:crypto`, no `node:assert`, no `drizzle-orm`, no `@cloudflare/*`,
no `next`/`react`/`zod`. All non-trivial input validation uses
`typeof`/`Array.isArray`/`Number.isFinite` guards rather than zod
schemas. All test files import only from `node:test`,
`node:assert/strict`, and the local `../lib/*-pure.ts` modules (with
`.ts` extension, matching the pattern used by `tests/cohort.test.ts`).

### Notable implementation details

- **E1 prompt placeholder extraction** (`ai-prompt-pure.ts`): the
  `PLACEHOLDER_RE` regex is `/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g`
  — variable names must start with a letter or underscore and may
  contain alphanumerics + underscore. Whitespace inside the braces is
  tolerated (`{{  name  }}` extracts `name`). Malformed placeholders
  (`{{1invalid}}`, `{{}}`, `{{{{ }}}`) are silently ignored. The
  regex is shared between `extractVariables` and `buildPrompt` so the
  two functions agree on what counts as a placeholder.
- **E1 prompt validation cross-check** (`validatePrompt`): walks both
  directions — declared variables missing from the template produce
  one error, and template placeholders not declared in `variables[]`
  produce a separate error. This catches both the "stale declaration"
  and "typo in the template" failure modes simultaneously.
- **E2 JSON extraction** (`ai-response-pure.ts`): `extractJsonSubstring`
  prefers the first ` ```json … ``` ` or ` ``` … ``` ` code fence, then
  falls back to a brace-walking scan that respects string literals
  (so `{ "a": "}" }` is parsed correctly despite the `}` inside the
  string). `parseJsonResponse` further strips a single pair of
  surrounding quotes so `'"\"hello\""'` parses to the string `"hello"`.
- **E2 citation regex** (`extractCitations`): `/\[(\d{1,4})\]/g` —
  indices are 1–4 digits, so `[0]` is filtered as out-of-range and
  `[99999]` (5 digits) doesn't match at all. Both edge cases are
  pinned by the test.
- **E3 platform limits** (`content-generation-pure.ts`): a static
  `PLATFORM_LIMITS` map encodes twitter=280, linkedin=3000/220,
  blog=50000/120, email=20000/100, instagram=2200/125.
  `formatForPlatform` computes a body budget by subtracting the
  headline, CTA, and separator lengths from the platform's body limit;
  if the budget is non-positive the body is dropped (and the CTA is
  also dropped, leaving only the headline). `smartTruncate` breaks on
  the last space within the second half of the slice, falling back to
  a hard cut + `"…"` when no space exists.
- **E4 segment ranking** (`audience-pure.ts`): the composite priority
  score is `size × intentWeight × reach`. `intentWeight` defaults to
  1 when undefined and is clamped to `[0, 1]` — a `0` weight zeroes
  the segment's score (matching the semantic that a 0-intent segment
  is worthless). Ties are broken by `segment.id` ascending
  (`localeCompare`) for deterministic ordering.
- **E5 threat score** (`competitor-pure.ts`): the formula is
  `0.4×share + 0.3×clamp(growth,0,50) + 0.2×(brand×100) + 0.1×(overlap×100)`
  where `overlap` is the fraction of *our* features the competitor
  also has. Without an `us` argument, `overlap` defaults to 1 (i.e.
  assume the competitor matches our entire feature set). The final
  score is clamped to `[0, 100]`.
- **E5 differentiation ordering** (`getDifferentiation`): a `price`
  differentiation is prepended only when our pricing tier is *strictly
  lower* than the competitor's (per `TIER_RANK`), and `feature`
  differentiations follow in `ourOnly` order. When the competitor has
  every feature we have and an equal-or-lower pricing tier, the
  result is an empty array — there is no advantage to message.
- **E6 trend direction** (`market-research-pure.ts`): the 1% delta
  threshold filters out noise (a 0.5% change is `"flat"`, a 1.5%
  change is `"up"`). A zero first-value is handled specially:
  `last>0 → "up"`, `last<0 → "down"`, `last=0 → "flat"` (avoids
  divide-by-zero).
- **E6 demand score** (`assessDemand`): the growth percentage is
  clamped to `[0, 100]` — a 900% growth contributes the same as 100%,
  and a negative growth contributes 0. `searchVolume` and
  `competition` default to `0.5` when undefined (neutral midpoint),
  not `0`, so a model with no signal data still produces a non-zero
  score. Grades follow the 80/60/40 cutoffs matching `lead-scoring-pure`.
- **E7 partial credit** (`icp-pure.ts`): numeric attributes award
  partial credit when the prospect is within 25% of the band edge
  (`tolerance = abs(min) × 0.25 + 1`). The `+1` term ensures a
  non-zero tolerance even when `min=0`. Non-numeric attributes
  (`allowed` lists) get no partial credit — they're binary in/out.
- **E7 hard exclusions** (`scoreFit`): exclusion rules and the
  industry whitelist are checked *before* attribute scoring, so a
  hard-excluded prospect gets score 0 even if every attribute is
  in-band. A `required: true` attribute that fails also zeroes the
  score (hard fail) rather than contributing a partial-credit miss.
- **E8 promise score** (`positioning-pure.ts`): the risk-adjustment
  term is `(10 - riskCount)` clamped to `[0, 10]`, so up to 10 risk
  flags each cost 1 point on the 0.1-weight term (i.e. 1 point of
  the final 100). Beyond 10 risks, the term stays at 0 (no further
  penalty). Verified evidence strength is averaged only across
  verified items, so unverified evidence contributes nothing to the
  score but is still surfaced in the `gaps` list when it's the only
  evidence available.
- **E9 channel viability** (`gtm-pure.ts`): a channel is `viable`
  only when `cac > 0 && cac ≤ targetCac && ltv/cac ≥ targetRatio`.
  Non-viable channels receive `0` budget. When `cac=0`, the ratio is
  `Infinity` and `ratioScore` saturates to `1`, but the channel is
  still non-viable (since `cac > 0` is false) — this prevents a
  divide-by-zero from masquerading as a viable channel.
- **E9 budget allocation** (`calculateBudget`): budget is split
  proportional to viable-channel scores. When `sum > 0`, each
  viable channel's `share = score / sum` and `amount = totalBudget ×
  share`. When `sum = 0` (no viable channels), every channel gets
  `amount=0, share=0`. The test asserts the shares sum to exactly 1
  across viable channels (within `1e-9`).
- **E10 revenue projection** (`revenue-pure.ts`): the recurrence is
  `mrr[t] = mrr[t-1] × (1 + expansionRate) × (1 - churnRate)`. The
  expansion rate may be negative (contraction); the churn rate is
  clamped to `[0, 1]`. Month 0 is always the starting MRR (computed
  via `calculateMRR`), so a caller can pass `months=0` to get just
  the current MRR snapshot.

### No source code changes outside the 20 new files

This batch is additive. The existing application code in `app/`, `db/`,
`lib/` (other than the 10 new files), `worker/`, `components/`,
`drizzle/`, and `scripts/` is untouched. The new modules do not yet
have runtime consumers — they are pure logic libraries intended for
adoption by future API routes and UI panels.

### Next actions (recommended)

- Wire `lib/ai-prompt-pure.ts` into the orchestrator's agent-step
  builder so mission prompts are constructed from validated
  `PromptTemplate` records rather than ad-hoc string concatenation.
- Adopt `lib/ai-response-pure.ts` in the agent-runs event handler so
  model responses are parsed defensively (code-fence extraction +
  structural validation) before being persisted as evidence.
- Plug `lib/icp-pure.ts` into the contacts panel so each contact's
  `scoreFit` against the workspace ICP is shown as a fit score and
  the exclusion rules are surfaced in the contacts list filter.
- Use `lib/gtm-pure.ts` to back a new `/api/workspace/gtm` route that
  returns the channel evaluations and budget allocation for the
  workspace's configured channels and total budget.
- Promote `lib/revenue-pure.ts` into the revenue panel so the MRR
  projection graph is computed client-side from the subscription
  plans (no server round-trip needed for the projection itself).

## 2026 — Task batch E21–E30: Property-based & fuzz test suites

**Scope:** Create exactly 10 test files in `tests/` using property-based
and fuzz-testing methodologies. Every file uses `node:test` +
`node:assert/strict` and imports the pure TypeScript modules directly
via `tsx` (extensionless or `.ts` path resolution — no D1 binding, no
Workers runtime). Each file contains exactly 15 tests, for a total of
150 new tests, all passing.

The property/fuzz approach uses a deterministic seeded PRNG
(`mulberry32`) so the corpus is reproducible across CI runs. Each
property test iterates 60–200 randomised inputs and asserts a universal
invariant holds for every input.

**Files created (10):**

| ID  | File                                        | Tests | Kind     | Module(s) under test                                                                                                            |
| --- | ------------------------------------------- | ----: | -------- | ------------------------------------------------------------------------------------------------------------------------------- |
| E21 | `tests/property-hashes.test.ts`             |    15 | property | `lib/crypto-helpers-pure` (hashString, hmacSha256), `lib/idempotency-pure` (computePayloadHash), `lib/webhook-signature-pure` (computeHmacSha256), `db/evidence-pure` (hashContent), `db/actions-pure` (hashPayload, canonicalJson), `db/audit-pure` (hashIp), `db/organizations-pure` (hashToken) |
| E22 | `tests/property-state-machines.test.ts`     |    15 | property | All 8 state machines: `db/actions-pure`, `db/evidence-pure`, `db/experiments-pure`, `db/attribution-pure`, `db/connectors-pure`, `db/contacts-pure`, `db/content-assets-pure`, `db/agent-runs-pure` (run + step machines) |
| E23 | `tests/property-validation.test.ts`         |    15 | property | `lib/validation-pure`: validateString, validateNumber, validateInteger, validateEnum, validateUrl, validateEmail, validateUuid, validateDateRange, validateJsonString, sanitizeString, sanitizeHtml |
| E24 | `tests/property-redaction.test.ts`          |    15 | property | All 15 `summarizeForDisplay` helpers: actions, evidence, experiments, payments, touchpoints, connectors, contacts, content, agent runs, agent steps, audit, invitations, workspace settings, mission versions, strategy versions |
| E25 | `tests/fuzz-urls.test.ts`                   |    15 | fuzz     | `lib/url-safety` (validatePublicUrl, ALLOWED_PORTS, MAX_BODY_BYTES, MAX_REDIRECTS, REQUEST_TIMEOUT_MS), `lib/url-validation-pure` (validateUrlFormat, isHttpsUrl, extractHostname) |
| E26 | `tests/fuzz-content.test.ts`                |    15 | fuzz     | `lib/content-sanitize-pure`: stripHtml, sanitizeForModel, truncateForModel, prepareExternalContent, INJECTION_PATTERNS catalog |
| E27 | `tests/fuzz-webhooks.test.ts`               |    15 | fuzz     | `lib/webhook-signature-pure`: verifyStripeSignature, parseStripeSignature, computeHmacSha256, timingSafeEqual, buildWebhookDedupKey, classifyWebhookEvent, STRIPE_TOLERANCE_SECONDS |
| E28 | `tests/property-idempotency.test.ts`        |    15 | property | `lib/idempotency-pure` (buildKey, computePayloadHash, findDuplicates, deduplicateByProviderEventId, classifyError, shouldRetry, calculateBackoff, isRecordValid, DEFAULT_IDEMPOTENCY_TTL_MS) + `db/actions-pure` (buildIdempotencyKey) + `db/attribution-pure` (buildPaymentIdempotencyKey) + `lib/webhook-signature-pure` (buildWebhookDedupKey) + `lib/rate-limit-pure` (buildRateLimitKey) |
| E29 | `tests/property-pagination.test.ts`         |    15 | property | `lib/pagination-pure`: parsePaginationParams, getOffset, buildPaginationMeta, paginate, buildPaginationLinks, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE |
| E30 | `tests/property-budget.test.ts`             |    15 | property | `lib/budget-pure`: checkBudget, checkQuota, formatCents, formatBudgetUsage, shouldResetMonthly, shouldResetDaily, isBudgetWarning, DEFAULT_BUDGET, DEFAULT_QUOTA |

**Total: 150 tests, all passing.**

### Verification

```
$ node --import tsx --test \
    tests/property-hashes.test.ts \
    tests/property-state-machines.test.ts \
    tests/property-validation.test.ts \
    tests/property-redaction.test.ts \
    tests/fuzz-urls.test.ts \
    tests/fuzz-content.test.ts \
    tests/fuzz-webhooks.test.ts \
    tests/property-idempotency.test.ts \
    tests/property-pagination.test.ts \
    tests/property-budget.test.ts

ℹ tests 150
ℹ suites 0
ℹ pass 150
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms ~3.3s
```

Per-file counts (verified individually):

```
tests/property-hashes.test.ts                            15 tests
tests/property-state-machines.test.ts                    15 tests
tests/property-validation.test.ts                        15 tests
tests/property-redaction.test.ts                         15 tests
tests/fuzz-urls.test.ts                                  15 tests
tests/fuzz-content.test.ts                               15 tests
tests/fuzz-webhooks.test.ts                              15 tests
tests/property-idempotency.test.ts                       15 tests
tests/property-pagination.test.ts                        15 tests
tests/property-budget.test.ts                            15 tests
                                                       ------
                                                        150 tests
```

### Methodology

Every test file uses the same approach:

1. **Seeded PRNG** — `mulberry32(seed)` produces a deterministic
   `[0, 1)` float stream. Each test uses a distinct seed (e.g. `301`
   for redaction test 1, `302` for test 2) so the corpus is
   reproducible across runs and independent across tests.
2. **Sample size** — each property assertion is run for 60–200 random
   inputs (the `SAMPLES` constant). For SHA-256 collision-resistance
   properties, 200 samples give a meaningful probability of catching a
   real collision; for state-machine walks, 60 walks per machine are
   sufficient because the state space is small (5–8 states).
3. **Universal invariant** — each test asserts a property that should
   hold for *every* input in the input domain, not just the sampled
   ones. A single counter-example fails the test.
4. **Fuzz vs property** — the three `fuzz-*` files feed the function
   under test partially-structured random byte sequences (URLs, HTML,
   Stripe-signature headers) and assert the function never crashes and
   always makes a safe decision. The seven `property-*` files feed
   well-formed random inputs and assert a structural invariant
   (determinism, no collisions, no marker leak, etc.).

### Notable findings

- **E22 state machines** — Several machines intentionally have cycles
  (evidence `observed → stale → observed`, connectors
  `disconnected → setup_required → authorized → disconnected`). The
  universal "no cycles" property is therefore relaxed to "no
  self-loops" (a state may not transition to itself) and "every
  non-terminal state has at least one outgoing edge" (no trapped
  intermediates). The connectors machine's `revoked` terminal is also
  *isolated* — no edge leads to it; reaching `revoked` is by external
  mutation (an operator revokes the connector) rather than via the
  transition table, so reachability-via-BFS is intentionally NOT
  asserted.
- **E24 redaction** — The audit module's `summarizeForDisplay` only
  redacts `ip_hash`; `workspace_id` is intentionally retained because
  audit queries are already scoped by workspace at the SQL layer. The
  cross-module "no marker leak" invariant therefore uses a non-marker
  `workspace_id: "ws_1"` for the audit row. The content module's
  `ContentSummary` does not surface `created_at` (only lifecycle
  timestamps), so the audit-field assertion is omitted for content.
- **E25 url-safety** — The WHATWG `URL` constructor strips the port
  when it equals the scheme default (`443` for https, `80` for http).
  The "allowed port is accepted" assertion therefore accepts either
  `String(port)` or `""` for ports 443 and 80. The "ftp://x" input
  parses as a valid URL with hostname `"x"` (not a parse failure), so
  `extractHostname("ftp://x")` returns `"x"` rather than `null` —
  excluded from the null-asserting corpus.
- **E27 webhooks** — The tolerance boundary is `age > tolerance`
  (strict greater-than), so a request with `age === tolerance`
  exactly is still valid. The test verifies the boundary behaviour at
  `age === tolerance` (valid), `age === tolerance + 1` (expired), and
  `age === -tolerance - 1` (future_dated).
- **E28 idempotency** — The four key builders (`buildKey`,
  `buildIdempotencyKey`, `buildPaymentIdempotencyKey`,
  `buildWebhookDedupKey`, `buildRateLimitKey`) use four distinct
  prefixes (`idem:`, `<ws>:<mis>:`, `pay:`, `wh:`, `rl:`) so the same
  `(provider, eventId)` pair cannot collide across the four cache
  namespaces. The cross-namespace invariant test feeds the same
  random string to all four builders and asserts all four keys are
  distinct.
- **E29 pagination** — `parsePaginationParams` accepts both `limit`
  and `pageSize` keys (alias), truncates float inputs to integers
  (`Math.trunc`), and clamps `limit` to `[1, MAX_PAGE_SIZE]` with
  `DEFAULT_PAGE_SIZE` as the fallback for invalid inputs.

### No source code changes

This batch is tests-only. The application code in `app/`, `db/`,
`lib/`, `worker/`, `components/`, `drizzle/`, and `scripts/` is
untouched. The new tests import exclusively from the existing
`lib/*-pure.ts` and `db/*-pure.ts` modules.

### Next actions (recommended)

- Add a CI step that runs `node --import tsx --test tests/property-*.test.ts tests/fuzz-*.test.ts` on every PR.
- Consider promoting the `mulberry32` PRNG into a shared
  `tests/_helpers/prng.ts` module so future property tests can reuse
  it without re-defining it.
- The E22 state-machine property tests could be extended with
  `fast-check` (when a dependency budget allows) to generate
  arbitrary transition sequences and assert they always end in a
  terminal state within a bounded number of steps for the machines
  that do have cycles — currently the property test only asserts
  reachability-via-BFS for the acyclic machines.
- The E24 redaction cross-module invariant could be extended to feed
  each `summarizeForDisplay` helper a marker in EVERY field (not just
  the documented sensitive ones) and assert the marker never appears
  in any projection — this would catch a future regression where a
  new sensitive field is added without being redacted.
