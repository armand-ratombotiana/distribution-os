# Distribution OS

> Agentic marketing and distribution operating system.
> Turn one website URL into a coordinated system of market intelligence,
> strategy, channel-native content, distribution experiments and revenue
> learning — powered by an AI CMO orchestrator and a durable evidence ledger.

Distribution OS is a Cloudflare-Workers + Next.js application that turns a
single public website URL into a continuously-improving go-to-market
mission. Six specialist agents share one mission, one memory and one
measurable objective: the first attributable verified payment. Every
external action is approval-gated. Every cycle produces revenue evidence or
new information that feeds the next iteration.

---

## Table of contents

1. [How it works](#how-it-works)
2. [Architecture](#architecture)
3. [Project layout](#project-layout)
4. [Quick start](#quick-start)
5. [Configuration](#configuration)
6. [API](#api)
7. [Database](#database)
8. [Security model](#security-model)
9. [Testing](#testing)
10. [Scripts](#scripts)
11. [Roadmap](#roadmap)

---

## How it works

```
                ┌──────────────── public website URL ────────────────┐
                │                                                    │
                ▼                                                    │
   ┌──────────────────────┐   validatePublicUrl   ┌──────────────────┴────┐
   │  fetchWithRedirectLimit │ ──────────────────▶ │  prepareExternalContent │
   │  (lib/url-safety.ts)   │                      │  (lib/content-sanitize-pure.ts) │
   └──────────────────────┘                       └────────────────────────┘
                │                                                    │
                ▼                                                    ▼
   ┌──────────────────────┐   strict JSON schema   ┌────────────────────────┐
   │  saveMission (D1)    │ ◀───────────────────── │  OpenAI Responses API   │
   │  + mission_events    │                        │  (mode: "live")         │
   └──────────────────────┘                        └────────────────────────┘
                │
                ├──▶ evidence row   (observed)
                └──▶ audit_events row (action · mission.created.live)
```

1. The user pastes a public URL on the landing page or in the workspace.
2. `POST /api/mission` fetches the page (SSRF-hardened), strips and
   sanitizes the HTML, and asks the OpenAI Responses API to produce a
   strict-schema mission.
3. The mission is persisted in D1 along with two initial events
   (`observation`, `decision`).
4. A best-effort `evidence` row is created from the sanitized website text,
   and a best-effort `audit_events` row records the creation.
5. The workspace UI exposes 14 views — Mission Control, Intelligence,
   Content, Experiments, Connectors, Revenue, Agent Memory, Action Queue,
   Evidence, Versions, Budget, Attribution, Audience, Settings.
6. The operator advances the loop (`observe → decide → act → measure →
   learn`) and approves the next external batch when ready. Each advance
   writes a `mission_versions` row and an `audit_events` row.

---

## Architecture

| Layer              | Technology                                                       |
| ------------------ | ---------------------------------------------------------------- |
| Runtime            | Cloudflare Workers (`@cloudflare/vite-plugin`)                   |
| Web framework      | Next.js 16 (App Router, RSC)                                     |
| Database           | Cloudflare D1 (SQLite) via Drizzle ORM                           |
| Auth               | ChatGPT-hosted identity headers injected by the control plane    |
| LLM                | OpenAI Responses API with strict JSON schema                     |
| UI kit             | shadcn@4.13.0 + Tailwind CSS 4 (`vendor/shadcn-tailwind-4.13.0.css`) |
| Build              | Vite 8 + `vinext` + `@vitejs/plugin-rsc`                          |
| Validation         | Zod                                                              |
| Language           | TypeScript 5.9 (strict)                                          |
| Linting            | ESLint 9 + `eslint-config-next`                                  |

The repository is built and served through the Sites runtime
(`scripts/sites-env.sh`) which sets up an isolated home, npm cache and
wrangler registry under `.sites-runtime/`.

---

## Project layout

```
distribution-os/
├── app/                          # Next.js App Router
│   ├── api/
│   │   ├── mission/
│   │   │   ├── route.ts          # GET/POST mission (URL → AI CMO → D1)
│   │   │   └── action/route.ts   # POST advance/approve
│   │   ├── connectors/route.ts   # POST prepare connector
│   │   ├── workspace/route.ts    # GET workspace snapshot
│   │   └── data-deletion/route.ts# POST wipe workspace data
│   ├── workspace/
│   │   ├── page.tsx              # Server component (auth gate)
│   │   └── workspace-client.tsx  # 14-view sidebar UI + 12 panels
│   ├── chatgpt-auth.ts           # Identity header parsing
│   ├── layout.tsx                # Root layout + metadata
│   ├── page.tsx                  # Public landing page
│   └── globals.css               # Tailwind + design tokens
├── components/ui/                # shadcn@4.13.0 registry (vendored)
├── db/                           # D1 access layer
│   ├── schema.ts                 # Drizzle schema + enums
│   ├── index.ts                  # getDb() / getRawDb()
│   ├── workspaces.ts             # identity + workspace + connections
│   ├── missions.ts               # mission CRUD + advance/approve
│   └── *-pure.ts                 # pure, side-effect-free helpers
├── lib/                          # Pure, reusable business logic
│   ├── url-safety.ts             # SSRF validation + safe fetch
│   ├── content-sanitize-pure.ts  # HTML strip + injection neutraliser
│   ├── mission-lifecycle-pure.ts # stage machine + readiness
│   ├── connector-catalog.ts      # 100+ connector catalog
│   ├── audit-pure.ts             # (alias of db/audit-pure.ts)
│   └── …                         # see lib/ for the full list
├── drizzle/                      # Migrations + journal
├── docs/
│   └── API_REFERENCE.md          # Full HTTP API reference
├── tests/                        # node:test + assert/strict
├── scripts/                      # Sites runtime + build helpers
├── public/                       # Static assets
├── vendor/                       # shadcn CSS + LICENSE
├── eslint.config.mjs
├── tsconfig.json
├── vite.config.ts
├── next.config.ts
├── drizzle.config.ts
└── package.json
```

---

## Quick start

```bash
# 1. Install dependencies (uses the Sites runtime shim)
npm run install:ci

# 2. Run the dev server (Vite + vinext)
npm run dev

# 3. Open the app
open http://localhost:5173
```

The dev server expects identity headers (`oai-authenticated-user-id`,
`oai-authenticated-user-email`) to be injected by the hosting control
plane. For local development without those headers, every authenticated
route returns `401 AUTH_REQUIRED` and the landing page renders the
"Sign in" CTA.

### Production build

```bash
npm run build      # runs scripts/build-verified.sh
npm run start      # serves the built Worker through vinext
```

---

## Configuration

| Variable          | Source                                  | Purpose                                                |
| ----------------- | --------------------------------------- | ----------------------------------------------------- |
| `DB`              | Cloudflare D1 binding (`wrangler.toml`) | SQLite database for all workspace-scoped tables.       |
| `OPENAI_API_KEY`  | Workers secret / `.dev.vars`            | When set, missions are generated with the live model.  |
| `OPENAI_MODEL`    | Workers var / `.dev.vars`               | Override the Responses API model (default `gpt-5.6`).  |

When `OPENAI_API_KEY` is unset, `POST /api/mission` falls back to a
deterministic `demoMission` and persists the mission with
`mode: "simulation"`. This makes the app fully demoable without an LLM
key.

---

## API

See [`docs/API_REFERENCE.md`](docs/API_REFERENCE.md) for the full HTTP
reference. Summary:

| Method | Path                       | Purpose                                          |
| ------ | -------------------------- | ------------------------------------------------ |
| `GET`  | `/api/workspace`           | Workspace snapshot (creates workspace on first access). |
| `POST` | `/api/mission`             | Analyze a website URL and persist the mission.   |
| `GET`  | `/api/mission`             | Return the workspace's latest mission.           |
| `POST` | `/api/mission/action`      | Advance or approve the current mission.          |
| `POST` | `/api/connectors`          | Prepare a workspace-scoped connector.            |
| `POST` | `/api/data-deletion`       | Wipe all workspace-scoped data (requires `{"confirm":"DELETE"}`). |

---

## Database

The D1 schema is defined in `db/schema.ts` and migrated with Drizzle Kit
(`npm run db:generate`). The core tables are:

| Table                       | Purpose                                                 |
| --------------------------- | ------------------------------------------------------ |
| `workspaces`                | One row per signed-in user.                            |
| `missions`                  | The latest mission payload per workspace.              |
| `mission_events`            | Append-only event ledger per mission.                  |
| `mission_versions`          | Append-only version history per mission.               |
| `strategy_versions`         | Per-strategy version history (ICP, channel, message).  |
| `evidence`                  | Sanitized external signals (website, email, payment…). |
| `experiments`               | Falsifiable experiments with kill rules.               |
| `action_queue`              | Approval-gated external actions.                       |
| `content_assets`            | Channel-native content drafts.                         |
| `touchpoints`               | Distribution touchpoints for attribution.              |
| `payments`                  | Stripe-verified payments.                              |
| `contacts`                  | Permission-based audience records.                     |
| `agent_runs` / `agent_steps`| Per-agent observability (tokens, cost, latency).       |
| `workspace_settings`        | Budget caps, retention, brand voice, quiet hours.      |
| `audit_events`              | Compliance audit log (best-effort, always written first). |
| `workspace_connections`     | Workspace-scoped connector installations.              |
| `connector_installations`   | Detailed connector health + token state.               |
| `organizations` / `organization_memberships` / `organization_invitations` | Multi-workspace org support. |

### Foreign-key safe deletion order

`POST /api/data-deletion` deletes from each table in FK-safe order
(children first), then leaves the `workspaces` row intact so the user can
continue to sign in. `audit_events` is intentionally written **before**
the cascade so the deletion intent is durable.

---

## Security model

### Identity

Identity is provided by the hosting control plane via request headers
(`oai-authenticated-user-id`, `oai-authenticated-user-email`, optional
`oai-authenticated-user-full-name` with
`oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`).
Routes consume them via `requireRequestIdentity` in `db/workspaces.ts`
and React Server Components consume them via `getChatGPTUser` /
`requireChatGPTUser` in `app/chatgpt-auth.ts`. The `ChatGPTUser` type now
includes `userId` so the workspace UI can display and reference the
stable user identifier.

### SSRF protection

`lib/url-safety.ts` exports `validatePublicUrl` and
`fetchWithRedirectLimit`:

- Rejects non-HTTP schemes, embedded credentials, non-standard ports,
  `localhost`, `.local`, `.internal` hostnames.
- Rejects private/reserved/multicast IPv4 and ULA/link-local IPv6.
- Caps redirects at 5, timeout at 10 000 ms, body at 120 000 bytes.
- Re-validates every `Location` header through `validatePublicUrl`.

`POST /api/mission` uses these helpers instead of the legacy
`assertPublicUrl`.

### Prompt injection

`lib/content-sanitize-pure.ts` runs every external HTML body through:

1. `stripHtml` — drops tags, scripts, styles, iframes, comments; decodes
   named and numeric entities.
2. `sanitizeForModel` — neutralises the twelve known prompt-injection /
   smuggling patterns (`ignore previous instructions`, role markers,
   special tokens, `javascript:` URIs, data URIs, null bytes, ANSI
   escapes, RTL control characters, etc.).
3. `truncateForModel` — byte-accurate UTF-8 truncation (default 8 000
   bytes).
4. `wrapAsDataSection` — wraps the result in `<data:website-text>…`
   so the model can tell user-authored text apart from fetched external
   text.

### Approval boundary

External actions (publish, outreach, spend, payment configuration) are
gated by `missions.approved`. The `act` stage cannot complete until a
human operator has called `POST /api/mission/action` with
`action: "approve"`. Approval is recorded as an `audit_events` row with
`event_category = "approval"`.

### Audit

Every mutating endpoint writes a best-effort `audit_events` row
identifying the actor, the affected resource, the IP hash (SHA-256) and a
JSON detail blob. Audit logging never blocks the primary operation
(wrapped in try/catch). The data-deletion endpoint writes its audit row
**before** the cascade so it survives the wipe.

---

## Testing

```bash
npm run test     # builds the project then runs node --test on tests/*.test.mjs
```

The test suite uses `node:test` and `node:assert/strict`. Each `*-pure.ts`
module has a sibling `tests/*.test.ts` that exercises it in isolation:

| Test file                          | Covers                                   |
| ---------------------------------- | ---------------------------------------- |
| `tests/url-safety.test.ts`         | SSRF validation, redirect limits, body cap. |
| `tests/content-sanitize.test.ts`   | HTML stripping + injection neutraliser.  |
| `tests/mission-lifecycle.test.ts`  | Stage machine, readiness, kill rules.    |
| `tests/audit.test.ts`              | Audit row builder, IP hash, time filters. |
| `tests/evidence.test.ts`           | Evidence state machine + content hash.   |
| `tests/versions.test.ts`           | Mission/strategy version diffs.          |
| `tests/actions.test.ts`            | Action queue state machine.              |
| `tests/webhook-signature.test.ts`  | Stripe-style HMAC verification.          |
| `tests/rate-limit.test.ts`         | Sliding-window rate limiter.             |
| `tests/idempotency.test.ts`        | Idempotency key + replay handling.       |
| …                                  | see `tests/` for the full list.          |

---

## Scripts

| Script                 | Purpose                                                              |
| ---------------------- | ------------------------------------------------------------------- |
| `npm run install:ci`   | Installs dependencies through the Sites runtime shim.               |
| `npm run dev`          | Starts Vite + vinext in dev mode.                                   |
| `npm run build`        | Verified production build via `scripts/build-verified.sh`.          |
| `npm run start`        | Serves the built Worker through `vinext start`.                     |
| `npm run test`         | Builds and runs `node --test` against `tests/*.test.mjs`.           |
| `npm run lint`         | Runs ESLint through the Sites runtime shim.                         |
| `npm run db:generate`  | Generates Drizzle migrations from `db/schema.ts`.                   |

---

## Roadmap

- Live connector OAuth adapters (Stripe, YouTube, Gmail, Reddit, X,
  Instagram, TikTok, Metricool, HubSpot).
- Realtime attribution graph (touchpoints → payment).
- Multi-workspace organizations (`organizations`,
  `organization_memberships`, `organization_invitations`).
- Agent-run cost observability dashboard (`agent_runs`,
  `agent_steps`).
- Per-mission retention enforcement using `workspace_settings.retention_days`.

---

## License

Proprietary. © 2026 Distribution OS.
