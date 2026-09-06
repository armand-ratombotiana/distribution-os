# Distribution OS — Product and Implementation Specification

**Status:** Delivery baseline

**Version:** 1.0

**Date:** 2026-09-06

**Owner:** Product and Engineering

**North-star outcome:** first attributable, provider-verified payment
**Runtime truth source:** [`CURRENT_STATE.md`](CURRENT_STATE.md)

> This document defines the target product and the backlog needed to reach it. It does not override runtime truth. At this baseline, URL ingestion, a durable mission graph, governed actions, a narrow Resend email adapter, signed Resend events, and signed Stripe payment events exist. Social publishing, OAuth connector installations, durable autonomous jobs, reply correlation, and the multi-agent workforce are not yet production capabilities.

## 1. Executive product definition

Distribution OS is a governed commercial operating system that converts one public website URL into a continuously improving path to qualified demand and verified revenue. It observes a business, separates facts from assumptions, recommends the highest-value next move, obtains the required human approval, executes only through a proven connector, measures the real provider outcome, attributes commercial value, and changes future decisions from evidence.

The first sellable product is deliberately narrow: a founder submits a website, confirms the generated business profile, reviews one evidence-backed opportunity, approves one compliant distribution action, captures a lead, follows up through Gmail, and sees a Stripe payment tied back to that action with an explicit confidence score. Time-to-first-value is under 15 minutes; time-to-first-approved-action is under 30 minutes for a complete website.

The product contract is:

1. Never present inference as fact.
2. Never present preparation, simulation, provider acceptance, delivery, conversion, or payment as the same event.
3. Never execute outside tenant, role, policy, budget, consent, and connector capability boundaries.
4. Make every recommendation answer “why this, why now, based on what, with what risk, and how will success be measured?”
5. Optimize for verified commercial learning, not agent activity or content volume.

## 2. Vision and philosophy

The destination is a system in which a small team can operate with the commercial discipline of an excellent growth organization without surrendering control. Distribution is treated as a linked causal system: product understanding → audience → positioning → channel → message → interaction → lead → conversation → offer → payment → retention → learning.

The governing laws are revenue as truth, evidence before confidence, earned autonomy, truthful execution, one verified path before connector breadth, deterministic control of identity and money, and reversible human-governed actions. Autonomy progresses per capability—not per workspace marketing label—from Assistant, to Copilot, to Autonomous Operator, to Strategic Partner. Promotion requires sufficient sample size, acceptable failure and complaint rates, calibrated confidence, explicit policy, and an owner decision. Downgrade is automatic when controls fail.

## 3. Problem statement

Builders can create software faster than they can learn whom it is for, earn attention, conduct compliant outreach, or prove why someone paid. Their work is split among generic AI chats, documents, schedulers, analytics, CRMs, inboxes, and payment dashboards. This causes slow activation, unsupported positioning, untracked actions, lost leads, weak follow-up, ambiguous attribution, and repeated campaigns that learn nothing.

Distribution OS resolves that fragmentation around a single commercial mission and evidence ledger. The user problem is not “make content”; it is “choose and complete the next best safe action, then know whether it created business value.” The business value is shorter time to first customer, higher conversion per unit effort, lower waste, stronger trust, and compounding proprietary learning.

## 4. Target users

| Persona | Pain and desired outcome | Core jobs/workflows | Permissions | Success metrics | Friction and risks |
| --- | --- | --- | --- | --- | --- |
| Solo builder | No GTM expertise or time; wants first customer | Confirm profile, select opportunity, approve content/follow-up | Workspace owner | Time to first action/customer, attributable revenue | Overtrusting AI; thin data; channel bans |
| Indie hacker | Scattered launch tactics; wants repeatable demand | Run small experiments, compare messages, learn fast | Owner/admin | Experiment velocity, lead rate, CAC | Vanity metrics; tiny samples |
| Startup founder | Unclear ICP/positioning; wants pipeline evidence | Review strategic brief, allocate budget, inspect revenue truth | Owner/approver | Qualified pipeline, payment conversion | Premature scaling; false certainty |
| Small business owner | Low technical capacity; wants booked work/sales | Guided onboarding, local offer, lead response | Owner/operator | Replies, bookings, collected revenue | Consent, local claims, setup complexity |
| Marketing manager | Manual coordination; wants governed execution | Plan campaign, approve assets, review outcomes | Admin/approver | Campaign conversion, cycle time, spend efficiency | Brand risk; attribution gaps |
| Growth operator | Slow experimentation; wants fast causal learning | Create hypotheses, variants, kill rules, analysis | Operator | Experiments/week, win rate, incremental revenue | Contamination; weak denominators |
| Agency owner | Many clients; wants safe scalable delivery | Create client workspaces, policy templates, portfolio view | Org owner | Client activation, retention, margin | Cross-client leakage; approval ambiguity |
| Agency member | Context switching; wants clear tasks | Draft, request approval, resolve blockers | Member/operator per client | Turnaround time, approval acceptance | Wrong brand/workspace action |
| Sales operator | Leads lack context; wants prioritized follow-up | Qualify, assign, draft/send Gmail, track replies | Sales operator | Reply, meeting, close rate | Spam, stale intent, duplicate contact |
| Content strategist | Generic briefs; wants evidence-grounded content | Strategy, claim review, channel variants | Editor/approver | Approved content conversion, reuse | Unsupported claims; voice drift |
| Executive/business owner | Cannot see revenue causality; wants decision clarity | View Mission Control, approve spend/strategy | Owner/viewer/approver | Verified revenue, payback, forecast quality | Metric overload; misleading attribution |
| Platform administrator | Operational/security risk; wants reliable tenancy | Audit, incident response, connector controls | Platform admin, no implicit tenant content access | SLOs, incidents, recovery time | Privilege abuse; secret exposure |

## 5. Jobs to be done

When I have built a product but do not know the best distribution move, help me turn public evidence into an editable commercial model so I can act without weeks of research. When several tactics look plausible, rank them by expected revenue, effort, confidence, and risk so I can spend scarce time well. When an action can affect customers, reputation, or money, show the exact payload and obtain the right approval. When an action runs, prove what the external provider accepted and what actually occurred. When a lead engages, help me respond personally and lawfully before intent decays. When money arrives, connect it to the originating evidence, experiment, action, and touchpoints without overstating causality. When results disappoint, extract a bounded lesson and propose the smallest next change.

## 6. Product principles

- **Outcome chain over output:** every plan names the expected link from action to qualified attention, lead, conversation, conversion, or revenue.
- **Evidence classes:** `observed`, `inferred`, `user_confirmed`, `provider_verified`, and `contradicted` are visually and computationally distinct.
- **Exact-payload approval:** changing recipient, copy, schedule, audience, channel, or spend invalidates approval.
- **Fail closed:** missing capability, unhealthy connector, stale approval, uncertain provider result, or exhausted budget produces a truthful blocked state.
- **Progressive disclosure:** present the decision first; reveal score components, evidence, provenance, and raw events on demand.
- **Calibrated AI:** confidence is a measured probability band with evidence coverage, freshness, and known unknowns—not decorative precision.
- **Tenant-first design:** workspace identity is derived server-side and included in every key, query, event, trace, and storage policy.
- **Smallest learning unit:** prefer one channel, one audience, one hypothesis, and one primary metric until the causal chain works.

## 7. Product boundaries

### Must have

Safe URL ingestion; editable/confirmable business profile; shared graph and evidence; opportunity scoring; one content/outreach action; exact approval; Gmail send and reply correlation; Stripe payment verification; first-touch/last-touch evidence with confidence; durable jobs; Mission Control; RBAC; budgets; audit; notifications; analytics instrumentation.

### Should have

Google Analytics or PostHog, Search Console, one compliant primary distribution channel selected after an API/terms feasibility spike, A/B experiments, content claim checks, model evaluations, agency roles, connector health, export/deletion, and basic billing.

### Could have

Additional social channels, CRM sync, advanced multi-touch models, multi-brand portfolios, ad platforms, semantic vector retrieval, video/image generation, and autonomy level 3 for low-risk workflows.

### Won't have yet

Agent marketplace, mass cold outreach, purchased lead lists, engagement automation, autonomous ad buying, automatic high-risk strategy changes, opaque “AI attribution,” unverified scraping of gated/private content, financial custody, full CRM replacement, or a connector labeled supported before production contract tests and provider receipts pass.

## 8. Golden user journey

1. **Enter URL:** Landing page accepts one HTTPS URL and explains public-data use. Client validation is advisory; server canonicalizes and validates.
2. **Ingest safely:** A bounded crawl resolves DNS for every redirect, blocks private/reserved ranges, restricts content types/size/pages/time, sanitizes HTML, stores hashes, and treats page instructions as hostile data.
3. **Understand:** Structured extraction produces product, offer, audience, problems, category, alternatives, pricing, CTAs, conversion paths, opportunities, unknowns, assumptions, confidence, and evidence references.
4. **Confirm:** The user corrects or confirms material fields. Inferences do not become `user_confirmed` without an attributable edit/confirmation event.
5. **Create workspace:** Mission Control opens with a persisted graph, brief, next actions, integration checklist, and ingestion evidence. Partial creation is compensated or resumed idempotently.
6. **Detect opportunity:** The system ranks bounded opportunities using audience fit, pain, channel fit, competition, timing, effort, expected conversion/revenue, confidence, and risk.
7. **Plan:** The selected opportunity becomes an experiment with objective, hypothesis, audience, channel, asset/offer, CTA, owner, budget, timeline, expected result, approval policy, denominator, instrumentation, and kill rule.
8. **Approve:** The authorized approver sees exact payload, evidence, risks, cost ceiling, schedule, and policy checks. Approval expires and is invalidated by mutation.
9. **Act:** A durable job executes through a capability-tested connector. State moves through `approved → queued → running → succeeded|failed|blocked|partially_completed|requires_reconnection`; simulation uses a separate terminal state.
10. **Measure and learn:** Provider events create deduplicated touchpoints. Leads and Gmail replies update lifecycle. Signed Stripe events verify revenue. Attribution explains its model and confidence. The experiment records a decision and bounded lesson; a proposed profile/strategy change again requires confirmation or approval.

**Golden-path acceptance:** a reviewer can trace one verified payment backward through customer/lead, touchpoints, Gmail thread, campaign/experiment, approved payload, opportunity, strategy, profile assertions, and source evidence without crossing a tenant or encountering a fabricated execution state.

## 9. Product operating loop

| Stage | User question | System artifact | Exit gate |
| --- | --- | --- | --- |
| Observe | What is happening? | Evidence and events | Source, time, tenant, hash recorded |
| Understand | Why might it be happening? | Graph assertions and brief | Facts/inferences separated; unknowns visible |
| Detect | Where is leverage? | Ranked opportunity | Score components, freshness, risk present |
| Decide | What should we test? | Versioned plan/experiment | Metric, denominator, budget, kill rule set |
| Approve | May this exact action run? | Immutable approval | Role/policy/payload hash/expiry valid |
| Act | What really ran? | Job attempt and provider receipt | Capability, idempotency, final/ambiguous state recorded |
| Measure | What outcome occurred? | Touchpoint/outcome/payment | Provider or declared source and confidence |
| Learn | What changed our belief? | Lesson and decision | Result vs hypothesis, limitations recorded |
| Improve | What changes next? | Proposed strategy/graph version | Human approval for material changes |

## 10. Product architecture

```text
Web / mobile-responsive Next.js UI
        |
        v
Tenant-aware application API (current: Next.js route handlers; versioned /api/v1 target)
  | identity/RBAC | policy/budget | validation | command/query separation
        |
        +--> PostgreSQL transactional truth + immutable evidence/audit partitions
        +--> Outbox --> durable workflow workers --> connector adapters
        +--> Object storage for bounded source artifacts
        +--> Redis for leases, rate limits, short-lived cache (never source of truth)
        +--> Strategic Brain/model gateway --> retrieval/tools/structured outputs/evals
        +--> Webhook inbox --> signature/dedupe/linkage --> domain events
        +--> OpenTelemetry --> metrics/logs/traces --> Prometheus/Grafana
```

**Evolution decision.** The current Next.js/TypeScript + Cloudflare D1 implementation remains the delivery base for Wave 0–1 validation. Add durable Cloudflare Queues/Workflows or an equivalent lease-backed worker before autonomous execution. Move transactional truth to PostgreSQL when concurrency, relational querying, or row-level security requires it. Introduce Python/FastAPI as an internal intelligence/worker service for evaluation, research, and ML libraries; do not split the request path merely to match a preferred stack. Contracts, outbox events, tenant rules, and state machines remain portable.

**Strategic Brain:** generates validated interpretations, opportunities, experiments, and recommendations. It cannot approve, spend, change authoritative records silently, or call external connectors directly.

**Distribution Fabric:** capability registry, OAuth lifecycle, scheduler, workflow runtime, webhooks, idempotency, retries, rate limits, receipts, and synchronization. Deterministic code owns state transitions.

**Business Graph:** relational graph of business, product, offer, audience, segment, persona, competitor, market, channel, content, campaign, experiment, lead, customer, conversation, payment, event, decision, outcome, assumption, and evidence. Graph edges are typed, temporal, tenant-scoped, and attributable.

**Evidence Ledger:** append-only observations, recommendations, decisions, approvals, execution attempts, outcomes, and corrections. Payloads may be encrypted/redacted, but hashes, provenance, timestamps, actors, and tombstone/audit semantics remain.

**MCP boundary:** MCP advertises tools and schemas to agents. The application still authenticates the caller, resolves tenant, checks authorization/policy/budget, validates inputs, issues idempotency keys, executes workflows, stores secrets, and audits results. An MCP tool result is not proof of business success without provider evidence.

## 11. Domain model

The aggregate path is `Organization → Workspace → Mission → StrategyVersion → Opportunity → Campaign/Experiment → ContentAsset → Action → ExecutionAttempt → Touchpoint → Lead/Conversation/Customer → Payment → Attribution → Lesson`.

| Aggregate/entity | Required invariants |
| --- | --- |
| Organization/workspace | One tenant boundary; membership role and status; no client-supplied workspace authority |
| Business graph node/edge | `workspace_id`, type, canonical data, evidence refs, confidence, validity interval, version; no dangling cross-tenant edge |
| Evidence | Immutable body/hash/source/observed time/ingested time/classification; corrections are new records linked by relation |
| Opportunity | Versioned score and component inputs; evidence set; status and dismissal reason |
| Campaign/experiment | One primary hypothesis and metric; denominator, baseline, target, window, budget, owner, kill rule |
| Content/action | Mutable draft; immutable approved snapshot/payload hash; explicit simulation/execution states |
| Job/attempt | Unique idempotency key, lease owner/expiry, attempt number, retry class, provider request/receipt, ambiguity state |
| Lead/customer/conversation | Lawful source, consent/legal basis, lifecycle, owner, suppression state, thread/provider identifiers |
| Payment | Provider event identity, amount/currency/status, signed-event receipt, refund lineage; no AI-created payment |
| Attribution | Model/version, touchpoint set, confidence band, reasons, exclusions; attribution never alters payment truth |
| Agent run/memory | Agent/prompt/model versions, scoped input/output refs, tool calls, cost, latency, status; memory provenance and expiry |

## 12. Information architecture

| Screen | Goal and CTA | Hierarchy/actions | Required states | Mobile/accessibility |
| --- | --- | --- | --- | --- |
| Mission Control | Choose next best action; **Review next action** | Revenue truth → mission stage → recommendation → blockers/jobs → activity | First-run checklist; skeleton; degraded data; verified success; blocked; approval card | Single-column cards; sticky action; semantic headings/live job announcements |
| Intelligence | Confirm business understanding; **Review profile** | Confirmed facts → assumptions/unknowns → market/audience → evidence | No crawl; extracting; stale/contradicted; saved version | Field accordions; evidence drawer; keyboard diff controls |
| Opportunities | Select leverage; **Create experiment** | Ranked queue → score explanation → brief/outcomes | No qualified opportunity; rescoring; stale inputs; dismissed | Sort/filter sheet; non-color score labels |
| Content | Produce compliant asset; **Generate draft** | Strategy → drafts → claim/evidence panel → variants/performance | Empty; generating; validation error; review/approved/scheduled/published/simulated | Preview tabs; textarea labels; character counts announced |
| Campaigns | Coordinate delivery; **Create campaign** | Objective/status → actions → budget → results | Draft/approval/running/paused/complete/failed | Condensed timeline; touch targets ≥44px |
| Experiments | Reach a decision; **Start experiment** | Hypothesis → metric/denominator → variants → result/lesson | Insufficient sample; instrument missing; killed/won/lost/inconclusive | Comparison cards/table alternative |
| Leads | Work highest-intent lead; **Draft follow-up** | Queue → identity/consent → timeline → next task | Empty/importing/duplicate/suppressed/unsubscribed | Master-detail becomes routes; focus management |
| Revenue | See commercial truth; **Resolve discrepancy** | Verified total → payments/refunds → attribution → reconciliation | No Stripe; syncing; delayed/failed webhook; unattributed | Compact currency list; accessible chart table |
| Analytics | Explain change; **Inspect driver** | Funnel → trends → segments → data quality | No tracking; partial data; stale connector | Responsive charts with textual summaries |
| Connectors | Enable a capability; **Connect** | Required golden path → installed → catalog → logs/scopes | Setup required/OAuth/healthy/degraded/expired/rate-limited/disconnected/simulation | Step-based OAuth return; status text/icons |
| AI Workforce | Govern agent work; **Review task** | Active runs → requests → specialists → history/cost | No delegated agents; running/failed/cancelled/blocked | Timeline list; pause button keyboard operable |
| Agent Memory | Inspect/change remembered context; **Confirm memory** | Confirmed → inferred → expired/conflicting → run lineage | Empty/indexing/stale/redacted | Search-first list; provenance dialog |
| Evidence Ledger | Prove a claim/action; **Inspect provenance** | Filters → chronological immutable entries → raw proof/export | Empty/loading/hash mismatch/retention hold | Table-to-cards; downloadable accessible CSV/JSON |
| Settings | Control workspace; **Save policy** | Members/roles → approvals → budgets/channels → data/billing | Unsaved/saving/conflict/forbidden/saved | Form sections; inline errors and summary |

Global navigation uses the required labels in this order: Mission Control, Intelligence, Opportunities, Content, Campaigns, Experiments, Leads, Revenue, Analytics, Connectors, AI Workforce, Agent Memory, Evidence Ledger, Settings. A command palette, breadcrumbs, global tenant switcher, notification center, job drawer, and “simulation” environment badge are persistent. Motion respects `prefers-reduced-motion`; color is never the sole status signal; all dialogs trap/restore focus; date, currency, and number formats use workspace locale.

## 13. Feature map

| Product area | Smallest valuable version | Excluded until proven | Primary outcome |
| --- | --- | --- | --- |
| Landing/onboarding | One URL, progress, profile confirmation, checklist | Questionnaire-first onboarding | Activation |
| Website intelligence | Safe bounded crawl and structured evidence | Broad web scraping/private pages | Trusted understanding |
| Business Graph | Versioned nodes/edges/assertions | Free-form knowledge graph editor | Reusable context |
| Mission Control | Next action, blockers, jobs, verified revenue | Generic dashboard widgets | Decision speed |
| Strategic Intelligence | Brief, audiences, positioning with evidence | Autonomous strategy replacement | Better decisions |
| Opportunity Engine | Explainable rank/brief/experiment conversion | Unlimited speculative ideas | Learning/revenue potential |
| Content OS | Evidence-grounded one-channel variants | Full creative suite | Qualified engagement |
| Distribution | One proven adapter and truthful states | Catalog breadth without execution | Reliable action |
| Campaigns/experiments | Hypothesis-to-decision record | Enterprise MMM | Causal learning |
| Leads/Gmail | Consent-aware capture, reply, follow-up | Cold batch sequencer | Conversations |
| Revenue/attribution | Signed Stripe truth and explainable links | AI-estimated revenue | Verified payment |
| Analytics | Funnel and data-quality visibility | Vanity metric warehouse | Diagnosis |
| AI Workforce/memory | Governed specialist runs and cited memory | Anthropomorphic agent theater | Leverage with control |
| Connectors/policies/evidence | Capability contracts, exact approval, immutable audit | MCP as security boundary | Trust |
| Workspace/billing/security/admin | RBAC, tenant controls, usage, operations | Complex enterprise hierarchy | Safe scale |
| Self-improvement | Bounded lessons and approved strategy proposals | Self-modifying production code/prompts | Compounding performance |

## 14. User stories

The backlog contains 84 stories. Each is independently demonstrable where dependencies allow. `M0–M4` map to Waves 0–4. Complexity uses S (≤3 engineer-days), M (≤1 sprint), L (2–3 sprints), XL (must be split during refinement). All externally visible states use the canonical state vocabulary; all mutations emit tenant-scoped audit and product analytics events unless explicitly noted.

### Landing and onboarding

#### DOS-001 — Submit and validate a website URL

- **ID:** DOS-001
- **Epic:** Landing and onboarding
- **Priority:** P0
- **Persona:** Solo builder
- **User story:** As a solo builder, I want to submit one website URL, so that I receive useful commercial analysis without configuring a complex system.
- **Business problem:** High setup friction prevents users from reaching value.
- **Expected outcome:** A valid public HTTPS site begins ingestion in ≤2 seconds and activation is attributable to the landing source.
- **Acceptance criteria:** Server canonicalizes URL; only HTTP(S) input is accepted and HTTPS is preferred; DNS/IP/redirect policy passes before fetch; duplicate submission offers resume/reanalyse; consent copy is visible; response returns `202`, `ingestion_id`, `status`, and status URL.
- **Happy path:** User pastes URL, sees normalized domain, submits, and enters progress view.
- **Alternative paths:** Add missing scheme; resume a recent incomplete ingestion; intentionally create a new analysis version.
- **Failure states:** Invalid syntax, credentials in URL, non-public host, rate limit, duplicate running job, service unavailable.
- **Permissions:** Anonymous may validate; authenticated user creates/resumes; workspace is resolved server-side.
- **Data required:** Raw/canonical URL, referral/UTM, consent timestamp, identity, request correlation ID.
- **API/backend work:** `POST /api/v1/ingestions`; canonicalizer; SSRF preflight; idempotency on user+canonical URL+time window.
- **Frontend/UI work:** Single-field hero form, inline validation, privacy note, disabled/submitting/error states.
- **AI/agent work:** None before fetch.
- **Workflow/job work:** Enqueue only after authorization and validation commit.
- **Security considerations:** SSRF, Unicode hostname confusion, DNS rebinding, redirect validation, per-IP/user throttles.
- **Analytics events:** `landing_url_entered`, `url_validation_failed`, `ingestion_requested` with no query-string secrets.
- **Definition of done:** Unit/fuzz/security/E2E tests pass; logs contain correlation not raw sensitive query data; p95 submit latency ≤500 ms excluding auth.
- **Dependencies:** DOS-061, DOS-073.
- **Estimated complexity:** M
- **Release milestone:** M1

#### DOS-002 — Follow truthful ingestion progress

- **ID:** DOS-002
- **Epic:** Landing and onboarding
- **Priority:** P0
- **Persona:** Startup founder
- **User story:** As a startup founder, I want to see real ingestion progress, so that I know whether the system is working and can recover from a delay.
- **Business problem:** Indeterminate AI loading erodes trust and causes duplicate submissions.
- **Expected outcome:** Users understand completed, active, blocked, failed, and retryable stages; abandonment during ingestion is <15%.
- **Acceptance criteria:** UI reflects persisted stages `validating`, `fetching`, `extracting`, `synthesizing`, `persisting`, `complete`; percent is stage-weighted, never fabricated; last heartbeat and mode are shown; refresh/reconnect resumes; terminal error includes safe next action.
- **Happy path:** SSE updates stages and routes to profile review on completion.
- **Alternative paths:** Poll after SSE loss; close and resume from onboarding; simulation is clearly labeled.
- **Failure states:** Lease expired, crawl partial, model timeout, artifact compensation, auth loss.
- **Permissions:** Ingestion owner or workspace member with view permission.
- **Data required:** Ingestion/run/stage records, heartbeat, attempt, error class, simulation flag.
- **API/backend work:** `GET /api/v1/ingestions/{id}` and authenticated event stream; tenant recheck per poll.
- **Frontend/UI work:** Accessible stepper, elapsed time, retry/help actions, `aria-live=polite` status.
- **AI/agent work:** Emit structured run metadata only; no prose progress fiction.
- **Workflow/job work:** Stage events and heartbeat; stale-run detector.
- **Security considerations:** Opaque IDs; sanitized errors; stream authorization throughout connection.
- **Analytics events:** `ingestion_stage_viewed`, `ingestion_resumed`, `ingestion_failed`, `ingestion_completed`.
- **Definition of done:** Forced disconnect, reload, timeout, partial crawl, and simulation E2Es show exact durable state.
- **Dependencies:** DOS-001, DOS-070.
- **Estimated complexity:** M
- **Release milestone:** M1

#### DOS-003 — Recover from an inaccessible or unsuitable website

- **ID:** DOS-003
- **Epic:** Landing and onboarding
- **Priority:** P0
- **Persona:** Small business owner
- **User story:** As a small business owner, I want a clear recovery path when my website cannot be analysed, so that I can still reach a useful profile.
- **Business problem:** Blocks, JavaScript-only pages, sparse sites, and outages otherwise terminate activation.
- **Expected outcome:** ≥60% of safe ingestion failures recover through retry, alternate public page, or bounded manual profile.
- **Acceptance criteria:** Classify `inaccessible`, `robots_blocked`, `unsupported_content`, `unsafe_target`, `too_large`, `insufficient_evidence`, and `transient`; never bypass robots/auth; offer retry only for retryable errors; manual path marks fields user-supplied; no workspace is presented as fully analysed when crawl failed.
- **Happy path:** User supplies a public pricing/about page and resumes.
- **Alternative paths:** Enter product, audience, offer, and CTA manually; save draft and return.
- **Failure states:** Repeated unsafe URL, quota exhausted, unsupported language/file, manual validation error.
- **Permissions:** Creator can recover; members require create-mission permission.
- **Data required:** Safe error class, attempt history, alternate URL, manual source attribution.
- **API/backend work:** Recovery command and partial-profile schema; retry-after response.
- **Frontend/UI work:** Cause-specific error panel; manual minimum form; support link.
- **AI/agent work:** Synthesize only from available labeled sources; lower confidence.
- **Workflow/job work:** Exponential retry for transient fetch failures only.
- **Security considerations:** Never ask for passwords or private-page exports; scan uploaded fallback if later allowed.
- **Analytics events:** `ingestion_recovery_offered`, `alternate_url_submitted`, `manual_profile_started/completed`.
- **Definition of done:** Fixture suite for every class; copy and allowed action match retry policy.
- **Dependencies:** DOS-001, DOS-006.
- **Estimated complexity:** M
- **Release milestone:** M1

#### DOS-004 — Create and complete a workspace checklist

- **ID:** DOS-004
- **Epic:** Landing and onboarding
- **Priority:** P0
- **Persona:** Indie hacker
- **User story:** As an indie hacker, I want a ready workspace and short checklist after analysis, so that I can reach my first approved action quickly.
- **Business problem:** Analysis without a guided next step produces insight but no distribution.
- **Expected outcome:** ≥50% of analysed workspaces confirm profile and review an opportunity in the same session.
- **Acceptance criteria:** Workspace/mission/initial artifacts are atomically created or compensatingly removed; checklist includes profile confirmation, opportunity review, measurement connection, Gmail connection, Stripe connection, and first approval; unavailable capabilities say why; completion derives from records, not user toggles.
- **Happy path:** Analysis completes, Mission Control opens, user follows contextual CTAs.
- **Alternative paths:** Skip optional connectors; invite an approver; remain in simulation.
- **Failure states:** Persistence conflict, partial graph failure, missing identity, tenant creation limit.
- **Permissions:** Owner creates; all members view; task actions respect capability roles.
- **Data required:** Workspace, mission, checklist derivations, profile version, connector states.
- **API/backend work:** Idempotent workspace bootstrap and `GET /api/v1/onboarding/status`.
- **Frontend/UI work:** Compact progress card and resume CTA; no celebratory success before commit.
- **AI/agent work:** Recommend order based on goal and gaps; deterministic required items.
- **Workflow/job work:** Reconciliation job detects/removes orphan bootstrap artifacts.
- **Security considerations:** Tenant identifier never accepted from bootstrap body; quotas prevent workspace abuse.
- **Analytics events:** `workspace_created`, `checklist_item_completed`, `activation_milestone_reached`.
- **Definition of done:** Transaction/compensation fault tests and checklist derivation tests pass.
- **Dependencies:** DOS-002, DOS-061.
- **Estimated complexity:** L
- **Release milestone:** M1

### Website intelligence

#### DOS-005 — Crawl a public website safely

