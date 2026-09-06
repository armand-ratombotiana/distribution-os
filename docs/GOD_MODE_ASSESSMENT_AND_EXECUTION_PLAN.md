# Distribution OS — Repository-Grounded Product and Implementation Specification

Verified against branch `armand-ratombotiana/v2` on 2026-09-06. Runtime claims below are based on source, schema, migrations, routes, tests, and configuration—not UI appearance. The 84 normalized engineering stories are in [USER_STORIES.md](USER_STORIES.md); the longer target-state rationale remains in [PRODUCT_IMPLEMENTATION_SPEC.md](PRODUCT_IMPLEMENTATION_SPEC.md).

## 1. Executive summary

Distribution OS has a credible hardened foundation, but it is not yet a complete autonomous commercial operating system. The working slice accepts one public URL, produces and persists a structured mission, separates simulation from live synthesis, governs exact action approval, can send one tightly constrained Resend email, ingests signed Resend and Stripe events, and renders tenant-scoped operating records. The shortest path to a real product is to finish one consented email-to-lead-to-payment loop before adding channels.

The codebase is strongest in pure domain rules, tenant-scoped queries, state-machine tests, idempotency primitives, evidence/payment records, and truthful fail-closed execution. It is weakest in real workspace membership, durable background work, multi-page website intelligence, business-graph semantics, connector authorization, lead/reply lineage, end-to-end attribution, production observability, and runtime integration tests. The UI and provider catalog have historically implied more breadth than the adapters provide; the current continuation slice corrects that boundary and connects the real Versions API.

## 2. Product definition

Distribution OS is a governed commercial operating system that turns one public website into an evidence-backed sequence of distribution decisions and measures those decisions against qualified demand and provider-verified revenue.

## 3. Vision

Move a builder from “I built a product” to “the right customer discovered, understood, trusted, and paid for it—and the system can show why and what to do next.”

## 4. Philosophy

Distribution is a connected system; revenue is the final truth; autonomy is earned per capability; evidence precedes confidence; side effects have truthful states; learning must reference outcomes; and one complete path is worth more than 100 catalog entries.

## 5. Market problem

Creation tooling has compressed product-building time, but founders still coordinate research, positioning, content, outreach, analytics, sales follow-up, payments, and learning manually across tools. Existing point products optimize activity and channel metrics while losing the causal and evidentiary chain to revenue.

## 6. Product opportunity

Own the post-build control loop: create a shared commercial memory, recommend the next bounded experiment, execute only approved actions through verified capabilities, and connect each outcome to payment evidence. The wedge is founders with a public SaaS site, consented initial audience, and Stripe-compatible checkout.

## 7. Target users

Primary: indie hackers, SaaS founders, vibe coders, and product creators. Secondary: small-business owners, agencies, marketers, sales/growth operators, and creator-led teams. Regulated enterprises and high-volume outbound teams are not initial users.

## 8. Personas

| Persona | Primary need | Trust requirement | Success signal |
| --- | --- | --- | --- |
| Solo builder | Find the first repeatable route to a customer | Minimal setup; no fake execution | First verified payment |
| Startup founder | Align positioning, experiment, and revenue | Evidence and fast correction | Shorter time to validated demand |
| Growth operator | Run measurable channel experiments | Durable jobs and attribution | Qualified pipeline per cost |
| Small-business owner | Understand and approve plain-language actions | Safe defaults and clear blockers | Leads and paid customers |
| Agency operator | Operate multiple isolated clients | Delegated roles and zero leakage | Retained profitable accounts |
| Approver/admin | Control risk, spend, and external messages | Exact payload, audit, revocation | Zero policy violations |

## 9. Jobs to be done

Understand my product from its site; correct the system’s assumptions; choose the highest-value next action; approve an exact low-risk experiment; execute through a real provider; capture and follow up a qualified lead; verify payment; explain attribution confidence; and turn the result into a bounded next recommendation.

## 10. User pain points

