<!--
  Thank you for contributing to Distribution OS!

  Please fill out every section below. PRs that skip sections may be
  returned for revision. Keep the title in Conventional Commits format,
  e.g. `feat(mission): add manual retry` or `fix(rate-limit): off-by-one`.
-->

## Summary

<!-- One or two paragraphs: what does this PR change and why? -->

## Related issues

<!-- `Closes #123`, `Refs #456`, or "none". -->

## Change type

<!-- Check exactly one. -->

- [ ] `feat` — new feature
- [ ] `fix` — bug fix
- [ ] `refactor` — no behaviour change
- [ ] `perf` — performance improvement
- [ ] `docs` — documentation only
- [ ] `test` — test-only change
- [ ] `chore` — build, config, tooling
- [ ] `breaking` — breaking change (call out in Summary)

## Checklist

<!-- Check every box. If a box does not apply, mark it and add a short
     note explaining why. -->

### Code quality

- [ ] Code follows the project style (TypeScript strict, no `any`,
      2-space indent, single quotes).
- [ ] No new ESLint warnings introduced (`npm run lint`).
- [ ] No new TypeScript errors introduced (`npm run typecheck`).
- [ ] New constants/types/errors live in `lib/` (pure, no I/O) when
      they are shared across modules.
- [ ] Business logic is in a `*-pure.ts` module with no D1 / Workers /
      Next imports; the runtime adapter in `app/` / `db/` only wires it
      up.

### Tests

- [ ] Every new `*-pure.ts` module ships with a sibling
      `tests/*.test.ts` using `node:test` + `node:assert/strict`.
- [ ] All pure modules have 100 % line coverage on the happy path and
      every branch.
- [ ] State-machine changes include transition-table tests covering
      every legal transition plus at least one illegal transition.
- [ ] Deterministic inputs used everywhere (explicit `nowMs`, injected
      `fetchImpl`, no `Date.now()` / `Math.random()` inside pure code).
- [ ] `npm run test:ts` passes locally.
- [ ] `npm run test` (build-dependent `.test.mjs` suite) passes locally.

### Security & compliance

- [ ] No secrets committed (`.dev.vars`, `wrangler.toml` secrets,
      `.env*`).
- [ ] Any new outbound HTTP uses `validatePublicUrl` +
      `fetchWithRedirectLimit` from `lib/url-safety.ts`.
- [ ] Any new external-content handling runs through
      `lib/content-sanitize-pure.ts` before reaching the model.
- [ ] Mutating endpoints write a best-effort `audit_events` row.
- [ ] GDPR-sensitive fields are projected through a
      `summarizeForDisplay` redactor before being returned.
- [ ] No new forbidden brand-safety claims introduced (see
      `lib/brand-safety-pure.ts`).

### Database

- [ ] If the schema changed: a Drizzle migration was generated with
      `npm run db:generate` and committed under `drizzle/`.
- [ ] The migration is reversible or its forward-only nature is
      documented in the migration header.
- [ ] FK-safe deletion order in `POST /api/data-deletion` is preserved
      if new tables are added.

### Documentation

- [ ] `docs/ARCHITECTURE.md` updated if the request lifecycle, data
      model, API surface, or pure-module inventory changed.
- [ ] `docs/DATABASE.md` updated for any schema change.
- [ ] `docs/CHANGELOG.md` has a new entry under the appropriate wave.
- [ ] `docs/API_EXAMPLES.md` updated for any new / changed endpoint.

### Rollout

- [ ] No breaking migration requires downtime; if it does, the rollout
      plan is documented in the PR description.
- [ ] Feature flags / `workspace_settings` toggles used where the
      change is not safe to enable for every tenant at once.
- [ ] The PR is small enough to review in one sitting (< ~600 lines of
      diff where possible); otherwise it has been split.

## Verification performed

<!-- What did you run locally to convince yourself this is correct?
     e.g. `npm run lint && npm run test:ts && npm run build`. -->

## Rollback plan

<!-- One sentence: how do we undo this if it goes wrong in prod? -->