- **ID:** DOS-005
- **Epic:** Website intelligence
- **Priority:** P0
- **Persona:** Growth operator
- **User story:** As a growth operator, I want the system to gather bounded public website evidence, so that recommendations reflect the actual product.
- **Business problem:** Shallow or unsafe fetching creates poor analysis and infrastructure risk.
- **Expected outcome:** Capture relevant product/pricing/about/CTA evidence with ≥95% safe-fetch completion for eligible sites.
- **Acceptance criteria:** Re-resolve and validate every redirect; allow listed content types only; enforce page/byte/time/depth limits and robots policy; sanitize scripts/forms/comments/hidden content; store source URL, hash, timestamps, parser version, status, and extracted text; partial crawl is explicit.
- **Happy path:** Root and a bounded set of same-site high-value pages are fetched and deduplicated.
- **Alternative paths:** Sitemap guides selection; canonical link deduplicates; locale page is selected.
- **Failure states:** Private IP, rebinding, redirect loop, decompression bomb, TLS error, 429, unsupported MIME.
- **Permissions:** Service job scoped to initiating workspace; no cross-workspace cache content without safe isolation.
- **Data required:** Fetch manifest, response metadata, content hashes, redaction/security findings.
- **API/backend work:** Hardened fetch service and artifact store; egress allow policy.
- **Frontend/UI work:** Crawl coverage and partial-warning detail.
- **AI/agent work:** Treat sanitized text as quoted untrusted data, never instructions.
- **Workflow/job work:** Bounded fan-out, circuit breaker, host rate limit, retry policy.
- **Security considerations:** SSRF, prompt injection, malware, PII minimization, data poisoning.
- **Analytics events:** `crawl_started/completed/partial/blocked`, pages/bytes/duration.
- **Definition of done:** OWASP SSRF corpus, redirect/rebinding, hostile HTML, size, robots, and load tests pass.
- **Dependencies:** DOS-001, DOS-073.
- **Estimated complexity:** L
- **Release milestone:** M1

#### DOS-006 — Extract a structured business profile

- **ID:** DOS-006
- **Epic:** Website intelligence
- **Priority:** P0
- **Persona:** Startup founder
- **User story:** As a startup founder, I want an editable business profile extracted from my site, so that I can validate the system’s commercial understanding.
- **Business problem:** Unstructured page summaries cannot drive reliable strategy or automation.
- **Expected outcome:** Required profile fields are schema-valid, evidence-linked, and reviewed in ≤10 minutes.
- **Acceptance criteria:** Output includes product description, proposition, audiences, problems, category, alternatives, positioning, pricing, CTAs, conversion paths, opportunities, unknowns, assumptions, and per-assertion confidence/evidence; missing is `unknown`, never invented; schema failure retries once then returns reviewable partial output; mode/model/prompt version recorded.
- **Happy path:** Model returns valid structured output and user sees high-impact fields first.
- **Alternative paths:** Deterministic extraction supplies pricing/CTAs; simulation fixture populates clearly labeled demo values.
- **Failure states:** Insufficient evidence, conflicting price, unsupported language, model refusal/timeout/schema error.
- **Permissions:** Workspace creator starts; members with intelligence view see; editor can correct later.
- **Data required:** Sanitized evidence refs, structured assertions, confidence factors, run metadata.
- **API/backend work:** Versioned profile schema, structured-output validation, assertion persistence.
- **Frontend/UI work:** Evidence-linked review form, unknown/conflict badges, skeleton/error/partial states.
- **AI/agent work:** Evidence-bounded prompt, citations by internal evidence ID, calibration checks.
- **Workflow/job work:** Model timeout/cost guard, deterministic fallback, resumable persistence.
- **Security considerations:** Prompt injection isolation; sensitive source redaction; output encoding.
- **Analytics events:** `profile_generated`, `profile_partial`, field confidence distribution.
- **Definition of done:** Golden fixtures meet extraction rubric; every assertion references evidence or is labeled inference/unknown.
- **Dependencies:** DOS-005, DOS-077.
- **Estimated complexity:** L
- **Release milestone:** M1

#### DOS-007 — Detect pricing, CTAs, audiences, competitors, and gaps

- **ID:** DOS-007
- **Epic:** Website intelligence
- **Priority:** P1
- **Persona:** Content strategist
- **User story:** As a content strategist, I want commercial page signals and gaps identified, so that messaging recommendations address conversion barriers.
- **Business problem:** A generic description misses the offer mechanics that determine conversion.
- **Expected outcome:** The profile surfaces pricing/CTA consistency, likely audience, named alternatives, and missing trust/conversion information.
- **Acceptance criteria:** Each finding has type, severity, observed/inferred class, evidence, confidence, freshness, and suggested validation; “competitor” requires explicit evidence or is “possible alternative”; contradictory prices remain separate; gaps include no price, weak CTA, unclear audience, unsupported claim, or broken path.
- **Happy path:** Findings populate intelligence review and inform opportunity scoring.
- **Alternative paths:** No public pricing becomes an explicit unknown; user marks sales-led pricing intentional.
- **Failure states:** Ambiguous currencies, stale cache, competitor name collision, inaccessible checkout.
- **Permissions:** Viewers read; editors resolve/confirm; AI cannot silently resolve conflict.
- **Data required:** Page elements, link graph, assertions, contradiction relations, user resolutions.
- **API/backend work:** Signal detectors and `GET /api/v1/missions/{id}/findings`.
- **Frontend/UI work:** Severity filters, side-by-side evidence, confirm/dismiss actions.
- **AI/agent work:** Classify signals and explain limits; no unsourced market claim.
- **Workflow/job work:** Re-run on new crawl; invalidate affected scores.
- **Security considerations:** Links displayed safely; no competitor crawling without separate policy.
- **Analytics events:** `finding_viewed/confirmed/dismissed`, `conversion_gap_detected`.
- **Definition of done:** Precision/recall rubric passes curated fixtures; user decisions version graph.
- **Dependencies:** DOS-006, DOS-010.
- **Estimated complexity:** M
- **Release milestone:** M1

#### DOS-008 — Correct and confirm AI understanding

- **ID:** DOS-008
- **Epic:** Website intelligence
- **Priority:** P0
- **Persona:** Small business owner
- **User story:** As a small business owner, I want to correct and confirm the generated profile, so that assumptions do not become business truth.
- **Business problem:** Incorrect AI context contaminates every downstream action.
- **Expected outcome:** Material fields have explicit ownership and downstream recommendations use the latest confirmed version.
- **Acceptance criteria:** Edit records before/after, reason, actor, and timestamp; confirming changes assertion class to `user_confirmed`; material edits create a profile version and mark derived opportunities stale; conflicts use optimistic locking; undo creates a new version; profile completeness and unresolved unknowns are shown.
- **Happy path:** User edits audience and pricing, confirms, and triggers bounded re-analysis.
- **Alternative paths:** Confirm all unchanged fields; defer unknown; attach a note/source URL.
- **Failure states:** Version conflict, invalid currency/URL, unauthorized edit, resynthesis failure.
- **Permissions:** Owner/admin/editor edit; viewer read; strategic changes may require approver by policy.
- **Data required:** Profile/assertion versions, actor, evidence, dependency/staleness links.
- **API/backend work:** `PATCH /api/v1/business-profile` with ETag and confirmation command.
- **Frontend/UI work:** Autosaved draft, diff review, stale-impact warning, success/conflict states.
- **AI/agent work:** Explain inferred origin; resynthesize only affected derived artifacts.
- **Workflow/job work:** Dependency invalidation and re-score job.
- **Security considerations:** Audit all edits; sanitize user text; tenant scope/version check.
- **Analytics events:** `profile_field_edited`, `profile_confirmed`, `profile_conflict`.
- **Definition of done:** Concurrent-edit, authorization, invalidation, audit, and end-to-end reanalysis tests pass.
- **Dependencies:** DOS-006.
- **Estimated complexity:** M
- **Release milestone:** M1

### Business Graph

#### DOS-009 — View the business graph as a business profile

- **ID:** DOS-009
- **Epic:** Business Graph
- **Priority:** P0
- **Persona:** Executive
- **User story:** As an executive, I want a comprehensible view of products, offers, audiences, channels, and evidence, so that I can assess the system’s operating context.
- **Business problem:** Raw graph data is unusable for commercial review.
- **Expected outcome:** Users locate the evidence and status of any material assertion in ≤3 clicks.
- **Acceptance criteria:** Default view is a structured profile, not a node cloud; each entity shows status, confidence band, freshness, owner, evidence count, and relationships; filters include confirmed/inferred/unknown/contradicted; empty/loading/error/stale states are defined; large graphs paginate.
- **Happy path:** User opens an offer, follows “targets audience” edge, and inspects evidence.
- **Alternative paths:** Search entity; use relationship table; export selected subgraph.
- **Failure states:** Dangling evidence, stale version, access revoked mid-session, query timeout.
- **Permissions:** Tenant viewers read; sensitive lead/payment nodes require separate scopes.
- **Data required:** Nodes, edges, assertions, evidence summary, version/current flags.
- **API/backend work:** Tenant-scoped graph query with depth/page limits and field-level authorization.
- **Frontend/UI work:** Profile sections, optional relationship explorer, provenance drawer.
- **AI/agent work:** Plain-language relationship summaries must cite graph IDs.
- **Workflow/job work:** Read-model projection after graph events.
- **Security considerations:** Avoid graph traversal across workspace keys; redact restricted nodes.
- **Analytics events:** `graph_viewed`, `entity_opened`, `evidence_traversed`.
- **Definition of done:** Accessibility, 10k-node performance, field-scope, and cross-tenant tests pass.
- **Dependencies:** DOS-004, DOS-006, DOS-061.
- **Estimated complexity:** L
- **Release milestone:** M1

#### DOS-010 — Edit entities and typed relationships

- **ID:** DOS-010
- **Epic:** Business Graph
- **Priority:** P1
- **Persona:** Marketing manager
- **User story:** As a marketing manager, I want to edit entities and valid relationships, so that strategy reflects current commercial reality.
- **Business problem:** Static AI output becomes stale and cannot coordinate a team.
- **Expected outcome:** Authorized edits update dependent decisions without corrupting graph integrity.
- **Acceptance criteria:** Entity types have schemas; relationship types constrain valid source/target; dates and evidence are optional only by rule; soft archive preserves history; material edits version graph and mark dependants stale; API rejects cross-tenant/dangling/cyclic relationships where forbidden.
- **Happy path:** Manager adds an offer and links it to an audience and conversion path.
- **Alternative paths:** Merge duplicate entities; archive old offer; propose edit for approval.
- **Failure states:** ETag conflict, invalid relationship, referenced active campaign, unauthorized archive.
- **Permissions:** Editor creates/edits; owner/admin archives/merges; viewer reads.
- **Data required:** Typed nodes/edges, constraints, validity window, author, reason.
- **API/backend work:** CRUD/merge endpoints, optimistic concurrency, constraint service.
- **Frontend/UI work:** Schema-driven forms, relation picker, impact preview, diff/conflict UI.
- **AI/agent work:** Suggest relations only; never commit without user action/policy.
- **Workflow/job work:** Recompute affected profile/opportunity read models.
- **Security considerations:** Server-enforced types and tenant keys; content sanitization.
- **Analytics events:** `graph_entity_created/updated/archived`, `relationship_created`.
- **Definition of done:** Constraint, merge lineage, dependency invalidation, and audit tests pass.
- **Dependencies:** DOS-009, DOS-070.
- **Estimated complexity:** L
- **Release milestone:** M2

#### DOS-011 — Review assumptions, evidence, and contradictions

- **ID:** DOS-011
- **Epic:** Business Graph
- **Priority:** P0
- **Persona:** Startup founder
- **User story:** As a startup founder, I want assumptions and contradictory evidence surfaced, so that I can resolve the riskiest uncertainty before spending.
- **Business problem:** Hidden assumptions cause confidently wrong campaigns.
- **Expected outcome:** Every high-impact unverified assertion is visible and resolvable; no P0 action relies silently on contradicted evidence.
- **Acceptance criteria:** Assumptions rank by impact×uncertainty; evidence cards show source/freshness/provenance; contradiction pairs preserve both records; user can confirm, reject, defer, or request research; action readiness blocks when policy-defined critical assumptions remain contradicted.
- **Happy path:** User resolves target segment contradiction and dependent plan is rescored.
- **Alternative paths:** Defer low-impact assumption with review date; attach direct customer evidence.
- **Failure states:** Source unavailable, hash mismatch, research timeout, user lacks resolve permission.
- **Permissions:** Viewers inspect; editors propose; approver resolves material assertions.
- **Data required:** Assumption impact, contradiction edges, evidence class, resolution/version.
- **API/backend work:** Assumption queue, resolution command, readiness integration.
- **Frontend/UI work:** Risk-sorted inbox, compare panel, blocked-action link.
- **AI/agent work:** Explain why evidence conflicts and propose validation, with uncertainty.
- **Workflow/job work:** Freshness scan and dependent invalidation.
- **Security considerations:** Preserve immutable evidence; malware-safe source previews.
- **Analytics events:** `assumption_reviewed/resolved/deferred`, `contradiction_detected`.
- **Definition of done:** Readiness cannot pass a critical unresolved contradiction; trace test reaches source.
- **Dependencies:** DOS-008, DOS-067.
- **Estimated complexity:** M
- **Release milestone:** M1

#### DOS-012 — Track graph versions without tenant leakage

- **ID:** DOS-012
- **Epic:** Business Graph
- **Priority:** P0
- **Persona:** Agency owner
- **User story:** As an agency owner, I want tenant-safe graph history and diffs, so that I can govern client changes without mixing data.
- **Business problem:** Shared infrastructure creates severe cross-client disclosure and accountability risk.
- **Expected outcome:** Every read/write/export proves tenant membership and every graph change is reconstructable.
- **Acceptance criteria:** Composite tenant keys or RLS protect nodes/edges; all repository methods require tenant context; version diff shows actor/reason/evidence; restore creates a forward version; caches/embeddings include tenant namespace; automated canary attempts cross-tenant IDs and gets indistinguishable 404.
- **Happy path:** Owner compares versions and restores a prior positioning assertion as a new version.
- **Alternative paths:** Export a version; legal hold prevents purge; member sees permitted subset.
- **Failure states:** Missing tenant context, stale cache, version pruned by policy, restore conflicts.
- **Permissions:** Owner/admin restore/export; viewers diff allowed fields; platform admin has audited break-glass only.
- **Data required:** Version/event sequence, tenant, actor, diff, retention/hold.
- **API/backend work:** Tenant repository abstraction, RLS tests, version/diff/restore endpoints.
- **Frontend/UI work:** Timeline, semantic diff, restore confirmation and impact warning.
- **AI/agent work:** Memory retrieval must pass same tenant filters.
- **Workflow/job work:** Retention job preserves holds and tombstones.
- **Security considerations:** IDOR, cache poisoning, embedding leakage, admin break-glass.
- **Analytics events:** `graph_version_viewed/restored/exported`; security denials separately.
- **Definition of done:** Property-based tenant isolation and restore lineage tests pass in CI.
- **Dependencies:** DOS-061, DOS-069, DOS-073.
- **Estimated complexity:** L
- **Release milestone:** M0

### Mission Control

#### DOS-013 — See the current commercial state and revenue truth

- **ID:** DOS-013
- **Epic:** Mission Control
- **Priority:** P0
- **Persona:** Executive
- **User story:** As an executive, I want one current-state view tied to verified revenue, so that I can decide what deserves attention now.
- **Business problem:** Fragmented tools obscure whether work creates business value.
- **Expected outcome:** In <30 seconds, a user can state lifecycle stage, verified revenue, funnel bottleneck, and next action.
- **Acceptance criteria:** Header shows mission stage/cycle/mode/freshness; revenue separates verified, refunded, pending, and attributed; funnel denominators are visible; cards link to source records; stale/partial connectors degrade explicitly; no fabricated zero-vs-unavailable ambiguity.
- **Happy path:** User sees one payment, its attribution band, and next bottleneck.
- **Alternative paths:** No revenue shows setup or first-action CTA; multiple currencies stay separate.
- **Failure states:** Query partial, Stripe unhealthy, delayed events, authorization loss.
- **Permissions:** Viewer sees aggregate; financial detail needs revenue permission.
- **Data required:** Mission read model, funnel events, payments/refunds, connector freshness.
- **API/backend work:** `GET /api/v1/mission-control` snapshot with as-of time/data-quality flags.
- **Frontend/UI work:** High-density responsive dashboard, text alternatives for charts.
- **AI/agent work:** Summary uses only snapshot and labels inference.
- **Workflow/job work:** Incremental read-model projection and reconciliation alerts.
- **Security considerations:** Field-level financial authorization; safe cached tenant keys.
- **Analytics events:** `mission_control_viewed`, `revenue_drilldown_opened`, time-to-decision CTA.
- **Definition of done:** Data contract, accessibility, partial-data, currency, and revenue-trace E2Es pass.
- **Dependencies:** DOS-004, DOS-047, DOS-051.
- **Estimated complexity:** L
- **Release milestone:** M1

#### DOS-014 — Review and prioritize next actions

- **ID:** DOS-014
- **Epic:** Mission Control
- **Priority:** P0
- **Persona:** Growth operator
- **User story:** As a growth operator, I want a short ranked action queue with rationale, so that I spend time on the highest expected commercial value.
- **Business problem:** Long AI task lists create paralysis and diffuse learning.
- **Expected outcome:** A user accepts, edits, delegates, or dismisses a top-three action within 5 minutes.
- **Acceptance criteria:** Each card includes outcome, reason, evidence, source/freshness, confidence band, expected impact range, effort, risk, approval, dependency, and measurement; ranking formula/version visible; manual priority records reason; dismissed actions do not immediately recur unchanged.
- **Happy path:** User selects top action and opens prefilled experiment/approval flow.
- **Alternative paths:** Reorder; snooze; dismiss; delegate; request more evidence.
- **Failure states:** No evidence-qualified action, stale score, policy blocks all channels, AI unavailable.
- **Permissions:** Members review; operators act; approvers approve; viewers cannot mutate.
- **Data required:** Recommendation, score inputs, evidence refs, policy/readiness, decisions.
- **API/backend work:** Ranked recommendation query and decision/snooze commands.
- **Frontend/UI work:** Three-item focus queue with expandable explanation and keyboard actions.
- **AI/agent work:** Generate bounded recommendations; deterministic scorer orders eligible items.
- **Workflow/job work:** Re-score on material events with debounce and versioning.
- **Security considerations:** Tool output cannot bypass eligibility; audit manual overrides.
- **Analytics events:** `recommendation_viewed/accepted/edited/dismissed/snoozed`, `time_to_action`.
- **Definition of done:** Recommendation template completeness and recurrence suppression tests pass.
- **Dependencies:** DOS-017, DOS-021, DOS-065.
- **Estimated complexity:** M
- **Release milestone:** M2

#### DOS-015 — See blockers and running jobs

- **ID:** DOS-015
- **Epic:** Mission Control
- **Priority:** P0
- **Persona:** Marketing manager
- **User story:** As a marketing manager, I want live blockers and job states, so that I can unblock delivery without assuming work happened.
- **Business problem:** Background automation is opaque and failures silently waste campaign windows.
- **Expected outcome:** Every active/blocked action has an owner, state, last update, and valid remediation.
- **Acceptance criteria:** Job drawer shows queued/running/retrying/ambiguous/succeeded/failed/blocked/reconnection/human-input; provider acceptance differs from delivery; stale heartbeat alerts; retry button appears only for retryable/idempotent work; blocker deep-links to connector, approval, budget, or input.
- **Happy path:** Expired Gmail token blocks job; owner reconnects; same job resumes without duplicate send.
- **Alternative paths:** Cancel before submission; acknowledge ambiguous result; assign human input.
- **Failure states:** Worker lost lease, webhook delayed, provider timeout, poisoned job, reconnect denied.
- **Permissions:** Members view mission jobs; operators retry/cancel; admins reconnect; approvers reapprove changed payload.
- **Data required:** Job/attempt/lease/receipt/blocker records and provider event timestamps.
- **API/backend work:** Job query/command endpoints with CAS transitions.
- **Frontend/UI work:** Real-time drawer, duration, attempt log, remediation CTAs.
- **AI/agent work:** Summarize error safely; cannot relabel state.
- **Workflow/job work:** Durable leases, heartbeats, retry classes, dead-letter handling.
- **Security considerations:** Redact payload/secrets; cancel authorization; tenant stream checks.
- **Analytics events:** `job_viewed/retried/cancelled/unblocked`, `job_state_changed`.
- **Definition of done:** Crash/retry/timeout/reconnect/duplicate chaos tests preserve exact-once business effect.
- **Dependencies:** DOS-039, DOS-070.
- **Estimated complexity:** L
- **Release milestone:** M1

#### DOS-016 — Ask the AI COO an evidence-grounded question

- **ID:** DOS-016
- **Epic:** Mission Control
- **Priority:** P1
- **Persona:** Solo builder
- **User story:** As a solo builder, I want to ask an AI COO what to do next, so that I receive a concise decision grounded in my current business evidence.
- **Business problem:** Generic chat lacks state, provenance, and operational follow-through.
- **Expected outcome:** ≥80% of rated answers are useful and every material claim is cited or labeled assumption.
- **Acceptance criteria:** Answer includes recommendation, reason, evidence links, confidence/freshness, expected impact, risks, approval, and proposed next action; retrieval is tenant/permission scoped; it says “unknown” when evidence is absent; draft artifacts require explicit user creation; no direct execution from chat.
- **Happy path:** User asks how to get first 10 leads; COO compares opportunities and proposes one experiment.
- **Alternative paths:** Ask for explanation, counterargument, source, or simulation.
- **Failure states:** No evidence, conflicting sources, model timeout, unsafe request, budget exceeded.
- **Permissions:** Members ask within readable scope; actions need separate operator/approver permission.
- **Data required:** Question, authorized graph/evidence snapshot, prompt/model versions, citations, feedback.
- **API/backend work:** Streaming conversation endpoint and retrieval authorization.
- **Frontend/UI work:** Citation chips, suggested questions, stop/retry, create-draft CTA.
- **AI/agent work:** AI COO prompt/tool allowlist, structured recommendation envelope, safety checks.
- **Workflow/job work:** Long research becomes visible async run.
- **Security considerations:** Prompt injection, data exfiltration, indirect tool injection, cost/rate limits.
- **Analytics events:** `coo_question_asked`, `citation_opened`, `answer_rated`, `draft_created_from_answer`.
- **Definition of done:** Retrieval isolation, hallucination rubric, unsafe-request, no-evidence, and action-separation evals pass.
- **Dependencies:** DOS-009, DOS-067, DOS-077.
- **Estimated complexity:** L
- **Release milestone:** M2

### Strategic Intelligence

#### DOS-017 — Review an evidence-backed strategic brief

- **ID:** DOS-017
- **Epic:** Strategic Intelligence
- **Priority:** P0
- **Persona:** Startup founder
- **User story:** As a startup founder, I want a concise strategic brief from confirmed business context, so that the team aligns on audience, positioning, offer, and next objective.
- **Business problem:** Tactical work diverges when commercial assumptions are not explicit.
- **Expected outcome:** A confirmed brief defines one primary segment, proposition, objective, and constraint for the current cycle.
- **Acceptance criteria:** Brief includes situation, goal, audience, pain, alternative, differentiation, offer, channel thesis, risks, unknowns, evidence, confidence, KPI/denominator, timebox; unconfirmed fields are labeled; edits version the strategy; all generated plans reference a strategy version.
- **Happy path:** Founder reviews evidence, edits positioning, and confirms the cycle brief.
- **Alternative paths:** Save draft; compare prior version; request specific research.
- **Failure states:** Critical profile unknown, contradictory evidence, concurrent edit, generation timeout.
- **Permissions:** Editors draft; owner/strategy approver confirms; viewers read.
- **Data required:** Confirmed profile, evidence, opportunity history, strategy versions.
- **API/backend work:** Brief generation, CRUD/version/diff, strategy confirmation command.
- **Frontend/UI work:** One-page brief with confidence/evidence rails and diff view.
- **AI/agent work:** Synthesis constrained to inputs; dissent/uncertainty section required.
- **Workflow/job work:** Generate/resynthesize; invalidate downstream drafts on version change.
- **Security considerations:** Tenant retrieval and sanitization; audit strategic confirmation.
- **Analytics events:** `brief_generated/edited/confirmed`, time-to-confirmation.
- **Definition of done:** Template completeness, citation coverage, version linkage, and permission tests pass.
- **Dependencies:** DOS-008, DOS-011.
- **Estimated complexity:** M
- **Release milestone:** M1

#### DOS-018 — Compare audience and positioning options

- **ID:** DOS-018
- **Epic:** Strategic Intelligence
- **Priority:** P1
- **Persona:** Content strategist
- **User story:** As a content strategist, I want to compare bounded audience-positioning options, so that messaging choices are explicit and testable.
- **Business problem:** One premature AI answer hides strategic alternatives and tradeoffs.
- **Expected outcome:** User selects a testable option or declares evidence insufficient.
- **Acceptance criteria:** Produce ≤3 options; each states target, job/pain, promise, proof, alternative, channel implication, expected outcome, evidence coverage, risk, and disconfirming signal; comparison uses same criteria; selection creates a version/hypothesis, not permanent truth.
- **Happy path:** User selects one positioning for a timeboxed experiment.
- **Alternative paths:** Combine only compatible elements; reject all; request customer evidence.
- **Failure states:** Options materially duplicate, lack evidence, violate forbidden claim, or target prohibited audience.
- **Permissions:** Editors compare; strategy approver selects production positioning.
- **Data required:** Audience/offer/competitor assertions, prior outcomes, brand/policy constraints.
- **API/backend work:** Comparison and selection endpoints with schema validation.
- **Frontend/UI work:** Accessible comparison table/cards and “what would change my mind?” section.
- **AI/agent work:** Diversity constraint, evidence scoring, forbidden-claim screening.
- **Workflow/job work:** Selection triggers dependent content/experiment draft refresh.
- **Security considerations:** Bias/protected-class review; no sensitive targeting inference.
- **Analytics events:** `positioning_options_generated/compared/selected/rejected`.
- **Definition of done:** Rubric detects duplicate/unsupported options; selection trace reaches experiment.
- **Dependencies:** DOS-017, DOS-031.
- **Estimated complexity:** M
- **Release milestone:** M2

#### DOS-019 — Refresh intelligence when material evidence changes

- **ID:** DOS-019
- **Epic:** Strategic Intelligence
- **Priority:** P1
- **Persona:** Marketing manager
- **User story:** As a marketing manager, I want strategy freshness tracked, so that campaigns do not run from stale pricing, offers, or audience assumptions.
- **Business problem:** Silent source changes invalidate live messaging and measurement.
- **Expected outcome:** Material changes are detected before affected future actions execute.
- **Acceptance criteria:** Source-specific TTL and content hashes identify change; semantic diff classifies materiality; affected assertions/briefs/opportunities/actions become `stale`; already approved material payloads become blocked and require reapproval; user sees exact changed evidence and impact.
- **Happy path:** Pricing page changes; scheduled price claim is blocked and owner reviews diff.
- **Alternative paths:** User marks change immaterial with reason; defer refresh.
- **Failure states:** Site unavailable, noisy dynamic page, false materiality, resynthesis failure.
- **Permissions:** System marks stale; editor resolves; approver reauthorizes.
- **Data required:** Crawl versions, hashes, materiality rules, dependency graph, approvals.
- **API/backend work:** Refresh policy and stale dependency query/commands.
- **Frontend/UI work:** Change inbox, semantic diff, affected-artifact list.
- **AI/agent work:** Classify materiality under deterministic high-risk overrides.
- **Workflow/job work:** Scheduled recrawl, debounce, reanalysis, action gate integration.
- **Security considerations:** Repeat SSRF validation; protect against page-based denial and poisoning.
- **Analytics events:** `material_change_detected`, `artifact_marked_stale`, `stale_action_blocked`.
- **Definition of done:** Pricing/CTA/audience fixture changes invalidate correct artifacts and leave unrelated ones valid.
- **Dependencies:** DOS-005, DOS-070.
- **Estimated complexity:** L
- **Release milestone:** M2

### Opportunity Engine

#### DOS-020 — Detect bounded market and distribution opportunities

- **ID:** DOS-020
- **Epic:** Opportunity Engine
- **Priority:** P1
- **Persona:** Growth operator
- **User story:** As a growth operator, I want evidence-qualified opportunities detected, so that I test real leverage rather than generate random campaign ideas.
- **Business problem:** Unbounded ideation wastes scarce time and budget.
- **Expected outcome:** System proposes 3–7 non-duplicate opportunities connected to a measurable funnel constraint.
- **Acceptance criteria:** Opportunity names audience, pain, channel, mechanism, offer/CTA, funnel stage, expected outcome, evidence/unknowns, confidence, risk, effort, timing, and validation step; prohibited/unavailable channels are excluded or blocked; duplicates cluster; weak evidence yields research opportunity, not execution.
- **Happy path:** Low conversion plus strong audience evidence produces a positioning experiment.
- **Alternative paths:** No execution opportunity produces customer-research task; user requests refresh.
- **Failure states:** No primary metric, stale profile, insufficient evidence, model/schema failure.
- **Permissions:** Members view; operators generate; policy controls data sources.
- **Data required:** Graph, funnel, past experiments, channel capabilities, policies, evidence freshness.
- **API/backend work:** Opportunity generation/version store and eligibility filter.
- **Frontend/UI work:** Opportunity queue with evidence/risk previews and empty research state.
- **AI/agent work:** Candidate generation; deterministic validation/deduplication.
- **Workflow/job work:** Recompute on meaningful events, not every metric tick.
- **Security considerations:** No private/prohibited source use; prompt-injection isolation.
- **Analytics events:** `opportunities_generated`, `opportunity_qualified`, count/evidence coverage.
- **Definition of done:** Curated scenarios yield relevant, non-prohibited, schema-complete opportunities.
- **Dependencies:** DOS-017, DOS-051, DOS-059.
- **Estimated complexity:** L
- **Release milestone:** M2