Fragmented context, generic AI advice, unclear ICP, inconsistent publishing, connector setup friction, lead loss, poor follow-up, vanity metrics, weak attribution, unsafe automation, and no persistent learning memory.

## 11. Product boundaries

- Must have: URL intelligence, editable profile, opportunity/experiment, approvals, one real consented distribution path, lead/reply lineage, signed Stripe truth, attribution, evidence, and learning.
- Should have: AI COO, claim checking, analytics connector, team roles, durable schedulers, health/reconciliation, and cost controls.
- Could have: additional channels after conformance and revenue-learning gates.
- Not now: mass cold outreach, autonomous ad spend, unsupported logos, full CRM replacement, marketplace, opaque multi-touch causality, or unrestricted agents.

## 12. Product principles

Every material recommendation carries source, timestamp, freshness, confidence, assumptions, impact, risk, approval, and next action. Deterministic code owns identity, policy, budget, money, idempotency, and side effects. Agents own bounded reasoning and drafts. “Provider accepted” never means delivered; “associated” never means caused.

## 13. Current codebase assessment

Repository facts: Next.js/React/TypeScript on Vinext/Vite and a Cloudflare Worker; D1/SQLite via Drizzle; 54 route files exposing 69 HTTP handlers; 23 schema tables and seven forward migrations; 144 test files containing 1,894 `test(...)` declarations; 84 product stories. There is no Python/FastAPI service, PostgreSQL, Redis, durable queue, OpenTelemetry SDK, Prometheus exporter, Grafana config, object storage use, or browser E2E harness.

What genuinely works:

- ChatGPT control-plane identity is required; the server derives a single owner workspace.
- URL syntax/literal-IP/redirect/timeout/body-size checks and external-content sanitization run before synthesis.
- One HTML page is fetched; a strict Zod/JSON schema validates live or deterministic simulation output.
- Missions, events, model-run metadata, evidence, assumptions, versions, experiments, content, and an action are persisted with compensation on artifact failure.
- Exact payload hashes gate approval; action queries are workspace scoped.
- Resend execution is restricted by site credential, exact workspace, sender, recipient allowlist, quiet hours, budgets, daily limits, and a database-unique execution idempotency key.
- Signed Resend events distinguish acceptance from delivery and reconcile early webhook events.
- Signed Stripe events require workspace metadata, validate referenced entities, deduplicate by provider identity, and update verified-payment count.
- Contacts, content, experiments, evidence, exports/deletion, settings, usage, audit, and timeline APIs have substantial tenant-scoped CRUD/read behavior.

What only appears to work:

- The provider catalog is a roadmap of 100+ names; only Resend executes and Stripe only ingests signed payment events.
- “Six agents” are six conceptual synthesis passes inside one model call, not independently scheduled workers.
- Mission stages advance on HTTP commands; no durable operator continuously runs the loop.
- Organizations and invitations persist, but membership is not used to resolve workspace access and no invitation-acceptance route is exposed.
- Most `lib/*-pure.ts` modules are tested utilities or target-state primitives, not proof they participate in runtime workflows.
- Several workspace components exist but are not mounted in the primary client. Before this slice, Versions was hard-coded empty despite a real API.

## 14. Current architecture assessment

The current modular monolith is appropriate for the pilot: Worker → App Router routes → tenant-scoped D1 repositories → external HTTPS APIs. Keep it while D1 constraints remain acceptable. Add durable workflow tables and scheduled Worker execution before introducing a second backend. Adopt PostgreSQL/FastAPI only when concurrency, row-level security, long-running intelligence, or connector workloads produce measured pressure; avoid a rewrite-first migration.

Architectural concerns: workspace ownership is single-user; organizations are detached from authorization; audit writes are often best-effort instead of atomic with critical mutations; action status vocabulary is narrower than the target contract; website fetching does not resolve/revalidate DNS or honor robots; errors often return raw exception messages; two connector tables duplicate concepts; raw provider payloads may exceed minimization goals; and no service-level telemetry exists.

## 15. Existing feature classification

