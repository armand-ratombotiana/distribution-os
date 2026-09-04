# Distribution OS — Contributing Guide

> How to contribute to Distribution OS. Covers code style, the pure-
> logic / runtime split, the PR process, commit conventions, and
> testing requirements.

Distribution OS is a small team operating a fast-moving agentic
marketing system. We optimise for **reviewable, reversible, well-tested
changes**. The two structural rules below are the most important — read
them before opening a PR.

---

## Table of contents

1. [Structural rules](#structural-rules)
2. [Code style](#code-style)
3. [Commit conventions](#commit-conventions)
4. [Pull request process](#pull-request-process)
5. [Testing requirements](#testing-requirements)
6. [Database changes](#database-changes)
7. [Security review](#security-review)
8. [Release process](#release-process)
9. [Getting help](#getting-help)

---

## Structural rules

### Rule 1 — Pure logic vs runtime adapters

Every business rule lives in a **pure module** (`lib/*-pure.ts` or
`db/*-pure.ts`) with no I/O, no globals, no `Date.now()`, no
`Math.random()`, no `fetch`. Pure modules:

- take `nowMs` / `fetchImpl` / `random` as explicit parameters when
  needed,
- return plain values (no `Promise<Response>`),
- can be unit-tested in plain Node with no D1 binding.

Runtime adapters (`db/*.ts`, `app/api/**/route.ts`, `worker/index.ts`)
are thin: they parse the request, call a pure function, persist the
result, and serialise the response. **No business decisions in
adapters.**

If you find yourself writing `if (status === "approved")` in a route
handler, stop — that logic belongs in a pure module with a test.

### Rule 2 — Every pure module ships with a test

The sibling test file is `tests/<module-name>.test.ts` (drop the
`-pure` suffix). A PR that adds a pure module without a test will be
blocked. See [`TESTING.md`](./TESTING.md) for the full guide.

---

## Code style

### TypeScript

- `strict: true` is on. No `any` without a comment explaining why.
- Use `type` for unions and intersections; `interface` only when you
  need declaration merging.
- Prefer `as const` for literal arrays and objects (it makes the
  inferred type narrow and tuple-shaped).
- Prefer readonly types for inputs: `readonly string[]`, `Readonly<T>`.

### Formatting

- 2-space indent.
- Single quotes for strings (double quotes only when the string
  contains a single quote).
- Semicolons always.
- Trailing commas in multi-line objects and arrays.
- Max line length: 100 characters (soft).
- No unused variables (`@typescript-eslint/no-unused-vars` is on,
  except in `components/ui/**` which is vendored from shadcn).

### Imports

- Group: (1) `node:*` built-ins, (2) external packages, (3) `@/*`
  internal aliases, (4) relative imports.
- Use the `@/*` alias for cross-directory imports
  (`@/lib/url-safety`), relative imports only within the same
  directory (`./foo-pure`).

### Naming

- Files: `kebab-case.ts` for modules, `kebab-case.test.ts` for tests,
  `PascalCase.tsx` for React components.
- Pure modules end in `-pure.ts`. Adapters do not.
- Functions: `camelCase`.
- Types: `PascalCase`.
- Constants: `UPPER_SNAKE_CASE` for top-level constants, `camelCase`
  for object properties.
- Database columns: `snake_case` (Drizzle ORM convention).

### Comments

- Use `//` for inline comments. Use `/** … */` JSDoc for exported
  functions and types.
- Comment the *why*, not the *what*. The code already says what.
- Each `*-pure.ts` module starts with a header comment explaining its
  scope and side-effect posture.

### Forbidden

- `console.log` in committed code (use `lib/observability-pure.ts`
  instead).
- `Date.now()` in pure modules (take `nowMs` as a parameter).
- `Math.random()` in pure modules (take `random` as a parameter).
- `fetch` in pure modules (take `fetchImpl` as a parameter).
- Raw SQL string concatenation. Always use parameterised queries via
  D1's `.prepare().bind()`.
- Storing secrets in `wrangler.toml` or `.env.example`. Secrets go in
  `wrangler secret put` or `.dev.vars`.

---

## Commit conventions

We follow a simplified Conventional Commits format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

| Type       | Use                                                |
| ---------- | -------------------------------------------------- |
| `feat`     | New user-facing feature.                           |
| `fix`      | Bug fix.                                           |
| `refactor` | Code change that neither adds a feature nor fixes a bug. |
| `test`     | Test-only change.                                  |
| `docs`     | Documentation only.                                |
| `chore`    | Build, deps, config, scripts.                      |
| `perf`     | Performance improvement.                           |
| `sec`      | Security hardening.                                |

### Scopes

Use the directory or module name: `mission`, `evidence`, `actions`,
`connectors`, `payments`, `audit`, `webhooks`, `url-safety`,
`content-sanitize`, `db`, `worker`, `docs`, `tests`, `deps`.

### Subject

- Imperative mood: "add", "fix", "remove" — not "added", "fixes".
- Lowercase, no trailing period.
- ≤72 characters.

### Body

- Wrap at 72 characters.
- Explain *why* the change is needed, not *what* changed (the diff
  already says what).
- Reference the issue / task ID.

### Footer

- `Closes #123` to auto-close issues.
- `BREAKING CHANGE: <description>` for backwards-incompatible changes.

### Examples

```
feat(mission): persist website evidence row on mission creation

POST /api/mission now writes an `evidence` row with source_type=website
and state=observed from the sanitized website text. This gives every
mission a baseline observation that later cycles can refine into
verified or contradicted state.

Closes #42
```

```
fix(url-safety): reject IPv4-mapped IPv6 loopback addresses

::ffff:127.0.0.1 was passing validation because the IPv6 branch did
not delegate to the IPv4 check for mapped addresses. Now it does.

sec: SSRF
```

```
refactor(audit): move buildAuditEntry to db/audit-pure.ts

No behaviour change. Moves the row-builder out of the D1 adapter so it
can be unit-tested in isolation.
```

---

## Pull request process

### 1. Branch

Branch from `main`:

```bash
git checkout -b feat/mission-evidence-row
```

### 2. Implement

Follow the structural rules and code style above. If you're adding a
new pure module, create the sibling test in the same PR.

### 3. Test locally

```bash
npm run lint
npm run test
```

Both must pass before you open the PR.

### 4. Open the PR

- Title: same format as the commit subject (`feat(mission): persist website evidence row`).
- Description:
  - **What** — one paragraph summary.
  - **Why** — the motivation / business reason.
  - **How** — the structural approach (which pure module, which
    adapter, which DB table).
  - **Testing** — which tests were added / updated.
  - **Security** — call out any security-relevant changes (new
    endpoint, new external call, new PII field).
  - **Breaking changes** — if any, with migration notes.

### 5. Address review feedback

- Push fixes as new commits; do not force-push during review (it makes
  the diff hard to follow).
- After approval, the maintainer may squash-merge.

### 6. Deploy

After merge, the CI deploys to the preview environment automatically.
Promotion to production is a separate manual step (see
[`DEPLOYMENT.md`](./DEPLOYMENT.md)).

---

## Testing requirements

### Required

- Every new pure function has a sibling test.
- Every new state machine has a transition-table test (every permitted
  and forbidden `(from, to)` pair).
- Every new `summarizeForDisplay` redaction has an assertion that the
  sensitive field is gone and the safe field is preserved.
- `npm run lint` passes.
- `npm run test` passes.
- TypeScript compiles with `strict: true`.

### Recommended

- Edge cases: empty input, null, undefined, very long strings, negative
  numbers, boundary values (0, MAX_INT, exactly-at-limit).
- Negative tests: invalid input should throw or return `ok: false`,
  not silently succeed.
- Determinism: same inputs → same outputs. If your function uses
  randomness, take `random` as a parameter.

### Not required

- Route-handler unit tests (we currently test these manually + via the
  build-dependent `.test.mjs` smoke tests).
- D1 access-layer tests (`db/*.ts` that touch the binding). These are
  exercised via the preview environment.

See [`TESTING.md`](./TESTING.md) for the full guide.

---

## Database changes

### Schema changes

1. Edit `db/schema.ts`.
2. Run `npm run db:generate` to produce a new `drizzle/XXXX_<slug>.sql`
   migration.
3. Inspect the generated SQL — Drizzle Kit occasionally produces
   destructive operations (e.g. `DROP TABLE` for a column rename). If
   the migration is destructive, write a manual replacement that
   preserves data.
4. Add the new migration to the test plan in the PR description.
5. Apply the migration to preview first, smoke-test, then promote to
   production.

### Indexes

- Every workspace-scoped query should hit a composite index that
  starts with `workspace_id`. The schema already does this for all
  hot tables.
- Add a new index only when a query plan shows a full table scan.
  Document the query in the migration's SQL comment.

### Foreign keys

- All workspace-scoped tables `REFERENCES workspaces(id) ON DELETE
  CASCADE`.
- Optional relations (e.g. `action_id` on payments) use `ON DELETE
  SET NULL` so deleting the parent doesn't lose the payment record.
- The `organizations` family uses `ON DELETE CASCADE` from the
  organization down to memberships and invitations.

See [`DATABASE.md`](./DATABASE.md) for the full schema reference.

---

## Security review

Any PR that touches the following must be reviewed by a maintainer with
explicit security context:

| Surface                                | Why                                                |
| -------------------------------------- | -------------------------------------------------- |
| `lib/url-safety.ts`                    | SSRF boundary.                                     |
| `lib/content-sanitize-pure.ts`         | Prompt-injection boundary.                         |
| `lib/webhook-signature-pure.ts`        | Webhook forgery boundary.                          |
| `lib/rate-limit-pure.ts`               | Abuse boundary.                                    |
| `lib/budget-pure.ts`                   | Spend boundary.                                    |
| `lib/brand-safety-pure.ts`             | Regulatory boundary.                               |
| `lib/idempotency-pure.ts`              | Replay boundary.                                   |
| `db/audit-pure.ts`                     | Compliance trail.                                  |
| Any `app/api/**/route.ts` that mutates | Audit row + tenant scoping must be correct.        |
| Any new outbound HTTP call             | Must go through `fetchWithRedirectLimit`.          |
| Any new PII column                     | Must be added to the relevant `summarizeForDisplay` redaction. |

When in doubt, tag the PR with `sec` and ask for a security review in
the description. See [`SECURITY.md`](./SECURITY.md) for the full
audit.

---

## Release process

Distribution OS does not have a formal versioned release cycle yet.
Production deploys are triggered manually after a PR is merged to
`main`:

1. CI runs `npm run lint` + `npm run test` on the PR.
2. Maintainer approves and merges.
3. CI auto-deploys to the preview environment.
4. Maintainer smoke-tests the preview (see
   [`DEPLOYMENT.md`](./DEPLOYMENT.md#preview-deploys)).
5. Maintainer applies any new D1 migrations to production.
6. Maintainer runs `npx wrangler deploy` against production.
7. Maintainer verifies via the smoke-test curls in
   [`DEPLOYMENT.md`](./DEPLOYMENT.md#production-deployment).

See [`CHANGELOG.md`](./CHANGELOG.md) for the wave-by-wave history.

---

## Getting help

- Open an issue with the `question` label.
- For security-sensitive reports, see the private disclosure path in
  [`SECURITY.md`](./SECURITY.md) (do not open a public issue).
- For architectural questions, refer to
  [`ARCHITECTURE.md`](./ARCHITECTURE.md) first; if it doesn't answer
  your question, that's a docs gap — open a PR to fix it.