#### DOS-021 — Rank and explain opportunity scores

- **ID:** DOS-021
- **Epic:** Opportunity Engine
- **Priority:** P1
- **Persona:** Startup founder
- **User story:** As a startup founder, I want explainable opportunity ranking, so that I can choose based on revenue potential, effort, risk, and evidence.
- **Business problem:** Opaque scores manufacture precision and reduce trust.
- **Expected outcome:** User can identify why an opportunity ranks above another and override it responsibly.
- **Acceptance criteria:** Versioned deterministic score combines audience fit, pain, channel fit, competition, timing, effort, expected conversion, revenue potential, confidence, and risk; raw inputs/ranges and missing penalties visible; sensitivity shows top drivers; score timestamp/version shown; override requires reason.
- **Happy path:** User compares top two and selects the lower-effort learning option.
- **Alternative paths:** Change scenario constraints; manually prioritize; exclude a channel.
- **Failure states:** Missing normalization, incomparable currencies/timeframes, stale score, invalid input.
- **Permissions:** Viewers inspect; operators override within policy; owner sets weighting policy.
- **Data required:** Component inputs/provenance, scoring version, constraints, override reason.
- **API/backend work:** Pure scoring service and ranking endpoint; reproducible snapshots.
- **Frontend/UI work:** Ranked list, score breakdown, sensitivity and caveat drawer.
- **AI/agent work:** Explain score from stored components; cannot alter numeric result.
- **Workflow/job work:** Re-score when versioned input changes.
- **Security considerations:** Prevent model/user injection into policy weights; audit overrides.
- **Analytics events:** `opportunity_score_opened`, `ranking_overridden`, `score_driver_viewed`.
- **Definition of done:** Fixed fixtures reproduce exact rankings and explanations across releases.
- **Dependencies:** DOS-020, DOS-065.
- **Estimated complexity:** M
- **Release milestone:** M2

#### DOS-022 — Create an opportunity brief

- **ID:** DOS-022
- **Epic:** Opportunity Engine
- **Priority:** P1
- **Persona:** Marketing manager
- **User story:** As a marketing manager, I want a decision-ready opportunity brief, so that an approver can evaluate it without reconstructing the research.
- **Business problem:** Scores alone omit execution and measurement consequences.
- **Expected outcome:** Approver can accept, reject, or request evidence in ≤10 minutes.
- **Acceptance criteria:** Brief includes problem, audience, insight, proposed mechanism, channel capability, offer/CTA, expected impact range and assumptions, effort/cost, risks/compliance, evidence/freshness, confidence, measurement, kill rule, dependencies, and required approval; version is immutable after decision.
- **Happy path:** Manager reviews, assigns owner, and converts to experiment.
- **Alternative paths:** Request research; edit as new version; share read-only link within tenant.
- **Failure states:** Capability removed, evidence expires, owner/budget missing, policy conflict.
- **Permissions:** Editors create; approvers decide; viewers read.
- **Data required:** Opportunity snapshot, evidence set, score, policies, connector capabilities.
- **API/backend work:** Brief generation/version and readiness endpoint.
- **Frontend/UI work:** Printable decision page, checklist, decision controls.
- **AI/agent work:** Structured narrative with citations and downside case.
- **Workflow/job work:** Invalidate readiness on material dependency change.
- **Security considerations:** Tenant-bound sharing; no secret/provider token exposure.
- **Analytics events:** `opportunity_brief_created/viewed`, `evidence_requested`.
- **Definition of done:** Brief readiness blocks missing metric/budget/capability/evidence fields.
- **Dependencies:** DOS-021, DOS-059.
- **Estimated complexity:** M
- **Release milestone:** M2

#### DOS-023 — Convert an opportunity into an experiment

- **ID:** DOS-023
- **Epic:** Opportunity Engine
- **Priority:** P0
- **Persona:** Growth operator
- **User story:** As a growth operator, I want to convert an opportunity into a prefilled experiment, so that insight becomes a measurable action without losing provenance.
- **Business problem:** Manual handoff breaks traceability and delays execution.
- **Expected outcome:** Experiment is ready for refinement in <5 minutes and retains opportunity/strategy/evidence lineage.
- **Acceptance criteria:** Conversion prepopulates objective, falsifiable hypothesis, audience, channel, offer/content, CTA, owner, budget, dates, primary metric/denominator, target, instrumentation, approval, risk, and kill rule; source opportunity stays immutable; duplicate conversion warns; creation does not equal approval.
- **Happy path:** User reviews prefilled fields, fixes sample target, saves draft.
- **Alternative paths:** Clone into alternate channel experiment; create research-only experiment.
- **Failure states:** Missing measurement capability, invalid deadline/budget, archived opportunity, stale strategy.
- **Permissions:** Operator creates; budget/strategy approval remains separate.
- **Data required:** Opportunity/brief/version refs, experiment inputs, creator.
- **API/backend work:** Transactional conversion command with idempotency key.
- **Frontend/UI work:** Prefilled wizard, provenance banner, readiness errors.
- **AI/agent work:** Suggest missing values with reasons; deterministic validation.
- **Workflow/job work:** Create instrumentation tasks and approval request only on submit.
- **Security considerations:** Prevent ID swapping/cross-tenant conversion; policy validation.
- **Analytics events:** `opportunity_converted`, `experiment_prefill_changed`, conversion time.
- **Definition of done:** One command creates exactly one linked experiment under retries; lineage E2E passes.
- **Dependencies:** DOS-022.
- **Estimated complexity:** M
- **Release milestone:** M2

#### DOS-024 — Dismiss, archive, and learn from opportunity outcomes

- **ID:** DOS-024
- **Epic:** Opportunity Engine
- **Priority:** P1
- **Persona:** Indie hacker
- **User story:** As an indie hacker, I want to dismiss opportunities and track their outcomes, so that bad ideas stop recurring and good patterns compound.
- **Business problem:** Recommendation systems repeat rejected advice and lose decision context.
- **Expected outcome:** Dismissed opportunities recur only when material evidence changes; completed opportunities report commercial outcome.
- **Acceptance criteria:** Dismiss requires reason category/note and optional revisit condition/date; archive preserves score/evidence; linked experiment outcome updates opportunity result; recurrence compares new evidence and explains change; outcome dashboard separates won/lost/inconclusive/not-run.
- **Happy path:** User dismisses unavailable channel; it remains suppressed until connector capability changes.
- **Alternative paths:** Snooze; archive after run; reopen with reason.
- **Failure states:** Active experiment prevents archive; invalid revisit date; stale outcome projection.
- **Permissions:** Operators dismiss/snooze; admins archive/reopen; viewers read.
- **Data required:** Decision, reason, condition, evidence version, linked outcomes/revenue.
- **API/backend work:** State machine and suppression/recurrence rules.
- **Frontend/UI work:** Reason dialog, archive, outcome chips, “why it returned” panel.
- **AI/agent work:** Use prior dismissals as scoped negative feedback, not absolute truth.
- **Workflow/job work:** Revisit scheduler and outcome projection.
- **Security considerations:** Audit decisions; user notes sanitized and tenant-scoped.
- **Analytics events:** `opportunity_dismissed/snoozed/reopened/archived`, outcome value.
- **Definition of done:** Suppression and evidence-change recurrence scenarios pass deterministic tests.
- **Dependencies:** DOS-020, DOS-040, DOS-083.
- **Estimated complexity:** M
- **Release milestone:** M2

### Content OS

#### DOS-025 — Generate a measurable content strategy

- **ID:** DOS-025
- **Epic:** Content OS
- **Priority:** P1
- **Persona:** Content strategist
- **User story:** As a content strategist, I want a content strategy tied to one audience and funnel objective, so that publishing creates qualified demand rather than volume.
- **Business problem:** Content calendars optimize output while disconnecting from conversion.
- **Expected outcome:** Every proposed content pillar has a business hypothesis, audience, CTA, channel rationale, and metric.
- **Acceptance criteria:** Strategy specifies objective, segment, journey stage, messages, proof, pillars, formats, channel, cadence, CTA, reuse rules, primary/guardrail metrics, risks, evidence, confidence, and exclusions; it references a confirmed strategy version; unavailable channels are marked simulated/blocked.
- **Happy path:** User selects lead-generation objective and approves a four-week draft strategy.
- **Alternative paths:** Choose research or conversion objective; edit cadence; save unapproved draft.
- **Failure states:** No audience/offer, unsupported claims, policy-prohibited channel, stale brief.
- **Permissions:** Editors generate/edit; content approver confirms.
- **Data required:** Strategy/profile, evidence, past content outcomes, channel capabilities, brand/policy.
- **API/backend work:** Versioned content-strategy resource and validation.
- **Frontend/UI work:** Strategy canvas with outcome chain and evidence drawer.
- **AI/agent work:** Content strategist agent; novelty and evidence-grounding rubric.
- **Workflow/job work:** Revalidate on strategy/policy change.
- **Security considerations:** No inferred sensitive targeting; brand/claim policy enforced.
- **Analytics events:** `content_strategy_generated/edited/approved`, objective selected.
- **Definition of done:** Every pillar traces to metric/evidence; stale strategy blocks approval.
- **Dependencies:** DOS-017, DOS-059.
- **Estimated complexity:** M
- **Release milestone:** M2

#### DOS-026 — Generate and prioritize content ideas

- **ID:** DOS-026
- **Epic:** Content OS
- **Priority:** P1
- **Persona:** Solo builder
- **User story:** As a solo builder, I want a small ranked set of content ideas, so that I can create the most commercially useful asset first.
- **Business problem:** Large generic idea lists overwhelm users and repeat themes.
- **Expected outcome:** User selects one of ≤10 evidence-backed ideas in under 5 minutes.
- **Acceptance criteria:** Each idea includes audience insight, hook, promise, proof/evidence, format, channel, CTA, expected funnel effect, effort, risk, confidence, and experiment link; duplicates cluster; forbidden claims and used topics are flagged; dismissal is remembered.
- **Happy path:** User filters by low effort and converts an idea to draft.
- **Alternative paths:** Refresh from new evidence; request variants; dismiss/snooze.
- **Failure states:** Evidence too weak, ideas duplicate, channel unavailable, generation quota exceeded.
- **Permissions:** Members view; editors generate/convert.
- **Data required:** Content strategy, performance history, dismissals, evidence, brand rules.
- **API/backend work:** Idea generation/ranking and state endpoints.
- **Frontend/UI work:** Ranked cards, filters, evidence preview, empty state.
- **AI/agent work:** Candidate generation and semantic dedupe; deterministic eligibility.
- **Workflow/job work:** Async generation with cache by source versions.
- **Security considerations:** Prevent source text injection and prohibited targeting.
- **Analytics events:** `content_ideas_generated/viewed/selected/dismissed`.
- **Definition of done:** Relevance/deduplication eval passes; no unsupported idea reaches draft unlabeled.
- **Dependencies:** DOS-025, DOS-077.
- **Estimated complexity:** M
- **Release milestone:** M2

#### DOS-027 — Create channel-specific content and variants

- **ID:** DOS-027
- **Epic:** Content OS
- **Priority:** P0
- **Persona:** Content strategist
- **User story:** As a content strategist, I want channel-native content variants, so that I can test messages without losing brand, evidence, or CTA consistency.
- **Business problem:** Generic repurposing ignores platform constraints and destroys experiment validity.
- **Expected outcome:** Drafts meet connector limits and expose exactly what differs between variants.
- **Acceptance criteria:** Draft stores hook/body/CTA/format/channel/character count/source idea/strategy/evidence; channel validator enforces limits; variants change one declared dimension where experiment requires; unsupported media is blocked; simulation preview is labeled; save does not approve.
- **Happy path:** User creates two email subject variants with identical body/CTA.
- **Alternative paths:** Rewrite tone; duplicate asset; manually edit; choose supported fallback format.
- **Failure states:** Length/format violation, missing CTA, stale claim, model timeout, connector capability absent.
- **Permissions:** Editors create/edit; approvers approve; viewers preview.
- **Data required:** Asset versions, variant relation/dimension, platform constraints, brand voice.
- **API/backend work:** Content CRUD/duplicate/version endpoints and capability validator.
- **Frontend/UI work:** Editor, platform preview, diff, autosave/conflict states.
- **AI/agent work:** Structured generation with constraint and brand checks.
- **Workflow/job work:** Generate asynchronously; mark stale on source change.
- **Security considerations:** Sanitize rendered HTML/links; no secret or PII leakage.
- **Analytics events:** `content_draft_created/edited/duplicated`, `variant_created`.
- **Definition of done:** Platform fixture and variant-isolation tests pass; approved snapshot is immutable.
- **Dependencies:** DOS-026.
- **Estimated complexity:** L
- **Release milestone:** M1

#### DOS-028 — Review quality and unsupported claims before approval

- **ID:** DOS-028
- **Epic:** Content OS
- **Priority:** P0
- **Persona:** Marketing manager
- **User story:** As a marketing manager, I want claim and quality checks before publishing, so that the company avoids deceptive or off-brand content.
- **Business problem:** Fluent AI copy can contain unsupported, risky, or prohibited claims.
- **Expected outcome:** 100% of public/outbound assets pass deterministic policy and claim review before approval.
- **Acceptance criteria:** Review reports claim text, type, evidence support, confidence, severity, policy match, accessibility/readability, brand issues, links, and remediation; critical unsupported/forbidden claims block approval; override needs authorized reason where policy allows; any edit invalidates review and approval.
- **Happy path:** User replaces unsupported “guaranteed” claim with sourced language and review passes.
- **Alternative paths:** Attach evidence; request legal/owner review; archive asset.
- **Failure states:** Checker unavailable, evidence stale, unsafe link, conflicting policy, override forbidden.
- **Permissions:** Editors remediate; approvers approve; only owner/compliance role may permitted-override.
- **Data required:** Asset version/hash, claim spans, evidence, brand/forbidden policies, review version.
- **API/backend work:** Deterministic rules + model-assisted review endpoint and approval gate.
- **Frontend/UI work:** Inline annotations, severity summary, resolve/attach-source actions.
- **AI/agent work:** Extract/classify claims; never adjudicate permission.
- **Workflow/job work:** Review job, re-run on edit, policy version pinning.
- **Security considerations:** Link scanning, output escaping, regulated/protected-class rules.
- **Analytics events:** `content_review_started/passed/failed`, `claim_resolved/overridden`.
- **Definition of done:** Adversarial claims fixture yields zero critical false negatives at acceptance threshold.
- **Dependencies:** DOS-027, DOS-065, DOS-067.
- **Estimated complexity:** L
- **Release milestone:** M1

#### DOS-029 — Track content performance to business outcomes

- **ID:** DOS-029
- **Epic:** Content OS
- **Priority:** P1
- **Persona:** Content strategist
- **User story:** As a content strategist, I want content performance linked to leads and revenue, so that future creative decisions use commercial evidence.
- **Business problem:** Reach and likes encourage activity that may not convert.
- **Expected outcome:** Each published asset shows reach-to-revenue funnel, cost, freshness, and attribution confidence where data exists.
- **Acceptance criteria:** Separate provider-reported reach/engagement/clicks, first-party visits/leads, replies/meetings, conversions/payments/refunds; show denominators and unavailable data; compare variants only over compatible windows/audiences; annotate external changes; learning uses verified events.
- **Happy path:** User sees lower reach variant produce higher qualified-lead rate.
- **Alternative paths:** Manual offline outcome with declared source; incomplete connector data.
- **Failure states:** Metric mismatch, delayed webhook, duplicate event, timezone/currency conflict.
- **Permissions:** Content viewers see aggregate; lead/revenue detail needs respective scopes.
- **Data required:** Asset/action/touchpoint/campaign/lead/payment links, costs, metric definitions.
- **API/backend work:** Content funnel query and metric normalization.
- **Frontend/UI work:** Outcome-first performance view with accessible data table.
- **AI/agent work:** Explain patterns with limitations, not causal certainty.
- **Workflow/job work:** Provider sync, late-event recomputation.
- **Security considerations:** Aggregate privacy thresholds; tenant-scoped event joins.
- **Analytics events:** `content_performance_viewed`, `metric_drilldown`, `learning_created_from_content`.
- **Definition of done:** Known event fixture reconciles exact funnel and never double-counts.
- **Dependencies:** DOS-033, DOS-051, DOS-054.
- **Estimated complexity:** L
- **Release milestone:** M2

### Distribution channels and connectors

#### DOS-030 — Connect the first real distribution channel

- **ID:** DOS-030
- **Epic:** Distribution channels
- **Priority:** P0
- **Persona:** Workspace owner
- **User story:** As a workspace owner, I want to connect one genuinely supported distribution channel, so that approved content can be executed and proven.
- **Business problem:** A catalog entry without a working adapter creates false trust.
- **Expected outcome:** The initial Resend connection passes domain, capability, send, signed-event, revoke, and compliance tests; later channel adapters must pass equivalent provider-specific gates.
- **Acceptance criteria:** MVP provider is Resend for a workspace-owned, consented audience; API key/domain authorization uses least privilege and encrypted secret reference; installation is `connected` only after domain and capability test; account/domain and terms constraints shown; simulation distinct; unsupported capabilities blocked; support claim gated by conformance suite. Any replacement/additional social provider requires a written API/terms feasibility gate before backlog commitment.
- **Happy path:** Owner authorizes a verified sending domain and sees tested small-campaign send and signed-event capabilities.
- **Alternative paths:** Sandbox/test recipient; simulation; reconnect or rotate credential; later choose another provider that passed the gate.
- **Failure states:** Invalid/revoked key, unverified domain, missing capability, provider outage, consent/policy incompatibility.
- **Permissions:** Owner/admin installs; operators use granted capabilities; viewers see status only.
- **Data required:** Installation, provider account, scopes, capabilities/version, token ref, consent, health.
- **API/backend work:** Resend credential/domain connect, rotate/revoke, and adapter contract; OAuth contract remains required for later OAuth providers.
- **Frontend/UI work:** Permission/domain review, account confirmation, test/status states.
- **AI/agent work:** None controls auth; agents query capability registry only.
- **Workflow/job work:** Credential/domain health and periodic capability probe; OAuth refresh applies to later providers.
- **Security considerations:** Encrypted secret vault, domain ownership, signed events, no key in client/model/log; OAuth providers additionally require CSRF/PKCE and callback allowlist.
- **Analytics events:** `connector_connect_started/completed/failed`, `capability_tested`.
- **Definition of done:** Resend sandbox/test-recipient conformance, signed events, revoke/rotation, security, consent, and receipt E2E pass; docs state exact limits.
- **Dependencies:** DOS-059, DOS-073.
- **Estimated complexity:** XL (split by discovery/OAuth/adapter/webhook/UI)
- **Release milestone:** M1

#### DOS-031 — Validate connector scopes and capabilities

- **ID:** DOS-031
- **Epic:** Distribution channels
- **Priority:** P0
- **Persona:** Growth operator
- **User story:** As a growth operator, I want the system to validate capabilities before planning, so that it never promises an action the account cannot perform.
- **Business problem:** Provider/account/plan differences make connector names unreliable.
- **Expected outcome:** Every executable plan references a fresh successful capability probe.
- **Acceptance criteria:** Capability contract defines action, input schema, scopes, account limits, simulation, webhook/poll support, rate limit, compliance notes, tested-at/version; readiness blocks missing/stale capability; UI distinguishes catalog, installed, healthy, degraded, unavailable.
- **Happy path:** Scheduler confirms publish+delete unsupported and omits delete workflow.
- **Alternative paths:** Degraded read-only mode; simulate unsupported write.
- **Failure states:** Scope revoked, provider schema changed, probe throttled, account restricted.
- **Permissions:** All members view safe capabilities; admins reauthorize; only system sets tested status.
- **Data required:** Capability manifests/probe results/scopes/provider versions/errors.
- **API/backend work:** `GET /api/v1/connectors/{id}/capabilities`; signed/versioned adapter manifest.
- **Frontend/UI work:** Capability matrix and remediation links.
- **AI/agent work:** Tool availability generated from authorized manifest.
- **Workflow/job work:** Scheduled/just-in-time probes with backoff.
- **Security considerations:** Server verifies provider response; least privilege; no client status promotion.
- **Analytics events:** `capability_check_run/failed`, `action_blocked_missing_capability`.
- **Definition of done:** Revoked scope blocks queued action before external call; contract tests pass.
- **Dependencies:** DOS-030.
- **Estimated complexity:** M
- **Release milestone:** M1

#### DOS-032 — Schedule and publish an approved asset

- **ID:** DOS-032
- **Epic:** Distribution channels
- **Priority:** P0
- **Persona:** Marketing manager
- **User story:** As a marketing manager, I want to schedule and publish the exact approved asset, so that execution is timely and governed.
- **Business problem:** Copy/payload drift between review and publishing creates brand and compliance risk.
- **Expected outcome:** Approved actions publish once within the schedule SLO and store provider evidence.
- **Acceptance criteria:** Schedule uses workspace timezone and future window; action snapshot includes payload hash, connector/account, cost ceiling, approver, expiry; worker rechecks hash/policy/capability/budget/token at execution; provider request uses idempotency when supported; `succeeded` requires receipt; edit/schedule/account change invalidates approval.
- **Happy path:** Approved post queues, runs, receives provider ID, and later metrics.
- **Alternative paths:** Publish now; cancel before claim; reschedule and reapprove; simulate.
- **Failure states:** Expired approval/token, quiet hours, quota/rate limit, provider rejection/timeout, ambiguous response.
- **Permissions:** Editor schedules draft; approver approves; operator cancels/retries per role.
- **Data required:** Immutable payload, approval, schedule/timezone, attempt, provider receipt.
- **API/backend work:** Schedule/execute commands with CAS and idempotency.
- **Frontend/UI work:** Exact preview, timezone, approval diff, status timeline.
- **AI/agent work:** No mutation after approval; agent may propose schedule.
- **Workflow/job work:** Durable timer, lease, preflight, submit, reconcile.
- **Security considerations:** Server-side policy; safe URLs; secret isolation; audit exact hash.
- **Analytics events:** `publish_scheduled/started/provider_accepted/succeeded/cancelled`.
- **Definition of done:** Clock/DST/crash/duplicate/changed-payload/provider-timeout tests pass.
- **Dependencies:** DOS-028, DOS-030, DOS-065, DOS-070.
- **Estimated complexity:** L
- **Release milestone:** M1

#### DOS-033 — Recover failed publishing without duplicates

- **ID:** DOS-033
- **Epic:** Distribution channels
- **Priority:** P0
- **Persona:** Growth operator
- **User story:** As a growth operator, I want safe failure recovery, so that retries do not duplicate public actions or hide ambiguous outcomes.
- **Business problem:** Naive retries create duplicate posts/messages and reputational harm.
- **Expected outcome:** Duplicate external effects are zero in conformance/chaos tests; ambiguous attempts are reconciled before retry.
- **Acceptance criteria:** Errors classify retryable/definitive/ambiguous/reconnect/human/policy; stable idempotency key per business action; attempt records precede call; exponential backoff honors `Retry-After`; circuit breaker protects provider; lookup/poll resolves ambiguity where possible; manual resolution is audited; real and simulated timelines never merge.
- **Happy path:** Provider 429 retries once later and succeeds with same key.
- **Alternative paths:** Reconnect then resume; operator confirms external occurrence; clone as new action.
- **Failure states:** Retry exhausted, lookup unavailable, provider lacks idempotency, dead-letter, receipt mismatch.
- **Permissions:** Operators retry definitive-safe; admins resolve ambiguous; content mutation requires reapproval.
- **Data required:** Attempts, error class, keys, receipts, provider lookups, decisions.
- **API/backend work:** Error taxonomy, reconciliation and dead-letter commands.
- **Frontend/UI work:** Failure explanation, attempts, safe available actions.
- **AI/agent work:** May summarize; deterministic code selects retry.
- **Workflow/job work:** Backoff/jitter/circuit breaker/reconciliation/dead-letter queue.
- **Security considerations:** No sensitive raw errors; audit manual outcome; abuse rate limits.
- **Analytics events:** `publish_failed/retried/reconciled`, `duplicate_prevented`, ambiguity duration.
- **Definition of done:** Fault-injection matrix proves state truth and at-most-once effect where provider supports it.
- **Dependencies:** DOS-032, DOS-070.
- **Estimated complexity:** L
- **Release milestone:** M1

### Campaigns

#### DOS-034 — Create a campaign around a commercial objective

- **ID:** DOS-034
- **Epic:** Campaigns
- **Priority:** P1
- **Persona:** Marketing manager
- **User story:** As a marketing manager, I want to create a campaign with a measurable objective, so that coordinated actions share ownership and outcome.
- **Business problem:** Disconnected assets and tasks cannot be governed or evaluated together.
- **Expected outcome:** Campaign creation yields a coherent draft plan, not immediate execution.
- **Acceptance criteria:** Require name, objective, funnel stage, audience, offer/CTA, owner, dates, primary metric/denominator/target, budget/currency, channels, attribution window, risks, approval policy, and linked strategy/opportunity; status begins `draft`; unsupported channels are blocked/simulated.
- **Happy path:** Manager converts opportunity into a campaign and assigns owners.
- **Alternative paths:** Start blank; clone prior campaign without approvals/results; save incomplete draft.
- **Failure states:** Invalid dates/budget, stale strategy, duplicate name allowed but warned, inaccessible audience.
- **Permissions:** Campaign editor creates; owner manages; approver authorizes spend/actions.
- **Data required:** Campaign/version, members, objectives, linked artifacts, policy snapshot.
- **API/backend work:** Campaign CRUD/version/readiness contracts.
- **Frontend/UI work:** Progressive wizard, readiness panel, clear draft badge.
- **AI/agent work:** Suggest bounded plan fields with citations.
- **Workflow/job work:** None until submitted; projection for Mission Control.
- **Security considerations:** Tenant/member validation; no audience PII in analytics.
- **Analytics events:** `campaign_created/edited/readiness_checked`.
- **Definition of done:** Schema/permission/version/readiness tests and create E2E pass.
- **Dependencies:** DOS-017, DOS-023.
- **Estimated complexity:** M
- **Release milestone:** M2

#### DOS-035 — Define audience, budget, timeline, and measurement plan

- **ID:** DOS-035
- **Epic:** Campaigns
- **Priority:** P0
- **Persona:** Growth operator
- **User story:** As a growth operator, I want campaign constraints and measurement defined before launch, so that success and safety are decidable.
- **Business problem:** Campaigns launch with vague audiences, vanity metrics, and no stop condition.
- **Expected outcome:** 100% of launched campaigns have valid instrumentation, cost ceiling, target, and kill rule.
- **Acceptance criteria:** Audience references graph segment and exclusion/suppression sets; budget has total/daily/action limits; timeline includes timezone; primary metric has exact event/denominator/baseline/target/window; guardrails and kill rule are executable; tracking test must pass or campaign remains blocked.
- **Happy path:** Operator tests CTA event, estimates sample, and submits plan.
- **Alternative paths:** Manual outcome source with lower confidence; zero-spend organic campaign.
- **Failure states:** Audience empty/prohibited, denominator missing, budget conflict, event not observed, dates too short.
- **Permissions:** Operators configure; finance/owner approves threshold spend; compliance approves restricted audiences.
- **Data required:** Segment snapshot, suppression list, budget, metric definitions, tracking test.
- **API/backend work:** Readiness validator, budget reservation, event test endpoint.
- **Frontend/UI work:** Constraint editor, budget summary, instrumentation test and blockers.
- **AI/agent work:** Recommend values and sample caveats; cannot waive controls.
- **Workflow/job work:** Budget reservation expiry and tracking health checks.
- **Security considerations:** Consent/suppression enforcement, sensitive audience prohibition.
- **Analytics events:** `campaign_constraints_completed`, `tracking_test_run`, `budget_reserved`.
- **Definition of done:** Launch cannot pass missing/invalid constraints; boundary tests cover currency/timezone.
- **Dependencies:** DOS-034, DOS-051, DOS-065.
- **Estimated complexity:** L
- **Release milestone:** M2

#### DOS-036 — Approve and execute a campaign plan