| Feature/module | Classification | Repository evidence and disposition |
| --- | --- | --- |
| Landing URL input | Fully implemented UI / partial outcome | Real form and auth routing; copy must remain capability-truthful |
| URL validation | Partial; security hardening required | Literal IP and redirects covered; DNS rebinding/robots absent |
| Website intelligence | Partial | One page, metadata/body extraction; no crawl graph/pricing/CTA detector |
| AI synthesis | Partial / simulated when unconfigured | One structured request or explicit deterministic simulation |
| Workspace bootstrap | Implemented for single owner | One workspace per owner; no member access path |
| Mission Control | Partial | Real API data and manual stage transitions; no next-best-action engine |
| Business Graph | Mocked by relational artifacts | Domain rows exist; no graph entities/edges/query contract |
| Evidence Ledger | Partial | Evidence/audit/provider tables exist; not fully immutable or unified |
| Opportunity Engine | Missing | Experiments are generated, but no opportunity entity/scoring lifecycle |
| Content OS | Partial | Draft persistence and CRUD; no quality/brand/claim workflow wired end-to-end |
| Actions/approvals | Strong partial | Exact hash and expiry; no roles, revision, schedule/cancel, or atomic audit |
| Resend | Real narrow adapter | Sandbox plain-text send plus signed event intake; operator secrets required |
| Stripe | Real narrow intake | Signed payment/refund families; no OAuth/product/customer sync |
| Gmail | Missing | Catalog only; no OAuth, send, watch, reply, or unsubscribe integration |
| Social channels | Missing | Catalog only; executor returns `501` for unsupported actions |
| Leads/contacts | Partial | CRUD/status/consent fields; no capture widget, assignment RBAC, reply/purchase link |
| Attribution | Partial | Mission/action touchpoint association and heuristic confidence; no customer lineage or causal model |
| AI Workforce | Simulated/conceptual | Run ledger exists; no specialist scheduling/tool permissions/evals runtime |
| Agent Memory | Partial | Runs/events/versions persist; no retrieval, retention, correction propagation |
| Connector platform | Partial / duplicated | Catalog and setup rows; no OAuth vault, refresh, revoke, real probes |
| Teams/RBAC | Broken as product flow | Organization rows/invites are not used by `ensureWorkspace` |
| Billing/usage | Mocked operationally | Usage counts exist; no metering invoice or subscription enforcement |
| Notifications | Partial | Derived action notifications; no preferences/delivery/acknowledgement |
| Observability | Missing production stack | Pure helpers only; no traces/exporters/dashboards/alerts |
| CI | Partially implemented | Main-branch CI runs lint/tests/build; feature branch push does not trigger it |
| Deployment | Implemented for Sites | Bound project/D1 config and deploy workflow; secrets remain external |
| Accessibility/responsiveness | Partial | Semantic states and responsive CSS exist; no automated axe/Playwright gate |

## 16. Gaps and technical debt

P0 gaps: real member authorization, durable jobs/leases/reconciliation, one UI-created executable Resend action, consented lead capture, reply correlation, Stripe-to-lead lineage, DNS/robots-aware ingestion, safe public errors, and mandatory critical audit linkage. P1 debt: duplicated connector models, monolithic/minified workspace client, unmounted duplicate panels, mutable evidence states, incomplete action vocabulary, absence of opportunities/business-graph entities, no coverage threshold, no E2E/provider contract suite, and stale target-state documentation. Preserve working domain rules, migrations, payment/webhook checks, and provider receipts. Remove only after import/runtime analysis: starter D1 example and truly unused panel/pure-module code. Defer new social connectors, marketplace, advanced attribution, and Python split.

## 17. Product-market alignment assessment

The north star and safety posture are strongly aligned. The current product can demonstrate trustworthy analysis and payment intake, but it cannot yet deliver the promised user transformation because its default generated action is unsupported, Gmail is absent, lead/reply lineage is incomplete, and learning is manual. Product-market proof therefore remains unearned; measure five pilot workspaces through the complete consented path before broad acquisition.

