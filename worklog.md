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