- **ID:** DOS-036
- **Epic:** Campaigns
- **Priority:** P0
- **Persona:** Executive
- **User story:** As an executive, I want to approve a campaign and its bounded actions, so that the team can execute within explicit risk and spend limits.
- **Business problem:** Blanket campaign approval can hide later payload or cost changes.
- **Expected outcome:** Execution occurs only within the approved version and envelope.
- **Acceptance criteria:** Review shows exact actions/assets/accounts/schedules, max spend, audiences/exclusions, evidence, risks, measurement, and policy; approval hashes plan plus action manifests; additions or material changes require delta/reapproval; low-risk auto-approval operates only within configured envelope; pause stops unclaimed jobs.
- **Happy path:** Owner approves plan and three scheduled actions queue.
- **Alternative paths:** Approve subset; reject; request changes; set lower cap; expire.
- **Failure states:** Separation-of-duties violation, stale evidence, connector degraded, budget changed, approval expired.
- **Permissions:** Policy-defined approver; creator self-approval can be forbidden; operators execute approved scope.
- **Data required:** Campaign/action versions, approval envelope, policy version, actor, expiry.
- **API/backend work:** Campaign approval/delta/pause commands and readiness gate.
- **Frontend/UI work:** Approval summary, diff, subset selection, typed confirmation for high risk.
- **AI/agent work:** Risk summary only; never records approval.
- **Workflow/job work:** Fan-out approved actions; pause/cancel coordination.
- **Security considerations:** Exact hashes, CSRF protection, role/SoD/budget checks at execution.
- **Analytics events:** `campaign_approval_requested/approved/rejected/paused`, approved spend.
- **Definition of done:** Mutation and expired-policy tests block execution; subset fan-out is exact.
- **Dependencies:** DOS-032, DOS-035, DOS-065, DOS-066.
- **Estimated complexity:** L
- **Release milestone:** M2

#### DOS-037 — Measure a campaign and expose data quality

- **ID:** DOS-037
- **Epic:** Campaigns
- **Priority:** P1
- **Persona:** Marketing manager
- **User story:** As a marketing manager, I want campaign results with data-quality context, so that I can decide whether to continue, change, or stop.
- **Business problem:** Aggregated dashboards hide missing and incomparable data.
- **Expected outcome:** Campaign review produces a documented decision based on defined metric and costs.
- **Acceptance criteria:** Show actual vs baseline/target for primary and guardrail metrics; event counts include denominators/window/freshness/source; cost separates incurred/committed; status identifies insufficient data; late events revise versioned result; annotations explain pauses/changes; revenue attribution band visible.
- **Happy path:** Target missed after minimum sample; manager stops and records reason.
- **Alternative paths:** Extend timebox with approval; declare inconclusive; segment analysis.
- **Failure states:** Tracking loss, provider lag, metric definition changed, sample contamination.
- **Permissions:** Viewers see aggregate; operator recommends; campaign owner decides.
- **Data required:** Campaign version, normalized events, costs, attribution, annotations, decision.
- **API/backend work:** Campaign result query/snapshot and decision endpoint.
- **Frontend/UI work:** Outcome summary, funnel, data-quality banner, decision CTA.
- **AI/agent work:** Explain variance with cited evidence and alternatives.
- **Workflow/job work:** Scheduled aggregation and late-event recompute.
- **Security considerations:** Privacy thresholds; immutable historical metric definitions.
- **Analytics events:** `campaign_results_viewed`, `campaign_decision_recorded`, data gaps.
- **Definition of done:** Fixture reconciles source events/cost/revenue exactly; no-data is not zero.
- **Dependencies:** DOS-035, DOS-036, DOS-051.
- **Estimated complexity:** L
- **Release milestone:** M2

### Experiments

#### DOS-038 — Define a falsifiable experiment

- **ID:** DOS-038
- **Epic:** Experiments
- **Priority:** P0
- **Persona:** Growth operator
- **User story:** As a growth operator, I want to define a falsifiable hypothesis and success rule, so that an action produces knowledge even when it fails.
- **Business problem:** Post-hoc interpretation turns every result into a success story.
- **Expected outcome:** Every started experiment has a precommitted decision rule.
- **Acceptance criteria:** Require “If [change] for [audience], then [metric] moves from [baseline] to [target] by [date], because [mechanism]”; define denominator, sample expectation, variants/baseline, guardrails, budget, owner, instrumentation, kill rule, attribution window, and limitations; freeze snapshot at start.
- **Happy path:** Operator validates event and starts approved A/B test.
- **Alternative paths:** Before/after or qualitative discovery design with explicit lower causal confidence.
- **Failure states:** Non-falsifiable wording, missing denominator, overlapping variant, no tracking, approval absent.
- **Permissions:** Editors draft; experiment owner starts; spend/action approvers authorize dependencies.
- **Data required:** Hypothesis, design, metrics, assignments, version, approvals.
- **API/backend work:** Experiment schema/readiness/start commands.
- **Frontend/UI work:** Guided hypothesis builder and preflight checklist.
- **AI/agent work:** Critique falsifiability and confounders; user retains decision.
- **Workflow/job work:** Snapshot/freeze and assignment scheduling.
- **Security considerations:** Avoid sensitive experimentation; consent and exclusion policy.
- **Analytics events:** `experiment_created/readiness_failed/started`.
- **Definition of done:** Invalid design fixtures cannot start; started definition is immutable.
- **Dependencies:** DOS-023, DOS-035.
- **Estimated complexity:** M
- **Release milestone:** M2

#### DOS-039 — Execute and safely compare experiment variants

- **ID:** DOS-039
- **Epic:** Experiments
- **Priority:** P1
- **Persona:** Growth operator
- **User story:** As a growth operator, I want variant assignment and execution kept comparable, so that observed differences support a defensible decision.
- **Business problem:** Unequal audiences, time windows, or extra changes invalidate comparisons.
- **Expected outcome:** Variant exposure is deterministic, auditable, and contamination is visible.
- **Acceptance criteria:** Assignment unit/key/ratio recorded before exposure; one declared variable per simple test; actions retain variant ID; exposure event precedes outcome; sample-ratio mismatch, overlap, early peeking, and missing exposure alerts appear; users may stop by kill rule.
- **Happy path:** Eligible leads are deterministically split and each receives one approved variant.
- **Alternative paths:** Manual alternation is labeled quasi-experiment; pause all arms; exclude invalid events with reason.
- **Failure states:** Assignment service unavailable, duplicate exposure, crossover, variant payload changed.
- **Permissions:** Operator manages run; approver authorizes variant payloads; analyst excludes with audit.
- **Data required:** Assignment/exposure/outcome, eligibility snapshot, variants, exclusions.
- **API/backend work:** Assignment service and comparison query.
- **Frontend/UI work:** Variant balance, contamination/data-quality alerts.
- **AI/agent work:** No assignment decisions; explain methodological limits.
- **Workflow/job work:** Scheduled assignments and guardrail/kill monitoring.
- **Security considerations:** Stable pseudonymous IDs; consent; prevent discriminatory allocation.
- **Analytics events:** `variant_assigned/exposed`, `experiment_contamination_detected`, `kill_rule_triggered`.
- **Definition of done:** Determinism, ratio, duplicate, crossover, and crash tests pass.
- **Dependencies:** DOS-038, DOS-070.
- **Estimated complexity:** L
- **Release milestone:** M2

#### DOS-040 — Declare a winner, failure, or inconclusive result and record learning

- **ID:** DOS-040
- **Epic:** Experiments
- **Priority:** P1
- **Persona:** Startup founder
- **User story:** As a startup founder, I want an evidence-based experiment conclusion, so that strategy changes reflect what the test actually learned.
- **Business problem:** Teams overclaim small samples and forget failed tests.
- **Expected outcome:** Every ended experiment has one of `won`, `lost`, `inconclusive`, `invalidated`, with a reusable lesson and next decision.
- **Acceptance criteria:** Result shows sample, effect/interval or qualitative evidence, primary/guardrail metrics, costs, revenue, data quality, confounders, decision rule comparison, confidence, and limitations; system recommends but owner declares; late data versions result; lesson states supported/refuted/unchanged belief and next test.
- **Happy path:** Variant B exceeds target without guardrail harm; owner declares winner and proposes rollout.
- **Alternative paths:** Stop failure; extend with approval; invalidate contaminated run.
- **Failure states:** Insufficient sample, missing denominator, metric drift, late refund reverses value.
- **Permissions:** Analyst prepares; experiment owner declares; major strategy update requires approval.
- **Data required:** Frozen design, event snapshot, statistics, costs/payments/refunds, decision/lesson.
- **API/backend work:** Analysis snapshot, declaration, result version and lesson creation.
- **Frontend/UI work:** Comparison, uncertainty visualization, declaration modal.
- **AI/agent work:** Narrative analysis cites computed values; never invents significance.
- **Workflow/job work:** Recompute for late events/refunds and notify version change.
- **Security considerations:** Immutable raw outcomes; audit exclusions/declaration.
- **Analytics events:** `experiment_result_viewed/declared/revised`, outcome class.
- **Definition of done:** Statistical fixtures and no/late/invalid data cases produce correct status.
- **Dependencies:** DOS-039, DOS-083.
- **Estimated complexity:** L
- **Release milestone:** M2

### Leads, conversations, and Gmail

#### DOS-041 — Capture and deduplicate a lead lawfully

- **ID:** DOS-041
- **Epic:** Leads and CRM
- **Priority:** P0
- **Persona:** Sales operator
- **User story:** As a sales operator, I want leads captured with source and consent context, so that I can follow up quickly without creating duplicates or spam risk.
- **Business problem:** Anonymous or duplicated leads lose attribution and create repeated contact.
- **Expected outcome:** ≥99% of lead submissions create/update one tenant contact and preserve acquisition source.
- **Acceptance criteria:** Capture validates fields; records first/last source, UTM/click/campaign/action, consent/legal basis, privacy version, timestamps; normalizes email within tenant; deterministic match proposes merge without cross-tenant lookup; suppressed/unsubscribed status survives re-import; bot/rate checks apply.
- **Happy path:** CTA form creates lead and attributable touchpoint, then notifies owner.
- **Alternative paths:** Manual/CSV/API capture; partial anonymous event later linked with consent.
- **Failure states:** Invalid/disposable email policy, duplicate ambiguity, missing consent for channel, bot abuse.
- **Permissions:** Public endpoint creates bounded record; operators view; import requires permission.
- **Data required:** Contact, identity keys, source/touchpoints, consent, suppression, form version.
- **API/backend work:** Capture endpoint, dedupe/merge candidates, idempotency.
- **Frontend/UI work:** Embeddable/native form, consent, truthful success/error; lead list empty state.
- **AI/agent work:** Optional qualification after capture; no consent inference.
- **Workflow/job work:** Enrichment/notification queued after commit.
- **Security considerations:** Encryption/PII minimization, abuse prevention, injection, retention.
- **Analytics events:** `lead_form_viewed/submitted/rejected`, `lead_created/deduplicated`.
- **Definition of done:** Replay/concurrency/suppression/tenant/security tests pass.
- **Dependencies:** DOS-051, DOS-061.
- **Estimated complexity:** L
- **Release milestone:** M1

#### DOS-042 — View, assign, and advance a lead lifecycle

- **ID:** DOS-042
- **Epic:** Leads and CRM
- **Priority:** P0
- **Persona:** Sales operator
- **User story:** As a sales operator, I want an attributable lead profile and clear lifecycle, so that the right person takes the right next action.
- **Business problem:** Leads decay when ownership, context, and stage are unclear.
- **Expected outcome:** New qualified leads are assigned within target SLA and every stage change is attributable.
- **Acceptance criteria:** Profile shows identity, company/role, source, evidence, consent/suppression, score rationale, owner, status, touchpoints, conversations, tasks, payments; lifecycle transitions are validated; assignment records actor/time; stale lead flag uses workspace SLA; conversion requires customer/payment or declared reason.
- **Happy path:** Operator claims qualified lead, records conversation, advances to meeting.
- **Alternative paths:** Reassign; reject with reason; merge duplicate; mark converted offline with declared evidence.
- **Failure states:** Concurrent assignment, invalid transition, deleted user, restricted PII, merge conflict.
- **Permissions:** Sales roles view/update assigned or all per policy; viewers see aggregates only.
- **Data required:** Contact/customer, owner, statuses, events, tasks, touchpoints, evidence.
- **API/backend work:** Lead query/update/assign/merge with ETags and state machine.
- **Frontend/UI work:** Queue and responsive master-detail timeline, bulk actions limited.
- **AI/agent work:** Summarize timeline using authorized fields.
- **Workflow/job work:** SLA timers/escalations and read-model updates.
- **Security considerations:** Field-level PII access, export audit, tenant dedupe only.
- **Analytics events:** `lead_viewed/assigned/status_changed/merged`, assignment latency.
- **Definition of done:** Lifecycle/concurrency/PII/merge and mobile accessibility tests pass.
- **Dependencies:** DOS-041, DOS-061.
- **Estimated complexity:** L
- **Release milestone:** M1

#### DOS-043 — Detect and explain lead intent

- **ID:** DOS-043
- **Epic:** Leads and CRM
- **Priority:** P1
- **Persona:** Sales operator
- **User story:** As a sales operator, I want lead intent summarized from permitted behavior, so that I prioritize timely, relevant follow-up.
- **Business problem:** Operators cannot manually interpret every interaction before intent decays.
- **Expected outcome:** High-intent leads are reviewed faster without opaque profiling.
- **Acceptance criteria:** Intent score uses permitted explicit events (form, reply, pricing visit, meeting, purchase) with versioned weights, freshness decay, evidence list, confidence, and exclusions; sensitive traits and unconsented cross-site data forbidden; score cannot send automatically; user can correct label.
- **Happy path:** Pricing visit plus demo request creates high-intent alert with evidence.
- **Alternative paths:** Low data returns unknown; user overrides with reason; account-level rollup.
- **Failure states:** Tracking missing, identity merge uncertain, stale signals, model unavailable.
- **Permissions:** Authorized sales users; score components respect event/PII permissions.
- **Data required:** Consented events, lead lifecycle, timestamps, score version, correction.
- **API/backend work:** Deterministic scoring service and explanation endpoint.
- **Frontend/UI work:** Intent label, evidence timeline, correction and freshness.
- **AI/agent work:** Summarize signals; deterministic service owns score.
- **Workflow/job work:** Event-driven recompute and decay schedule.
- **Security considerations:** Profiling transparency, data minimization, protected-trait exclusion.
- **Analytics events:** `intent_score_changed/viewed/corrected`, lead response latency.
- **Definition of done:** Fixed fixtures reproduce score; fairness/privacy review and correction tests pass.
- **Dependencies:** DOS-041, DOS-051.
- **Estimated complexity:** M
- **Release milestone:** M2

#### DOS-044 — Connect Gmail with least privilege

- **ID:** DOS-044
- **Epic:** Gmail workflows
- **Priority:** P0
- **Persona:** Workspace owner
- **User story:** As a workspace owner, I want to connect Gmail with clear scopes and account identity, so that approved one-to-one follow-up can be sent and correlated safely.
- **Business problem:** Email execution requires sensitive access and provider trust.
- **Expected outcome:** Connection can send/read only the golden-path capabilities explicitly consented to and can be revoked.
- **Acceptance criteria:** OAuth state+PKCE; exact Google account confirmed; incremental least-privilege scopes; encrypted refresh token reference; domain/account policy checked; send and history/watch capabilities probed; connection health/expiry/revoke visible; production verification requirements documented; no batch scope implied.
- **Happy path:** Owner grants scopes and test verifies draft/send plus reply-watch capability.
- **Alternative paths:** Send-only connection limits reply tracking; simulation; reconnect another account.
- **Failure states:** Consent denied, scope unavailable, unverified app restriction, admin policy, token revoked.
- **Permissions:** Owner/admin connects; email operator uses capability; no member sees tokens.
- **Data required:** Installation, account identity, scopes, token ref/expiry, consent, watch state.
- **API/backend work:** Google OAuth/callback/refresh/revoke and Gmail adapter.
- **Frontend/UI work:** Scope rationale, account confirmation, verification/reconnect states.
- **AI/agent work:** None in authentication.
- **Workflow/job work:** Refresh, watch renewal, capability health.
- **Security considerations:** Vault/KMS, OAuth CSRF, secret redaction, Google data policy/retention.
- **Analytics events:** `gmail_connect_started/completed/failed/revoked`, scopes granted.
- **Definition of done:** Google test account send/watch/revoke conformance and security review pass.
- **Dependencies:** DOS-059, DOS-073.
- **Estimated complexity:** XL (split OAuth/send/watch/revoke/UI)
- **Release milestone:** M1

#### DOS-045 — Draft, approve, and send a personalized Gmail follow-up

- **ID:** DOS-045
- **Epic:** Gmail workflows
- **Priority:** P0
- **Persona:** Sales operator
- **User story:** As a sales operator, I want a relevant follow-up drafted and sent only after approval, so that I respond quickly without surrendering judgment.
- **Business problem:** Slow follow-up loses demand; automatic generic outreach creates spam and brand risk.
- **Expected outcome:** Median qualified-lead response time falls below configured SLA while complaint/approval violations remain zero.
- **Acceptance criteria:** Draft cites lead intent/context and excludes unsupported personalization; exact to/from/subject/body/thread/CTA are previewed; consent/suppression/quiet hours/frequency/policy/connector/budget checks pass; approval hash expires; send creates attempt before call and requires Gmail message/thread receipt; no BCC/mass send in MVP.
- **Happy path:** Operator edits suggested draft, requests approval, approver accepts, one email sends.
- **Alternative paths:** Save draft in Gmail only; schedule; reject/request changes; simulate.
- **Failure states:** Unsubscribed, duplicate recipient window, expired approval/token, provider timeout/ambiguity, thread missing.
- **Permissions:** Sales editor drafts; email approver approves; authorized operator sends.
- **Data required:** Lead/consent, thread context, approved payload/hash, policies, attempt/receipt.
- **API/backend work:** Draft/preflight/approval/execute contracts and Gmail adapter.
- **Frontend/UI work:** Composer, context/evidence rail, exact approval diff/status timeline.
- **AI/agent work:** Draft with tone/claim/privacy guardrails; never sends.
- **Workflow/job work:** Scheduled send, idempotency, reconcile ambiguous result.
- **Security considerations:** Prompt injection in inbound email, PII, header injection, spam rules.
- **Analytics events:** `followup_drafted/edited/approval_requested/sent/delivered`, response time.
- **Definition of done:** Consent/duplicate/mutation/timeout/thread and provider E2Es pass.
- **Dependencies:** DOS-028, DOS-041, DOS-044, DOS-065, DOS-070.
- **Estimated complexity:** L
- **Release milestone:** M1

#### DOS-046 — Correlate replies and enforce unsubscribe/suppression

- **ID:** DOS-046
- **Epic:** Gmail workflows
- **Priority:** P0
- **Persona:** Sales operator
- **User story:** As a sales operator, I want replies and unsubscribe requests correlated to the lead and experiment, so that I can continue genuine conversations and stop unwanted contact.
- **Business problem:** Delivery is not reply; missed replies lose sales and ignored opt-outs create legal/reputation risk.
- **Expected outcome:** ≥95% of eligible replies link automatically; suppression takes effect before any later send.
- **Acceptance criteria:** Gmail history/watch events are authenticated/deduped; thread/message headers map reply to outbound action/lead; uncertain matches queue human review; intent categories include positive/question/objection/not-now/unsubscribe/out-of-office; explicit unsubscribe immediately suppresses workspace contact; future sends fail closed; manual correction audited.
- **Happy path:** Lead replies with question; timeline updates, owner alerted, experiment reply metric increments.
- **Alternative paths:** Manual thread link; out-of-office schedules no automatic resend; not-now follow-up requires approval.
- **Failure states:** Watch expired, history gap, ambiguous forwarded mail, spoofed headers, parsing failure.
- **Permissions:** Sales users read permitted mailbox-derived content; owner manages suppression policy.
- **Data required:** Provider messages/threads, minimal content refs, mapping, classification, suppression.
- **API/backend work:** Gmail event ingestion, correlation, suppression endpoint.
- **Frontend/UI work:** Conversation timeline, ambiguous inbox, unsubscribe lock state.
- **AI/agent work:** Treat inbound body as hostile; classify intent with confidence/evidence.
- **Workflow/job work:** Watch renewal, history backfill, retry/dedupe, alerts.
- **Security considerations:** Inbound prompt injection, phishing links, mailbox privacy, retention, unsubscribe law.
- **Analytics events:** `reply_received/correlated/classified`, `unsubscribe_recorded`, `send_suppressed`.
- **Definition of done:** Reply/forward/gap/unsubscribe/adversarial-email fixtures pass; no send after suppression.
- **Dependencies:** DOS-044, DOS-045, DOS-070.
- **Estimated complexity:** XL (split ingestion/correlation/classification/suppression)
- **Release milestone:** M1

### Revenue and Stripe

#### DOS-047 — Connect Stripe and synchronize commercial references

- **ID:** DOS-047
- **Epic:** Revenue and Stripe
- **Priority:** P0
- **Persona:** Workspace owner
- **User story:** As a workspace owner, I want to connect the correct Stripe account and synchronize products/customers, so that revenue can be verified against my commercial graph.
- **Business problem:** Webhook-only payments lack durable product/customer mapping and account consent.
- **Expected outcome:** Correct account is healthy, backfill is bounded, and product/customer refs are tenant-linked without copying unnecessary data.
- **Acceptance criteria:** Stripe Connect OAuth or approved key model identifies account; least scopes; webhook endpoint/secret configured; test/live mode distinct; products/prices/customers sync incrementally with cursor and checkpoints; deleted objects tombstoned; data minimization rules apply; connection reports health/freshness.
- **Happy path:** Owner connects test account and selected products map to offers.
- **Alternative paths:** Webhook-only MVP with explicit mapping gaps; manual offer mapping.
- **Failure states:** Wrong mode/account, restricted key, webhook setup failure, pagination/rate limit, revoked access.
- **Permissions:** Owner/admin connects/maps; finance role views customer details.
- **Data required:** Account/mode, token ref, webhook config, external refs, sync cursors/mappings.
- **API/backend work:** Stripe auth/install, sync adapters, mapping endpoints.
- **Frontend/UI work:** Account/mode warning, sync progress, offer mapping and reconnect.
- **AI/agent work:** Suggest product-offer mapping; user confirms.
- **Workflow/job work:** Incremental backfill, webhook reconciliation, token health.
- **Security considerations:** Signed webhooks, encrypted secrets, PCI boundary, financial PII.
- **Analytics events:** `stripe_connected/disconnected`, `stripe_sync_started/completed/failed`, mapping confirmed.
- **Definition of done:** Stripe test-mode connect/sync/revoke/rate-limit tests and security review pass.
- **Dependencies:** DOS-059, DOS-073.
- **Estimated complexity:** XL (split install/sync/mapping/UI)
- **Release milestone:** M1

#### DOS-048 — Verify and record payment events

- **ID:** DOS-048
- **Epic:** Revenue and Stripe
- **Priority:** P0
- **Persona:** Executive
- **User story:** As an executive, I want payments recorded only from verified Stripe events, so that displayed revenue is commercial truth.
- **Business problem:** Client events or AI assertions can fabricate revenue.
- **Expected outcome:** 100% of counted payments have valid signature, account/workspace mapping, provider identity, and replay-safe state transition.
- **Acceptance criteria:** Verify raw-body signature/tolerance before parse; dedupe event ID; require workspace/account binding; handle selected payment/checkout/invoice events; preserve event and payment identities; transitions are idempotent/out-of-order safe; amount/currency/status/mode/received/occurred recorded; persistence failure returns retryable non-2xx.
- **Happy path:** `payment_intent.succeeded` creates verified payment and mission counter once.
- **Alternative paths:** Event lacks attribution but remains workspace revenue; pending later succeeds.
- **Failure states:** Bad signature, unknown account, malformed amount, duplicate/out-of-order, DB failure.
- **Permissions:** Public webhook uses signature authority; finance users view; no user creates verified payment.
- **Data required:** Webhook inbox/hash, provider event/payment/customer IDs, amount/currency/status.
- **API/backend work:** Raw webhook boundary, inbox/dedupe, payment state machine.
- **Frontend/UI work:** Verified badge/source/time; delayed webhook status.
- **AI/agent work:** None determines verification.
- **Workflow/job work:** Async processing after durable inbox; replay/reconciliation.
- **Security considerations:** Signature/replay/tenant mapping, secret rotation, safe raw-event retention.
- **Analytics events:** Operational `stripe_webhook_verified/rejected/deduplicated`, `payment_verified`.
- **Definition of done:** Stripe fixture suite, replay/out-of-order/failure and tenant-metadata tests pass.
- **Dependencies:** DOS-047, DOS-070.
- **Estimated complexity:** L
- **Release milestone:** M1

#### DOS-049 — Handle refunds and reconcile discrepancies

- **ID:** DOS-049
- **Epic:** Revenue and Stripe
- **Priority:** P0
- **Persona:** Finance-aware owner
- **User story:** As a business owner, I want refunds and discrepancies reconciled to original payments, so that net revenue and campaign economics remain true.
- **Business problem:** Gross success counts remain inflated after refunds, disputes, missed events, or mapping errors.
- **Expected outcome:** Net verified revenue matches Stripe within defined tolerance and unresolved differences have owners.
- **Acceptance criteria:** Refund/dispute/chargeback events link to original payment; partial/multiple refunds supported; net and gross remain separate; reconciliation compares provider objects to ledger by window/currency/mode; discrepancies classify missing/duplicate/status/amount/mapping; resolution never overwrites raw event; attribution reverses proportionally and result versions.
- **Happy path:** Partial refund reduces net attributed revenue and revises experiment outcome.
- **Alternative paths:** Manual declared adjustment stays unverified; replay missing event; remap customer after review.
- **Failure states:** Original payment absent, currency mismatch, API unavailable, closed period/hold.
- **Permissions:** Finance/owner reviews and resolves; system ingests; manual adjustment needs approval.
- **Data required:** Payment/refund/dispute lineage, reconciliation runs/items/resolutions.
- **API/backend work:** Refund state, reconciliation query/job, resolution commands.
- **Frontend/UI work:** Gross/net/refund view and discrepancy work queue.
- **AI/agent work:** Explain likely cause only; no financial mutation.
- **Workflow/job work:** Daily reconciliation with backoff and alerts.
- **Security considerations:** Financial audit immutability, least privilege, PII redaction.
- **Analytics events:** `refund_verified`, `reconciliation_run`, `discrepancy_opened/resolved`.
- **Definition of done:** Partial/multiple/out-of-order refund fixtures reconcile exactly.
- **Dependencies:** DOS-048, DOS-070.
- **Estimated complexity:** L
- **Release milestone:** M1

#### DOS-050 — Display revenue truth without overstating attribution

- **ID:** DOS-050
- **Epic:** Revenue and Stripe
- **Priority:** P0
- **Persona:** Executive
- **User story:** As an executive, I want gross, net, pending, refunded, and attributed revenue separated, so that I make decisions from verified money rather than optimistic dashboards.
- **Business problem:** Revenue and attributed revenue are distinct, and collapsing them misleads decision-makers.
- **Expected outcome:** Users can reconcile any displayed total to provider records and understand unattributed share.
- **Acceptance criteria:** Totals group currency/mode/status; never sum currencies without explicit FX source; show gross/net/refunds/pending/unattributed and attribution confidence bands; each value has as-of/freshness and drilldown; simulation excluded by default; no-data differs from zero; exported totals use same query/version.
- **Happy path:** Owner drills from net revenue to payment, refund, and touchpoint attribution.
- **Alternative paths:** Filter test mode; view currency separately; inspect unattributed queue.
- **Failure states:** Stale Stripe, reconciliation open, FX unavailable, permission-limited aggregate.
- **Permissions:** Revenue viewers see totals; finance role sees customer/payment details.
- **Data required:** Verified payment/refund ledger, attribution versions, connector freshness.
- **API/backend work:** Revenue summary/detail/export contract with shared calculation library.
- **Frontend/UI work:** Truth-first cards, waterfall/table, data quality and mode labels.
- **AI/agent work:** Narrative cites exact aggregate snapshot.
- **Workflow/job work:** Projection rebuild and reconciliation status.
- **Security considerations:** Financial field authorization; prevent spreadsheet formula injection in export.
- **Analytics events:** `revenue_viewed/drilled/exported`, `unattributed_revenue_viewed`.
- **Definition of done:** Ledger fixtures equal UI/API/export totals; accessibility and permission tests pass.
- **Dependencies:** DOS-048, DOS-049, DOS-052.
- **Estimated complexity:** M
- **Release milestone:** M1

### Attribution and analytics

#### DOS-051 — Capture source, campaign, and UTM touchpoints