## 18. Golden user journey

URL → safe bounded ingestion → editable evidence-linked profile → tenant workspace → ranked opportunity → falsifiable experiment → exact approval → real Resend action → instrumented CTA/lead → Gmail follow-up/reply → signed Stripe payment → first/last-touch explanation → evidence-backed lesson. Every unavailable step exposes `requires_connection`, `requires_approval`, `blocked`, or `simulated` rather than success.

## 19. Core operating loop

Observe source/provider facts; understand graph context; detect bounded opportunities; prioritize by revenue/effort/risk/confidence; decide a falsifiable plan; approve the exact side effect; act through an idempotent job; measure qualified and commercial outcomes; attribute with confidence; learn a proposed diff; improve only after required approval; observe again.

## 20. Product architecture

Strategic Brain (reasoning, scoring, experiments), Distribution Fabric (capability registry, jobs, adapters, webhooks), Business Graph (typed commercial state), and Evidence Ledger (append-only provenance/decisions/executions/outcomes). MCP/tool calls sit behind deterministic identity, policy, secrets, budget, idempotency, and audit boundaries.

## 21. Domain model

`Organization → Membership → Workspace → Business → Product/Offer/Audience → Mission → Opportunity → StrategyVersion → Experiment → ContentAsset → Action → Approval → ExecutionAttempt → Touchpoint/Conversation/Lead → Customer → Payment → Attribution → Lesson`, with Evidence linked to every material assertion and AuditEvent linked to every mutation.

## 22. Business Graph model

Add typed `business_entities`, `business_relationships`, and `business_assertions` (or equivalent normalized tables), all with workspace, version, state, confidence, freshness, source evidence, created/confirmed actor, and optimistic version. Use relational adjacency first; add vector retrieval only for semantic lookup with demonstrable value. User corrections create new versions and stale dependent recommendations.

## 23. Evidence Ledger model

Use append-only ledger events for source observation, inference, recommendation, decision, approval, execution attempt/result, metric, payment proof, attribution, lesson, user correction, and policy decision. Corrections supersede rather than overwrite evidence. Each record has workspace, subject, source, hash, observed/received time, parser/prompt/model version, freshness, confidence class, and correlation/idempotency identifiers.

## 24. AI Workforce model

AI COO coordinates role-bounded Market, Customer, Positioning, Content Strategy, Content Production, Distribution, Growth, Sales, Revenue, Analytics, Experimentation, and Compliance agents. Each contract defines mission, input evidence IDs, structured output schema, allowed tools, read/write scope, memory policy, confidence, cost ceiling, approval requirement, timeout/retry, escalation, eval metric, and audit events. No agent receives raw secrets or commits money/state directly.

## 25. Connector architecture

Create a server-owned manifest per provider/capability: authorization type/scopes, secrets reference, health probe, token refresh, webhooks, rate limits, retry/idempotency policy, simulation support, retention/consent, platform restrictions, conformance version, and kill switch. Status is capability-specific; a Stripe webhook does not imply Stripe account sync. Prioritize website crawler, Resend, Stripe, Gmail, then one analytics source. Add one public channel only after the golden path passes.

## 26. Information architecture

Primary navigation: Mission Control, Intelligence, Opportunities, Content, Campaigns, Experiments, Leads, Revenue, Analytics, Connectors, AI Workforce, Agent Memory, Evidence Ledger, Settings. Keep Action Queue and approvals contextual/global. Hide roadmap modules behind explicit previews rather than empty operational screens.

## 27. UX/UI system

Keep the calm dark control-room palette, strong type hierarchy, compact status language, responsive sidebar, and reusable shadcn primitives. Every screen must specify goal, primary CTA, secondary actions, evidence/confidence/status, loading, empty, error, success, blocked, approval, simulation, responsive, keyboard/screen-reader behavior, and analytics. Never use decorative agent activity to imply execution.

## 28. Feature map

