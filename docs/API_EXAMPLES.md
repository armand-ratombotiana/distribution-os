# Distribution OS — API Examples

> Copy-paste curl recipes for every major Distribution OS endpoint.
> Use these as a starting point for integrations, smoke tests, and
> debugging sessions. See [`API_REFERENCE.md`](./API_REFERENCE.md) for
> the canonical HTTP reference.

## Table of contents

- [Conventions](#conventions)
- [Authentication](#authentication)
- [Workspace](#workspace)
- [Missions](#missions)
- [Mission action (advance / approve)](#mission-action-advance--approve)
- [Mission sub-resources](#mission-sub-resources)
- [Actions (approve / reject / execute)](#actions-approve--reject--execute)
- [Evidence](#evidence)
- [Experiments](#experiments)
- [Contacts](#contacts)
- [Connectors](#connectors)
- [Connector installations](#connector-installations)
- [Webhooks](#webhooks)
- [Organizations](#organizations)
- [Workspace settings](#workspace-settings)
- [Audit](#audit)
- [Data export (GDPR Art. 15)](#data-export-gdpr-art-15)
- [Data deletion (GDPR Art. 17)](#data-deletion-gdpr-art-17)
- [Common error responses](#common-error-responses)

---

## Conventions

- **Base URL:** same origin as the workspace UI
  (e.g. `https://app.distribution.os`).
- **Request body:** JSON (`Content-Type: application/json`) for
  `POST` / `PATCH`.
- **Time fields:** epoch milliseconds (UTC).
- **Money fields:** integer cents (e.g. `1999` → $19.99).
- **Errors:** `{ "error": string }` with the appropriate HTTP status
  code. Mutations also accept an `Idempotency-Key` header.
- **Identity:** the hosting control plane injects
  `oai-authenticated-user-id` and `oai-authenticated-user-email`
  headers on every routed request. The examples below pass them
  explicitly for clarity.

---

## Authentication

There is no `/login` endpoint — identity is provided by the hosting
control plane. Every authenticated route reads:

| Header                                          | Required |
| ----------------------------------------------- | -------- |
| `oai-authenticated-user-id`                     | yes      |
| `oai-authenticated-user-email`                  | yes      |
| `oai-authenticated-user-full-name`              | no       |
| `oai-authenticated-user-full-name-encoding`     | no       |

When either required header is missing, the route returns:

```json
HTTP/1.1 401 Unauthorized
{ "error": "Sign in to launch a mission." }
```

The examples below use the placeholder headers
`oai-authenticated-user-id: user_test_001` and
`oai-authenticated-user-email: ada@example.com`. Replace them with
the real headers injected by your control plane.

---

## Workspace

### Get workspace snapshot

Creates the workspace on first access if it does not yet exist.

```bash
curl -sS https://app.distribution.os/api/workspace \
  -H "oai-authenticated-user-id: user_test_001" \
  -H "oai-authenticated-user-email: ada@example.com"
```

```jsonc
// 200 OK
{
  "workspace": {
    "id": "ws_3f9c…",
    "display_name": "ada",
    "owner_email": "ada@example.com",
    "plan": "founder"
  },
  "connections": [
    {
      "id": "ws_3f9c:youtube",
      "provider": "YouTube",
      "category": "Video",
      "status": "setup_required",
      "scopes_json": "[]",
      "last_sync_at": null,
      "updated_at": 1730000000000
    }
  ],
  "mission_count": 2
}
```

---

## Missions

### Create a mission from a website URL

```bash
curl -sS -X POST https://app.distribution.os/api/mission \
  -H "oai-authenticated-user-id: user_test_001" \
  -H "oai-authenticated-user-email: ada@example.com" \
  -H "Content-Type: application/json" \
  -d '{"website_url":"https://yourproduct.com"}'
```

```jsonc
// 200 OK
{
  "mission": {
    "mission_id": "MISSION-3f9c…",
    "product_name": "Your Product",
    "product_summary": "…",
    "executive_thesis": "…",
    "north_star_metric": "first_attributable_verified_payment",
    "icp": { "segment": "…", "pain": "…", "trigger": "…", "exclusion": "…" },
    "strategy": { "primary_channel": "…", "offer": "…", "message": "…", "why_now": "…" },
    "assumptions": [ /* 3 items */ ],
    "agents": [ /* 6 items */ ],
    "experiments": [ /* 3 items */ ],
    "content_queue": [ /* 5 items */ ],
    "approval": { "action": "…", "risk": "medium", "reason": "…" }
  },
  "mode": "live",
  "inspected": { "title": "Your Product", "description": "…", "final_url": "https://yourproduct.com/" },
  "state": {
    "mission_id": "MISSION-3f9c…",
    "status": "learning",
    "current_stage": "observe",
    "cycle_number": 1,
    "payment_count": 0,
    "approved": false,
    "created_at": 1730000000000,
    "updated_at": 1730000000000
  },
  "events": [ /* latest 24 mission_events */ ]
}
```

> When `OPENAI_API_KEY` is unset, the response includes
> `"mode": "simulation"` and the mission is generated from a
> deterministic demo payload.

### Get the latest mission

```bash
curl -sS https://app.distribution.os/api/mission \
  -H "oai-authenticated-user-id: user_test_001" \
  -H "oai-authenticated-user-email: ada@example.com"
```

Returns the same shape as `POST /api/mission`, or `{ "mission": null }`
when no mission exists yet.

---

## Mission action (advance / approve)

### Advance the mission to the next stage

```bash
curl -sS -X POST https://app.distribution.os/api/mission/action \
  -H "oai-authenticated-user-id: user_test_001" \
  -H "oai-authenticated-user-email: ada@example.com" \
  -H "Content-Type: application/json" \
  -d '{"mission_id":"MISSION-3f9c…","action":"advance"}'
```

The `advance` action moves the mission through
`observe → decide → act → measure → learn → observe`, incrementing
`cycle_number` on the `learn → observe` wrap. A `mission_versions`
row and an `audit_events` row are written (best-effort).

### Approve external actions

```bash
curl -sS -X POST https://app.distribution.os/api/mission/action \
  -H "oai-authenticated-user-id: user_test_001" \
  -H "oai-authenticated-user-email: ada@example.com" \
  -H "Content-Type: application/json" \
  -d '{"mission_id":"MISSION-3f9c…","action":"approve"}'
```

Sets `missions.approved = true`. The `act` stage cannot complete
without this approval. An `audit_events` row with
`event_category = "approval"`, `event_type = "mission.approved"` is
written.

---

## Mission sub-resources

All sub-resources are scoped under `/api/missions/[mission_id]/...`
and require the mission to exist in the caller's workspace.

### List mission events

```bash
curl -sS https://app.distribution.os/api/missions/MISSION-3f9c/events \
  -H "oai-authenticated-user-id: user_test_001" \
  -H "oai-authenticated-user-email: ada@example.com"
```

### Append a mission event

```bash
curl -sS -X POST https://app.distribution.os/api/missions/MISSION-3f9c/events \
  -H "oai-authenticated-user-id: user_test_001" \
  -H "oai-authenticated-user-email: ada@example.com" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type":"observation",
    "title":"Website refreshed",
    "detail":"Homepage hero updated; re-running scraper.",
    "actor":"operator"
  }'
```

### List evidence for a mission

```bash
curl -sS https://app.distribution.os/api/missions/MISSION-3f9c/evidence \
  -H "oai-authenticated-user-id: user_test_001" \
  -H "oai-authenticated-user-email: ada@example.com"
```

### Create an evidence row

```bash
curl -sS -X POST https://app.distribution.os/api/missions/MISSION-3f9c/evidence \
  -H "oai-authenticated-user-id: user_test_001" \
  -H "oai-authenticated-user-email: ada@example.com" \
  -H "Content-Type: application/json" \
  -d '{
    "source_type":"manual",
    "title":"Customer interview — Ada",
    "summary":"Confirmed pain point around onboarding friction.",
    "extracted_facts":{"pain":"onboarding friction","icp_match":true}
  }'
```

### List experiments for a mission

```bash
curl -sS https://app.distribution.os/api/missions/MISSION-3f9c/experiments \
  -H "oai-authenticated-user-id: user_test_001" \
  -H "oai-authenticated-user-email: ada@example.com"
```

### Create an experiment

```bash
curl -sS -X POST https://app.distribution.os/api/missions/MISSION-3f9c/experiments \
  -H "oai-authenticated-user-id: user_test_001" \
  -H "oai-authenticated-user-email: ada@example.com" \
  -H "Content-Type: application/json" \
  -d '{
    "title":"LinkedIn founder post vs. Twitter thread",
    "hypothesis":"Founder-led LinkedIn posts drive 2x more demo signups than Twitter threads.",
    "metric":"demo_signups",
    "kill_rule":"Stop if LinkedIn < 5 signups after 7 days."
  }'
```

### List / enqueue actions for a mission

```bash
# List pending actions
curl -sS https://app.distribution.os/api/missions/MISSION-3f9c/actions \
  -H "oai-authenticated-user-id: user_test_001" \
  -H "oai-authenticated-user-email: ada@example.com"

# Enqueue a new action
curl -sS -X POST https://app.distribution.os/api/missions/MISSION-3f9c/actions \
  -H "oai-authenticated-user-id: user_test_001" \
  -H "oai-authenticated-user-email: ada@example.com" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: my-client-key-001" \
  -d '{
    "action_type":"send_email",
    "channel":"email",
    "title":"Welcome email to new lead",
    "summary":"Send welcome email to ada@example.com introducing the product.",
    "payload":{"to":"ada@example.com","template":"welcome"},
    "risk":"low",
    "expires_in_seconds":604800
  }'
```

### List agent runs / touchpoints / payments / versions / content

```bash
# Agent runs (observability)
curl -sS https://app.distribution.os/api/missions/MISSION-3f9c/runs \
  -H "oai-authenticated-user-id: user_test_001" \
  -H "oai-authenticated-user-email: ada@example.com"

# Touchpoints (attribution)
curl -sS https://app.distribution.os/api/missions/MISSION-3f9c/touchpoints \
  -H "oai-authenticated-user-id: user_test_001" \
  -H "oai-authenticated-user-email: ada@example.com"

# Payments (Stripe-verified)
curl -sS https://app.distribution.os/api/missions/MISSION-3f9c/payments \
  -H "oai-authenticated-user-id: user_test_001" \
  -H "oai-authenticated-user-email: ada@example.com"

# Version history (mission + strategy)
curl -sS https://app.distribution.os/api/missions/MISSION-3f9c/versions \
  -H "oai-authenticated-user-id: user_test_001" \
  -H "oai-authenticated-user-email: ada@example.com"

# Content assets
curl -sS https://app.distribution.os/api/missions/MISSION-3f9c/content \
  -H "oai-authenticated-user-id: user_test_001" \
  -H "oai-authenticated-user-email: ada@example.com"
```

### Create a content asset

```bash
curl -sS -X POST https://app.distribution.os/api/missions/MISSION-3f9c/content \
  -H "oai-authenticated-user-id: user_test_001" \
  -H "oai-authenticated-user-email: ada@example.com" \
  -H "Content-Type: application/json" \
  -d '{
    "platform":"linkedin",
    "format":"carousel",
    "hook":"3 lessons from launching our first distribution mission",
    "body":"…",
    "cta":"Comment 'mission' and I'll send the playbook."
  }'
```

---

## Actions (approve / reject / execute)

These three endpoints move an action through its 7-status state
machine. See [`STATE_MACHINES.md`](./STATE_MACHINES.md#action).

```bash
ACTION_ID="act_…"

# Approve a prepared action
curl -sS -X POST https://app.distribution.os/api/actions/${ACTION_ID}/approve \
  -H "oai-authenticated-user-id: user_test_001" \
  -H "oai-authenticated-user-email: ada@example.com"

# Reject a prepared action
curl -sS -X POST https://app.distribution.os/api/actions/${ACTION_ID}/reject \
  -H "oai-authenticated-user-id: user_test_001" \
  -H "oai-authenticated-user-email: ada@example.com" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Off-brand; tone too aggressive."}'

# Execute an approved action
curl -sS -X POST https://app.distribution.os/api/actions/${ACTION_ID}/execute \
  -H "oai-authenticated-user-id: user_test_001" \
  -H "oai-authenticated-user-email: ada@example.com"
```

---

## Evidence

### Transition an evidence row to a new state

```bash
EVIDENCE_ID="ev_…"

# Mark a previously observed evidence row as verified
curl -sS -X POST https://app.distribution.os/api/evidence/${EVIDENCE_ID}/state \
  -H "oai-authenticated-user-id: user_test_001" \
  -H "oai-authenticated-user-email: ada@example.com" \
  -H "Content-Type: application/json" \
  -d '{"state":"verified"}'
```

Permitted transitions are defined in
[`db/evidence-pure.ts`](../db/evidence-pure.ts) (see
[`STATE_MACHINES.md`](./STATE_MACHINES.md#evidence) for the diagram).
A forbidden transition yields `409 Conflict`.

---

## Experiments

### Transition an experiment to a new status

```bash
EXPERIMENT_ID="exp_…"

# Start a draft experiment
curl -sS -X POST https://app.distribution.os/api/experiments/${EXPERIMENT_ID}/status \
  -H "oai-authenticated-user-id: user_test_001" \
  -H "oai-authenticated-user-email: ada@example.com" \
  -H "Content-Type: application/json" \
  -d '{"status":"running"}'

# Stop a running experiment (kill rule fired)
curl -sS -X POST https://app.distribution.os/api/experiments/${EXPERIMENT_ID}/status \
  -H "oai-authenticated-user-id: user_test_001" \
  -H "oai-authenticated-user-email: ada@example.com" \
  -H "Content-Type: application/json" \
  -d '{"status":"stopped"}'
```

Permitted transitions are defined in
[`db/experiments-pure.ts`](../db/experiments-pure.ts).

---

## Contacts

### List contacts (with filters)

```bash
# All contacts
curl -sS https://app.distribution.os/api/contacts \
  -H "oai-authenticated-user-id: user_test_001" \
  -H "oai-authenticated-user-email: ada@example.com"

# Filtered by mission and status
curl -sS "https://app.distribution.os/api/contacts?mission_id=MISSION-3f9c&status=replied" \
  -H "oai-authenticated-user-id: user_test_001" \
  -H "oai-authenticated-user-email: ada@example.com"
```

### Create a contact

```bash
curl -sS -X POST https://app.distribution.os/api/contacts \
  -H "oai-authenticated-user-id: user_test_001" \
  -H "oai-authenticated-user-email: ada@example.com" \
  -H "Content-Type: application/json" \
  -d '{
    "mission_id":"MISSION-3f9c…",
    "email":"prospect@example.com",
    "name":"Grace Hopper",
    "company":"COBOL Inc.",
    "role":"CTO",
    "source":"outreach",
    "consent_given":true,
    "qualification_signals":{"pain":"onboarding","icp_match":true}
  }'
```

### Transition a contact's status

```bash
CONTACT_ID="contact_…"

# Mark a contact as replied
curl -sS -X PATCH https://app.distribution.os/api/contacts/${CONTACT_ID}/status \
  -H "oai-authenticated-user-id: user_test_001" \
  -H "oai-authenticated-user-email: ada@example.com" \
  -H "Content-Type: application/json" \
  -d '{"status":"replied"}'

# Mark a contact as converted (requires converted_at auto-set by adapter)
curl -sS -X PATCH https://app.distribution.os/api/contacts/${CONTACT_ID}/status \
  -H "oai-authenticated-user-id: user_test_001" \
  -H "oai-authenticated-user-email: ada@example.com" \
  -H "Content-Type: application/json" \
  -d '{"status":"converted"}'
```

Permitted transitions are defined in
[`db/contacts-pure.ts`](../db/contacts-pure.ts).

---

## Connectors

### List workspace connections

```bash
curl -sS https://app.distribution.os/api/connectors \
  -H "oai-authenticated-user-id: user_test_001" \
  -H "oai-authenticated-user-email: ada@example.com"
```

### Register a connector

```bash
curl -sS -X POST https://app.distribution.os/api/connectors \
  -H "oai-authenticated-user-id: user_test_001" \
  -H "oai-authenticated-user-email: ada@example.com" \
  -H "Content-Type: application/json" \
  -d '{"provider":"Stripe"}'
```

`provider` must match a `name` from
[`lib/connector-catalog.ts`](../lib/connector-catalog.ts) (100+ entries
across 8 categories).

### Get / update a single connector

```bash
PROVIDER="stripe"

# Get
curl -sS https://app.distribution.os/api/connectors/${PROVIDER} \
  -H "oai-authenticated-user-id: user_test_001" \
  -H "oai-authenticated-user-email: ada@example.com"

# Update status
curl -sS -X PATCH https://app.distribution.os/api/connectors/${PROVIDER} \
  -H "oai-authenticated-user-id: user_test_001" \
  -H "oai-authenticated-user-email: ada@example.com" \
  -H "Content-Type: application/json" \
  -d '{"status":"authorized"}'
```

---

## Connector installations

### List installations

```bash
curl -sS https://app.distribution.os/api/connector-installations \
  -H "oai-authenticated-user-id: user_test_001" \
  -H "oai-authenticated-user-email: ada@example.com"
```

### Upsert an installation

```bash
curl -sS -X POST https://app.distribution.os/api/connector-installations \
  -H "oai-authenticated-user-id: user_test_001" \
  -H "oai-authenticated-user-email: ada@example.com" \
  -H "Content-Type: application/json" \
  -d '{
    "provider":"Stripe",
    "category":"Payments",
    "status":"connected",
    "scopes":["payments:read","payments:write"],
    "capabilities":["charges","refunds","webhooks"],
    "token_reference":"opaque-vault-ref:abc123",
    "token_expires_at":1735689600000,
    "last_sync_at":1730000000000
  }'
```

The `token_reference` is an opaque pointer to a stored credential —
the actual secret never enters D1. `summarizeForDisplay` redacts it
from all responses.

---

## Webhooks

### Receive a Stripe webhook

Webhooks are received at `/api/webhooks/[provider]` and verified with
the Stripe-style HMAC-SHA256 signature header. The example below shows
how Stripe would call your endpoint; you normally do not invoke this
manually.

```bash
# The signature header has the shape: t=<unix-seconds>,v1=<hex-hmac>
SIGNATURE='t=1730000000,v1=<hex-hmac-sha256-of-timestamp.body>'

curl -sS -X POST https://app.distribution.os/api/webhooks/stripe \
  -H "stripe-signature: ${SIGNATURE}" \
  -H "Content-Type: application/json" \
  -d '{
    "id":"evt_1",
    "type":"payment_intent.succeeded",
    "data":{"object":{
      "id":"pi_abc123",
      "amount":1999,
      "currency":"usd",
      "status":"succeeded"
    }}
  }'
```

When the signature is missing, malformed, expired, future-dated, or
mismatches, the endpoint returns `401`. When
`STRIPE_WEBHOOK_SECRET` is unset, it returns `503`. When the body is
not valid JSON, it returns `400`. Otherwise it returns `200` and
(when the event represents a payment) records a `payments` row.

### Verifying a webhook signature locally (Stripe CLI)

```bash
# Forward Stripe's test events to your local dev server
stripe listen --forward-to http://localhost:5173/api/webhooks/stripe
```

The CLI prints a `whsec_...` signing secret — set it in `.dev.vars`
as `STRIPE_WEBHOOK_SECRET`.

---

## Organizations

### List / create organizations

```bash
# List
curl -sS https://app.distribution.os/api/organizations \
  -H "oai-authenticated-user-id: user_test_001" \
  -H "oai-authenticated-user-email: ada@example.com"

# Create
curl -sS -X POST https://app.distribution.os/api/organizations \
  -H "oai-authenticated-user-id: user_test_001" \
  -H "oai-authenticated-user-email: ada@example.com" \
  -H "Content-Type: application/json" \
  -d '{"name":"Acme Inc.","slug":"acme"}'
```

> The workspace id IS the organization id — every workspace has
> exactly one organization whose `id` equals the workspace id.

---

## Workspace settings

### Get settings

```bash
curl -sS https://app.distribution.os/api/workspace/settings \
  -H "oai-authenticated-user-id: user_test_001" \
  -H "oai-authenticated-user-email: ada@example.com"
```

### Update settings

```bash
curl -sS -X PATCH https://app.distribution.os/api/workspace/settings \
  -H "oai-authenticated-user-id: user_test_001" \
  -H "oai-authenticated-user-email: ada@example.com" \
  -H "Content-Type: application/json" \
  -d '{
    "monthly_budget_cents": 50000,
    "daily_budget_cents": 5000,
    "quiet_hours_start": 22,
    "quiet_hours_end": 8,
    "timezone": "America/New_York",
    "forbidden_claims": ["guaranteed revenue","risk free"],
    "retention_days": 180,
    "auto_approve_low_risk": false,
    "max_daily_actions": 25
  }'
```

---

## Audit

### List audit events (with filters)

```bash
# All events for the workspace
curl -sS https://app.distribution.os/api/audit \
  -H "oai-authenticated-user-id: user_test_001" \
  -H "oai-authenticated-user-email: ada@example.com"

# Filtered by category and time range
FROM_MS=1730000000000
TO_MS=1730086400000
curl -sS "https://app.distribution.os/api/audit?category=approval&from=${FROM_MS}&to=${TO_MS}&limit=100" \
  -H "oai-authenticated-user-id: user_test_001" \
  -H "oai-authenticated-user-email: ada@example.com"
```

`category` must be one of: `auth, role, approval, connector, action,
payment, export, deletion, security, config`. The `ip_hash` column is
redacted by `summarizeForDisplay` before being returned.

---

## Data export (GDPR Art. 15)

### Export all workspace data as JSON

```bash
curl -sS -X POST https://app.distribution.os/api/data-export \
  -H "oai-authenticated-user-id: user_test_001" \
  -H "oai-authenticated-user-email: ada@example.com" \
  -o workspace-export.json
```

The response is a JSON download (`Content-Disposition: attachment`)
containing every tenant-scoped table for the caller, with all PII /
tokens / IP hashes redacted via `summarizeForDisplay`. Read-only — no
rows are mutated.

---

## Data deletion (GDPR Art. 17)

### Wipe all workspace-scoped data

```bash
curl -sS -X POST https://app.distribution.os/api/data-deletion \
  -H "oai-authenticated-user-id: user_test_001" \
  -H "oai-authenticated-user-email: ada@example.com" \
  -H "Content-Type: application/json" \
  -d '{"confirm":"DELETE"}'
```

```jsonc
// 200 OK
{
  "deleted": true,
  "workspace_id": "ws_3f9c…",
  "tables": [
    "agent_steps", "agent_runs", "mission_events", "mission_versions",
    "strategy_versions", "evidence", "payments", "touchpoints",
    "content_assets", "experiments", "action_queue", "contacts",
    "workspace_settings", "workspace_connections",
    "connector_installations", "missions"
  ]
}
```

> The `confirm` field must be the literal string `"DELETE"`. Any other
> value yields `400`. The `audit_events` row recording the deletion is
> written BEFORE the cascade so it survives long enough to be
> replicated / exported by the compliance pipeline. The `workspaces`
> row is preserved so the user can still sign in.

---

## Common error responses

| Status | Body                                                            | Cause                                                  |
| ------ | --------------------------------------------------------------- | ------------------------------------------------------ |
| `400`  | `{ "error": "website_url must be a valid URL" }`                | Zod validation failure.                                |
| `400`  | `{ "error": "Invalid audit category: foo" }`                    | Unknown enum value.                                    |
| `400`  | `{ "error": "confirm field is required" }`                      | Missing `confirm: "DELETE"` on data-deletion.          |
| `401`  | `{ "error": "Sign in to launch a mission." }`                   | Missing identity headers.                              |
| `401`  | `{ "error": "Invalid webhook signature." }`                     | Stripe HMAC verification failed.                       |
| `404`  | `{ "error": "Mission not found." }`                             | Mission id does not exist in the caller's workspace.   |
| `409`  | `{ "error": "Payment … cannot transition from … to …" }`        | Forbidden state-machine transition.                    |
| `422`  | `{ "error": "Validation failed", "details": { … } }`            | Body passed Zod but failed business-rule validation.   |
| `429`  | `{ "error": "Rate limit exceeded", "retryAfter": 30 }`          | Token bucket exhausted.                                |
| `500`  | `{ "error": "Internal server error" }`                          | Unexpected failure (D1 binding missing, etc.).         |
| `502`  | `{ "error": "OpenAI returned no usable payload." }`             | Upstream provider returned non-2xx or empty body.      |
| `503`  | `{ "error": "Stripe webhook secret is not configured." }`       | `STRIPE_WEBHOOK_SECRET` unset.                         |

For the full HTTP status map, see
[`API_REFERENCE.md`](./API_REFERENCE.md#standard-error-envelope) and
[`lib/api-errors-pure.ts`](../lib/api-errors-pure.ts).