- **ID:** DOS-051
- **Epic:** Attribution
- **Priority:** P0
- **Persona:** Growth operator
- **User story:** As a growth operator, I want consented source and campaign touchpoints captured consistently, so that I can connect distribution work to downstream demand.
- **Business problem:** Inconsistent UTMs and client-only tracking break the causal chain before a lead appears.
- **Expected outcome:** At least 95% of golden-path visits and leads carry a normalized source or an explicit `unknown` reason.
- **Acceptance criteria:** Versioned event schema accepts server/client events; UTMs and click/action/campaign IDs are normalized; anonymous IDs merge to a lead only with permitted evidence; dedupe and late arrival are deterministic; bot/internal traffic is labeled; consent is enforced; missing is distinct from direct.
- **Happy path:** An approved action link produces visit, CTA, form, and lead touchpoints under one campaign.
- **Alternative paths:** Direct visit; privacy-preserving aggregate; GA/PostHog import; offline source declared by a user.
- **Failure states:** Blocked script, malformed UTM, duplicate event, identity conflict, consent denied.
- **Permissions:** Public collection uses scoped write keys; workspace analysts read; PII linkage requires sales permission.
- **Data required:** Event ID, tenant, session/subject refs, source/medium/campaign/content/term, action, timestamps, consent, evidence.
- **API/backend work:** `/v1/events` ingestion, schema registry, identity-link and touchpoint query APIs.
- **Frontend/UI work:** Tracking builder, live debugger, touchpoint timeline, consent and quality states.
- **AI/agent work:** None may invent missing source; AI may explain observed paths.
- **Workflow/job work:** Dedupe, enrichment, bot labeling, late-event projection rebuild.
- **Security considerations:** Signed keys, origin limits, data minimization, no fingerprinting, injection-safe dimensions.
- **Analytics events:** `tracking_event_accepted/rejected/deduplicated`, coverage and unknown-source rate.
- **Definition of done:** Browser/server fixtures prove consent, ordering, dedupe, tenant isolation, and end-to-end traceability.
- **Dependencies:** DOS-032, DOS-070.
- **Estimated complexity:** L
- **Release milestone:** M1

#### DOS-052 — Attribute conversions and revenue with confidence

- **ID:** DOS-052
- **Epic:** Attribution
- **Priority:** P0
- **Persona:** Executive
- **User story:** As an executive, I want conversions and verified payments attributed with an explainable confidence level, so that I invest without mistaking correlation for causation.
- **Business problem:** Last-click dashboards hide uncertainty and over-credit visible channels.
- **Expected outcome:** Every attributed payment exposes its model, eligible touchpoints, confidence, and limitations.
- **Acceptance criteria:** First-touch and last-touch models ship first; windows and eligibility are versioned; deterministic identity rules link payment/customer/lead; confidence derives from identity and tracking completeness; unattributed remains visible; recalculation creates a new version; totals never exceed verified net revenue.
- **Happy path:** Stripe customer matches a lead whose tracked campaign touchpoints produce explainable first/last attribution.
- **Alternative paths:** Coupon or declared sales source raises partial confidence; multi-device remains uncertain; no touchpoint is unattributed.
- **Failure states:** Conflicting identity, missing UTM, late refund, cross-currency total, model job failure.
- **Permissions:** Analysts view aggregates; finance/sales permissions govern identifiable drilldown.
- **Data required:** Touchpoints, identity links, conversions, payments/refunds, model/window version, confidence factors.
- **API/backend work:** Versioned attribution engine and result/explanation APIs.
- **Frontend/UI work:** Path view, model selector, confidence breakdown, unattributed queue.
- **AI/agent work:** Explain results from frozen inputs; cannot alter weights or payment truth.
- **Workflow/job work:** Recalculate on identity, event, payment, refund, or model changes.
- **Security considerations:** Tenant-safe identity graph, purpose limitation, export controls.
- **Analytics events:** `attribution_viewed/model_changed/explained`, attributed share and confidence distribution.
- **Definition of done:** Golden fixtures reconcile across model versions, refunds, late events, and UI/API/export.
- **Dependencies:** DOS-048, DOS-049, DOS-051.
- **Estimated complexity:** L
- **Release milestone:** M1

#### DOS-053 — Detect missing or broken measurement

- **ID:** DOS-053
- **Epic:** Analytics
- **Priority:** P1
- **Persona:** Growth operator
- **User story:** As a growth operator, I want tracking gaps detected before launch, so that an experiment does not spend time or money without learnable evidence.
- **Business problem:** Campaigns often launch with missing events, mismatched domains, or unresolvable conversion paths.
- **Expected outcome:** Measurement readiness is a blocking preflight for governed actions.
- **Acceptance criteria:** Preflight checks destination reachability, approved domains, UTM persistence, CTA/form event, identity link, conversion/payment mapping, connector freshness, sample/test traffic, and consent; each check is pass/warn/block with remediation; overrides require authorized reason and expire.
- **Happy path:** Test visit reaches the conversion event and returns the expected campaign/action identifiers.
- **Alternative paths:** Server-side conversion test; manual evidence for offline conversion; simulation.
- **Failure states:** CSP/cookie block, redirect strips UTM, wrong domain, stale analytics, event schema mismatch.
- **Permissions:** Operator runs tests; approver may accept warnings; security blocks non-overridable risks.
- **Data required:** Plan, URLs, schema, test run, expected/observed events, connector health.
- **API/backend work:** Measurement preflight and remediation contracts.
- **Frontend/UI work:** Readiness checklist with live test trace and blocked launch state.
- **AI/agent work:** Summarize likely cause from deterministic check output.
- **Workflow/job work:** Scheduled health probes and pre-launch recheck.
- **Security considerations:** Safe URL fetch, synthetic-data labeling, no production PII in tests.
- **Analytics events:** `measurement_preflight_started/passed/blocked/overridden`, gap categories.
- **Definition of done:** Fault injection catches every golden-path break and blocks execution as configured.
- **Dependencies:** DOS-005, DOS-035, DOS-051.
- **Estimated complexity:** M
- **Release milestone:** M2

#### DOS-054 — Explain metric changes and connect activity to revenue

- **ID:** DOS-054
- **Epic:** Analytics
- **Priority:** P1
- **Persona:** Marketing manager
- **User story:** As a marketing manager, I want material metric changes explained from evidence, so that I know which action to continue, stop, or investigate.
- **Business problem:** Charts reveal changes but not whether instrumentation, mix, seasonality, or action performance caused them.
- **Expected outcome:** Users reach a supported next decision faster without causal overclaiming.
- **Acceptance criteria:** Compare fixed windows/cohorts and denominators; surface data-quality changes first; show funnel deltas from reach through verified revenue; candidate explanations cite evidence and counterevidence; causal language is prohibited without valid experiment; recommendation includes impact, confidence, risk, and next test.
- **Happy path:** Reply conversion rises for a winning variant and the explanation links the approved content, cohort, replies, and revenue.
- **Alternative paths:** Change is below threshold; instrumentation explains delta; insufficient sample returns inconclusive.
- **Failure states:** Stale connector, changed metric definition, missing baseline, currency mismatch, model unavailable.
- **Permissions:** Analysts view authorized aggregates; evidence drilldown respects source permissions.
- **Data required:** Versioned metrics, cohorts, actions, experiments, evidence, attribution, quality flags.
- **API/backend work:** Metric comparison snapshots and explanation evidence bundle.
- **Frontend/UI work:** Funnel delta, annotated timeline, explanation/counterevidence rail.
- **AI/agent work:** Generate bounded explanation from supplied calculations; structured claim validator.
- **Workflow/job work:** Anomaly detection, snapshot freeze, notification routing.
- **Security considerations:** Minimum cohort sizes, no sensitive inference, prompt/evidence isolation.
- **Analytics events:** `metric_change_detected/viewed`, `explanation_accepted/rejected`, decision time.
- **Definition of done:** Evaluation set rejects unsupported causality and reproduces all displayed calculations.
- **Dependencies:** DOS-040, DOS-050, DOS-052, DOS-067.
- **Estimated complexity:** L
- **Release milestone:** M2

### AI Workforce and Agent Memory

#### DOS-055 — Use an evidence-grounded AI COO

- **ID:** DOS-055
- **Epic:** AI Workforce
- **Priority:** P1
- **Persona:** Founder
- **User story:** As a founder, I want an AI COO to answer commercial questions and propose the next decision, so that I can act across the operating loop without losing evidence or control.
- **Business problem:** Users must synthesize fragmented product, campaign, lead, and revenue context themselves.
- **Expected outcome:** Answers shorten decision time and always distinguish observed fact, inference, unknown, and proposed action.
- **Acceptance criteria:** Retrieval is tenant/permission scoped; response schema contains answer, evidence, freshness, confidence, risks, unknowns, and next action; write/tool actions are previews; approval is requested through policy service; citations open exact records; abstain when evidence is insufficient.
- **Happy path:** Founder asks why revenue stalled and receives a cited funnel diagnosis plus a proposed experiment.
- **Alternative paths:** Clarifying question; compare strategies; read-only mobile answer; handoff to specialist.
- **Failure states:** Retrieval unavailable, conflicting evidence, permission gap, model timeout, unsafe requested action.
- **Permissions:** Any member asks within access; proposed actions require their normal capabilities.
- **Data required:** Authorized graph/evidence/metrics, question, prompt/model/tool versions, response evaluation.
- **API/backend work:** Conversation/run endpoints, retrieval authorization, structured response validation.
- **Frontend/UI work:** Persistent command bar/chat, citations, confidence, proposed-action preview.
- **AI/agent work:** Orchestrate read tools only by default; enforce evidence coverage and abstention.
- **Workflow/job work:** Long analysis can run durably with cancel/resume and progress.
- **Security considerations:** Prompt injection defense, tool allowlists, output encoding, retention controls.
- **Analytics events:** `coo_question_asked/answered/abstained`, citation opened, proposal accepted.
- **Definition of done:** Permission, injection, citation, hallucination, timeout, and accessibility eval suites pass.
- **Dependencies:** DOS-016, DOS-061, DOS-066, DOS-069.
- **Estimated complexity:** L
- **Release milestone:** M2

#### DOS-056 — Invoke role-bounded specialist agents

- **ID:** DOS-056
- **Epic:** AI Workforce
- **Priority:** P1
- **Persona:** Growth operator
- **User story:** As a growth operator, I want specialist agents for content, growth, market, revenue, customer research, and analytics, so that each task uses an explicit method and permission boundary.
- **Business problem:** One omnipotent assistant obscures expertise, inputs, evaluation, and accountability.
- **Expected outcome:** Specialist outputs are reproducible artifacts that can be reviewed and measured.
- **Acceptance criteria:** Each role declares allowed tools/data, input/output schema, prompt/eval version, cost/time ceiling, approval needs, and fallback; six agents produce drafts only unless capability policy allows more; role cannot inherit caller permissions; result shows evidence/confidence/limitations.
- **Happy path:** Growth agent requests market evidence, then creates a scored experiment proposal.
- **Alternative paths:** User chooses one specialist; deterministic template fallback; agent abstains.
- **Failure states:** Tool denied, budget exhausted, invalid structure, evidence too stale, dependency agent fails.
- **Permissions:** Run authorization intersects user, role, workspace policy, and tool capability.
- **Data required:** Agent definition, run, task, tool calls, costs, artifacts, evaluation.
- **API/backend work:** Agent registry, run/artifact APIs, capability tokens.
- **Frontend/UI work:** Workforce roster, scope cards, run detail, artifact compare.
- **AI/agent work:** Versioned specialist prompts, routers, validators, evaluation sets.
- **Workflow/job work:** Durable runs with quotas, cancellation, timeouts, retry classification.
- **Security considerations:** Least privilege, data boundary labels, sandboxed untrusted content.
- **Analytics events:** `agent_run_started/completed/failed`, cost, latency, artifact adoption.
- **Definition of done:** Contract, authorization, budget, fallback, and domain-quality evals pass per agent.
- **Dependencies:** DOS-055, DOS-061, DOS-069, DOS-071.
- **Estimated complexity:** XL (deliver one role at a time)
- **Release milestone:** M2

#### DOS-057 — Coordinate and delegate agent tasks transparently

- **ID:** DOS-057
- **Epic:** AI Workforce
- **Priority:** P2
- **Persona:** Marketing manager
- **User story:** As a marketing manager, I want agents to delegate bounded subtasks with visible dependencies, so that complex plans complete without hidden actions.
- **Business problem:** Opaque multi-agent chains are hard to debug, govern, or trust.
- **Expected outcome:** Every delegated task has an owner, scope, budget, status, artifact, and trace.
- **Acceptance criteria:** Parent creates typed task DAG; cycles and unbounded fan-out rejected; child receives minimum context/capabilities; shared writes use optimistic concurrency; user can inspect, cancel, retry, or take over; failed child yields partial result; no agent can approve another agent's action.
- **Happy path:** COO delegates audience research and content options, then synthesizes one proposal.
- **Alternative paths:** Sequential fallback; user completes task; one branch abstains.
- **Failure states:** Deadlock, cost ceiling, conflicting artifacts, stale parent, child timeout.
- **Permissions:** Delegated rights are a strict subset of initiating user's current rights.
- **Data required:** Task graph, dependencies, context refs, capabilities, states, artifacts, costs.
- **API/backend work:** Task DAG commands/queries and scoped capability issuance.
- **Frontend/UI work:** Run graph, progress, blockers, costs, cancel/take-over controls.
- **AI/agent work:** Planner constrained by task and fan-out schemas; deterministic merge checks.
- **Workflow/job work:** Durable DAG scheduling, compensation, lease recovery.
- **Security considerations:** Confused-deputy prevention, context minimization, revocation propagation.
- **Analytics events:** `agent_task_delegated/completed/taken_over`, chain success/cost.
- **Definition of done:** Cycle, revocation, partial failure, concurrency, and cost-cap tests pass.
- **Dependencies:** DOS-056, DOS-063, DOS-069.
- **Estimated complexity:** XL
- **Release milestone:** M3

#### DOS-058 — Review agent approval requests

- **ID:** DOS-058
- **Epic:** AI Workforce
- **Priority:** P1
- **Persona:** Approver
- **User story:** As an approver, I want agent-proposed actions in the normal approval queue, so that AI never bypasses commercial controls.
- **Business problem:** Conversational consent is ambiguous and can conceal material payload changes.
- **Expected outcome:** Zero agent-originated executions occur without a valid deterministic authorization decision.
- **Acceptance criteria:** Request includes origin agent/run, exact payload/hash, evidence, confidence, cost, risk, policy checks, expiry, and diff; approve/reject/request-change supported; mutation invalidates; separation of duties configurable; approval is not execution; expired/revoked requests block.
- **Happy path:** Content agent submits a post; approver edits, triggering a new version, then approves it.
- **Alternative paths:** Bulk review only for identical low-risk class; delegate approver temporarily; simulation.
- **Failure states:** Stale evidence, unavailable connector, changed budget, missing approver, expired request.
- **Permissions:** Policy-selected approvers; agents and request creators cannot self-approve where separation applies.
- **Data required:** Agent run, action version/hash, policy evaluation, decision, actor, timestamps.
- **API/backend work:** Agent proposal adapter into generic approval commands.
- **Frontend/UI work:** Unified inbox with AI-origin badge, diff, evidence, and expiry.
- **AI/agent work:** Generates rationale only; cannot mutate after submission.
- **Workflow/job work:** Expiry/escalation and revocation cancel queued executions.
- **Security considerations:** Non-repudiation, replay prevention, delegated-approval boundaries.
- **Analytics events:** `agent_approval_requested/approved/rejected/expired`, cycle time.
- **Definition of done:** Bypass, self-approval, mutation, expiry, revocation, and race tests pass.
- **Dependencies:** DOS-056, DOS-062, DOS-063.
- **Estimated complexity:** M
- **Release milestone:** M2

#### DOS-059 — Store and govern agent memory

- **ID:** DOS-059
- **Epic:** Agent Memory
- **Priority:** P1
- **Persona:** Workspace owner
- **User story:** As a workspace owner, I want agent memory to be inspectable, correctable, and source-linked, so that automation learns without turning guesses into truth.
- **Business problem:** Hidden long-term memory compounds stale facts, tenant leakage, and unsupported assumptions.
- **Expected outcome:** Reused context is accurate, permission-aware, and deletable.
- **Acceptance criteria:** Memory types are session, workspace fact, preference, lesson, and proposed memory; every durable entry has source, confidence, freshness, owner, sensitivity, retention, and version; facts require observed/provider/user-confirmed source; user can edit/archive/forget; retrieval filters permissions and staleness; deletion propagates to semantic indexes.
- **Happy path:** User-confirmed brand preference is reused with a visible memory citation.
- **Alternative paths:** Session-only mode; proposed lesson awaits confirmation; conflicting memory marked disputed.
- **Failure states:** Source deleted, stale entry, embedding unavailable, access revoked, deletion backlog.
- **Permissions:** Owners set policy; members see/edit authorized memories; agents only propose or use allowed types.
- **Data required:** Memory/version/source refs, sensitivity, retention, embeddings optional, access log.
- **API/backend work:** Memory CRUD/search/forget APIs and authorization filters.
- **Frontend/UI work:** Memory browser, provenance, correction, retention, used-in-run view.
- **AI/agent work:** Extraction proposes structured memories; retrieval cites IDs and ignores instructions in content.
- **Workflow/job work:** Freshness decay, re-index, retention deletion, source revocation.
- **Security considerations:** Tenant-separated indexes, PII classification, right-to-delete, poisoning defense.
- **Analytics events:** `memory_proposed/confirmed/corrected/forgotten/used`, stale-use rate.
- **Definition of done:** Isolation, provenance, correction, deletion, poisoning, and stale-retrieval tests pass.
- **Dependencies:** DOS-011, DOS-061, DOS-066.
- **Estimated complexity:** L
- **Release milestone:** M2

#### DOS-060 — Recover failed agent runs and display calibrated confidence

- **ID:** DOS-060
- **Epic:** AI Workforce
- **Priority:** P1
- **Persona:** Growth operator
- **User story:** As a growth operator, I want failed agent work to recover safely and confidence to reflect evidence quality, so that I can decide whether to trust, retry, or take over.
- **Business problem:** Silent retries and decorative confidence hide cost, partial work, and uncertainty.
- **Expected outcome:** Agent failures are recoverable without duplicate side effects and confidence is empirically monitored.
- **Acceptance criteria:** Run states include queued/running/waiting/partial/succeeded/failed/cancelled/blocked; checkpoints persist before tool calls; retry only classified transient failures; side-effect tools require idempotency; partial artifacts visible; confidence includes model calibration band, evidence coverage/freshness, and sample caveat; user can retry from safe checkpoint or take over.
- **Happy path:** Model timeout resumes from last completed research artifact and produces one result.
- **Alternative paths:** Switch approved model; accept partial; cancel; deterministic fallback.
- **Failure states:** Invalid checkpoint, repeated permanent failure, tool outcome ambiguous, cost cap, model outage.
- **Permissions:** Run owner/operator controls retries; model/cost changes respect workspace policy.
- **Data required:** Run/checkpoints/attempts, tool receipts, error class, cost, confidence components, eval version.
- **API/backend work:** Run-control and confidence-explanation APIs.
- **Frontend/UI work:** State timeline, partial artifacts, retry/takeover, confidence breakdown.
- **AI/agent work:** Self-report is not confidence; use evaluation/calibration service.
- **Workflow/job work:** Leases, heartbeat, retry budget, dead-letter and reconciliation.
- **Security considerations:** Redacted errors, no retry of unauthorized or unsafe calls, checkpoint encryption.
- **Analytics events:** `agent_run_retried/recovered/taken_over`, calibration error, duplicate side effects.
- **Definition of done:** Crash/timeout/ambiguous-tool/cancel/cost and calibration tests pass.
- **Dependencies:** DOS-056, DOS-069, DOS-070.
- **Estimated complexity:** L
- **Release milestone:** M2

### Approvals and policies

#### DOS-061 — Configure approval and autonomy policies

- **ID:** DOS-061
- **Epic:** Governance
- **Priority:** P0
- **Persona:** Workspace owner
- **User story:** As a workspace owner, I want policies by risk, channel, action, and autonomy level, so that execution matches my tolerance and obligations.
- **Business problem:** A single autonomy switch cannot express spending, publishing, outreach, or role risk.
- **Expected outcome:** Every action receives a deterministic allow, require-approval, or deny decision with reasons.
- **Acceptance criteria:** Policies support action/channel/recipient/source/risk, autonomy level, confidence/evidence minimum, budget, schedule, role, and connector health; deny overrides allow; system safety rules cannot be weakened; versions have effective times; dry-run shows affected capabilities; default is approval-required; promotion/demotion criteria are measurable.
- **Happy path:** Owner permits scheduled low-risk drafts but requires approval for public publish and every email send.
- **Alternative paths:** Template by persona; stricter channel override; temporary policy with expiry.
- **Failure states:** Conflicting rule, invalid scope, stale client version, no eligible approver, policy service unavailable.
- **Permissions:** Owner/admin edits; members read relevant rules; platform safety rules read-only.
- **Data required:** Policy/set/version/rules, author, effective/expiry, test cases, evaluation log.
- **API/backend work:** Policy CRUD, compile, dry-run, evaluate, rollback APIs.
- **Frontend/UI work:** Plain-language builder, conflict warnings, capability matrix, version diff.
- **AI/agent work:** May suggest rules; deterministic engine validates/evaluates.
- **Workflow/job work:** Re-evaluate queued work on policy/revocation changes.
- **Security considerations:** Fail closed, signed/versioned decisions, privilege escalation tests.
- **Analytics events:** `policy_created/changed/tested/rolled_back`, deny/approval rates.
- **Definition of done:** Decision-table, precedence, migration, outage, and authorization tests pass.
- **Dependencies:** DOS-075, DOS-076.
- **Estimated complexity:** L
- **Release milestone:** M0

#### DOS-062 — Approve, reject, or request changes to an action

- **ID:** DOS-062
- **Epic:** Governance
- **Priority:** P0
- **Persona:** Approver
- **User story:** As an approver, I want to inspect the exact proposed action and decide it, so that nothing material executes by implication.
- **Business problem:** Chat acknowledgements and blanket approvals are ambiguous and unauditable.
- **Expected outcome:** Approval decisions are fast, attributable, and bound to immutable payloads.
- **Acceptance criteria:** Queue shows payload/diff, audience, evidence, risk, cost, connector, schedule, confidence, policy, and simulation status; approve/reject/request-change requires reason as configured; payload hash and version bind decision; optimistic locking prevents double decision; approval does not imply success.
- **Happy path:** Approver opens request, checks evidence, approves exact version, and sees it queued.
- **Alternative paths:** Reject; request edit; delegate; batch only within policy-defined homogeneous class.
- **Failure states:** Already decided, mutated, expired, permission revoked, evidence stale, connector unhealthy.
- **Permissions:** Only resolved approver role; separation of duties and delegation apply.
- **Data required:** Action/version/payload hash, policy result, request, decision, actor, comments.
- **API/backend work:** Approval commands with ETag/idempotency and decision queries.
- **Frontend/UI work:** Inbox, detail/diff, keyboard review, decision confirmation, status timeline.
- **AI/agent work:** Summarize evidence; never records the human decision.
- **Workflow/job work:** On approval enqueue only after fresh preflight; notify on decision.
- **Security considerations:** CSRF, session reauthentication for high risk, non-repudiation.
- **Analytics events:** `approval_opened/approved/rejected/changes_requested`, review time.
- **Definition of done:** Mutation, race, replay, delegation, expiry, and accessibility tests pass.
- **Dependencies:** DOS-061, DOS-066.
- **Estimated complexity:** M
- **Release milestone:** M1

#### DOS-063 — Enforce spend, channel, and autonomous-action limits

- **ID:** DOS-063
- **Epic:** Governance
- **Priority:** P0
- **Persona:** Workspace owner
- **User story:** As a workspace owner, I want hard limits on spend, channels, recipients, and autonomous actions, so that automation cannot exceed its mandate.
- **Business problem:** Approval without execution-time limits leaves race conditions and cumulative-risk gaps.
- **Expected outcome:** Zero executions exceed reserved budget or a current channel/autonomy restriction.
- **Acceptance criteria:** Per-action/day/month currency budgets, recipient/frequency caps, channel allowlist, risk exclusions, and autonomy ceiling enforced transactionally; reserve before queue, consume from provider result, release on terminal failure; currency conversion never assumed; queued work rechecked; platform abuse limits non-overridable.
- **Happy path:** Approved action reserves its cost, executes below ceiling, and settles actual cost.
- **Alternative paths:** No-cost action; owner raises future limit; simulation estimates without reserve.
- **Failure states:** Insufficient budget, concurrent reservation, stale FX, restricted channel, policy changed mid-run.
- **Permissions:** Owner configures; finance may manage budgets; operators see remaining allowance.
- **Data required:** Budget/limit/period, reservations, actuals, policy/action/connector refs.
- **API/backend work:** Atomic reserve/settle/release and limit query APIs.
- **Frontend/UI work:** Limit editor, remaining budget, preflight block and transaction history.
- **AI/agent work:** Can propose allocation; cannot reserve or modify limits.
- **Workflow/job work:** Expire reservations, reconcile provider cost, stop scheduled jobs.
- **Security considerations:** Integer minor units, concurrency, authorization, tamper-proof ledger.
- **Analytics events:** `budget_reserved/settled/released/blocked`, utilization and violations.
- **Definition of done:** Concurrency/property tests prove no overspend or bypass across retries.
- **Dependencies:** DOS-061, DOS-066.
- **Estimated complexity:** L
- **Release milestone:** M1

#### DOS-064 — Revoke or expire approval and execution permission

- **ID:** DOS-064
- **Epic:** Governance
- **Priority:** P0
- **Persona:** Workspace owner
- **User story:** As a workspace owner, I want approvals and delegated permissions to expire or be revoked, so that stale authorization cannot produce future actions.
- **Business problem:** Delayed jobs may execute after context, personnel, policy, or intent has changed.
- **Expected outcome:** Revocation propagates to every queued or resumable action before the next side effect.
- **Acceptance criteria:** Approvals have expiry and use count; owner/authorized approver can revoke; role/connector/policy changes invalidate affected grants; worker checks authorization immediately before each external call; queued job becomes blocked/cancelled; already accepted provider action is reconciled, not falsely undone; audit records propagation.
- **Happy path:** Owner revokes a scheduled post; worker cancels it and releases reservation.
- **Alternative paths:** Re-approval creates new version; revoke delegated approver; emergency channel kill switch.
- **Failure states:** Provider already executing, worker offline, revoke race, partial multi-step action.
- **Permissions:** Grant issuer, owner, or policy-defined administrator revokes; emergency rule restricted.
- **Data required:** Grant/approval, expiry/use, revocation, affected jobs, provider state.
- **API/backend work:** Revoke command, grant introspection, impacted-work query.
- **Frontend/UI work:** Revoke controls, impact preview, propagation status.
- **AI/agent work:** None controls revocation.
- **Workflow/job work:** Cancellation signals, pre-side-effect introspection, compensation/reconcile.
- **Security considerations:** Fail closed on introspection failure; race and replay protection.
- **Analytics events:** `approval_expired/revoked`, `job_cancelled_by_revocation`, propagation latency.
- **Definition of done:** Queue/running/partial/provider-race and outage tests pass.
- **Dependencies:** DOS-062, DOS-063.
- **Estimated complexity:** M
- **Release milestone:** M1

#### DOS-065 — Review complete governance history

- **ID:** DOS-065
- **Epic:** Governance
- **Priority:** P1
- **Persona:** Auditor
- **User story:** As an authorized auditor, I want to review who proposed, approved, changed, executed, or revoked an action, so that accountability is demonstrable.
- **Business problem:** Separate logs cannot prove authorization and execution continuity.
- **Expected outcome:** An audit reviewer can reconstruct the full governed action lifecycle.
- **Acceptance criteria:** Append-only timeline includes actor/service, tenant, action/version/hash, policy/version/result, approval, revocation, attempts, receipts, outcome, and correlation IDs; filters/export are deterministic; sensitive fields redacted by role; clock/source displayed; integrity check reports gaps.
- **Happy path:** Auditor traces one Gmail message from agent proposal through human approval to provider receipt.
- **Alternative paths:** Export signed manifest; inspect denied attempt; compare versions.
- **Failure states:** Missing event, integrity mismatch, storage lag, retention hold, export failure.
- **Permissions:** Owner/auditor; platform admins have no implicit tenant payload access.
- **Data required:** Audit/evidence/events and actor/service identity.
- **API/backend work:** Append/query/export/integrity APIs with cursor pagination.
- **Frontend/UI work:** Searchable timeline, filters, diff and integrity status.
- **AI/agent work:** May summarize selected records with citations; no log mutation.
- **Workflow/job work:** Export generation, integrity scan, retention/legal hold.
- **Security considerations:** Append-only storage, hash chaining/signing option, redaction, export watermark.
- **Analytics events:** `audit_viewed/exported/integrity_failed`.
- **Definition of done:** Lifecycle fixture reconstructs exactly; tamper, permission, pagination, export tests pass.
- **Dependencies:** DOS-062, DOS-064, DOS-066.
- **Estimated complexity:** M
- **Release milestone:** M1

### Evidence Ledger

#### DOS-066 — Record immutable sources and provenance