Foundation: identity, tenant, RBAC, policy, audit, jobs, observability. Understand: ingestion, profile, graph, intelligence. Decide: opportunities, strategy, campaigns, experiments, AI COO. Act: content, approvals, connector capabilities. Convert: leads, conversations, Gmail. Prove: Stripe, revenue, attribution, analytics, evidence. Improve: memory, lessons, re-scoring. Operate: notifications, usage/billing, admin, compliance.

## 29. Detailed user stories

[USER_STORIES.md](USER_STORIES.md) contains 84 stories across onboarding, intelligence, graph, Mission Control, opportunities, content, execution, campaigns, experiments, leads/Gmail, revenue/Stripe, attribution, workforce, approvals, evidence, connectors, security/workspace, and self-improvement. Every story follows the requested 32-field engineering format and is validated by `tests/product-spec.test.mjs`.

## 30. Acceptance criteria

Cross-cutting gates: tenant access is server-derived; exact approval survives no payload mutation; side effects are idempotent and receipt-backed; simulation is visually/analytically separate; evidence is traceable; money is signed-provider truth; all states have recovery; errors are safe; accessibility meets WCAG 2.2 AA; and golden-path E2E plus security/contract tests pass.

## 31. API requirements

Version future contracts under `/api/v1`; use Zod request/response schemas, stable error codes, correlation IDs, cursor pagination, ETags for edits, idempotency keys for commands, and `202` job resources for long work. Add ingestions, profiles/assertions, opportunities, approvals/revisions, jobs, connector authorize/callback/health/revoke, conversations/replies, customers, lessons, and analytics events. Preserve current routes behind compatibility adapters until UI migration.

## 32. Database requirements

Add memberships to workspace authorization; ingestion/pages/jobs/leases/outbox/inbox; approvals as first-class immutable records; opportunities and graph entities/edges/assertions; leads/conversations/messages/suppressions; customers/payment-event lineage; lessons/recommendation versions; and metric definitions. Enforce workspace composite keys, foreign keys, unique provider/idempotency identities, state checks, optimistic versions, indexes by tenant/status/time, migration tests, backup/restore, and retention deletion.

## 33. Frontend implementation plan

Split the large workspace client into route-level screens and a typed API client; mount canonical panels once; add profile correction, opportunity, approval revision, job state, connector capability, lead conversation, attribution explanation, and lesson-review screens. Add error boundaries per route, accessible live regions, focus restoration, mobile tables/cards, and a Playwright/axe/visual suite. Show only verified runtime capability labels.

## 34. Backend implementation plan

First close authorization and audit invariants; then add durable job/lease/outbox orchestration; then ingestion manifests and graph persistence; then Resend lead capture, Gmail replies, Stripe customer linkage, attribution, and learning. Extract services from routes, centralize safe errors/context/policy, and make critical mutation+audit writes atomic. Keep Worker-compatible HTTP integrations.

## 35. AI/agent implementation plan

Replace the one monolithic synthesis with versioned structured stages only after deterministic ingestion exists. Require evidence IDs per assertion, abstention/unknown states, prompt injection isolation, model routing/cost limits, cached deterministic extractors, evaluation sets, calibration metrics, traceable tool calls, memory write proposals, and human approval for strategic or external changes.

## 36. Data ingestion plan

Create an ingestion resource and durable stages: validate, DNS/egress policy, robots decision, fetch root, select same-origin high-value pages, bounded crawl, sanitize, extract deterministic signals, synthesize assertions, persist, review. Limit host concurrency, redirects, pages, bytes, decompression, MIME, time, and retries. Store manifests/hashes/freshness, not unnecessary raw content. Revalidate every redirect and resolved address.

## 37. Workflow and job architecture

Add `jobs` with type/state/payload reference/attempt/not-before/lease owner/lease expiry/idempotency/error/correlation; transactional outbox for commands; provider inbox for webhooks; scheduled Worker consumer; exponential jitter; dead-letter/operator recovery; heartbeat and lease stealing; per-workspace fairness/budgets; cancellation before side effects; and reconciliation for unknown results. States: proposed, awaiting approval, approved, scheduled, queued, running, succeeded, partially succeeded, failed, retrying, blocked, simulated, cancelled, expired, reconnect/human required.

