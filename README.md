# Distribution OS

Distribution OS turns one public website URL into a tenant-owned, evidence-grounded distribution mission. Its north star is not content volume or agent activity; it is the first attributable, provider-verified payment.

The product is intentionally governed:

- evidence is separated into observed, inferred, and verified states;
- plans, experiments, content, and actions become durable records;
- external actions require approval of an exact queued payload;
- execution fails closed until a provider adapter can return a real receipt;
- revenue counts come from signed Stripe webhook events, not UI simulation;
- every query and stream is scoped to the authenticated workspace.

The current implementation is a hardened first slice, not a claim that the full autonomous operating system already exists. See [Current State](docs/CURRENT_STATE.md) for the verified boundary and next implementation wave.

## Golden path

1. An authenticated operator submits a public URL to `POST /api/mission`.
2. The server validates the URL against SSRF and redirect abuse, fetches it, and sanitizes the page as untrusted content.
3. OpenAI synthesis is used when configured; otherwise the same contract is populated in explicit simulation mode. Both paths are schema-validated.
4. The server creates a mission plus website evidence, inferred assumptions, experiments, content drafts, a prepared action, versions, lifecycle events, and run telemetry. A failed artifact write is compensated by deleting the new mission graph.
5. The lifecycle follows `observe → decide → approve → act → measure → learn`. Server-side readiness checks prevent skipping exact-action approval, provider-confirmed execution, or measurement evidence.
6. Signed Stripe events with valid workspace metadata record attributable payments and update the mission’s verified-payment counter.

No outbound distribution adapter is currently connected. The execute endpoint deliberately returns `501` and preserves the approved action instead of manufacturing success.

## Stack

- Next.js App Router on Vinext/Vite and Cloudflare Workers
- Cloudflare D1 / SQLite
- TypeScript, React, Zod, Drizzle
- OpenAI Responses API for optional live synthesis
- ChatGPT-hosted identity headers supplied by the control plane

## Local commands

Node 22.13 or newer is required. The default commands are portable across Windows and Linux.

```sh
npm run install:ci
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
```

`npm run install:ci:sites` retains the Linux-only, lock-and-preflight Sites installer for the hosted build image. Standard local and CI installations use `npm ci`.

Authenticated routes require the hosting identity headers. A local request without those headers correctly returns `401`; the application does not invent a development identity.

## Configuration

| Variable | Required | Purpose |
| --- | --- | --- |
| `DB` | yes in hosted runtime | Cloudflare D1 binding |
| `OPENAI_API_KEY` | no | Enables live mission synthesis; omission is labelled simulation |
| `OPENAI_MODEL` | no | Overrides the configured Responses API model |
| `STRIPE_WEBHOOK_SECRET` | for Stripe ingestion | Verifies signed Stripe webhook payloads |

Connector records are setup declarations only. Their status cannot be promoted to connected by a client request.

## Repository map

- `app/api/` — authenticated HTTP boundaries and webhooks
- `app/workspace/` — API-backed operator workspace
- `db/` — tenant-scoped persistence and domain operations
- `lib/` — validation, lifecycle, safety, and pure domain logic
- `drizzle/` — forward-only schema migrations
- `tests/` — TypeScript and module tests
- `docs/` — API, security, architecture, and current-state documentation
- `scripts/` — cross-platform command runner plus hosted Linux installer

## Security boundary

- Workspace ownership is derived from trusted identity headers, never request JSON.
- Mission, action, payment-attribution, and SSE queries verify workspace ownership.
- Website content is untrusted input and is sanitized before model use.
- Action approval does not imply connector authorization, spend authorization, or execution success.
- Webhook persistence errors return failure so Stripe can retry.
- Data deletion is audited only after its deletion batch succeeds.

See [Security](docs/SECURITY.md), [API Reference](docs/API_REFERENCE.md), and [Database](docs/DATABASE.md) for deeper reference material. Where older design notes describe planned behavior, [Current State](docs/CURRENT_STATE.md) is authoritative for runtime claims.