- **ID:** DOS-066
- **Epic:** Evidence Ledger
- **Priority:** P0
- **Persona:** Growth operator
- **User story:** As a growth operator, I want every material claim linked to an immutable source record, so that I can verify what the system believes and why.
- **Business problem:** URLs and generated prose alone do not preserve source content, capture time, or transformation lineage.
- **Expected outcome:** Every strategic artifact meets an evidence-coverage threshold or exposes its gap.
- **Acceptance criteria:** Source record stores tenant, type, locator, capture/observed time, freshness policy, content hash, bounded artifact ref, consent/access, extractor/version, and parent lineage; raw untrusted content is immutable; correction adds record; deletion uses tombstone/retention policy; claims link supporting or contradicting evidence.
- **Happy path:** Pricing assertion opens the exact sanitized page snapshot and extraction span.
- **Alternative paths:** User statement, provider event, analytics aggregate, manual document.
- **Failure states:** Source unavailable, hash mismatch, expired retention, access revoked, unsupported format.
- **Permissions:** Source access follows original sensitivity plus workspace role.
- **Data required:** Evidence/source/artifact/claim links, hashes, provenance, freshness.
- **API/backend work:** Evidence append/read/link/tombstone APIs and content-addressed storage.
- **Frontend/UI work:** Evidence drawer, source preview, provenance chain, missing-access state.
- **AI/agent work:** Must cite evidence IDs in structured output; webpage instructions never become tools.
- **Workflow/job work:** Capture, sanitize, hash, malware scan, freshness marking.
- **Security considerations:** SSRF/file safety, immutable audit, object-store tenant keys, PII retention.
- **Analytics events:** `evidence_recorded/viewed/linked/staled`, coverage rate.
- **Definition of done:** Hash, lineage, access, tamper, stale, and deletion-policy tests pass.
- **Dependencies:** DOS-076.
- **Estimated complexity:** L
- **Release milestone:** M0

#### DOS-067 — Record recommendations, decisions, executions, and outcomes

- **ID:** DOS-067
- **Epic:** Evidence Ledger
- **Priority:** P0
- **Persona:** Founder
- **User story:** As a founder, I want the entire decision-to-outcome chain recorded, so that the system learns from what actually happened rather than from generated plans.
- **Business problem:** Recommendations, decisions, attempts, and outcomes are often conflated or lost.
- **Expected outcome:** Every completed experiment has a traceable causal record and explicit unresolved gaps.
- **Acceptance criteria:** Typed ledger entries cover recommendation, user/system decision, approval, attempt, provider result, metric outcome, revenue evidence, and lesson; each references prior entries and frozen artifact versions; states remain distinct; late/corrective entries append; simulations cannot satisfy real outcome; contradictions trigger review.
- **Happy path:** Opportunity becomes approved campaign, provider action, lead, payment, attribution, and lesson chain.
- **Alternative paths:** Recommendation rejected; execution fails; payment unattributed; experiment inconclusive.
- **Failure states:** Broken lineage, missing receipt, delayed metric, duplicate webhook, projection lag.
- **Permissions:** Writers use scoped service/user identities; readers follow underlying artifact access.
- **Data required:** Typed entries, lineage edges, correlations, actors, state, payload hashes.
- **API/backend work:** Ledger append/query/lineage and invariant validation.
- **Frontend/UI work:** Evidence chain/timeline and gap/contradiction indicators.
- **AI/agent work:** Generates recommendation/lesson drafts; deterministic services append execution/payment facts.
- **Workflow/job work:** Outbox append, projection, lineage validation, gap alerts.
- **Security considerations:** Append-only, idempotency, authorization per entry, no secret payloads.
- **Analytics events:** `ledger_entry_created`, `lineage_gap_detected`, trace completion rate.
- **Definition of done:** Golden-path and every terminal/failure path form valid, queryable lineage.
- **Dependencies:** DOS-066.
- **Estimated complexity:** L
- **Release milestone:** M1

#### DOS-068 — Display freshness and contradictory evidence

- **ID:** DOS-068
- **Epic:** Evidence Ledger
- **Priority:** P1
- **Persona:** Content strategist
- **User story:** As a content strategist, I want stale and contradictory evidence surfaced before reuse, so that published claims remain trustworthy.
- **Business problem:** Business facts change and multiple sources can disagree.
- **Expected outcome:** No material stale or contradicted assertion silently enters an approved asset.
- **Acceptance criteria:** Freshness is policy-derived, not cosmetic; contradiction detector groups claims by entity/field/time and preserves both sources; severity and evidence shown; authoritative resolution requires user/provider evidence; dependent recommendations/assets become `review_required`; refresh, accept-temporary, and correct flows are audited.
- **Happy path:** New pricing conflicts with old profile; owner confirms new source and affected draft refreshes.
- **Alternative paths:** Time-scoped facts both valid; low-severity wording difference; unknown remains unresolved.
- **Failure states:** Refresh blocked, source inaccessible, extraction ambiguity, user lacks permission.
- **Permissions:** Editors view; authorized owner resolves material business truth.
- **Data required:** Claims, normalized values, temporal validity, source authority, dependencies, resolution.
- **API/backend work:** Freshness/contradiction query, resolution command, dependency invalidation.
- **Frontend/UI work:** Freshness badges, side-by-side evidence, affected-artifact list.
- **AI/agent work:** Proposes contradiction candidates and neutral summary; cannot select business truth.
- **Workflow/job work:** Scheduled freshness scan and dependent-artifact invalidation.
- **Security considerations:** Treat sources as untrusted, prevent resolution through prompt injection.
- **Analytics events:** `contradiction_detected/viewed/resolved`, stale-claim block rate.
- **Definition of done:** Temporal, semantic, resolution, dependency, and permission fixtures pass.
- **Dependencies:** DOS-011, DOS-028, DOS-066.
- **Estimated complexity:** M
- **Release milestone:** M2

#### DOS-069 — Export auditable evidence records

- **ID:** DOS-069
- **Epic:** Evidence Ledger
- **Priority:** P1
- **Persona:** Workspace owner
- **User story:** As a workspace owner, I want a portable audit export, so that I can verify, retain, or share the system's commercial record.
- **Business problem:** Trust depends on data portability and independent verification.
- **Expected outcome:** Authorized users can export a scoped, integrity-checkable record without leaking secrets or unrelated tenant data.
- **Acceptance criteria:** User selects time/types/artifacts/redaction; async export contains schema/version, entries, lineage, source metadata, checksums, omissions, and manifest; no OAuth tokens/raw secrets; CSV fields resist formula injection; download expires; export event audited; large exports paginate/checkpoint.
- **Happy path:** Owner exports one experiment's evidence-to-revenue chain and validates checksums.
- **Alternative paths:** JSON/CSV bundle; metadata-only due source restriction; legal hold.
- **Failure states:** Oversized request, permission change, artifact unavailable, generation timeout, expired link.
- **Permissions:** Owner/auditor; finance/PII fields require corresponding role.
- **Data required:** Export request/snapshot, authorized ledger/source records, manifest/checksums.
- **API/backend work:** Export request/status/download and snapshot authorization.
- **Frontend/UI work:** Scope/redaction wizard, progress, omissions, expiring download.
- **AI/agent work:** None required.
- **Workflow/job work:** Durable streaming export, malware scan, expiry deletion.
- **Security considerations:** Reauthorize at download, encryption, signed URL, redaction, tenant tests.
- **Analytics events:** `evidence_export_requested/completed/downloaded/expired`.
- **Definition of done:** Large, revoked-access, redaction, checksum, formula, and expiry tests pass.
- **Dependencies:** DOS-065, DOS-066, DOS-067.
- **Estimated complexity:** M
- **Release milestone:** M2

### Connector platform

#### DOS-070 — Execute external actions with durable idempotent jobs

- **ID:** DOS-070
- **Epic:** Distribution Fabric
- **Priority:** P0
- **Persona:** Growth operator
- **User story:** As a growth operator, I want approved actions executed by durable jobs with truthful states, so that retries never fabricate or duplicate external work.
- **Business problem:** Request-bound execution loses state and provider timeouts create duplicate or falsely successful actions.
- **Expected outcome:** Every attempt is recoverable, observable, idempotent, and reconciled to a provider receipt or explicit ambiguity.
- **Acceptance criteria:** State machine supports draft/awaiting approval/approved/queued/running/succeeded/failed/blocked/simulated/partial/reconnect/human-input; attempt persists before side effect; key scopes tenant+connector+action version; retry matrix distinguishes transient/permanent/ambiguous; leases/heartbeats recover crashes; provider receipt required for success; outbox prevents lost enqueue.
- **Happy path:** Approved send queues, worker reserves capability, provider returns receipt, projections update.
- **Alternative paths:** Simulation; scheduled job; partial multi-step; reconcile prior ambiguous attempt.
- **Failure states:** Worker crash, rate limit, token expiry, provider timeout, policy revoke, receipt mismatch.
- **Permissions:** Worker receives short-lived scoped capability after execution-time policy check.
- **Data required:** Job/attempt/lease/checkpoint, action/version, idempotency key, receipt/error, outbox.
- **API/backend work:** Job commands/status/reconcile and transactional outbox.
- **Frontend/UI work:** Live status timeline, retry/reconnect/human-input actions.
- **AI/agent work:** Cannot set execution state; may explain classified errors.
- **Workflow/job work:** Queue, lease, backoff+jitter, dead letter, reconciliation, projection.
- **Security considerations:** Capability tokens, payload encryption/redaction, replay and confused-deputy protection.
- **Analytics events:** `job_queued/started/succeeded/failed/blocked/reconciled`, duplicate rate.
- **Definition of done:** Crash/race/timeout/replay/revoke/rate-limit chaos tests show no duplicate side effects.
- **Dependencies:** DOS-061, DOS-063, DOS-066, DOS-073.
- **Estimated complexity:** XL (split state/outbox/worker/reconcile/UI)
- **Release milestone:** M1

#### DOS-071 — Discover connectors and test declared capabilities

- **ID:** DOS-071
- **Epic:** Connectors
- **Priority:** P1
- **Persona:** Workspace admin
- **User story:** As a workspace admin, I want to see only genuinely supported connector capabilities and test them, so that plans never depend on marketing claims.
- **Business problem:** A connected logo does not prove that the required API, scope, or provider feature works.
- **Expected outcome:** Users plan against a runtime capability contract with verified health and mode.
- **Acceptance criteria:** Catalog distinguishes available/beta/planned/unavailable; manifest declares auth, scopes, read/write capabilities, webhooks, limits, compliance, retention, simulation, contract version, and test status; installation probe returns capability-level pass/warn/fail; unsupported calls reject before queue; last verified time visible.
- **Happy path:** Admin tests Gmail send and reply-watch separately and sees both verified.
- **Alternative paths:** Read-only capability; sandbox-only; waitlist for planned connector.
- **Failure states:** Provider degradation, removed scope, contract mismatch, test quota, regional restriction.
- **Permissions:** All view catalog; admin connects/tests; only platform release process marks support.
- **Data required:** Connector manifest/version, installation, probes, status, limitations.
- **API/backend work:** Catalog/manifest/probe APIs and adapter conformance interface.
- **Frontend/UI work:** Capability matrix, mode/health/freshness, limitation disclosure.
- **AI/agent work:** Reads capability registry; never assumes from connector name.
- **Workflow/job work:** Periodic probes within rate limits and change alerts.
- **Security considerations:** Safe non-destructive probes, no secret display, least-scope rationale.
- **Analytics events:** `connector_viewed/capability_tested`, probe success and feature demand.
- **Definition of done:** Manifest validation and provider sandbox contract tests gate support label.
- **Dependencies:** DOS-070, DOS-073.
- **Estimated complexity:** M
- **Release milestone:** M1

#### DOS-072 — Handle rate limits and connector errors visibly

- **ID:** DOS-072
- **Epic:** Connectors
- **Priority:** P0
- **Persona:** Growth operator
- **User story:** As a growth operator, I want provider limits and failures handled safely, so that work resumes without duplicates or hidden delays.
- **Business problem:** Blind retries amplify outages and can violate provider policies.
- **Expected outcome:** Connector reliability meets SLO while every delay or terminal failure is truthful.
- **Acceptance criteria:** Normalize provider errors to auth/rate/transient/permanent/policy/ambiguous; honor retry headers; token-bucket limits apply per tenant/provider/capability; backoff+jitter has deadline/budget; circuit breaker protects outage; UI shows next retry and impact; manual retry cannot bypass limits; logs link provider request ID.
- **Happy path:** Rate-limited publish waits until provider reset then succeeds once.
- **Alternative paths:** User reschedules; circuit half-open probe; provider-specific remediation.
- **Failure states:** Clock skew, missing retry header, shared quota exhausted, permanent policy rejection, outage.
- **Permissions:** Operator views/retries allowed states; admin changes tenant-safe scheduling policy.
- **Data required:** Limit buckets, error taxonomy, attempts, provider IDs, retry/deadline.
- **API/backend work:** Adapter error contract, limiter and circuit status endpoints.
- **Frontend/UI work:** Error detail, retry countdown, impact and remediation.
- **AI/agent work:** Explains normalized error only; cannot override limiter.
- **Workflow/job work:** Fair queue, backoff, circuit breaker, dead letter.
- **Security considerations:** Avoid provider error/secret leakage and retry-based abuse.
- **Analytics events:** `connector_rate_limited/error/retry_scheduled`, recovery and saturation.
- **Definition of done:** Fault/clock/concurrency/property tests verify fairness, caps, and no duplicate call.
- **Dependencies:** DOS-070, DOS-071.
- **Estimated complexity:** L
- **Release milestone:** M1

#### DOS-073 — Connect, inspect, refresh, and disconnect services securely

- **ID:** DOS-073
- **Epic:** Connectors
- **Priority:** P0
- **Persona:** Workspace admin
- **User story:** As a workspace admin, I want to manage service authorization and health, so that external access remains intentional and recoverable.
- **Business problem:** Tokens expire, scopes drift, and disconnected integrations can leave unsafe queued work.
- **Expected outcome:** Every installation has explicit consent, least privilege, visible health, and a complete revocation path.
- **Acceptance criteria:** OAuth uses state+PKCE and exact redirect; tokens encrypted by reference, refreshed with single-flight locking and rotation; scopes/account/mode/consent/health visible; expiry/revocation triggers reconnect state and blocks jobs; disconnect previews affected work, revokes provider token where possible, stops webhooks/sync, preserves required audit, and deletes credentials.
- **Happy path:** Admin authorizes scopes, verifies account, passes capability probes, later disconnects cleanly.
- **Alternative paths:** API key where provider requires; partial scopes; reconnect; credential rotation.
- **Failure states:** CSRF mismatch, denied consent, refresh race, revoked token, provider revoke failure.
- **Permissions:** Owner/admin manages; operators view capability/health, never credentials.
- **Data required:** Installation/account, scope, consent, encrypted secret ref, health, webhook, retention.
- **API/backend work:** OAuth/callback/refresh/revoke, health, disconnect lifecycle.
- **Frontend/UI work:** Connect wizard, scope rationale, account confirmation, impact/reconnect.
- **AI/agent work:** No access to raw tokens.
- **Workflow/job work:** Refresh, health probe, webhook renew, disconnect compensation.
- **Security considerations:** Vault/KMS, secret redaction, CSRF, redirect allowlist, audit.
- **Analytics events:** `connector_connect_started/completed/failed/refreshed/disconnected`.
- **Definition of done:** OAuth threat-model and refresh/disconnect/race/provider-failure tests pass.
- **Dependencies:** DOS-061, DOS-066, DOS-076.
- **Estimated complexity:** L
- **Release milestone:** M1

#### DOS-074 — Inspect connector logs without exposing secrets

- **ID:** DOS-074
- **Epic:** Connectors
- **Priority:** P1
- **Persona:** Workspace admin
- **User story:** As a workspace admin, I want searchable connector activity logs, so that I can diagnose failures without accessing credentials or unrelated tenant data.
- **Business problem:** Operational debugging either lacks detail or leaks raw payloads and secrets.
- **Expected outcome:** Most connector incidents are diagnosable from correlated, redacted metadata.
- **Acceptance criteria:** Logs include tenant-safe correlation, connector/capability, attempt, normalized state/error, latency, retry, provider request ID, and redacted request/response summary; secret/authorization/PII denylist enforced at write and display; sampling never drops errors; retention and export policy apply.
- **Happy path:** Admin follows a failed send from job to provider error and reconnect action.
- **Alternative paths:** Support bundle with consent; aggregate health only for limited role.
- **Failure states:** Logging pipeline delay, redaction failure, provider ID absent, retention expired.
- **Permissions:** Admin/auditor; support access is time-bound, consented, and audited.
- **Data required:** Structured logs, correlations, redaction version, access/export audit.
- **API/backend work:** Scoped log query/export and redaction pipeline.
- **Frontend/UI work:** Filterable log viewer with copy-safe identifiers and delayed state.
- **AI/agent work:** May summarize already-redacted logs.
- **Workflow/job work:** Indexing, retention, redaction canary, access expiry.
- **Security considerations:** Write-time redaction, log-injection defense, minimum support access.
- **Analytics events:** `connector_logs_viewed/exported`, incident diagnosis time.
- **Definition of done:** Secret canary, tenant isolation, log injection, retention, and support-access tests pass.
- **Dependencies:** DOS-065, DOS-070, DOS-073.
- **Estimated complexity:** M
- **Release milestone:** M1

### Workspace, tenant management, and security

#### DOS-075 — Invite members and enforce role-based access

- **ID:** DOS-075
- **Epic:** Workspace management
- **Priority:** P0
- **Persona:** Workspace owner
- **User story:** As a workspace owner, I want to invite teammates into explicit roles, so that collaboration does not grant unnecessary commercial or customer access.
- **Business problem:** Shared credentials and coarse admin roles create approval and privacy risk.
- **Expected outcome:** Every workspace request and action is authorized by current membership and capability.
- **Acceptance criteria:** Invite is email-bound, single-use, expiring, revocable; roles include owner/admin/approver/operator/editor/sales/finance/analyst/viewer/auditor with composable capabilities; least privilege defaults; role changes invalidate sessions/capabilities and queued grants; last owner protected; member removal reassigns or blocks owned work.
- **Happy path:** Owner invites content editor who can draft but not approve, send, view finance, or connect services.
- **Alternative paths:** Resend/revoke invite; custom role later; agency guest with workspace-only access.
- **Failure states:** Expired/wrong-email invite, duplicate membership, last-owner removal, stale token.
- **Permissions:** Owner manages owners/admins; delegated admin within policy.
- **Data required:** User/org/workspace/membership/role/capability, invite, session/version.
- **API/backend work:** Invite/membership/role commands and centralized authorization middleware.
- **Frontend/UI work:** Team table, role matrix, invite/status/remove/reassign flow.
- **AI/agent work:** None grants access.
- **Workflow/job work:** Invite email, expiry, access-revocation propagation.
- **Security considerations:** Enumeration prevention, session invalidation, confused deputy, audit.
- **Analytics events:** `member_invited/joined/role_changed/removed`, invite conversion.
- **Definition of done:** Role matrix, invite abuse, stale session, last-owner, and queue revocation tests pass.
- **Dependencies:** Identity-provider integration; no story dependency.
- **Estimated complexity:** L
- **Release milestone:** M0

#### DOS-076 — Prove tenant isolation at every boundary

- **ID:** DOS-076
- **Epic:** Security
- **Priority:** P0
- **Persona:** Business owner
- **User story:** As a business owner, I want my workspace data and actions isolated from every other tenant, so that I can trust the platform with commercial context.
- **Business problem:** One cross-tenant read, cache key, event, agent retrieval, or connector call is catastrophic.
- **Expected outcome:** Automated controls demonstrate zero cross-tenant access across UI, API, jobs, storage, logs, and AI.
- **Acceptance criteria:** Tenant derives server-side from authenticated membership; every tenant table/index/key/object/event/job/trace includes tenant; repository API requires scope; database RLS targeted with PostgreSQL; caches and vectors partition; connector account binds tenant; platform support has no implicit access; cross-tenant adversarial suite runs in CI.
- **Happy path:** Identical resource IDs in two tenants return only the caller's authorized resource.
- **Alternative paths:** Explicit organization portfolio aggregate with per-workspace authorization.
- **Failure states:** Missing tenant context, stale membership, poisoned cache, event misroute, support impersonation attempt.
- **Permissions:** All access uses evaluated membership; break-glass is separate, time-bound, consent/audit controlled.
- **Data required:** Tenant-scoped domain records, request/job actor context, authorization audit.
- **API/backend work:** Tenant-scoped repositories/middleware, RLS migration plan, key builders.
- **Frontend/UI work:** Workspace identity always visible; switch clears local state.
- **AI/agent work:** Retrieval/tool context hard-scoped outside prompts.
- **Workflow/job work:** Tenant context signed in messages and validated by workers.
- **Security considerations:** Primary security invariant; fuzz/property tests and external review.
- **Analytics events:** Security-only `tenant_scope_violation_blocked`; never product analytics payload.
- **Definition of done:** Isolation matrix and penetration tests pass across every storage/execution surface.
- **Dependencies:** DOS-075, centralized request context.
- **Estimated complexity:** XL (continuous control)
- **Release milestone:** M0

#### DOS-077 — Protect ingestion from SSRF, prompt injection, and poisoned content

- **ID:** DOS-077
- **Epic:** Security
- **Priority:** P0
- **Persona:** Platform administrator
- **User story:** As a platform administrator, I want public-site ingestion isolated and bounded, so that a submitted URL cannot reach private systems or control agents.
- **Business problem:** Website ingestion crosses hostile network and content boundaries.
- **Expected outcome:** Unsafe targets/files/instructions are blocked and safe content is treated only as quoted evidence.
- **Acceptance criteria:** HTTPS default; canonicalize and resolve DNS before each request/redirect; block loopback/private/link-local/reserved/metadata and rebinding; allow ports/types; cap redirects/pages/bytes/time/depth; sandbox parsing; malware/file rejection; strip active content; webpage instructions labeled untrusted and never enter system/tool prompt; robots/terms policy; egress logs and kill switch.
- **Happy path:** Bounded crawl of a normal public site stores sanitized, hashed evidence.
- **Alternative paths:** User pastes public text; crawl only homepage; allowed manual redirect confirmation.
- **Failure states:** Private resolution, redirect to metadata, DNS change, oversized file, decompression bomb, prompt injection.
- **Permissions:** Public submit is rate-limited; authenticated user creates workspace only after validation.
- **Data required:** Crawl request, DNS/redirect trace, policy decisions, response metadata/hash, rejection.
- **API/backend work:** Isolated fetch service, DNS/IP validator, parser boundary, quotas.
- **Frontend/UI work:** Safe progress, exact blocked reason, retry/edit URL; no raw unsafe render.
- **AI/agent work:** Data/instruction separation, content delimiters, tool calls disabled during extraction.
- **Workflow/job work:** Bounded crawl, cancellation, quarantine, safe cleanup.
- **Security considerations:** SSRF, injection, malware, poisoning, abuse, legal compliance.
- **Analytics events:** `ingestion_security_blocked` by category, false-positive review rate.
- **Definition of done:** OWASP SSRF corpus, rebinding/redirect/file/injection fuzz and sandbox tests pass.
- **Dependencies:** DOS-005, DOS-066, DOS-076.
- **Estimated complexity:** L
- **Release milestone:** M0

#### DOS-078 — Export or delete workspace data safely

- **ID:** DOS-078
- **Epic:** Privacy and compliance
- **Priority:** P1
- **Persona:** Workspace owner
- **User story:** As a workspace owner, I want to export or delete workspace data, so that I retain control over business and personal information.
- **Business problem:** Data lock-in and incomplete deletion undermine trust and legal compliance.
- **Expected outcome:** Portable exports and verified deletion complete within published SLA, subject to disclosed holds.
- **Acceptance criteria:** Export inventory covers domain records/artifacts/config except secrets; deletion shows impact, requires reauth+typed confirmation and cooling period, cancels jobs/revokes connectors/deletes credentials, tombstones tenant, cascades primary/object/vector/cache data, preserves minimal legally required audit with anonymization/hold disclosure, and issues completion report; restore only during cooling period.
- **Happy path:** Owner requests deletion, reconnects none, cooling period expires, and receives completion proof.
- **Alternative paths:** Cancel during cooling; delete one data class/lead; legal hold delays subset.
- **Failure states:** Active billing dispute, revocation failure, storage deletion lag, backup expiry pending.
- **Permissions:** Owner only for workspace; subject-request role for individual records.
- **Data required:** Inventory, deletion/export request, holds, tasks, verification report.
- **API/backend work:** Export/delete orchestration and per-store deletion adapters.
- **Frontend/UI work:** Inventory/impact, reauth, cooling countdown, status/report.
- **AI/agent work:** Memory/vector deletion participates; no retention exception by agent.
- **Workflow/job work:** Revoke, cancel, cascade, verify, backup-expiry tracking.
- **Security considerations:** Destructive confirmation, recovery window, identity verification, audit minimization.
- **Analytics events:** `data_export_requested`, `workspace_deletion_requested/cancelled/completed`.
- **Definition of done:** Full store inventory and deletion/export/hold/failure recovery tests pass.
- **Dependencies:** DOS-069, DOS-073, DOS-075, DOS-076.
- **Estimated complexity:** XL
- **Release milestone:** M2

#### DOS-079 — Prevent spam, abuse, and unsafe automation

- **ID:** DOS-079
- **Epic:** Trust and safety
- **Priority:** P0
- **Persona:** Workspace owner
- **User story:** As a workspace owner, I want outreach and publishing guardrails, so that growth work protects recipients, platforms, and my reputation.
- **Business problem:** Autonomous distribution can scale spam, deception, harassment, or platform abuse.
- **Expected outcome:** Prohibited actions are blocked before provider calls and complaint signals reduce autonomy.
- **Acceptance criteria:** Prohibit purchased/scraped lists, fake engagement, deceptive claims, harassment, credential sharing, and mass unsolicited send; require source/consent/lawful basis and suppression/frequency checks; per-user/workspace/IP limits; content and recipient risk rules; complaint/bounce/provider-policy events trigger circuit breaker and autonomy downgrade; appeal and incident review audited.
- **Happy path:** Consented lead receives one approved contextual reply and opt-out is honored.
- **Alternative paths:** Transactional email; manually initiated relationship follow-up; blocked action appealed.
- **Failure states:** Unknown consent, suppression service unavailable, abuse evasion, sudden complaint spike.
- **Permissions:** Safety rules non-overridable; trained admins review appeals; operators see remediation.
- **Data required:** Consent/source, suppression, frequency, complaints/bounces, risk decision, appeal.
- **API/backend work:** Abuse preflight, suppression and rate-limiting services, kill switch.
- **Frontend/UI work:** Clear block reason, safe alternative, complaint health, appeal flow.
- **AI/agent work:** Classifier assists; deterministic hard rules and human review own decisions.
- **Workflow/job work:** Reputation monitor, circuit breaker, quarantine, incident alert.
- **Security considerations:** Adversarial evasion, protected classes, reviewer privacy, platform terms.
- **Analytics events:** `abuse_action_blocked/appealed`, complaints, bounces, autonomy downgrade.
- **Definition of done:** Abuse/red-team corpus and suppression/outage/circuit-breaker E2Es pass.
- **Dependencies:** DOS-045, DOS-061, DOS-063, DOS-070.
- **Estimated complexity:** L
- **Release milestone:** M1

### Self-improvement, notifications, billing, and administration

#### DOS-080 — Detect underperformance and generate bounded lessons

- **ID:** DOS-080
- **Epic:** Self-improvement
- **Priority:** P1
- **Persona:** Growth operator
- **User story:** As a growth operator, I want underperforming actions detected and translated into evidence-bound lessons, so that repeated work improves rather than merely repeats.
- **Business problem:** Teams repeat weak tactics or draw strong conclusions from noisy data.
- **Expected outcome:** Completed experiments produce a disposition and reusable, appropriately scoped lesson.
- **Acceptance criteria:** Evaluate against frozen hypothesis/metric/denominator/window/guardrails/kill rule; classify winning/losing/inconclusive/invalid; compare historical cohorts and uncertainty; lesson states what changed, scope, evidence, counterevidence, confidence, expiry, and next test; never generalize across audience/channel without evidence; user confirms durable strategy change.
- **Happy path:** Variant misses lead threshold with adequate sample and becomes a scoped negative lesson.
- **Alternative paths:** Stop early for safety; instrumentation invalidates; extend window with approval.
- **Failure states:** Missing denominator, contaminated cohorts, delayed conversions, changed goal, model failure.
- **Permissions:** Operator reviews; strategist/owner approves material learning application.
- **Data required:** Experiment snapshot/results, evidence, cohorts, lesson/version, review decision.
- **API/backend work:** Evaluation/lesson/proposal APIs with statistical utility.
- **Frontend/UI work:** Result card, uncertainty, lesson editor, affected recommendations.
- **AI/agent work:** Draft narrative after deterministic analysis; no silent graph mutation.
- **Workflow/job work:** Window close evaluation, late-outcome revision, lesson expiry.
- **Security considerations:** No sensitive-segment conclusions; immutable prior versions.
- **Analytics events:** `underperformance_detected`, `lesson_generated/confirmed/rejected/revised`.
- **Definition of done:** Winner/loser/inconclusive/invalid/late-data fixtures and narrative evals pass.
- **Dependencies:** DOS-040, DOS-054, DOS-067.
- **Estimated complexity:** L
- **Release milestone:** M2

#### DOS-081 — Propose evidence-based strategy changes with approval