## 38. Security architecture

Threat controls: trusted control-plane auth plus membership RBAC; tenant-scoped repositories and isolation tests; encrypted/reference-only OAuth secrets; PKCE/state/nonce and least scopes; DNS-aware SSRF/redirect/robots policy; prompt-injection data boundaries; content/PII minimization; consent/suppression/frequency limits; signed timestamped webhooks and replay dedupe; exact approvals/budgets; immutable receipts; rate/abuse limits; retention/export/delete; safe errors; dependency scanning; CSP/security headers; and incident/runbook ownership. Fail closed on uncertainty.

## 39. Observability strategy

Instrument request/job/provider spans with OpenTelemetry-compatible IDs; RED metrics for APIs and jobs; connector success/rate-limit/unknown-result metrics; webhook lag/dedupe/reconciliation; model latency/tokens/cost/schema/citation/calibration; attribution completeness; and trust counters. Add SLOs, symptom-based alerts, redacted structured logs, dashboard/runbook links, and audit/evidence correlation. Never log secrets, approved bodies, lead PII, or raw payment payloads by default.

## 40. Testing strategy

Retain the broad pure suite but rebalance toward runtime confidence: repository integration against migrated D1, route contract tests, membership/isolation matrices, action concurrency/idempotency, lease/retry/dead-letter, signed webhook/replay/order, provider sandbox contract, SSRF/DNS/prompt-injection corpora, AI fixture/eval/regression, Playwright golden path, axe/keyboard/mobile/visual, migration/backup/restore, load and chaos. Enforce coverage on critical services rather than rewarding utility-test volume.

## 41. Deployment strategy

Continue Sites/Cloudflare for the pilot with additive D1 migrations, environment-specific secrets, test/live provider separation, preview smoke tests, migration preflight, canary flags, per-capability kill switches, and automatic rollback to prior Worker code. Database rollback is forward-fix/restore, so destructive migrations require backup and rehearsal. CI must run on the active delivery branch or PR, not only `main`.

## 42. Product roadmap

Wave 0 corrects truth, identity, policy, jobs, observability, tests, and docs. Wave 1 proves URL-to-payment with Resend, Gmail, Stripe, attribution, and evidence. Wave 2 adds opportunity intelligence, AI COO, experiments, and learning. Wave 3 adds one connector at a time after conformance. Wave 4 adds agency/multi-brand, billing, advanced revenue intelligence, and earned autonomy.

## 43. Wave-by-wave implementation plan

| Wave | Objective/user value | Stories/deliverables | Dependencies/risks | Demo/gate/metrics/rollback |
| --- | --- | --- | --- | --- |
| 0 | Trustworthy foundation | P0 identity, RBAC, policy, audit, jobs, safe errors, DNS ingestion, design/test/telemetry | Identity decision; migration risk | Member isolation + durable retry demo; zero approval/leak failures; flags disable new paths |
| 1 | First verified customer path | DOS-001–016, 030–033, 041–052, 061–077; profile, Resend, lead, Gmail, Stripe, attribution | Provider credentials/review, consent | Full golden path; real receipts and replay safety; adapter kill switches and simulation fallback |
| 2 | Better decisions over time | DOS-017–029, 038–040, 053–060, 068–069, 080–081 | Wave 1 evidence volume; AI quality | Cited COO proposal → experiment → reviewed lesson; pin prior prompt/score and disable writes |
| 3 | Safe channel expansion | Provider derivatives of 030–033/071–074 | API terms/access and 30-day reliability | One new adapter passes conformance/live canary; capability kill switch |
| 4 | Commercial scale | Agency hierarchy, billing, portfolio analytics, advanced autonomy | Retention, DR, governance maturity | Two isolated client workspaces and delegated approval; demote autonomy/disable portfolio actions |

Every wave gate includes user value, technical deliverables, security review, migration/rollback, demo, SLOs, analytics quality, and a decision to continue, revise, or stop.

