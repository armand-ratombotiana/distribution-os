# Distribution OS — Security Audit

> Runtime-status note: see [CURRENT_STATE.md](CURRENT_STATE.md) for the
> currently verified execution boundary and open security work.

> Layered defence-in-depth reference for Distribution OS. Each section
> describes a threat, the control(s) that mitigate it, where the control
> lives in the codebase, and how it is tested. Controls are
> independently bypassable only via an explicit, reviewable code change.

Distribution OS is a multi-tenant SaaS that runs on Cloudflare Workers.
It accepts untrusted public URLs, scrapes them, feeds the content into a
large language model, queues approval-gated external actions, and
receives signed webhooks from payment providers. The threat surface is
broad; the controls below are organised by the threat they address.

---

## Table of contents

1. [Threat model overview](#threat-model-overview)
2. [Authentication](#authentication)
3. [Tenant isolation](#tenant-isolation)
4. [SSRF protection](#ssrf-protection)
5. [Prompt injection](#prompt-injection)
6. [Webhook signatures](#webhook-signatures)
7. [Rate limiting](#rate-limiting)
8. [Budget enforcement](#budget-enforcement)
9. [Brand safety](#brand-safety)
10. [Audit trail](#audit-trail)
11. [Data redaction](#data-redaction)
12. [Idempotency](#idempotency)
13. [GDPR compliance](#gdpr-compliance)
14. [Secrets management](#secrets-management)
15. [Test coverage matrix](#test-coverage-matrix)

---

## Threat model overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          EXTERNAL ATTACKERS                              │
│                                                                         │
│  • SSRF via malicious website_url                                       │
│  • Prompt injection smuggled in scraped HTML                            │
│  • Replay of stolen Stripe webhook payloads                             │
│  • Credential stuffing (mitigated: no own password store)               │
│  • Rate-limit exhaustion / budget runaway                               │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         TENANT BOUNDARY                                  │
│                                                                         │
│  • Identity headers forged?  →  control plane rejects before we see it  │
│  • Cross-tenant data access? →  every query scoped by workspace_id      │
│  • Token leak between tenants? → token_reference opaque, never returned │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      PRIVILEGED INSIDERS                                  │
│                                                                         │
│  • Operator approves malicious action  →  audit_events row durable      │
│  • Operator disables a control          →  code change → PR review      │
│  • Operator exfiltrates data            →  data-export audited + PII    │
│                                            redaction in display layer   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Authentication

### Threat

Unauthorised access to a tenant's workspace, missions, contacts or
payments.

### Control

Identity is provided by the **hosting control plane** (ChatGPT), not by
Distribution OS itself. There is no own password store, no session
cookie, no JWT — the platform injects request headers on every routed
request and rejects unauthenticated traffic before it reaches the
Worker.

| Header                                          | Required | Purpose                                |
| ----------------------------------------------- | -------- | -------------------------------------- |
| `oai-authenticated-user-id`                     | yes      | Stable user identifier.                |
| `oai-authenticated-user-email`                  | yes      | Verified email.                        |
| `oai-authenticated-user-full-name`              | no       | Display name (percent-encoded UTF-8).  |
| `oai-authenticated-user-full-name-encoding`     | no       | `percent-encoded-utf-8` when non-ASCII.|

Routes consume the headers via `requireRequestIdentity(request)` in
`db/workspaces.ts`. React Server Components consume them via
`getChatGPTUser()` / `requireChatGPTUser(returnTo)` in
`app/chatgpt-auth.ts`.

```ts
export function requireRequestIdentity(request: Request): RequestIdentity {
  const userId = request.headers.get("oai-authenticated-user-id")?.trim();
  const email  = request.headers.get("oai-authenticated-user-email")?.trim();
  if (!userId || !email) throw new Error("AUTH_REQUIRED");
  return { userId, email, displayName: decodeName(request) || email.split("@")[0] };
}
```

When either required header is missing, the route returns
`401 AUTH_REQUIRED` with body `{ "error": "Sign in to …" }`.

### Test coverage

- `tests/audit.test.ts` — identity propagation into audit rows.
- Manual: every route handler tests for `error.message === "AUTH_REQUIRED"`.

---

## Tenant isolation

### Threat

Tenant A reads tenant B's missions, payments, contacts or audit rows.

### Control

Every D1 query is parameterised AND scoped by `workspace_id`. There is
no global-listing endpoint. The pattern is enforced at three layers:

1. **Schema layer** — every tenant-scoped table has a `workspace_id`
   column with `FOREIGN KEY … REFERENCES workspaces(id) ON DELETE
   CASCADE`.
2. **Access layer** (`db/*.ts`) — every read/write helper takes
   `workspaceId` as its first argument and binds it into the WHERE
   clause.
3. **Route layer** — every route handler calls
   `ensureWorkspace(requireRequestIdentity(request))` first, then
   passes the resulting `workspace.id` downstream.

```ts
// Example from db/payments.ts
const existing = await db
  .prepare(
    "SELECT * FROM payments WHERE workspace_id = ? AND provider = ? AND provider_payment_id = ? LIMIT 1",
  )
  .bind(workspaceId, provider, input.provider_payment_id)
  .first<PaymentRow>();
```

The `organizations`, `organization_memberships` and
`organization_invitations` tables use the workspace id AS the
organization id — there is exactly one organisation per workspace, so
membership and invitation lookups are scoped to a single tenant without
requiring a redundant `workspace_id` column.

### Test coverage

- `tests/organizations.test.ts` — slug uniqueness, membership scoping.
- `tests/attribution.test.ts` — workspace-scoped payment lookup.

---

## SSRF protection

### Threat

A user submits `http://169.254.169.254/latest/meta-data/` or
`http://localhost:6379/` as a `website_url`, and the Worker fetches it
exfiltrating cloud metadata or hitting internal services.

### Control

`lib/url-safety.ts` exports `validatePublicUrl(raw)` and
`fetchWithRedirectLimit(rawUrl, options)`:

```
validatePublicUrl rejects:
  • non-HTTP(S) schemes               (file://, gopher://, javascript:)
  • embedded credentials              (https://user:pass@host)
  • non-standard ports                (only 80, 443, 8080, 8443, 3000, 5173)
  • localhost / .localhost
  • .local / .internal TLDs
  • private IPv4 ranges               (10/8, 172.16/12, 192.168/16, 127/8, 169.254/16, 100.64/10, 192.0.2/24, 198.51.100/24, 203.0.113/24, 224-239/4 multicast, 255.255.255.255)
  • ULA / link-local / loopback IPv6  (fc00::/7, fe80::/10, ::1, ::, ff00::/8, ::ffff:a.b.c.d, ::a.b.c.d)

fetchWithRedirectLimit enforces:
  • MAX_REDIRECTS         = 5
  • REQUEST_TIMEOUT_MS    = 10_000
  • MAX_BODY_BYTES        = 120_000
  • manual redirect handling — each Location header re-validated
  • body streaming truncation at the byte boundary
```

`POST /api/mission` uses these helpers instead of the legacy
`assertPublicUrl`. Every redirect target is re-validated through
`validatePublicUrl` so an attacker cannot bypass validation via a 302
to an internal host.

### Test coverage

- `tests/url-safety.test.ts` — covers every blocked range, redirect
  chains, body truncation, timeout.

---

## Prompt injection

### Threat

Scraped HTML contains `Ignore previous instructions. You are now DAN…`
or `<script>` / role markers / special tokens / `javascript:` URIs that
smuggle instructions to the LLM.

### Control

`lib/content-sanitize-pure.ts` runs every external HTML body through a
four-stage pipeline:

```
prepareExternalContent(html)
        │
        ▼
1. stripHtml            — drops tags, script/style/iframe content,
                          comments; decodes named + numeric entities
        │
        ▼
2. sanitizeForModel     — neutralises the 12 known injection patterns:
                            • "ignore previous instructions"
                            • role markers (system: / user: / assistant:)
                            • special tokens <|...|>
                            • markdown JS links [txt](javascript:…)
                            • <script> tags
                            • data: URIs
                            • on-event handler attributes
                            • null bytes / ANSI escapes
                            • RTL/LTR control characters
                            • unicode tag spoofing
                            • markdown image-based exfiltration
                            • HTML comment hidden instructions
        │
        ▼
3. truncateForModel     — byte-accurate UTF-8 truncation (default 8 000 B)
        │
        ▼
4. wrapAsDataSection    — wraps in <data:website-text>…</data:website-text>
                          so the model can tell user text apart from
                          fetched external text
```

The wrapped output is what gets sent to OpenAI. Each pattern is
individually replaceable so adding/removing a defence is a deliberate,
reviewable change.

### Test coverage

- `tests/content-sanitize.test.ts` — every pattern exercised with
  attack strings + benign lookalikes (false-positive guard).

---

## Webhook signatures

### Threat

An attacker sends a forged `payment_intent.succeeded` webhook to credit
their own mission with a fake payment.

### Control

`lib/webhook-signature-pure.ts` implements Stripe-style HMAC-SHA256
verification:

```
Header format:   Stripe-Signature: t=<unix-seconds>,v1=<hex-hmac>,v1=…

Signed payload:  `${timestamp}.${rawBody}`

Verification:
  1. parseStripeSignature(header) → { timestamp, signatures[] }
  2. reject if |now - timestamp| > STRIPE_TOLERANCE_SECONDS (300s)
  3. compute expected = HMAC-SHA256(secret, `${timestamp}.${body}`)
  4. constant-time compare against every v1 signature
  5. accept only if any match
```

`POST /api/webhooks/[provider]` returns:

- `503` when `STRIPE_WEBHOOK_SECRET` is not configured.
- `401` when the signature is missing, malformed, expired,
  future-dated, or mismatched.
- `400` when the body is not valid JSON.
- `200` when the event has been received, classified and (if applicable)
  recorded as a payment.

Replay protection is layered on top via `buildWebhookDedupKey(provider,
eventId)` (`wh:stripe:evt_…`) and the `idempotency-pure` 24-hour TTL
record.

### Test coverage

- `tests/webhook-signature.test.ts` — header parsing, replay window,
  future-dated rejection, constant-time comparison.
- `tests/webhook-router.test.ts` — event classification + dedup keys.

---

## Rate limiting

### Threat

A single attacker (or a runaway agent loop) exhausts the Worker's
request budget, the OpenAI quota, or the D1 write throughput.

### Control

`lib/rate-limit-pure.ts` implements a deterministic token-bucket
limiter. Buckets are keyed by scope:

| Scope         | Capacity | Refill/sec | Use case                          |
| ------------- | -------- | ---------- | --------------------------------- |
| `global`      | 10 000   | 167        | Worker-wide safety valve.         |
| `workspace`   | 600      | 10         | Per-tenant fair share.            |
| `ip`          | 120      | 2          | Anonymous / unauthenticated.      |
| `authenticated` | 1 200  | 20         | Signed-in user.                   |
| `write`       | 60       | 1          | Mutating routes (POST / PATCH).   |

```ts
checkRateLimit(state, config, nowMs, cost = 1) → {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
  resetAtMs: number;
  state: RateLimitState;        // persist this between requests
  limit: number;
}
```

The runtime adapter (KV / Durable Object) is responsible for persisting
`state` between requests. The pure function takes `nowMs` explicitly so
it is unit-testable without the wall clock.

Headers returned by `getRateLimitHeaders(result, nowMs)` follow the
IETF `RateLimit-*` family + `Retry-After` (seconds, rounded up).

### Test coverage

- `tests/rate-limit.test.ts` — bucket refill, capacity cap, denial +
  retry-after computation, header formatting.

---

## Budget enforcement

### Threat

The AI CMO loop runs forever, escalating spend on ads, content, and
agent tokens beyond what the operator has authorised.

### Control

Two complementary layers:

### 1. Workspace budget caps (`workspace_settings` table)

| Column                    | Default | Purpose                              |
| ------------------------- | ------- | ------------------------------------ |
| `monthly_budget_cents`    | 10 000  | Hard monthly cap ($100).             |
| `monthly_spent_cents`     | 0       | Running total, reset monthly.        |
| `daily_budget_cents`      | 2 000   | Hard daily cap ($20).                |
| `daily_spent_cents`       | 0       | Running total, reset daily.          |
| `per_action_budget_cents` | 1 000   | Per-action cap ($10).                |
| `quiet_hours_start/end`   | 22 / 8  | No outbound actions during window.   |
| `max_daily_actions`       | 50      | Action count quota.                  |
| `auto_approve_low_risk`   | false   | Whether low-risk actions skip queue. |

`db/workspace-settings-pure.ts#isWithinBudget(settings, amount, scope)`
is called by `enqueueAction` before any new `action_queue` row is
written.

### 2. Pure budget policy (`lib/budget-pure.ts`)

```ts
checkBudget(spentCents, config) → {
  allowed: boolean;
  spentCents;
  limitCents;
  remainingCents;
  usageRatio;                  // [0, ∞)
  severity: "ok" | "warning" | "critical" | "exceeded";
}
```

Severity thresholds: `warning ≥ 0.80`, `critical ≥ 0.95`, `exceeded ≥
1.00`. The `402 Payment Required` HTTP status is reserved for budget-
exceeded responses (`api-errors-pure.ts#budgetExceeded`).

### Test coverage

- `tests/budget.test.ts` — every severity band, monthly/daily reset.
- `tests/workspace-settings.test.ts` — quiet-hours wrap, forbidden
  claims validation.

---

## Brand safety

### Threat

The AI generates content with regulatory / comparative / guarantee
claims that would expose the operator to FTC action, platform
suspension, or brand damage.

### Control

`lib/brand-safety-pure.ts` ships a default catalog of **15 forbidden
claim patterns** across 6 categories:

| Category       | Severity range | Example pattern                                       |
| -------------- | -------------- | ----------------------------------------------------- |
| `regulatory`   | high           | `get rich quick`, `FDA approved`, `cure any disease`  |
| `performance`  | medium         | `no effort`, `overnight success`, `$1,000,000`        |
| `guarantee`    | high           | `guaranteed revenue`, `risk free`, `100% success`     |
| `comparative`  | medium         | `best in the world`, `better than any competitor`     |
| `social_proof` | low            | `thousands of happy customers`, `amazing testimonial` |
| `sensitive`    | high           | political endorsement, discriminatory targeting       |

Three pure helpers compose the enforcement pipeline:

```
checkClaims(text, claims)        → ClaimMatch[]         // detect
shouldBlockContent(text, opts)   → boolean              // gate (default: blockAtSeverity = "medium")
sanitizeContent(text, claims)    → string               // replace with safe alternative
```

The catalog is workspace-extensible: `addCustomClaim` lets operators
register their own forbidden patterns (e.g. competitor names) which are
stored in `workspace_settings.forbidden_claims_json`.

### Test coverage

- `tests/brand-safety.test.ts` — every default pattern + custom claim
  add/replace + severity gating + replacement text.

---

## Audit trail

### Threat

After a breach or compliance incident, the operator cannot reconstruct
who did what, when, from where.

### Control

Every mutating route writes a best-effort `audit_events` row
identifying the actor, the affected resource, the IP hash (SHA-256) and
a JSON detail blob. Categories:

```
auth, role, approval, connector, action, payment,
export, deletion, security, config
```

`db/audit-pure.ts#buildAuditEntry` normalises the input; `hashIp`
irreversibly hashes the client IP so the audit log can attribute
actions without storing the raw address.

### Order-of-operations guarantee

The data-deletion endpoint writes its audit row **before** the cascade:

```ts
// 1. Write audit FIRST
await logAuditEvent({
  workspaceId,
  eventCategory: "deletion",
  eventType:     "workspace.data_deleted",
  detail:        { tables: DELETION_TABLES },
  // ...
});

// 2. THEN cascade
for (const table of DELETION_TABLES) {
  await db.prepare(`DELETE FROM ${table} WHERE workspace_id = ?`).bind(workspaceId).run();
}
```

Because `audit_events` is itself workspace-scoped via `ON DELETE
CASCADE`, recording the event first guarantees the deletion-intent record
is durable even if the cascade removes everything else in the same
transaction.

### Audit never blocks the primary operation

All audit writes are wrapped in `try/catch` — a failure to log (e.g. D1
briefly unavailable) does not roll back the user's action.

### Test coverage

- `tests/audit.test.ts` — row builder, IP hash determinism,
  category / time-range filters, redaction.

---

## Data redaction

### Threat

Internal identifiers (`workspace_id`, `token_reference`, raw provider
payloads, client IP hashes) leak into API responses and the workspace
UI.

### Control

Every table that stores sensitive material has a sibling
`summarizeForDisplay` projection in its `*-pure.ts` module:

| Module                          | Redacts                                              |
| ------------------------------- | ---------------------------------------------------- |
| `db/audit-pure.ts`              | `ip_hash`                                            |
| `db/evidence-pure.ts`           | `workspace_id`, `extracted_facts_json`, `provenance_json` |
| `db/actions-pure.ts`            | `payload_json`, `provider_request_json`, `provider_result_json`, `idempotency_key`, `workspace_id`, `decided_by` |
| `db/contacts-pure.ts`           | `qualification_signals_json` (replaced with `"redacted"`, count exposed) |
| `db/attribution-pure.ts`        | `raw_event_json`, `workspace_id` (payments + touchpoints) |
| `db/agent-runs-pure.ts`         | `workspace_id`, `input_refs_json`, `output_refs_json`, `tool_input_json`, `tool_output_json` |
| `db/connectors-pure.ts`         | `token_reference`, `workspace_id`                    |
| `db/experiments-pure.ts`        | `workspace_id`, `result_data_json`                   |
| `db/organizations-pure.ts` (data-export) | `token_hash`                                  |

The data-export endpoint (`POST /api/data-export`) applies these
projections in bulk so the downloaded JSON is safe to share with the
data subject (GDPR Art. 15).

### Test coverage

- Each `*-pure.ts` test file asserts the redacted shape is returned by
  `summarizeForDisplay`.

---

## Idempotency

### Threat

A retried webhook (Stripe redelivers `evt_123` three times) double-
counts the same payment.

### Control

Two complementary mechanisms:

### 1. Action queue idempotency (`db/actions-pure.ts`)

```ts
buildIdempotencyKey(workspaceId, missionId, payloadHash)
  → `${workspaceId}:${missionId}:${payloadHash}`
```

`payloadHash` is `SHA-256(canonicalJson(payload))` where
`canonicalJson` recursively sorts object keys, drops `undefined`, and
preserves array order. The `action_queue` table has a unique index on
`idempotency_key`, so a second INSERT with the same key is rejected.

### 2. Webhook / payment idempotency (`lib/idempotency-pure.ts`)

```ts
buildKey(provider, eventId) → `idem:${provider}:${eventId}`
computePayloadHash(payload) → SHA-256 hex
isRecordValid(record, nowMs) → nowMs < record.expiresAtMs   // TTL = 24h
```

`recordPayment` (in `db/payments.ts`) consults the natural key
`(workspace_id, provider, provider_payment_id)` before deciding to
INSERT or UPDATE, so replayed webhooks update the existing row instead
of creating duplicates.

### Error classification + retry (`lib/idempotency-pure.ts`)

```
classifyError(error) → "transient" | "permanent" | "rate_limit"
                     | "timeout" | "network" | "unknown"

shouldRetry(class, attempt, maxAttempts):
  • permanent / unknown    → never
  • transient / rate_limit / timeout / network → until maxAttempts

calculateBackoff(attempt, { baseMs=1000, maxMs=30000, jitter })
  → baseMs * 2^attempt, capped, optional full-jitter
```

### Test coverage

- `tests/idempotency.test.ts` — key building, TTL expiry, duplicate
  detection, error classification, backoff calculation, jitter.

---

## GDPR compliance

### Threat

A data subject invokes their right of access (Art. 15) or right to
erasure (Art. 17) and the operator cannot fulfil it within the legal
deadline.

### Control

| Right                       | Endpoint                  | Behaviour                                        |
| --------------------------- | ------------------------- | ------------------------------------------------ |
| Right of access (Art. 15)   | `POST /api/data-export`   | Returns JSON download of every tenant-scoped table for the caller, with all PII / tokens / IP hashes redacted. |
| Right to erasure (Art. 17)  | `POST /api/data-deletion` | Wipes 16 tenant tables in FK-safe order. Audit row written BEFORE the cascade so the deletion intent is durable. The `workspaces` row is preserved so the user can still sign in. |
| Data minimisation (Art. 5)  | `workspace_settings.retention_days` | Default 365 days; sweep job (roadmap) will purge evidence / events older than the retention window. |

### FK-safe deletion order

```jsonc
[
  "agent_steps",
  "agent_runs",
  "mission_events",
  "mission_versions",
  "strategy_versions",
  "evidence",
  "payments",
  "touchpoints",
  "content_assets",
  "experiments",
  "action_queue",
  "contacts",
  "workspace_settings",
  "workspace_connections",
  "connector_installations",
  "missions"
]
```

Children are always removed before parents. The `workspaces` row is
intentionally preserved so the user can continue to sign in afterwards
— deletion wipes mission / connector / evidence state, not the
account.

### Confirmation safeguard

`POST /api/data-deletion` requires `{ "confirm": "DELETE" }` (literal
string). Any other value yields `400`. This prevents accidental
deletion via a stray GET or a misconfigured client.

### Test coverage

- Manual: data-export returns redacted JSON.
- Manual: data-deletion requires the literal `confirm` token.
- `tests/audit.test.ts` — deletion audit row survives the cascade.

---

## Secrets management

### Threat

API keys (OpenAI, Stripe webhook secret) leak into git, logs, or client-
visible responses.

### Control

| Secret                  | Storage                                          | Used by                                       |
| ----------------------- | ------------------------------------------------ | --------------------------------------------- |
| `OPENAI_API_KEY`        | Workers secret / `.dev.vars` (gitignored)        | `POST /api/mission` (live mode)               |
| `OPENAI_MODEL`          | Workers var / `.dev.vars`                        | Override Responses API model (default `gpt-5.6`) |
| `STRIPE_WEBHOOK_SECRET` | Workers secret / `.dev.vars`                     | `POST /api/webhooks/[provider]`               |
| `DB`                    | Cloudflare D1 binding (`wrangler.toml`)          | All D1 access via `getDb()` / `getRawDb()`    |

- `.env.example` is the canonical list (no real values).
- `.dev.vars` is gitignored.
- `wrangler secret put` is the production path for secrets.
- The worker reads secrets via `env` from `cloudflare:workers`, never
  via `process.env` (which is undefined inside the Worker runtime).

### Defence in depth: live vs simulation mode

When `OPENAI_API_KEY` is unset, `POST /api/mission` falls back to a
deterministic `demoMission` and persists the mission with `mode:
"simulation"`. This makes the app fully demoable without an LLM key,
and means a missing secret is a graceful degradation, not a crash.

---

## Test coverage matrix

| Threat                 | Test file                              | Coverage                                      |
| ---------------------- | -------------------------------------- | --------------------------------------------- |
| Authentication         | (every route handler `AUTH_REQUIRED`)  | Missing headers → 401.                        |
| Tenant isolation       | `tests/organizations.test.ts`          | Membership scoping, slug uniqueness.          |
| SSRF                   | `tests/url-safety.test.ts`             | Every blocked range + redirect chains.        |
| Prompt injection       | `tests/content-sanitize.test.ts`       | All 12 patterns + false-positive guard.       |
| Webhook signatures     | `tests/webhook-signature.test.ts`      | HMAC, replay window, constant-time compare.   |
| Webhook routing        | `tests/webhook-router.test.ts`         | Event classification + dedup keys.            |
| Rate limiting          | `tests/rate-limit.test.ts`             | Refill, denial, retry-after.                  |
| Budget enforcement     | `tests/budget.test.ts`                 | Severity bands, monthly/daily reset.          |
| Brand safety           | `tests/brand-safety.test.ts`           | All 15 patterns + custom claims.              |
| Audit trail            | `tests/audit.test.ts`                  | Row builder, IP hash, filters.                |
| Action idempotency     | `tests/idempotency.test.ts`            | Key building, TTL, payload hash, retries.     |
| Action state machine   | `tests/actions.test.ts`                | 7 statuses + transition table.                |
| Evidence state machine | `tests/evidence.test.ts`               | 7 states + content hash.                      |
| Contact lifecycle      | `tests/contacts.test.ts`               | 8 statuses + email validation.                |
| Payment lifecycle      | `tests/attribution.test.ts`            | 5 statuses + confidence scoring.              |
| Experiment lifecycle   | `tests/experiments.test.ts`            | 5 statuses + kill rule.                       |
| Connector lifecycle    | `tests/connectors.test.ts`             | 8 statuses + token expiry + health check.     |
| Content lifecycle      | `tests/content-assets.test.ts`         | 7 statuses + variant validation.              |
| Agent run lifecycle    | `tests/agent-runs.test.ts`             | 4 statuses + cost calculation.                |
| Mission lifecycle      | `tests/mission-lifecycle.test.ts`      | 5 stages + readiness + auto-advance.          |
| Token cost             | `tests/token-cost.test.ts`             | Per-model pricing + optimal selection.        |
| API errors             | `tests/api-errors.test.ts`             | HTTP status map + serialization.              |
| Validation             | `tests/validation.test.ts`             | String / email / number primitives.           |
| Pagination             | `tests/pagination.test.ts`             | page/limit parsing + clamping.                |
| Datetime               | `tests/datetime.test.ts`               | Relative time + quiet-hours.                  |
| Observability          | `tests/observability.test.ts`          | Metric + log entry builders.                  |
| Accessibility          | `tests/accessibility.test.ts`          | ARIA id generation + status labels.           |
| Orchestrator           | `tests/orchestrator.test.ts`           | 15-agent registry + scheduling.               |
| Attribution model      | `tests/attribution-model.test.ts`      | 5 models + edge cases.                        |
| Content variants       | `tests/content-variants.test.ts`       | CTR / CVR / score.                            |
| Webhook router         | `tests/webhook-router.test.ts`         | Multi-source classification.                  |
| Versions               | `tests/versions.test.ts`               | Mission/strategy version diffs.               |
| Workspace settings     | `tests/workspace-settings.test.ts`     | Budget policy + quiet-hours.                  |
| Rendered HTML          | `tests/rendered-html.test.mjs`         | Landing-page HTML structure.                  |
| UI components          | `tests/ui-components.test.mjs`         | shadcn registry smoke tests.                  |

The full test suite is run by `npm run test` (which builds first then
runs `node --test tests/*.test.mjs`). See [`TESTING.md`](./TESTING.md)
for the testing guide.