- **ID:** DOS-081
- **Epic:** Self-improvement
- **Priority:** P1
- **Persona:** Founder
- **User story:** As a founder, I want recurring patterns to produce reviewable strategy changes, so that the operating system compounds learning without rewriting my business autonomously.
- **Business problem:** Isolated lessons do not change decisions, while automatic strategy mutation is unsafe.
- **Expected outcome:** High-confidence patterns become versioned, approved changes and can be rolled back.
- **Acceptance criteria:** Pattern requires configured minimum independent experiments/time; proposal identifies affected profile/priority/channel/offer, evidence and counterexamples, expected impact, confidence, risks, diff, expiry, and validation plan; owner approval required for material change; creates new graph/strategy version; prior recommendations are re-evaluated; rollback preserves history.
- **Happy path:** Repeated high reply and conversion from one segment proposes raising its priority.
- **Alternative paths:** Accept as temporary test; reject with reason; ask for more evidence.
- **Failure states:** Correlated samples, contradictory recent evidence, stale sources, no authorized owner.
- **Permissions:** System/strategist proposes; owner or strategic approver accepts.
- **Data required:** Lessons, experiments, graph/strategy versions, proposal/approval/outcome.
- **API/backend work:** Pattern aggregation, strategy diff/apply/rollback APIs.
- **Frontend/UI work:** Proposal comparison, evidence matrix, approval and rollback.
- **AI/agent work:** Finds candidates and drafts rationale; deterministic thresholds and versioning control apply.
- **Workflow/job work:** Periodic pattern scan and downstream invalidation/recompute.
- **Security considerations:** Poisoning resistance, diversity checks, no protected-trait strategy.
- **Analytics events:** `strategy_change_proposed/approved/rejected/rolled_back`, post-change lift.
- **Definition of done:** Sample-independence, approval, version, rollback, and downstream tests pass.
- **Dependencies:** DOS-059, DOS-068, DOS-080.
- **Estimated complexity:** L
- **Release milestone:** M2

#### DOS-082 — Receive actionable, preference-aware notifications

- **ID:** DOS-082
- **Epic:** Notifications
- **Priority:** P1
- **Persona:** Growth operator
- **User story:** As a growth operator, I want timely notifications for decisions, failures, leads, and revenue, so that I act before value or trust decays.
- **Business problem:** Silent blockers lose conversions; noisy alerts train users to ignore the system.
- **Expected outcome:** Critical items meet notification SLO and users can reach the resolving action directly.
- **Acceptance criteria:** Typed severity for approval, blocked/failed job, reconnect, high-intent lead, reply, payment, discrepancy, safety, and learning; in-app first plus verified email; dedupe/grouping, quiet hours, timezone, per-type preferences, escalation, read/resolve links; no sensitive content in lock-screen/email subject; delivery state visible.
- **Happy path:** Qualified reply alerts assignee and opens the correlated conversation.
- **Alternative paths:** Daily digest; backup approver escalation; email delivery failure remains in-app.
- **Failure states:** Missing recipient, invalid timezone, provider bounce, duplicate storm, stale deep link.
- **Permissions:** Only recipients with current artifact access; access rechecked on open.
- **Data required:** Notification/type/subject, recipient preference, delivery attempts, resolution.
- **API/backend work:** Notification preferences, inbox, delivery and acknowledgement APIs.
- **Frontend/UI work:** Notification center, badges, preference matrix, grouped mobile cards.
- **AI/agent work:** May summarize authorized evidence; templates own sensitive-field rules.
- **Workflow/job work:** Fan-out, dedupe, quiet-hour schedule, escalation, retry.
- **Security considerations:** No PII leakage, unsubscribe for optional email, signed expiring links.
- **Analytics events:** `notification_sent/opened/resolved/muted`, time-to-resolution.
- **Definition of done:** Dedupe, access revoke, quiet-hour, bounce, escalation, and accessibility tests pass.
- **Dependencies:** DOS-045, DOS-062, DOS-070, DOS-075.
- **Estimated complexity:** M
- **Release milestone:** M1

#### DOS-083 — Understand and control billing and AI usage

- **ID:** DOS-083
- **Epic:** Billing and usage
- **Priority:** P1
- **Persona:** Workspace owner
- **User story:** As a workspace owner, I want transparent plan limits, usage, and spend controls, so that Distribution OS creates value within a predictable cost.
- **Business problem:** Hidden model, crawl, storage, and connector usage damages trust and margin.
- **Expected outcome:** Customers understand current consumption and never incur platform overage outside chosen policy.
- **Acceptance criteria:** Meter tenant usage by billable unit/version; estimate before costly run; hard/soft caps and alerts; separate customer campaign budget from platform subscription; Stripe billing webhooks verified; invoice/plan/status visible; downgrade grace and read-only behavior defined; disputes/credits append; AI run exposes token/model/cost without hidden chain-of-thought.
- **Happy path:** Owner sees monthly usage, sets hard AI cap, and receives threshold alert.
- **Alternative paths:** Trial, prepaid credits, agency pooled plan with workspace allocation.
- **Failure states:** Meter lag, duplicate event, billing webhook delay, cap race, payment failure.
- **Permissions:** Owner/billing admin manages; members view allowance relevant to tasks.
- **Data required:** Plan/entitlement, meter events, aggregation, limits, invoice/subscription/customer refs.
- **API/backend work:** Meter, entitlement, limit, Stripe Billing webhook and portal contracts.
- **Frontend/UI work:** Usage dashboard, estimate, cap settings, plan/payment state.
- **AI/agent work:** Model gateway emits immutable usage; router respects cost policy.
- **Workflow/job work:** Aggregate/reconcile meters, alerts, entitlement transitions.
- **Security considerations:** Signed billing webhooks, no card data storage, atomic quota, invoice privacy.
- **Analytics events:** `usage_viewed/cap_set/cap_blocked`, trial conversion, gross margin.
- **Definition of done:** Meter replay/concurrency/reconciliation/cap/downgrade/provider fixtures pass.
- **Dependencies:** DOS-048, DOS-060, DOS-063, DOS-070.
- **Estimated complexity:** L
- **Release milestone:** M3

#### DOS-084 — Operate the platform with safe administration controls

- **ID:** DOS-084
- **Epic:** Administration
- **Priority:** P1
- **Persona:** Distribution OS administrator
- **User story:** As a platform administrator, I want health, feature, incident, and support controls without ambient tenant access, so that I can operate the service safely.
- **Business problem:** Production operations need intervention, but broad administrator access creates severe trust risk.
- **Expected outcome:** Incidents are mitigated within SLO using narrow, audited controls.
- **Acceptance criteria:** Admin console shows aggregate SLO/queues/connectors/model/cost/abuse; feature flags and connector kill switches are scoped/versioned/rollbackable; support access requires ticket, tenant consent where possible, role approval, reason, expiry, watermark, and audit; break-glass pages security and never reveals secrets; replay/reconcile tools are idempotent; tenant impersonation disabled by default.
- **Happy path:** Admin disables a failing connector capability globally and affected tenants see truthful blocked status.
- **Alternative paths:** Workspace-scoped flag; consented read-only support session; replay dead-letter event.
- **Failure states:** Flag propagation lag, approval unavailable, support session expiry, replay conflict.
- **Permissions:** Dedicated platform roles with hardware-backed MFA and separation of duties.
- **Data required:** Operational aggregates, flags, incidents, support grants/sessions, admin audit.
- **API/backend work:** Separate admin plane, flag/kill/replay/support-grant APIs.
- **Frontend/UI work:** Operational dashboards, impact preview, approval and session banner.
- **AI/agent work:** Operational summaries use aggregate/redacted data; no autonomous admin actions.
- **Workflow/job work:** Flag propagation, support expiry, incident notifications, replay.
- **Security considerations:** Separate identity/audience, MFA, IP/device policy, tamper alerts, least access.
- **Analytics events:** Security-only `admin_action`, SLO/MTTR; exclude tenant product analytics.
- **Definition of done:** Privilege, approval, expiry, flag rollback, replay, and external security review pass.
- **Dependencies:** DOS-065, DOS-070, DOS-074, DOS-076.
- **Estimated complexity:** XL
- **Release milestone:** M3

## 15. Cross-cutting acceptance criteria

These criteria apply to every story in addition to its local acceptance criteria.

| Concern | Required behavior | Verification |
| --- | --- | --- |
| Valuable slice | The story completes one user decision or outcome; placeholders do not count | Product acceptance demo traces user input to persisted result |
| State truth | UI/API expose canonical state, update time, source, and whether real or simulated | State-machine and UI contract tests cover every state |
| Loading | Skeleton or progress appears within 200 ms; work over 2 s shows stage and cancellation when safe | Throttled-browser and durable-job tests |
| Empty | Explain why no data exists and offer one valid next action; zero is not no-data | Component fixtures for new, filtered, and permission-limited workspaces |
| Error | Preserve user input, give stable error code/correlation ID, classify retryability, and avoid false success | Fault-injection tests for dependency and persistence failures |
| Permission | Server authorizes every command/query; UI hides or disables with reason; revocation affects active work | Role matrix and stale-session tests |
| Approval | Exact version/hash, actor, policy, expiry, cost, and scope bind approval; mutation invalidates it | Race, replay, edit-after-approval, and expiry tests |
| Simulation | Separate state, visual treatment, data namespace, and metrics; cannot create real revenue/outcomes | End-to-end tests assert no connector call and no real aggregate impact |
| Evidence | Material AI claims cite authorized evidence with freshness/confidence; absence is explicit | Citation completeness and permission-eval suite |
| Observability | Request/job/provider correlations, structured logs, span, counters, latency, and error class exist | Trace assertion in integration tests; dashboard/runbook linked |
| Security | Threat model updated; input/output validation, tenant scoping, rate limit, redaction, and retention applied | Security test checklist and reviewer sign-off |
| Accessibility | WCAG 2.2 AA target: keyboard, focus, names, contrast, reduced motion, status announcements | Automated axe plus manual keyboard/screen-reader checks |
| Responsive UI | Primary task works at 360 px; dense data collapses to summary/detail rather than horizontal loss | Visual tests at phone/tablet/desktop widths |
| Analytics | Named event has owner, purpose, schema, consent class, and no unnecessary PII | Schema validation and analytics QA query |
| Operability | Feature flag, migration/backfill, runbook, alert, rollback/disable path, and support state defined | Production-readiness checklist |

No story is done when only the happy-path UI exists. “Done” means schema migration, API, UI states, authorization, audit/evidence, observability, automated tests, documentation, and acceptance demonstration are complete for its smallest valuable version.

## 16. API and backend requirements

### Contract conventions

- External product API target is `/api/v1`; the current Next.js route handlers may implement it while the boundary remains portable to FastAPI services.
- JSON uses `snake_case`, RFC 3339 UTC timestamps, opaque string IDs, ISO 4217 currency, and integer minor monetary units. Workspace timezone is presentation/scheduling context, never storage time.
- Authenticated tenant identity is resolved server-side. A client-supplied `workspace_id` is a selector checked against membership, never authority.
- Mutations accept `Idempotency-Key`; versioned resources accept `If-Match`. Conflict is `409`, stale version `412`, validation `422`, throttling `429`, dependency unavailable `503`.
- Errors use `{error:{code,message,retryable,field_errors,correlation_id,remediation}}`. Messages are safe for users; raw provider errors remain redacted operational data.
- Lists use cursor pagination and stable ordering. API and exports share calculation libraries and metric versions.
- Commands return the persisted resource and its state, never an unpersisted optimistic claim. Long work returns `202` with a job URL.

### Golden-path contracts

| Method and route | Command/result | Key invariants |
| --- | --- | --- |
| `POST /api/v1/ingestions` | `{url}` → ingestion job | Server URL safety; rate limit; idempotent canonical URL within request window |
| `GET /api/v1/ingestions/{id}` | Progress, stage, safe errors, evidence count | Tenant scoped; canonical job state |
| `GET/PATCH /api/v1/business-profile` | Versioned profile/assertions | `If-Match`; edits create user-confirmed evidence and graph version |
| `POST /api/v1/business-profile/confirm` | Confirm selected fields/version | Does not confirm unknown or hidden fields |
| `GET /api/v1/opportunities` | Ranked snapshot with components | Score/model version, freshness, risk, evidence IDs |
| `POST /api/v1/experiments` | Convert opportunity to experiment | Objective, hypothesis, primary metric, denominator, window, kill rule required |
| `POST /api/v1/actions` | Create immutable action version | Real/simulated mode explicit; capability and measurement preflight attached |
| `POST /api/v1/actions/{id}/approval-requests` | Submit exact version | Payload hash and policy snapshot frozen |
| `POST /api/v1/approval-requests/{id}/decisions` | Approve/reject/request changes | Actor capability, expiry, separation of duties, optimistic concurrency |
| `POST /api/v1/actions/{id}/execute` | `202` job reference | Fresh approval/policy/capability/budget check; outbox commit |
| `GET /api/v1/jobs/{id}` | State, attempts, next retry, receipt summary | No secret/raw PII; canonical worker state |
| `POST /api/v1/leads` | Consented lead capture | Tenant-local dedupe; consent/source/suppression required |
| `POST /api/v1/leads/{id}/follow-ups` | Gmail draft/action | Exact recipient/thread/payload; no automatic send |
| `POST /api/v1/webhooks/{provider}` | Durable webhook acceptance | Verify raw signature/account before parse; dedupe; retry on failed persistence |
| `GET /api/v1/revenue/summary` | Verified revenue snapshot | Mode/currency/status separate; as-of and reconciliation state |
| `GET /api/v1/attribution/{payment_id}` | Model version, paths, confidence | Eligible inputs and unattributed explanation visible |
| `GET /api/v1/evidence/{id}` | Source/provenance/freshness | Underlying source authorization applies |
| `POST /api/v1/agent-runs` | Bounded agent task | Tool/data/cost/time scope; long-running job; no implicit write authority |

### Service boundaries and non-negotiable backend rules

The application control plane owns authentication, tenancy, RBAC, policies, approvals, budgets, state transitions, idempotency, audit, and money. The Strategic Brain accepts an authorized evidence bundle and returns schema-validated proposals. It never receives raw credentials and never directly calls a distribution adapter. Connector adapters implement typed `probe`, `execute`, `lookup`, `sync`, `revoke`, and optional `simulate` contracts. The workflow runtime invokes them only with short-lived capability tokens.

PostgreSQL is the production transactional target. Redis is limited to leases, rate limits, and disposable cache. Object storage holds sanitized source artifacts by tenant/content hash. The outbox and webhook inbox bridge transactional writes to asynchronous work. All migrations are additive first, backfilled observably, and destructive only after compatibility windows and verified rollback.

## 17. Frontend and UX requirements

### Experience model

The shell uses a left navigation on desktop, command/search bar, workspace switcher, health/notification indicators, and a persistent “Ask COO” entry. Mobile uses a compact header and bottom/slide-over navigation; dense canvases become prioritized cards plus drilldown. Typography favors legible tabular numerals for metrics and restrained semantic color. Motion communicates state and respects `prefers-reduced-motion`.

Every AI recommendation uses one consistent decision card: recommendation → expected commercial outcome → evidence/confidence/freshness → risk and cost → approval/state → next action. Every external action uses one status vocabulary. Badges never rely on color alone.

| Screen | Primary goal / CTA | Secondary actions and hierarchy | Empty / loading / error / blocked / approval / success | Mobile and accessibility |
| --- | --- | --- | --- | --- |
| Landing/onboarding | Submit website URL / **Analyze website** | Privacy/safety note, example, sign-in after value preview | Inline URL validation; staged crawl; safe retry; partial results; success continues to confirmation | URL keyboard type, labeled errors, progress announced |
| Mission Control | Choose next safe commercial action / **Review next action** | Revenue truth, blockers, running work, funnel, recent evidence | New-workspace checklist; live job states; degraded-data banner; approval cards | Cards reorder by urgency; skip links and live regions |
| Intelligence | Confirm business understanding / **Review profile** | Strategic brief, segments, positioning, competitors, unknowns | Evidence skeleton; no-evidence prompt; contradictions/staleness block dependent action | Profile sections collapse; citations keyboard-openable |
| Opportunities | Select best opportunity / **Create experiment** | Score components, comparison, archive | No qualified opportunity; scoring progress; stale evidence warning; created experiment success | Comparison becomes two-card stepper; accessible score text |
| Content | Produce an evidence-safe asset / **Create content** | Strategy, ideas, variants, claim review, performance | Template empty state; streaming draft; unsupported-claim block; approval diff | Single-pane editor/preview toggle; proper labels and shortcuts |
| Campaigns | Coordinate actions to objective / **Create campaign** | Plan, assets, schedule, cost, status, outcomes | Guided empty plan; readiness checks; budget/policy blocks; launch approval | Timeline stacks; no drag-only interactions |
| Experiments | Make a falsifiable test / **Create experiment** | Hypothesis, variants, sample/window, results, lessons | Setup wizard; collecting; invalid/inconclusive/winner states | Result summary before charts; chart data table |
| Leads | Respond to qualified demand / **Review lead** | Queue, profile, source, intent, owner, lifecycle | Capture setup; redacted permission state; duplicate/suppressed states | Master-detail becomes list then detail; bulk actions limited |
| Revenue | Verify money and discrepancies / **Inspect payment** | Gross/net/refunds/unattributed, reconciliation, attribution paths | No payments ≠ zero; stale Stripe; finance permission; verified success badge | Currency tabs and compact waterfall; tabular values narrated |
| Analytics | Understand funnel change / **Investigate change** | Cohort/window/model controls, quality, explanations | Missing tracking CTA; loading snapshot; incompatible metric error | Summary first, scrollable tables with captions |
| Connectors | Establish a real capability / **Connect service** | Catalog, scopes, account, health, limits, logs | Planned unavailable, simulation, reconnect, degraded, verified | Step wizard; scope rationale in plain language |
| AI Workforce | Delegate bounded work / **Assign task** | Agent scopes, runs, artifacts, costs, failures | No enabled role; queued/running/partial/failed; approval request | Task graph becomes ordered dependency list |
| Agent Memory | Control reusable context / **Review proposals** | Type, source, freshness, used-in, correct/forget | Memory-off explanation; indexing; stale/conflict/deletion states | Filter drawer; screen-reader provenance labels |
| Evidence Ledger | Verify provenance / **Trace outcome** | Timeline, lineage, filters, export, contradictions | No records; projection lag; access-limited source; integrity warning | Linear timeline; graph has equivalent text tree |
| Settings | Set people, policy, limits, data / **Save policy** | Team, workspace, approvals, security, billing | Defaults explained; conflict errors; unsaved diff; dangerous action confirmation | Section menu becomes select; focus moves to error summary |

Reusable UI states are Storybook-tested components: `StateBadge`, `EvidenceCitation`, `ConfidenceMeter`, `FreshnessLabel`, `ApprovalCard`, `JobTimeline`, `ConnectorHealth`, `MetricQuality`, `EmptyState`, `PermissionGate`, and `SimulationBanner`.

## 18. AI and agent requirements

### AI contract

All production generations use the model gateway. A request declares tenant, actor, purpose, data classes, model policy, maximum tokens/cost/time, prompt version, retrieval query, allowed read tools, output schema, and evaluation hooks. The gateway records model/provider/version, latency, token usage, cost, structured-validation result, safety result, and evidence IDs. Model fallbacks may change style, never permissions or product state.

Required output for material recommendations:

```json
{
  "recommendation": "bounded proposed decision",
  "reason": "causal rationale stated as hypothesis where appropriate",
  "evidence_ids": ["ev_..."],
  "counterevidence_ids": [],
  "confidence": {"band": "low|medium|high", "basis": [], "calibration_version": "..."},
  "freshness": {"as_of": "...", "stale_inputs": []},
  "expected_impact": {"metric": "...", "range": [], "time_horizon": "..."},
  "risks": [],
  "required_approval": "...",
  "next_action": "...",
  "unknowns": []
}
```

### Agent controls

- AI COO orchestrates the decision experience; specialist agents own narrow methods, not privileges.
- Agent identity is distinct from user/service identity. Effective rights are the intersection of caller, tenant policy, role, task, and tool capability.
- Retrieval filters are applied before context construction. Web pages, emails, connector data, and uploaded files are untrusted quoted data; instructions within them are never executable authority.
- Tool calls are schema-validated and allowlisted. Writes become proposals or deterministic application commands. Money, permissions, policy, approval, and execution state are never model decisions.
- Memory write is proposed, source-linked, sensitivity-classified, and reviewable. “Remember everything” is not supported.
- Confidence is produced by a calibration service using task eval performance, evidence coverage/freshness, and known uncertainty—not the model's self-rating.
- Promotion to autonomous operator is per capability. Minimum gate: explicit owner policy, reversible low-risk action, proven sample, calibrated precision, complaint/failure below threshold, budget cap, kill switch, and rollback. Any safety/control breach demotes automatically.
- Agent evaluation sets cover factuality/citation, claim support, strategy quality, privacy, prompt injection, tool selection, abstention, tone, structured output, cost, and regression by prompt/model version.

## 19. Data model

### Core relational aggregates

| Aggregate | Essential records and constraints |
| --- | --- |
| Identity/tenant | `users`, `organizations`, `workspaces`, `memberships`, `roles`, `capabilities`, `invitations`; unique membership; server-derived tenant |
| Business Graph | `entities`, `entity_versions`, `relationships`, `relationship_versions`, `assertions`, `assumptions`; typed edges; no cross-workspace foreign key |
| Evidence | `evidence_records`, `source_artifacts`, `claim_evidence`, `evidence_lineage`, `contradictions`; append-only content hash/provenance |
| Strategy | `strategic_briefs`, `opportunities`, `opportunity_score_versions`, `decisions`; score inputs and model versions frozen |
| Work | `missions`, `campaigns`, `experiments`, `variants`, `success_metrics`, `lessons`; explicit objective/hypothesis/denominator/window |
| Content | `content_assets`, `content_versions`, `claims`, `claim_reviews`, `channel_payloads`; approved payload immutable |
| Governance | `policy_sets`, `policy_versions`, `policy_evaluations`, `approval_requests`, `approval_decisions`, `permission_grants`, `budget_accounts`, `budget_reservations`; exact hash/version |
| Execution | `actions`, `action_versions`, `jobs`, `job_attempts`, `provider_receipts`, `outbox_events`, `webhook_inbox`; unique idempotency and provider-event keys per tenant |
| Connectors | `connector_definitions`, `capability_manifests`, `connector_installations`, `installation_capabilities`, `secret_references`, `sync_checkpoints`, `health_probes`; secrets outside DB payload |
| Demand | `leads`, `lead_identities`, `consents`, `suppressions`, `conversations`, `messages`, `assignments`, `lifecycle_events`; tenant-local dedupe and PII classification |
| Measurement | `tracking_events`, `touchpoints`, `identity_links`, `metric_definitions`, `metric_snapshots`, `attribution_models`, `attribution_results`; immutable raw event plus versioned projection |
| Revenue | `customers`, `offers`, `products`, `prices`, `payments`, `refunds`, `disputes`, `reconciliation_runs/items`; provider-verified flag and gross/net separation |
| AI | `agent_definitions`, `agent_runs`, `agent_tasks`, `tool_calls`, `agent_artifacts`, `memories`, `memory_versions`, `model_usage`, `evaluation_results`; permission and source refs |
| Operations | `notifications`, `audit_events`, `feature_flags`, `incidents`, `exports`, `deletion_requests`, `usage_meter_events`; retention/sensitivity on each class |

All tenant-owned tables start with `workspace_id` and use composite unique constraints that include it. Money is integer minor units plus currency. Mutable aggregates have `version`; append-only tables do not update facts but may add correction/tombstone entries. Referential links to external providers store provider, account, mode, object type, and external ID. Raw webhook bodies and large source artifacts are encrypted in object storage with a DB hash/ref and retention policy.

Indexes are designed from queries: workspace+updated cursor; workspace+state+scheduled time; workspace+provider+external ID; workspace+entity type; workspace+lead identity hash; workspace+occurred time; workspace+correlation ID. PostgreSQL RLS is defense in depth, not a replacement for scoped repository APIs.

## 20. Workflow and job architecture

### Canonical action and execution states

Approval state and execution state are separate dimensions. APIs use the exact codes below; UI labels may be friendlier but must not merge meanings.

| API code | UI label | Meaning | Terminal / allowed next states |
| --- | --- | --- | --- |
| `draft` | Draft | Editable action; no approval requested | No; `awaiting_approval`, `simulated`, `blocked` |
| `awaiting_approval` | Awaiting approval | Exact version is under review | No; `approved`, `draft`, `blocked` |
| `approved` | Approved | Exact payload may be queued until expiry/revocation | No; `queued`, `blocked`, `requires_human_input` |
| `queued` | Queued | Durable work exists; no provider outcome | No; `running`, `blocked`, `requires_reconnection` |
| `running` | Running | A fenced worker owns the attempt | No; `succeeded`, `failed`, `partially_completed`, `blocked`, `requires_reconnection`, `requires_human_input` |
| `succeeded` | Succeeded | Required provider receipt and projection persisted | Yes; corrective outcome is a new event/version |
| `failed` | Failed | Definitive terminal failure; no success inferred | Yes; a retry is a new approved execution version |
| `blocked` | Blocked | Policy, safety, budget, capability, or dependency forbids progress | No; return to a valid prior gate only after explicit remediation/re-evaluation |
| `simulated` | Simulated | No real side effect was attempted | Yes; never transitions into a real success |
| `partially_completed` | Partially completed | Some declared steps have receipts and others do not | No; `running`, `failed`, `succeeded`, `requires_human_input` |
| `requires_reconnection` | Requires reconnection | Connector authorization/capability is invalid | No; `queued` only after reauthorization and fresh preflight |
| `requires_human_input` | Requires human input | Ambiguity or business choice prevents safe automation | No; policy-defined resolution creates a new transition event |

Every transition records previous/new state, occurred/recorded time, actor/service, action and payload version/hash, policy/approval version, attempt/job, evidence or receipt, and correlation. Unknown provider outcome is not `failed`; it is represented as `requires_human_input` or an internal reconciliation substate while the visible action remains truthful.

```text
transaction: validate → authorize → policy/budget → persist command result + outbox
                                                               |
                                                               v
queue: claim lease → re-authorize → checkpoint → external call → receipt
          |               |                         |              |
          |               +-- blocked/revoked       +-- ambiguous  +-- succeeded
          +-- crash/lease expiry                         |
                                                      reconcile
                                                               |
transaction: append evidence/domain event → update projections → notify
```

Every workflow defines input schema/version, tenant/actor, state machine, idempotency scope, retry taxonomy, timeout/deadline, lease/heartbeat, checkpoints, compensation, cancellation semantics, progress, output receipt, metrics, and runbook. Retries use capped exponential backoff with jitter and provider `Retry-After`. Permanent authorization, validation, policy, and safety failures do not retry. Ambiguous side effects reconcile before retry. Dead letters require owner and remediation, not silent abandonment.

Priority queues separate interactive approvals/follow-ups from crawl/sync/analysis. Fair scheduling prevents one agency tenant exhausting workers. Backpressure blocks new low-priority work before core webhook/payment ingestion. Scheduled actions store UTC instant, declared workspace timezone, and schedule version; DST tests are mandatory.

## 21. Connector architecture

The first production distribution channel is **Resend to a workspace-owned, consented audience**, because the repository already contains a narrow real adapter and signed event handling. Its MVP capability is a small approved campaign send—not prospect scraping, list purchase, or Gmail-style mass outreach. Gmail remains the one-to-one lead follow-up connector. Stripe verifies payments. GA or PostHog captures the web conversion path; Search Console supplies owned-search intelligence. A different public/social first channel may replace Resend only after API access, terms, receipts, deletion/correction semantics, test environment, and economics pass a written feasibility gate.

Every connector manifest must declare:

| Contract area | Required declaration |
| --- | --- |
| Authorization | OAuth/key method, PKCE/state, account identity, exact scopes, consent copy, refresh/rotation/revoke |
| Capabilities | Typed reads/writes, schema, sandbox/simulation, account/plan restrictions, tested version/date |
| Execution | Provider idempotency, our fallback, receipts, ambiguous-result lookup, partial semantics |
| Events | Webhooks/polling, signature/auth, dedupe key, ordering behavior, replay/backfill |
| Reliability | Documented/observed rate limits, retry mapping, deadlines, circuit behavior, SLO |
| Compliance | Platform terms, prohibited uses/content, recipient/consent rules, review requirements |
| Data | Fields collected, sensitivity, storage location, retention, deletion/export, residency constraints |
| Operations | Health probe, logs, metrics, alerts, reconnect, support runbook, kill switch |

A connector is “supported” only after sandbox/provider contract tests, security review, live canary, receipt reconciliation, revocation, observability, documentation, and named ownership pass. UI separately labels `planned`, `sandbox`, `beta`, `supported`, `degraded`, and `unavailable`.

## 22. Security and compliance

### Threat and control matrix