## 44. Prioritised backlog

Must/P0: membership authorization; exact approval/audit; durable jobs; safe crawl; editable profile; one executable UI action; consented lead; Gmail reply; Stripe customer/payment; attribution trace; evidence/lesson. Should/P1: opportunities, AI COO, analytics connector, connector health, notifications, billing visibility. Could/P2: extra content/experiment intelligence and a proven second channel. Not now/P3: connector breadth, mass outreach, ads, marketplace, advanced causality, enterprise customization.

## 45. Risks and mitigations

Generic AI → evidence IDs/evals/abstention. False execution → receipt-only success. Cross-tenant leak → membership-aware scoped repositories and stop-ship tests. Spam → consent/suppression/frequency/reputation circuit breakers. Duplicate effects → outbox/inbox/idempotency/reconciliation. Attribution overclaim → confidence factors/unattributed visibility. Scope explosion → wave gates. D1 limits → measured migration trigger. Provider drift → manifests/conformance/canaries. Cost/latency → routing/budgets/cache. Audit gaps → atomic critical ledger writes.

## 46. MVP definition

A new founder submits a safe public URL, corrects an evidence-linked profile, selects a scored opportunity, approves an exact consented Resend action, captures a lead, approves/sends a Gmail follow-up, records a reply, receives a signed Stripe payment, inspects first/last attribution with confidence, and approves a cited lesson. Five pilots complete it with zero tenant, approval, duplicate, suppression, or false-success incidents.

## 47. Production-readiness definition

Real-provider acceptance and failure tests; security/privacy threat-model signoff; membership isolation; durable retries/reconciliation; migrations/backup/restore/rollback; SLO/dashboard/alerts/runbook/on-call; AI eval/calibration/cost gates; accessible E2E; provider terms and revoke/delete; no Sev-1/2 or bypass of identity, approval, suppression, budget, or payment truth.

## 48. Golden-path demo script

Submit safe URL and block private URL; inspect crawl/evidence and correct profile; review opportunity and experiment; generate claim-checked message; invalidate approval by editing then approve exact payload; execute Resend and distinguish accepted/delivered; capture consented lead/UTM; Gmail follow-up/reply/unsubscribe; Stripe test payment/replay/refund; explain attribution; ask AI COO for a cited proposed lesson; trace and export the entire chain.

## 49. Product metrics

Activation: URL success, profile confirmed, opportunity reviewed, first approval. Engagement: weekly active workspaces, actions reviewed, experiments completed, leads processed. Distribution: receipt-backed actions, qualified reach/clicks/replies. Commercial: qualified leads, meetings, customers, verified payments, attributable net revenue, CAC, conversion, time to payment. Trust: false claims, approval violations, duplicates, suppressed sends, tenant incidents, job/provider reliability, attribution completeness, corrections, recommendation acceptance. Every metric includes owner, definition version, denominator, freshness, and real/simulated dimension.

## 50. Open questions

Choose initial ICP/offer; decide D1-to-Postgres trigger; confirm identity/membership model; secure Resend/Stripe/Gmail test and production approvals; choose PostHog versus GA4; define consent geography/retention; define attribution confidence threshold; establish autonomy promotion/demotion thresholds; set pilot pricing and supported currencies; define support break-glass policy.

## 51. Final recommended execution order

1. Merge truthful capability labels and real Versions view.
2. Make membership/RBAC and critical audit writes authoritative.
3. Add durable jobs/leases/outbox/inbox and reconciliation.
4. Harden ingestion with DNS/robots/manifests and editable assertions.
5. Make the generated first action a consented, UI-executable Resend experiment.
6. Add lead capture, suppression, Gmail follow-up/reply correlation.
7. Link Stripe customer/payment/refund events to lead and experiment.
8. Produce attribution explanations and approval-gated lessons.
9. Run five real pilot workspaces and repair the weakest conversion step.
10. Add Opportunity Engine/AI COO depth, then one new connector only after gates pass.
