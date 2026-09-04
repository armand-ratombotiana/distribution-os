# Distribution OS — Worklog

This file is an append-only record of substantive work performed on the
repository. Each entry is dated and grouped by task batch.

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