| Risk | Preventive controls | Detection/recovery |
| --- | --- | --- |
| Tenant leakage | Server-derived tenant, scoped repositories, RLS target, tenant keys/events/vectors, role checks | Cross-tenant CI/pen tests, blocked-access alerts, incident kill switch |
| SSRF/unsafe crawl | Per-hop DNS/IP validation, isolated egress, type/size/time/page limits, safe parser | Egress anomaly logs, quarantine, fuzz corpus |
| Prompt injection/data poisoning | Trust labels, data/instruction separation, tool isolation, evidence authority and contradiction review | Injection evals, suspicious-source flag, revoke/invalidate dependents |
| Credential theft | OAuth PKCE/state, KMS/vault references, rotation, no client/model/log exposure | Secret canaries, access audit, revoke/reconnect runbook |
| Unauthorized execution | RBAC, policy engine, exact approval, execution-time check, capability token, budget reserve | Approval violation metric (target zero), cancellation and revoke propagation |
| Duplicate/false action | Outbox, attempt-before-call, stable idempotency, receipt-required success, ambiguity reconcile | Duplicate detector, provider reconciliation, truthful partial/unknown state |
| Webhook spoof/replay | Raw signature and account binding before parse, tolerance, event dedupe | Rejection metrics, secret rotation, replay fixtures |
| Spam/platform abuse | Consent/source/suppression/frequency, content rules, limits, complaint breaker | Reputation alerts, automatic autonomy downgrade, appeals/incident review |
| PII/financial exposure | Classification, field authorization, minimization, encryption, retention, PCI boundary | DLP/redaction canaries, access/export audit, deletion workflow |
| Admin abuse | Separate admin plane/identity, MFA, separation, time-bound consented support, no ambient access | Tamper alerts, session recording metadata, independent audit |

Security baseline: OWASP ASVS-aligned application controls; dependency/SAST/secret/container scans; CSP, secure cookies, CSRF where applicable, output encoding, request size/rate limits; encryption in transit and at rest; key rotation; least-privilege cloud IAM; encrypted tested backups; incident classification and notification playbook. Compliance work begins with data inventory, subprocessor list, privacy notice, DPA, consent/lawful-basis mapping, retention schedule, data-subject export/deletion, and provider terms. SOC 2 evidence collection follows production use; certification is not an MVP claim.

## 23. Observability

OpenTelemetry propagates `trace_id`, `correlation_id`, `workspace_hash`, `user/service_actor`, `mission_id`, `action_id`, `job_id`, `attempt_id`, and safe provider request ID. Raw tenant content, email bodies, tokens, and payment PII never become span attributes.

Four golden signals apply by API, job type, connector, and model route: rate, errors, duration, saturation. Product-truth indicators add approval violations, false-success corrections, duplicate external actions, ambiguous duration, webhook verification/dedupe, connector freshness, reconciliation discrepancies, evidence coverage, stale recommendation use, agent abstention, calibration error, notification latency, and meter lag.

Initial SLOs:

- API availability 99.9% monthly; p95 cached query under 500 ms and command acknowledgment under 1 s, excluding async work.
- Valid payment/reply webhooks durably accepted p95 under 2 s; projected p95 under 60 s.
- Scheduled approved actions start within 60 s p95 when provider healthy.
- Critical failure/approval/reply notifications created within 60 s p95.
- Connector health freshness under 15 minutes for executable capability.
- Zero approval violations, cross-tenant incidents, false success claims, and duplicate side effects; any occurrence is Sev-1/2 by impact.

Each alert links a runbook and owner. Alerts target symptoms and user harm, not raw volume. Synthetic golden-path canaries run in test/sandbox accounts. Dashboards split platform, tenant-safe product, connector, workflow, AI cost/quality, security, and commercial truth views.

## 24. Analytics and attribution

### Measurement hierarchy

The north star is **workspaces reaching a first attributable, provider-verified payment within 30 days**, reported alongside attribution-confidence distribution. Guardrails are complaint rate, approval violations, duplicate actions, false execution claims, refund rate, and gross margin. The funnel is:

`URL submitted → analysis completed → profile confirmed → opportunity reviewed → experiment created → action approved → provider action verified → qualified engagement → lead → reply/meeting → verified payment → attributed net revenue → lesson confirmed`.

Every event has a registry entry: name, description, owner, producer, schema version, subject identifiers, allowed properties, consent/sensitivity class, retention, dedupe key, occurred/received timestamps, and tests. Event names use past tense. Client events describe UI interaction; server/domain/provider events establish business truth. Revenue never comes from client analytics.

### Metric definitions

- Activation is a five-step cohort with step-level time and abandonment, not a single login.
- Qualified attention is channel-specific and configured; it cannot be raw impressions alone.
- Lead conversion denominator is unique eligible visitors or recipients, with bot/test/internal exclusions shown.
- Reply rate separates delivered denominator, human replies, out-of-office, unsubscribe, and bounce.
- Customer and revenue metrics use verified payment/refund state. Gross, net, pending, test, and unattributed remain separate.
- CAC includes declared channel spend and allocated platform/model cost when available; unknown cost makes CAC incomplete, not zero.
- Attribution MVP reports first and last eligible touch. Confidence factors are deterministic identity match, path completeness, consented tracking continuity, window fit, and contradictory source evidence.
- Experiment lift always shows counts, denominator, interval/uncertainty, window, and guardrails. Small samples are inconclusive.

Data-quality monitors track schema rejection, unknown source, event lateness, identity conflicts, UTM loss, connector freshness, payment reconciliation, and projection lag. Metric definition changes are versioned and annotated; historic dashboards default to the original definition and offer explicit restatement.

## 25. Testing strategy

| Layer | Required coverage |
| --- | --- |
| Unit/property | State transitions, scores, policy precedence, money, budgets, idempotency keys, URL/IP safety, redaction, attribution, metrics, time/DST |
| Schema/contract | API request/response, event registry, agent structured output, connector manifests, webhook payload versions |
| Integration | Database constraints/RLS, outbox/inbox, object store, queues, Redis locks, KMS refs, model gateway |
| Connector conformance | OAuth/refresh/revoke, scopes, capability probe, sandbox action, receipt, webhook/poll, rate limit, ambiguous lookup, deletion |
| End-to-end | Golden path plus invalid URL, partial ingestion, correction, rejection, expiry, disconnect, failed send, unsubscribe, payment/refund, unattributed revenue |
| Security | Tenant matrix, SSRF/rebinding, prompt injection, CSRF, authz, replay, secret/PII leakage, file/parser attacks, abuse limits, admin access |
| AI evaluation | Evidence citation/coverage, factuality, abstention, strategy quality, supported claims, injection resistance, tool choice, structured validity, calibration, cost |
| Reliability/chaos | Worker crash at each checkpoint, duplicate delivery, queue delay, DB failure, provider timeout/429/5xx, webhook disorder, stale policy/revocation |
| Performance | URL ingestion bounds, API p95, queue throughput/fairness, graph/ledger pagination, dashboard projection, large export |
| UX/accessibility | Storybook states, keyboard/screen reader, contrast/reduced motion, 360/768/1440 visual regression, slow/offline/reconnect |
| Migration/restore | Forward/backward compatibility, partial backfill, rollback, backup restore, deletion propagation |

CI gates typecheck, lint, unit/property/fuzz, contract, migration, component accessibility, and critical integration tests. Nightly runs connector sandboxes, model evals, cross-tenant adversarial suites, and synthetic golden path. Release candidates run E2E, chaos, performance smoke, restore, and security scans. Flaky tests are quarantined only with owner, issue, and expiry; critical-path tests never pass by retrying invisibly.

Acceptance fixtures include a canonical demo business, hostile website corpus, consented/suppressed leads, provider sandbox accounts, known campaign path, payments/refunds, and expected evidence chain. Production canaries use clearly labeled non-customer data.

## 26. Deployment strategy

Environments are local, ephemeral preview, shared integration, staging with provider sandboxes, and production. Accounts, secrets, webhooks, queues, storage, and analytics are isolated per environment; test-mode objects never appear in live totals.

Build once and promote an immutable artifact. CI emits SBOM, provenance, scan results, migration plan, feature-flag defaults, and release notes. Infrastructure is declarative. Secrets come from the runtime secret manager. Database changes use expand → dual-read/write only when needed → backfill with checkpoints → verify → switch → contract. Workers deploy backward-compatible with queued message versions.

Rollout sequence is internal tenant → 5% eligible workspaces → 25% → 100%, gated by SLO, errors, duplicates, approval compliance, connector health, AI quality/cost, and commercial funnel regression. High-risk connector writes launch behind per-workspace flags and kill switches. Rollback disables the feature/connector first, rolls application artifact second, and avoids down-migrations that destroy accepted data. Reconciliation repairs ambiguous external state after rollback.

Production requires multi-zone managed data services where available, point-in-time recovery, encrypted backups, restore drills, queue dead-letter retention, object versioning for governed artifacts, CDN/WAF/rate limits, and on-call ownership. Initial targets are RPO ≤15 minutes and RTO ≤4 hours; payment/evidence webhook inboxes target no acknowledged loss.

## 27. Product roadmap

Milestones map to waves: **M0 Foundation**, **M1 Golden Path**, **M2 Intelligence & Experiments**, **M3 Distribution Expansion**, and **M4 Commercial Scale**. Sequence is dependency-led, not calendar theater.

| Wave | Outcome | Included story ranges | Exit signal |
| --- | --- | --- | --- |
| 0 | A secure tenant can hold truthful evidence and governed work | DOS-001 foundations as needed; DOS-061, 066, 075–077; platform portions of 065, 070 | Threat model, tenant suite, state model, design system, telemetry and CI green |
| 1 | One founder completes URL-to-verified-payment golden path | DOS-001–016, 030–037, 041–052, 062–074, 079, 082 | Five sandbox/pilot workspaces complete trace with no fake/duplicate/unauthorized action |
| 2 | System finds, tests, explains, and learns better actions | DOS-017–029, 038–040, 053–060, 068–069, 078, 080–081 | Experiments produce reviewable evidence-bound lessons and improve decision quality |
| 3 | Repeatable distribution expands without weakening governance | DOS-057 advanced, DOS-071 additional adapters, DOS-083–084, new adapter stories | Each new connector passes same conformance and reliability gates; positive unit economics |
| 4 | Agency/multi-brand and advanced autonomy scale commercially | Extensions to DOS-075/076/083/084 plus portfolio/billing/autonomy stories | Isolation, delegation, margin, retention, and autonomy safety proven at scale |

## 28. Wave-by-wave delivery plan

### Wave 0 — Product foundation

- **Objective / user value:** establish a trustworthy workspace where public evidence, identities, permissions, and states cannot lie or leak.
- **Stories:** enabling slices of DOS-001–012, DOS-061, DOS-065–066, DOS-070, DOS-075–077.
- **Technical deliverables:** domain/event vocabulary; tenant-scoped repositories; auth/RBAC; graph/evidence schemas; URL safety service; policy/state-machine libraries; outbox/job skeleton; design tokens/components; OpenTelemetry; CI/security/property tests.
- **Dependencies:** hosting/runtime choice, identity provider, managed database/object store/queue/KMS.
- **Risks:** retrofitting tenant scope; premature service split; incomplete hostile-input boundary.
- **Demo:** two users in two workspaces ingest the same URL; evidence is isolated; owner changes a policy; blocked unsafe URL and audit are visible.
- **Acceptance gate:** zero cross-tenant suite failures; URL red-team corpus passes; migrations/restore work; all canonical states render accessibly.
- **Metrics:** safe ingestion completion, p95 API/job start, authz denies, evidence coverage, test reliability.
- **Rollback:** flags disable ingestion/agents; retain read-only graph/evidence; roll artifact back without down-migration.

### Wave 1 — Golden path

- **Objective / user value:** take a founder from URL to one attributed verified payment through a real, controlled path.
- **Stories:** DOS-001–016, DOS-030–037, DOS-041–052, DOS-062–074, DOS-079, DOS-082.
- **Technical deliverables:** profile confirmation; opportunity/action plan; Resend consented distribution; lead capture; Gmail one-to-one follow-up/reply; Stripe sync/webhooks/refunds; first/last attribution; Mission Control; durable workers; approvals/budgets; full evidence lineage.
- **Dependencies:** Wave 0; provider sandbox/production approvals and domains; demo website and consented audience; analytics SDK.
- **Risks:** Gmail verification; identity matching gaps; email deliverability; provider ambiguity; payment attribution overclaim.
- **Demo:** section 33 script with provider receipts and an intentionally failed/retried action.
- **Acceptance gate:** five pilot workspaces complete the full trace; ≥95% eligible reply correlation; revenue reconciles; zero approval violations/duplicates/false success.
- **Metrics:** time to analysis/profile/action, activation completion, publish/send reliability, leads/replies, first verified payment, attributable share.
- **Rollback:** kill connector writes, stop queued work, revoke/reserve release, remain read-only with raw webhook capture and later reconciliation.

### Wave 2 — Intelligence and experiments

- **Objective / user value:** consistently choose better opportunities and convert outcomes into bounded future improvements.
- **Stories:** DOS-017–029, DOS-038–040, DOS-053–060, DOS-068–069, DOS-078, DOS-080–081.
- **Technical deliverables:** scoring/explanations; strategic briefs; content/claim evaluation; experiment analysis; AI COO and specialists; governed memory; model eval/calibration; contradiction/freshness; metric-change explanation; learning proposals.
- **Dependencies:** sufficient Wave 1 event/evidence corpus; evaluation owners and labeled sets; cost budgets.
- **Risks:** plausible but unsupported recommendations; tiny samples; cost/latency; poisoned memory; false causal claims.
- **Demo:** COO diagnoses a funnel issue, proposes two variants, user approves one, result closes as inconclusive/winner, lesson and strategy diff require review.
- **Acceptance gate:** citation coverage ≥98% for material claims; unsupported-claim escape below agreed threshold; calibrated confidence; no silent authoritative graph change.
- **Metrics:** proposal adoption, experiment completion, decision time, evidence coverage, calibration error, cost per accepted artifact, post-learning lift.
- **Rollback:** pin previous prompt/model/score version; disable write proposals; retain deterministic analytics and prior graph version.

### Wave 3 — Distribution expansion

- **Objective / user value:** add channels and repeatable content workflows through one unchanged governance contract.
- **Stories:** new provider-specific derivatives of DOS-030–033 and DOS-071–074; DOS-057, DOS-083–084.
- **Technical deliverables:** connector SDK/conformance harness; scheduler scaling; channel templates; portfolio-safe quotas; usage billing; admin operations; one adapter at a time after feasibility.
- **Dependencies:** provider access and terms; Wave 1 reliability data; stable action/capability contract.
- **Risks:** shallow connector sprawl; changing APIs; platform enforcement; low margins; notification fatigue.
- **Demo:** same approved content artifact becomes compliant variants for two verified connectors, each with its own state/receipt/metrics and no inferred parity.
- **Acceptance gate:** each adapter passes security/conformance/live canary; connector SLO met for 30 days; positive marginal economics; support runbook staffed.
- **Metrics:** connector activation/health, successful action rate, duplicate/complaint rate, incremental qualified leads/revenue, gross margin.
- **Rollback:** per-capability kill switch; stop/reconcile affected jobs; other connectors and read models stay available.

### Wave 4 — Commercial scale

- **Objective / user value:** let agencies and multi-brand businesses operate safely with portfolio visibility and earned low-risk autonomy.
- **Stories:** agency hierarchy/custom roles, workspace templates, consolidated billing, portfolio analytics, advanced attribution, autonomy promotion, retention/forecast extensions.
- **Technical deliverables:** organization/workspace hierarchy; policy templates with local overrides; scoped portfolio aggregates; delegated approvals; enterprise audit/export/retention; capacity and DR upgrades.
- **Dependencies:** sustained retention and reliability, legal/compliance maturity, proven per-capability autonomy data.
- **Risks:** cross-client leakage; approval ambiguity; noisy aggregate decisions; enterprise complexity; premature autonomous scope.
- **Demo:** agency owner provisions two isolated client workspaces, delegates teams/policies, reviews aggregate non-PII outcomes, and promotes only one proven capability.
- **Acceptance gate:** isolation and delegated-approval external review; enterprise SLO/DR; positive agency margin/retention; automatic demotion drill passes.
- **Metrics:** workspace activation per agency, client retention, contribution margin, policy reuse, approval SLA, safe autonomous success rate.
- **Rollback:** disable portfolio/action delegation while preserving independent client workspaces; demote autonomy to Copilot globally.

## 29. Prioritised backlog

| Bucket | Stories | Rationale |
| --- | --- | --- |
| Must have — P0 | DOS-001–016 where marked P0; DOS-030–033; DOS-035–036; DOS-038; DOS-041–042; DOS-044–052; DOS-061–064; DOS-066–067; DOS-070, 072–073; DOS-075–077, 079 | Shortest safe URL-to-payment path and its truth, tenant, approval, connector, lead, and money controls |
| Should have — P1 | Remaining P1 stories through DOS-084 | Credible intelligence, experiments, explainability, operations, privacy, team use, billing |
| Could have — P2 | DOS-024, DOS-039, DOS-057 plus new channel/agency/advanced analytics derivatives | Increases leverage after the golden path is reliable |
| Won't have yet — P3 | Agent marketplace, mass cold outreach, fake engagement, autonomous ads, custody, opaque attribution, dozens of logos, full CRM | Does not improve near-term verified revenue learning enough to justify risk/effort |

Within a priority, sequence by dependency, then time to first value, learning value, revenue impact, user frequency, risk reduction, and effort. A P1 control that gates a P0 unsafe action is pulled into the P0 slice. No team may increase connector breadth while payment trace completion, approval integrity, or duplicate-action reliability is below gate.

The first six delivery increments are: (1) tenant/evidence/safe URL, (2) editable confirmed profile, (3) opportunity-to-approved simulated action, (4) durable real Resend action plus measurement, (5) lead/Gmail reply path, (6) Stripe/revenue/attribution/lesson. Each increment is demoable and leaves truthful blocked states for the next.

## 30. Risks and mitigations

| Risk | Likelihood / impact | Leading indicator | Mitigation / owner |
| --- | --- | --- | --- |
| Product feels like another dashboard | Medium / High | Low action approval and return rate | Mission Control centers one next action and blocker; CPO owns activation interviews |
| AI recommendations are generic/false | High / High | Low evidence coverage/adoption, high corrections | Structured evidence contract, abstention, evals, narrow prompts; AI lead |
| No reliable first public channel API | Medium / High | Feasibility gate fails | Use existing real consented Resend channel; do not claim social support; integrations lead |
| Gmail/Stripe production verification delay | Medium / High | Sandbox complete but review pending | Start provider review Wave 0; retain truthful blocked/demo sandbox; delivery lead |
| Email becomes spam | Medium / Critical | Consent gaps, complaints/bounces | Owned consented audience, suppression/frequency, one-to-one Gmail, circuit breakers; trust lead |
| Attribution overclaims causality | High / High | Users treat low confidence as proof | First/last facts, confidence factors, unattributed visibility, experiment language; data lead |
| Cross-tenant leak | Low / Critical | Isolation test or context assertion failure | Scoped repositories/RLS/keys, CI/pen test, stop-ship; security lead |
| Duplicate or false execution | Medium / Critical | Ambiguous backlog, corrected success, duplicates | Outbox, attempts, keys, receipts, reconcile, kill switch; platform lead |
| Connector/API drift | High / Medium | Probe failures/schema changes | Versioned manifests, conformance, canaries, per-capability kill; integrations lead |
| Model cost/latency harms margin | High / Medium | Cost per accepted artifact rises | Budgets, routing/cache, smaller models, deterministic fallbacks, usage transparency; AI/finance |
| Insufficient data causes false learning | High / High | Many tiny “winners” | Denominator/window/minimum sample/inconclusive state; experimentation lead |
| Scope explosion | High / High | Multiple partial connectors/agents | Wave gates and one trace metric; product/delivery owner rejects non-chain work |
| Migration from current D1/runtime | Medium / Medium | Concurrency/query limits, dual-system drift | Portable contracts, additive migration, outbox replay, reconcile; architecture lead |
| Privacy/compliance debt | Medium / High | Unknown inventory/retention, deletion backlog | Data map, minimization, consent, retention and deletion from M0; privacy owner |
| Operational overload | Medium / High | Alert volume/MTTR/dead letters rise | SLO/runbooks, symptom alerts, admin plane, fair queues; SRE owner |

## 31. Definition of MVP

MVP is not a complete navigation shell or a catalog of future integrations. It is a production-capable pilot in which a solo builder can:

1. Submit one public HTTPS website and see bounded, truthful ingestion progress.
2. Review, correct, and confirm a source-linked business profile.
3. Review a scored opportunity and turn it into one measurable plan.
4. Create a claim-checked asset for a real Resend campaign to a workspace-owned consented audience.
5. Approve the exact payload under explicit policy and budget; see durable provider execution state.
6. Capture/deduplicate a lead with source/consent, draft and approve one Gmail follow-up, correlate a reply, and enforce suppression.
7. Connect Stripe test/live correctly, verify payment/refund webhooks, and see gross/net/unattributed truth.
8. Trace a payment to eligible touchpoints with first/last model and confidence, then confirm a bounded lesson.
9. Invite at least one editor/approver with enforced roles, export evidence, and inspect audit history.

Deliberately excluded: social-network adapters, mass outreach, multi-agent delegation, autonomous public execution, ad spend, advanced multi-touch attribution, CRM replacement, agency portfolio, mobile native apps, and unsupported provider logos.

MVP acceptance is five external pilot workspaces completing the golden path in sandbox or approved live environments, median analysis under 10 minutes, median confirmed profile under 15 minutes, median first approved action under 30 minutes, revenue/event reconciliation exact, and zero cross-tenant, approval, false-success, duplicate, or suppression incidents.

## 32. Definition of production readiness

A capability is production-ready only when product, engineering, security, operations, support, and analytics sign the same release record:

- Acceptance criteria and all UI states pass with a real provider receipt where relevant; simulation is labeled.
- Threat model, privacy classification, permissions, retention, abuse constraints, and security tests pass.
- State machine, idempotency, retry/reconcile, outbox/inbox, migration, backup/restore, and rollback are verified.
- SLO, dashboards, alerts, runbook, on-call owner, kill switch, capacity and cost ceiling exist.
- Analytics schema/metric owner/data-quality query and experiment or rollout plan exist.
- Connector conformance, provider terms, account/scopes, test/live separation, revoke/delete, and production approval pass.
- AI feature has labeled eval set, baseline/gate, prompt/model versioning, confidence calibration, cost budget, injection tests, and deterministic fallback/disable path.
- Documentation discloses exact supported capability and limitations; support can diagnose from redacted correlations.
- No Sev-1/2 open defect; no known route around tenant, approval, suppression, budget, or revenue truth controls.

## 33. Golden-path demo script

1. Open a fresh workspace and submit the canonical demo website URL. Show normalization and safe crawl stages; in a second tab submit a private-network URL and show a truthful security block.
2. Open the generated profile. Drill from pricing and audience statements to source snapshots. Correct one assumption and confirm material fields; show the new evidence/version.
3. Enter Mission Control. Review the ranked opportunity, expand score components/risks/freshness, and convert it into an experiment with audience, CTA, primary metric, denominator, window, budget, and kill rule.
4. Generate two Resend campaign variants. Show an unsupported claim being blocked, replace it with evidence-backed wording, and select one.
5. Open the exact approval request. Change the payload to demonstrate invalidation, resubmit, then approve with an authorized second role. Show policy and budget reservation.
6. Execute first in simulation and prove no provider call or real metric. Execute the approved real action; show queued/running/provider receipt/succeeded states and the audit/evidence chain.
7. Follow the instrumented CTA as a consented demo recipient and submit the lead form. Show dedupe, source/UTM touchpoints, intent evidence, and assignment.
8. Generate a Gmail follow-up, approve exact recipient/thread/body, send, and display Gmail receipt. Reply from the demo account; show authenticated correlation. Demonstrate an unsubscribe blocks a later send in a separate fixture.
9. Complete Stripe test checkout. Show signed webhook acceptance, one verified payment despite replay, gross/net separation, and first/last attribution with confidence. Issue a partial refund and show net revenue plus experiment result revise.
10. Ask the AI COO, “What did we learn and what should change?” Show cited evidence, counterevidence, confidence, unknowns, and a proposed—unapplied—strategy diff. Approve or reject it.
11. Trace the payment backward through customer/lead, reply, Gmail action, campaign asset, approval, experiment, opportunity, profile assertion, and source. Export the scoped manifest.

The demo fails if any simulated state looks real, a provider-accepted event is called delivered without evidence, an approval can survive payload mutation, replay changes totals, a suppressed recipient can be sent to, or the AI alters strategy without approval.

## 34. Product success metrics

| Category | Metric | Initial target / guardrail |
| --- | --- | --- |
| Activation | Website analysis success / median duration | ≥90% eligible sites; <10 min |
| Activation | Profile confirmed / opportunity reviewed / first action approved | ≥70% / ≥60% / ≥40% of created eligible workspaces in 24 h |
| Engagement | Weekly active activated workspaces | ≥50% during pilot |
| Engagement | Actions reviewed and experiments created/completed | Baseline first; improve without lowering quality or increasing spam |
| Distribution | Verified action success and schedule start | ≥98% excluding provider outage; p95 ≤60 s |
| Distribution | Qualified engagement and click-to-lead | By channel/cohort; never optimize raw reach alone |
| Commercial | Qualified leads, replies, meetings, customers | Cohort trend with denominators and consent quality |
| Commercial | First provider-verified payment | ≥20% of activated pilot workspaces within 30 days (validate target in discovery) |
| Commercial | Time to first customer / attributable net revenue / CAC | Downward / upward / complete-cost reporting |
| Attribution | Payment attributable share and confidence | ≥70% has eligible path; report confidence distribution, not forced target |
| Learning | Experiments with valid disposition and confirmed lesson | ≥80% / ≥60% |
| AI quality | Material claim citation coverage / unsupported escape | ≥98% / <1% on release eval and monitored sample |
| AI economics | Cost per accepted artifact / per activated workspace | Within plan gross-margin budget |
| Trust | False execution claims / approval violations / duplicates | 0 / 0 / 0; incident on any occurrence |
| Trust | Send after suppression / cross-tenant incident | 0 / 0 |
| Reliability | API availability / valid webhook durable acceptance | 99.9% / ≥99.99% excluding invalid signatures |
| Connectors | Executable capability health freshness / success | <15 min / ≥98% excluding provider outage |
| Operations | Failed jobs, ambiguity age, reconciliation discrepancy, MTTR | Error-budgeted; no ambiguity >24 h; financial discrepancy owned within 1 business day |
| Retention | 4-week activated workspace retention | Baseline in pilot; target ≥40% before scaling acquisition |

Targets are hypotheses until pilot baselines exist. Metric owners review weekly by acquisition cohort, persona, workspace maturity, and real/simulated mode. No metric may hide sample size, denominator, definition version, freshness, or data-quality warning.

## 35. Open questions and assumptions

### Assumptions adopted for implementation

1. The current Next.js/TypeScript/Cloudflare implementation remains the near-term delivery base; Python/FastAPI enters as a bounded intelligence/worker service when its ecosystem creates concrete value.
2. Resend is the first real distribution adapter for consented owned audiences because a narrow adapter exists. Gmail is strictly one-to-one follow-up in MVP. Neither is permission for cold mass outreach.
3. PostgreSQL is the production-system target, but migration occurs on demonstrated concurrency/relational/RLS need with compatible contracts rather than a rewrite-first program.
4. Stripe is the only source of provider-verified payment truth in the golden path. Manual revenue remains explicitly declared/unverified.
5. First-touch and last-touch are evidence models, not causal proof. Advanced attribution waits for sufficient data and experiment maturity.
6. All public actions and sends require human approval in MVP. Autonomy level 3 is excluded until per-capability evidence gates are met.
7. Initial market is English-language solo builders/startup founders with a public SaaS/product site and Stripe-compatible sale; localization, regulated verticals, and ecommerce breadth wait.

### Decisions required before or during Wave 0–1

| Question | Owner / deadline | Decision evidence |
| --- | --- | --- |
| Which ICP and offer will the MVP sell first: solo SaaS builder, service SMB, or agency? | CPO before pilot recruitment | 15 problem interviews, willingness-to-pay, reachable consented cohort |
| Is Resend campaign distribution sufficient to validate demand, or is a specific social/community adapter necessary? | Product + integrations before M1 scope lock | Provider API/terms/access/cost, customer workflow frequency, conformance spike |
| Identity provider and organization model? | Security/architecture in M0 | MFA, invitations, B2B org support, export, pricing, data residency |
| Stay on D1 through pilot or migrate transactional truth before external beta? | Architecture at M0 load/constraint gate | concurrency tests, relational/RLS needs, migration cost and rollback |
| GA4 or PostHog as primary golden-path analytics connector? | Data/product in M0 | server events, consent controls, identity/linking, export/API, customer adoption |
| Required Gmail scopes and production verification lead time? | Integrations/security immediately | exact send/watch flow, Google verification and data-policy review |
| Supported countries, currencies, taxes, and billing entity? | Finance/legal before live billing | Stripe availability, refund/tax/invoice obligations |
| Consent/lawful-basis model and retention by market? | Privacy/legal before any live campaign | target geography, channel, provider terms, DPA/subprocessors |
| Pilot success threshold for attribution confidence and first payment? | CPO/data before pilot | baseline tracking completeness and sales-cycle distribution |
| What action sample/error/complaint thresholds permit autonomy promotion? | CPO/trust/data before any L3 test | calibrated historical outcomes and explicit owner risk acceptance |
| What support-access consent and break-glass policy will customers accept? | Security/support before beta | threat model, customer interviews, audit/legal requirements |

Unanswered questions produce an owner, due milestone, and truthful blocked state where they affect safety or provider capability. They do not become AI assumptions or invisible backlog scope.
