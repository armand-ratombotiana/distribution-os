# Distribution OS — Migration Guide

> How to upgrade Distribution OS between versions. Covers the general
> upgrade process, per-wave breaking changes, database migrations,
> configuration changes, and code-migration patterns. Pair this guide
> with [`CHANGELOG.md`](./CHANGELOG.md) (what changed) and
> [`DEPLOYMENT.md`](./DEPLOYMENT.md) (how to deploy).

Distribution OS does not yet have a formal semver release cycle —
production deploys are cut from `main` and tagged by wave (see
[`CHANGELOG.md`](./CHANGELOG.md)). Treat each wave as a minor version
bump (`0.x.0` → `0.(x+1).0`): additive by default, occasionally
breaking, always documented here.

---

## Table of contents

1. [General upgrade process](#general-upgrade-process)
2. [Versioning & compatibility policy](#versioning--compatibility-policy)
3. [Wave-by-wave breaking changes](#wave-by-wave-breaking-changes)
   - [Wave 6 → Wave 7 (current)](#wave-6--wave-7-current)
   - [Wave 5 → Wave 6](#wave-5--wave-6)
   - [Wave 4 → Wave 5](#wave-4--wave-5)
   - [Wave 3 → Wave 4](#wave-3--wave-4)
   - [Wave 2 → Wave 3](#wave-2--wave-3)
   - [Wave 1 → Wave 2](#wave-1--wave-2)
   - [Wave 0 → Wave 1](#wave-0--wave-1)
4. [Database migrations](#database-migrations)
5. [Configuration migrations](#configuration-migrations)
6. [Code migration patterns](#code-migration-patterns)
7. [Rollback](#rollback)
8. [Frequently asked questions](#frequently-asked-questions)

---

## General upgrade process

A safe upgrade follows four steps. Run them in order; do not skip the
preview-environment pass.

### 1. Read the changelog and this guide

Open [`CHANGELOG.md`](./CHANGELOG.md) and locate the highest wave you
have not yet deployed. Read every wave between your current deployment
and the target. Cross-reference any "Breaking" or "Removed" entry
against this guide for migration steps.

### 2. Update dependencies on a branch

```bash
git checkout main
git pull --ff-only
git checkout -b chore/upgrade-to-wave-7
npm run install:ci
```

`npm run install:ci` (via `scripts/install-ci.sh`) is the canonical
install path. It is flock-protected, integrity-pinned, and bounded by
a timeout — do **not** run bare `npm install`.

### 3. Apply code & config migrations

Work through every applicable section in
[Wave-by-wave breaking changes](#wave-by-wave-breaking-changes) below.
For each breaking change:

- search the codebase for the affected symbol with
  `rg --type ts '<old-symbol>'`,
- update each call site,
- update or add a sibling test in `tests/*.test.ts`,
- run `npm run lint` and `node --import tsx --test tests/*.test.ts`.

### 4. Migrate the database, then deploy

```bash
# 4a. Apply D1 migrations to preview and smoke-test
npx wrangler d1 migrations apply distribution-os-preview --remote
npx wrangler deploy -c wrangler.preview.toml

# 4b. After smoke-testing the preview, promote to production
npx wrangler d1 migrations apply distribution-os-prod --remote
npx wrangler deploy
```

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for the full deploy flow,
preview-deploy setup, and the smoke-test recipe.

---

## Versioning & compatibility policy

| Concept               | Policy                                                                                  |
| --------------------- | --------------------------------------------------------------------------------------- |
| Wave                  | A grouped batch of features shipped to `main` together; documented in `CHANGELOG.md`.   |
| Breaking change       | Any change that requires a code edit, config edit, or DB migration on the consumer side. |
| Deprecation window    | A deprecated symbol is kept for **one full wave** before removal.                       |
| Database migrations   | Always forward-only unless an explicit down-migration is shipped alongside.            |
| API version prefix    | `/api/v1/...` — the `v1` segment is reserved and will not change within a wave.         |
| Config keys           | Renames are deprecated for one wave, removed in the next.                               |

The `API_VERSION` constant in [`lib/constants.ts`](../lib/constants.ts)
pins the current API version segment.

---

## Wave-by-wave breaking changes

### Wave 6 → Wave 7 (current)

> Shared constants/types/errors modules, CI workflow, GitHub templates,
> code-owner policy.

#### Added

- `lib/constants.ts` — single source of truth for tunable defaults
  (`API_VERSION`, `DEFAULT_PAGE_SIZE = 50`, `MAX_PAGE_SIZE = 500`,
  `DEFAULT_TIMEOUT_MS = 10_000`, etc.).
- `lib/types.ts` — shared wire shapes (`ApiResponse<T>`,
  `PaginatedResponse<T>`, `ErrorResponse`, `SuccessResponse`,
  `PaginationMeta`, `ListQueryParams`, ...).
- `lib/errors.ts` — class-based error hierarchy (`AppError`,
  `ValidationError`, `AuthError`, `NotFoundError`, `ConflictError`,
  `RateLimitError`, `BudgetExceededError`, plus `ForbiddenError`,
  `GoneError`, `InternalError`).
- `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`,
  `.github/PULL_REQUEST_TEMPLATE.md`, `.github/ISSUE_TEMPLATE/*.md`,
  `.github/CODEOWNERS`.
- `docs/MIGRATION_GUIDE.md` (this file).

#### Migration steps

1. **Adopt the shared constants.** Where a pure module hard-codes a
   value that now lives in `lib/constants.ts`, switch to the import:

   ```diff
   -const DEFAULT_TIMEOUT_MS = 10_000;
   +import { DEFAULT_TIMEOUT_MS } from "@/lib/constants";
   ```

   Do **not** mass-rename `lib/pagination-pure.ts`'s own
   `DEFAULT_PAGE_SIZE` / `MAX_PAGE_SIZE` constants — they are pinned
   to `20` / `100` by `tests/pagination.test.ts`. A follow-up wave will
   align them with the new shared values.

2. **Adopt the shared types.** New routes should return the
   `ApiResponse<T>` envelope from `lib/types.ts`:

   ```ts
   import type { ApiResponse, Mission } from "@/lib/types";
   const body: ApiResponse<Mission> = { success: true, data: mission };
   return Response.json(body, { status: 200 });
   ```

3. **Adopt the error classes.** Prefer throwing an `AppError` subclass
   over constructing a plain `ApiError` object:

   ```diff
   -import { notFound } from "@/lib/api-errors-pure";
   -throw notFound("Mission not found", "mission");
   +import { NotFoundError } from "@/lib/errors";
   +throw new NotFoundError("Mission not found", { resource: "mission" });
   ```

   `lib/api-errors-pure.ts` is **not** removed — its
   `fromThrownError()` accepts an `AppError` instance transparently, so
   existing route handlers that call `fromThrownError(err).toResponse()`
   keep working unchanged.

4. **CI workflow.** If you forked the previous CI workflow, replace it
   with the new `.github/workflows/ci.yml`. The test step is now
   `node --import tsx --test tests/*.test.ts` (no prior build required),
   matching the recommendation in the Wave 5 worklog.

5. **Code owners.** `.github/CODEOWNERS` now lists `@armand-ratombotiana`
   as the sole required reviewer. If you forked the previous per-area
   CODEOWNERS, replace it with the single catch-all line.

#### Not breaking

- `lib/api-errors-pure.ts` is unchanged and remains the canonical
  serialiser for cross-worker error envelopes.
- `lib/pagination-pure.ts` is unchanged; its `DEFAULT_PAGE_SIZE` /
  `MAX_PAGE_SIZE` constants are separate from the new shared ones.

---

### Wave 5 → Wave 6

> Documentation & operations. No code breaking changes.

#### Added

- `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, `docs/DEPLOYMENT.md`,
  `docs/TESTING.md`, `docs/CONTRIBUTING.md`, `docs/DATABASE.md`,
  `docs/STATE_MACHINES.md`, `docs/API_EXAMPLES.md`, `docs/CHANGELOG.md`.
- `.env.example` updated with `OPENAI_API_KEY`, `OPENAI_MODEL`,
  `STRIPE_WEBHOOK_SECRET`, and the `DB` binding reference.

#### Migration steps

1. Update your local `.dev.vars` from the new `.env.example`.
2. Update any internal onboarding doc to point at the new
   `docs/` set rather than ad-hoc README sections.

---

### Wave 4 → Wave 5

> Security hardening & GDPR. Replaces the legacy `assertPublicUrl` and
> the bare `fetch + entity-decode` mission pipeline.

#### Breaking

- `lib/url-safety.ts` replaces the legacy `assertPublicUrl`. The legacy
  function is removed; update call sites to `validatePublicUrl` /
  `fetchWithRedirectLimit`.
- `POST /api/mission` no longer uses raw `fetch + entity-decode`. It
  now uses `fetchWithRedirectLimit` + `prepareExternalContent`. Direct
  callers of the mission route see no change, but any code that
  shelled out to the legacy fetch pipeline must be updated.
- `lib/api-errors-pure.ts` introduces the typed error envelope. Routes
  that previously returned ad-hoc `{ error: "..." }` shapes should
  switch to `createApiError(...)` + `toResponse()`.

#### Migration steps

1. Replace any `assertPublicUrl` import with `validatePublicUrl`:

   ```diff
   -import { assertPublicUrl } from "@/lib/url-safety";
   -assertPublicUrl(url);
   +import { validatePublicUrl } from "@/lib/url-safety";
   +const result = validatePublicUrl(url);
   +if (!result.ok) throw new ValidationError(result.error);
   ```

2. Update outbound HTTP calls to use `fetchWithRedirectLimit`:

   ```diff
   -const res = await fetch(url);
   +import { fetchWithRedirectLimit } from "@/lib/url-safety";
   +const res = await fetchWithRedirectLimit(url);
   ```

3. Replace ad-hoc error envelopes with `createApiError(...)` +
   `toResponse()` from `lib/api-errors-pure.ts`.

---

### Wave 3 → Wave 4

> Connectors, content, contacts, experiments, agent runs. Schema-only
> breaking change: 19 new tables.

#### Breaking

- Drizzle migration `0004_loose_spacker_dave.sql` adds 19 tables.
  Existing queries are unaffected; the migration is purely additive.

#### Migration steps

1. Pull `main`, run `npm run install:ci`.
2. Apply the migration to preview, then production:
   `npx wrangler d1 migrations apply distribution-os --remote`.
3. The workspace UI adds 10 new views — no code change required for
   API consumers.

---

### Wave 2 → Wave 3

> Attribution & revenue. Adds `touchpoints`, `payments` tables and the
> 5 attribution models.

#### Breaking

- Mission `status` field gains a `revenue` stage after the first
  `succeeded` payment. Any code with a closed enum of mission statuses
  must add the `revenue` value.

#### Migration steps

1. Audit any `Mission["status"]` consumer for exhaustive `switch`
   statements; add a `revenue` case.
2. Apply migration `0003_aberrant_mister_sinister.sql` (index swap on
   `missions` + `workspace_connections`). The migration is
   forward-only; the dropped indexes are superseded by composites.

---

### Wave 1 → Wave 2

> Evidence ledger & versioning. Adds the `evidence` table, content
> hashing, and the `mission_versions` / `strategy_versions` tables.

#### Breaking

- `POST /api/mission/action` now writes a `mission_versions` row on
  every advance and an `audit_events` row on every approval. Any caller
  that asserted the absence of side effects on `advance` must update.

#### Migration steps

1. Apply migrations `0001_youthful_greymalkin.sql` and
   `0002_sharp_the_santerians.sql` (workspaces table + index drop).
2. If you have a forked `POST /api/mission/action`, port the
   `mission_versions` write.

---

### Wave 0 → Wave 1

> Mission loop & workspace UI. Adds the URL → AI CMO → D1 pipeline,
> action queue, and the workspace sidebar.

#### Breaking

- Initial public API surface (`POST /api/mission`,
  `POST /api/mission/action`, `GET /api/workspace`).

#### Migration steps

1. Apply migration `0000_grey_christian_walker.sql` (initial schema).
2. Configure the `DB` D1 binding in `wrangler.toml` (or rely on the
   hosting control plane's `.openai/hosting.json`).
3. Set `OPENAI_API_KEY` via `wrangler secret put` for live mode, or
   leave unset for simulation mode.

---

## Database migrations

Migrations live in [`drizzle/*.sql`](../drizzle/) and are tracked by
[`drizzle/meta/_journal.json`](../drizzle/meta/_journal.json). They are
generated by Drizzle Kit from [`db/schema.ts`](../db/schema.ts):

```bash
npm run db:generate
```

### Apply order

Always apply migrations in the order recorded in the journal. D1
migrations are not transactional across statements — a partial failure
leaves the database in an inconsistent state, so always back up D1
before applying to production:

```bash
npx wrangler d1 backup create distribution-os-prod
```

### Forward-only by default

Distribution OS migrations are forward-only. If a migration is
destructive (column rename, type change, table drop), the migration
header documents the data loss and offers a manual reconciliation
script. Do not attempt to revert by replaying a prior migration
forwards — write an explicit down-migration instead.

### Cross-environment parity

The local D1 (provisioned by the Cloudflare Vite plugin), the preview
D1, and the production D1 must always be at the same migration
journal index after a deploy. CI does not enforce this today —
operators must apply migrations to each environment in the same PR
that introduces them.

See [`DATABASE.md`](./DATABASE.md) for the column-by-column schema
reference and [`DEPLOYMENT.md`](./DEPLOYMENT.md#database-migrations)
for the wrangler commands.

---

## Configuration migrations

### Environment variables

The canonical list lives in [`.env.example`](../.env.example). When a
variable is renamed, the old name is accepted (with a deprecation log
line) for one wave, then removed.

| Wave   | Variable                | Change                                       |
| ------ | ----------------------- | -------------------------------------------- |
| 5      | `OPENAI_API_KEY`        | Added (was previously hard-coded ad-hoc).    |
| 5      | `OPENAI_MODEL`          | Added; default `gpt-5.6`.                    |
| 5      | `STRIPE_WEBHOOK_SECRET` | Added.                                       |
| 7      | `DEFAULT_PAGE_SIZE`     | New shared constant in `lib/constants.ts`; not an env var. |

### Bindings

The `DB` D1 binding is required in every environment. The optional
`ASSETS` R2 binding is reserved for future large-asset uploads and is
not yet consumed by application code.

### wrangler.toml

Distribution OS does not ship a `wrangler.toml` — bindings are
declared in [`vite.config.ts`](../vite.config.ts) and read from
`.openai/hosting.json`. To deploy with `wrangler` directly, create a
`wrangler.toml` per the template in
[`DEPLOYMENT.md`](./DEPLOYMENT.md#wrangler-configuration).

---

## Code migration patterns

### Pattern 1 — Replace a hard-coded constant with the shared import

```diff
- const MAX_PAGE_SIZE = 100;
+ import { MAX_PAGE_SIZE } from "@/lib/constants";
```

Search for ad-hoc copies with:

```bash
rg --type ts 'MAX_PAGE_SIZE\s*=\s*\d+'
```

### Pattern 2 — Replace an ad-hoc error throw with an `AppError` subclass

```diff
- throw { status: 404, message: "Mission not found" };
+ import { NotFoundError } from "@/lib/errors";
+ throw new NotFoundError("Mission not found", { resource: "mission" });
```

At the route boundary, normalise via `fromThrownError`:

```ts
import { fromThrownError } from "@/lib/api-errors-pure";
try {
  // ... pure-module call
} catch (err) {
  const apiError = fromThrownError(err);
  const { status, body } = toResponse(apiError);
  return Response.json(body, { status });
}
```

### Pattern 3 — Replace an ad-hoc response shape with `ApiResponse<T>`

```diff
- return Response.json({ mission });
+ import type { ApiResponse } from "@/lib/types";
+ const body: ApiResponse<Mission> = { success: true, data: mission };
+ return Response.json(body);
```

### Pattern 4 — Migrate a `*.test.mjs` build-dependent test to a `*.test.ts` pure test

Pure tests run without a prior build via
`node --import tsx --test tests/*.test.ts`. Move any logic-only test
out of the `.test.mjs` suite and into a `.test.ts` file so it joins
the fast tier:

```diff
- // tests/foo.test.mjs  (build-dependent)
+ // tests/foo.test.ts   (pure, runs under tsx)
```

---

## Rollback

### Worker rollback

Cloudflare Workers supports instant rollback to the previous version:

```bash
npx wrangler deployments list
npx wrangler deployments rollback --version-id <previous-version-id>
```

### D1 rollback

D1 does not support automatic migration rollback. To revert:

1. Restore from the most recent D1 backup taken before the migration:
   ```bash
   npx wrangler d1 backup restore distribution-os-prod <backup-id>
   ```
2. If no backup is available, write an explicit down-migration that
   reverses the schema change and apply it via
   `wrangler d1 migrations apply --remote`.

> Data lost by a forward migration cannot be recovered unless you have
> a D1 backup. Schedule periodic backups via the dashboard or
> `wrangler d1 backup create`.

### Code rollback

`git revert` the merge commit on `main` and re-run the deploy workflow.
The Worker is stateless, so a code-only rollback is safe at any time.

---

## Frequently asked questions

### Do I need to update my application code on every wave?

No. Most waves are additive. You only need to update code when a wave
entry is marked "Breaking" in [`CHANGELOG.md`](./CHANGELOG.md) and has
a corresponding section above.

### Can I skip waves?

Yes, but you must apply every database migration in journal order
between your current deployment and the target. Skipping a migration
leaves the journal out of sync and the next `db:generate` will produce
a broken diff.

### Where do I report a migration that did not work?

Open a bug report using the
[`bug_report.md`](../.github/ISSUE_TEMPLATE/bug_report.md) template.
Include the wave you migrated from/to, the migration journal index
before and after, and the exact error message.

### How do I migrate a forked copy of Distribution OS?

Rebase your fork onto `main`, resolve conflicts file-by-file, and run
`npm run lint && node --import tsx --test tests/*.test.ts && npm run build`
locally. If you have forked any of the `lib/*-pure.ts` modules, port
the breaking-change sections above onto your fork before merging.
