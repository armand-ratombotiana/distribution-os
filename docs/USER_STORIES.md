# Distribution OS — Engineering User Story Catalog

Generated from the product backlog in `PRODUCT_IMPLEMENTATION_SPEC.md`. This normalized catalog is the engineering-ticket contract: 84 product-oriented stories, each using the required field order and explicit permission, approval, data, execution, security, observability, testing, risk, and release-wave boundaries. Regenerate with `node scripts/build-user-story-catalog.mjs`.

## DOS-001 — Submit and validate a website URL

**ID:** DOS-001

**Epic:** Landing and onboarding

**Feature:** Submit and validate a website URL

**Priority:** P0

**Persona:** Solo builder

**User story:** As a solo builder, I want to submit one website URL, so that I receive useful commercial analysis without configuring a complex system.

**User problem:** High setup friction prevents users from reaching value.

**Business outcome:** A valid public HTTPS site begins ingestion in ≤2 seconds and activation is attributable to the landing source.

**Preconditions:** Dependencies are satisfied; Anonymous may validate; authenticated user creates/resumes; workspace is resolved server-side.

**Main workflow:** User pastes URL, sees normalized domain, submits, and enters progress view.

**Alternative workflows:** Add missing scheme; resume a recent incomplete ingestion; intentionally create a new analysis version.

**Failure states:** Invalid syntax, credentials in URL, non-public host, rate limit, duplicate running job, service unavailable.

**Acceptance criteria:** Server canonicalizes URL; only HTTP(S) input is accepted and HTTPS is preferred; DNS/IP/redirect policy passes before fetch; duplicate submission offers resume/reanalyse; consent copy is visible; response returns `202`, `ingestion_id`, `status`, and status URL.

**Permissions:** Anonymous may validate; authenticated user creates/resumes; workspace is resolved server-side.

**Approval requirements:** None for read-only analysis; any derived external side effect is a separate approval-gated action.

**Data required:** Raw/canonical URL, referral/UTM, consent timestamp, identity, request correlation ID.

**Data produced:** Tenant-scoped durable records for submit and validate a website url, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Single-field hero form, inline validation, privacy note, disabled/submitting/error states.

**Backend work:** `POST /api/v1/ingestions`; canonicalizer; SSRF preflight; idempotency on user+canonical URL+time window.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** None before fetch.

**Workflow/job work:** Enqueue only after authorization and validation commit.

**Connector work:** None; do not manufacture a connector dependency.

**Security considerations:** SSRF, Unicode hostname confusion, DNS rebinding, redirect validation, per-IP/user throttles.

**Analytics events:** `landing_url_entered`, `url_validation_failed`, `ingestion_requested` with no query-string secrets.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Unit/fuzz/security/E2E tests pass; logs contain correlation not raw sensitive query data; p95 submit latency ≤500 ms excluding auth.

**Definition of done:** Unit/fuzz/security/E2E tests pass; logs contain correlation not raw sensitive query data; p95 submit latency ≤500 ms excluding auth.

**Dependencies:** DOS-061, DOS-073.

**Risks:** Primary failure and trust risks: Invalid syntax, credentials in URL, non-public host, rate limit, duplicate running job, service unavailable. Security risks: SSRF, Unicode hostname confusion, DNS rebinding, redirect validation, per-IP/user throttles.

**Estimated complexity:** M

**Release wave:** Wave 1

---

## DOS-002 — Follow truthful ingestion progress

**ID:** DOS-002

**Epic:** Landing and onboarding

**Feature:** Follow truthful ingestion progress

**Priority:** P0

**Persona:** Startup founder

**User story:** As a startup founder, I want to see real ingestion progress, so that I know whether the system is working and can recover from a delay.

**User problem:** Indeterminate AI loading erodes trust and causes duplicate submissions.

**Business outcome:** Users understand completed, active, blocked, failed, and retryable stages; abandonment during ingestion is <15%.

**Preconditions:** Dependencies are satisfied; Ingestion owner or workspace member with view permission.

**Main workflow:** SSE updates stages and routes to profile review on completion.

**Alternative workflows:** Poll after SSE loss; close and resume from onboarding; simulation is clearly labeled.

**Failure states:** Lease expired, crawl partial, model timeout, artifact compensation, auth loss.

**Acceptance criteria:** UI reflects persisted stages `validating`, `fetching`, `extracting`, `synthesizing`, `persisting`, `complete`; percent is stage-weighted, never fabricated; last heartbeat and mode are shown; refresh/reconnect resumes; terminal error includes safe next action.

**Permissions:** Ingestion owner or workspace member with view permission.

**Approval requirements:** None for read-only analysis; any derived external side effect is a separate approval-gated action.

**Data required:** Ingestion/run/stage records, heartbeat, attempt, error class, simulation flag.

**Data produced:** Tenant-scoped durable records for follow truthful ingestion progress, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Accessible stepper, elapsed time, retry/help actions, `aria-live=polite` status.

**Backend work:** `GET /api/v1/ingestions/{id}` and authenticated event stream; tenant recheck per poll.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Emit structured run metadata only; no prose progress fiction.

**Workflow/job work:** Stage events and heartbeat; stale-run detector.

**Connector work:** None; do not manufacture a connector dependency.

**Security considerations:** Opaque IDs; sanitized errors; stream authorization throughout connection.

**Analytics events:** `ingestion_stage_viewed`, `ingestion_resumed`, `ingestion_failed`, `ingestion_completed`.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Forced disconnect, reload, timeout, partial crawl, and simulation E2Es show exact durable state.

**Definition of done:** Forced disconnect, reload, timeout, partial crawl, and simulation E2Es show exact durable state.

**Dependencies:** DOS-001, DOS-070.

**Risks:** Primary failure and trust risks: Lease expired, crawl partial, model timeout, artifact compensation, auth loss. Security risks: Opaque IDs; sanitized errors; stream authorization throughout connection.

**Estimated complexity:** M

**Release wave:** Wave 1

---

## DOS-003 — Recover from an inaccessible or unsuitable website

**ID:** DOS-003

**Epic:** Landing and onboarding

**Feature:** Recover from an inaccessible or unsuitable website

**Priority:** P0

**Persona:** Small business owner

**User story:** As a small business owner, I want a clear recovery path when my website cannot be analysed, so that I can still reach a useful profile.

**User problem:** Blocks, JavaScript-only pages, sparse sites, and outages otherwise terminate activation.

**Business outcome:** ≥60% of safe ingestion failures recover through retry, alternate public page, or bounded manual profile.

**Preconditions:** Dependencies are satisfied; Creator can recover; members require create-mission permission.

**Main workflow:** User supplies a public pricing/about page and resumes.

**Alternative workflows:** Enter product, audience, offer, and CTA manually; save draft and return.

**Failure states:** Repeated unsafe URL, quota exhausted, unsupported language/file, manual validation error.

**Acceptance criteria:** Classify `inaccessible`, `robots_blocked`, `unsupported_content`, `unsafe_target`, `too_large`, `insufficient_evidence`, and `transient`; never bypass robots/auth; offer retry only for retryable errors; manual path marks fields user-supplied; no workspace is presented as fully analysed when crawl failed.

**Permissions:** Creator can recover; members require create-mission permission.

**Approval requirements:** None for read-only analysis; any derived external side effect is a separate approval-gated action.

**Data required:** Safe error class, attempt history, alternate URL, manual source attribution.

**Data produced:** Tenant-scoped durable records for recover from an inaccessible or unsuitable website, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Cause-specific error panel; manual minimum form; support link.

**Backend work:** Recovery command and partial-profile schema; retry-after response.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Synthesize only from available labeled sources; lower confidence.

**Workflow/job work:** Exponential retry for transient fetch failures only.

**Connector work:** None; do not manufacture a connector dependency.

**Security considerations:** Never ask for passwords or private-page exports; scan uploaded fallback if later allowed.

**Analytics events:** `ingestion_recovery_offered`, `alternate_url_submitted`, `manual_profile_started/completed`.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Fixture suite for every class; copy and allowed action match retry policy.

**Definition of done:** Fixture suite for every class; copy and allowed action match retry policy.

**Dependencies:** DOS-001, DOS-006.

**Risks:** Primary failure and trust risks: Repeated unsafe URL, quota exhausted, unsupported language/file, manual validation error. Security risks: Never ask for passwords or private-page exports; scan uploaded fallback if later allowed.

**Estimated complexity:** M

**Release wave:** Wave 1

---

## DOS-004 — Create and complete a workspace checklist

**ID:** DOS-004

**Epic:** Landing and onboarding

**Feature:** Create and complete a workspace checklist

**Priority:** P0

**Persona:** Indie hacker

**User story:** As an indie hacker, I want a ready workspace and short checklist after analysis, so that I can reach my first approved action quickly.

**User problem:** Analysis without a guided next step produces insight but no distribution.

**Business outcome:** ≥50% of analysed workspaces confirm profile and review an opportunity in the same session.

**Preconditions:** Dependencies are satisfied; Owner creates; all members view; task actions respect capability roles.

**Main workflow:** Analysis completes, Mission Control opens, user follows contextual CTAs.

**Alternative workflows:** Skip optional connectors; invite an approver; remain in simulation.

**Failure states:** Persistence conflict, partial graph failure, missing identity, tenant creation limit.

**Acceptance criteria:** Workspace/mission/initial artifacts are atomically created or compensatingly removed; checklist includes profile confirmation, opportunity review, measurement connection, Gmail connection, Stripe connection, and first approval; unavailable capabilities say why; completion derives from records, not user toggles.

**Permissions:** Owner creates; all members view; task actions respect capability roles.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Workspace, mission, checklist derivations, profile version, connector states.

**Data produced:** Tenant-scoped durable records for create and complete a workspace checklist, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Compact progress card and resume CTA; no celebratory success before commit.

**Backend work:** Idempotent workspace bootstrap and `GET /api/v1/onboarding/status`.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Recommend order based on goal and gaps; deterministic required items.

**Workflow/job work:** Reconciliation job detects/removes orphan bootstrap artifacts.

**Connector work:** Capability-aware adapter work for Gmail, Stripe, connector; verify scopes, health, rate limits, idempotency, receipts, revoke/reconnect, and simulation boundaries before claiming support.

**Security considerations:** Tenant identifier never accepted from bootstrap body; quotas prevent workspace abuse.

**Analytics events:** `workspace_created`, `checklist_item_completed`, `activation_milestone_reached`.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Transaction/compensation fault tests and checklist derivation tests pass.

**Definition of done:** Transaction/compensation fault tests and checklist derivation tests pass.

**Dependencies:** DOS-002, DOS-061.

**Risks:** Primary failure and trust risks: Persistence conflict, partial graph failure, missing identity, tenant creation limit. Security risks: Tenant identifier never accepted from bootstrap body; quotas prevent workspace abuse.

**Estimated complexity:** L

**Release wave:** Wave 1

---

## DOS-005 — Crawl a public website safely

**ID:** DOS-005

**Epic:** Website intelligence

**Feature:** Crawl a public website safely

**Priority:** P0

**Persona:** Growth operator

**User story:** As a growth operator, I want the system to gather bounded public website evidence, so that recommendations reflect the actual product.

**User problem:** Shallow or unsafe fetching creates poor analysis and infrastructure risk.

**Business outcome:** Capture relevant product/pricing/about/CTA evidence with ≥95% safe-fetch completion for eligible sites.

**Preconditions:** Dependencies are satisfied; Service job scoped to initiating workspace; no cross-workspace cache content without safe isolation.

**Main workflow:** Root and a bounded set of same-site high-value pages are fetched and deduplicated.

**Alternative workflows:** Sitemap guides selection; canonical link deduplicates; locale page is selected.

**Failure states:** Private IP, rebinding, redirect loop, decompression bomb, TLS error, 429, unsupported MIME.

**Acceptance criteria:** Re-resolve and validate every redirect; allow listed content types only; enforce page/byte/time/depth limits and robots policy; sanitize scripts/forms/comments/hidden content; store source URL, hash, timestamps, parser version, status, and extracted text; partial crawl is explicit.

**Permissions:** Service job scoped to initiating workspace; no cross-workspace cache content without safe isolation.

**Approval requirements:** None for read-only analysis; any derived external side effect is a separate approval-gated action.

**Data required:** Fetch manifest, response metadata, content hashes, redaction/security findings.

**Data produced:** Tenant-scoped durable records for crawl a public website safely, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Crawl coverage and partial-warning detail.

**Backend work:** Hardened fetch service and artifact store; egress allow policy.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Treat sanitized text as quoted untrusted data, never instructions.

**Workflow/job work:** Bounded fan-out, circuit breaker, host rate limit, retry policy.

**Connector work:** None; do not manufacture a connector dependency.

**Security considerations:** SSRF, prompt injection, malware, PII minimization, data poisoning.

**Analytics events:** `crawl_started/completed/partial/blocked`, pages/bytes/duration.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: OWASP SSRF corpus, redirect/rebinding, hostile HTML, size, robots, and load tests pass.

**Definition of done:** OWASP SSRF corpus, redirect/rebinding, hostile HTML, size, robots, and load tests pass.

**Dependencies:** DOS-001, DOS-073.

**Risks:** Primary failure and trust risks: Private IP, rebinding, redirect loop, decompression bomb, TLS error, 429, unsupported MIME. Security risks: SSRF, prompt injection, malware, PII minimization, data poisoning.

**Estimated complexity:** L

**Release wave:** Wave 1

---

## DOS-006 — Extract a structured business profile

**ID:** DOS-006

**Epic:** Website intelligence

**Feature:** Extract a structured business profile

**Priority:** P0

**Persona:** Startup founder

**User story:** As a startup founder, I want an editable business profile extracted from my site, so that I can validate the system’s commercial understanding.

**User problem:** Unstructured page summaries cannot drive reliable strategy or automation.

**Business outcome:** Required profile fields are schema-valid, evidence-linked, and reviewed in ≤10 minutes.

**Preconditions:** Dependencies are satisfied; Workspace creator starts; members with intelligence view see; editor can correct later.

**Main workflow:** Model returns valid structured output and user sees high-impact fields first.

**Alternative workflows:** Deterministic extraction supplies pricing/CTAs; simulation fixture populates clearly labeled demo values.

**Failure states:** Insufficient evidence, conflicting price, unsupported language, model refusal/timeout/schema error.

**Acceptance criteria:** Output includes product description, proposition, audiences, problems, category, alternatives, positioning, pricing, CTAs, conversion paths, opportunities, unknowns, assumptions, and per-assertion confidence/evidence; missing is `unknown`, never invented; schema failure retries once then returns reviewable partial output; mode/model/prompt version recorded.

**Permissions:** Workspace creator starts; members with intelligence view see; editor can correct later.

**Approval requirements:** None for read-only analysis; any derived external side effect is a separate approval-gated action.

**Data required:** Sanitized evidence refs, structured assertions, confidence factors, run metadata.

**Data produced:** Tenant-scoped durable records for extract a structured business profile, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Evidence-linked review form, unknown/conflict badges, skeleton/error/partial states.

**Backend work:** Versioned profile schema, structured-output validation, assertion persistence.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Evidence-bounded prompt, citations by internal evidence ID, calibration checks.

**Workflow/job work:** Model timeout/cost guard, deterministic fallback, resumable persistence.

**Connector work:** None; do not manufacture a connector dependency.

**Security considerations:** Prompt injection isolation; sensitive source redaction; output encoding.

**Analytics events:** `profile_generated`, `profile_partial`, field confidence distribution.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Golden fixtures meet extraction rubric; every assertion references evidence or is labeled inference/unknown.

**Definition of done:** Golden fixtures meet extraction rubric; every assertion references evidence or is labeled inference/unknown.

**Dependencies:** DOS-005, DOS-077.

**Risks:** Primary failure and trust risks: Insufficient evidence, conflicting price, unsupported language, model refusal/timeout/schema error. Security risks: Prompt injection isolation; sensitive source redaction; output encoding.

**Estimated complexity:** L

**Release wave:** Wave 1

---

## DOS-007 — Detect pricing, CTAs, audiences, competitors, and gaps

**ID:** DOS-007

**Epic:** Website intelligence

**Feature:** Detect pricing, CTAs, audiences, competitors, and gaps

**Priority:** P1

**Persona:** Content strategist

**User story:** As a content strategist, I want commercial page signals and gaps identified, so that messaging recommendations address conversion barriers.

**User problem:** A generic description misses the offer mechanics that determine conversion.

**Business outcome:** The profile surfaces pricing/CTA consistency, likely audience, named alternatives, and missing trust/conversion information.

**Preconditions:** Dependencies are satisfied; Viewers read; editors resolve/confirm; AI cannot silently resolve conflict.

**Main workflow:** Findings populate intelligence review and inform opportunity scoring.

**Alternative workflows:** No public pricing becomes an explicit unknown; user marks sales-led pricing intentional.

**Failure states:** Ambiguous currencies, stale cache, competitor name collision, inaccessible checkout.

**Acceptance criteria:** Each finding has type, severity, observed/inferred class, evidence, confidence, freshness, and suggested validation; “competitor” requires explicit evidence or is “possible alternative”; contradictory prices remain separate; gaps include no price, weak CTA, unclear audience, unsupported claim, or broken path.

**Permissions:** Viewers read; editors resolve/confirm; AI cannot silently resolve conflict.

**Approval requirements:** None for read-only analysis; any derived external side effect is a separate approval-gated action.

**Data required:** Page elements, link graph, assertions, contradiction relations, user resolutions.

**Data produced:** Tenant-scoped durable records for detect pricing, ctas, audiences, competitors, and gaps, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Severity filters, side-by-side evidence, confirm/dismiss actions.

**Backend work:** Signal detectors and `GET /api/v1/missions/{id}/findings`.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Classify signals and explain limits; no unsourced market claim.

**Workflow/job work:** Re-run on new crawl; invalidate affected scores.

**Connector work:** None; do not manufacture a connector dependency.

**Security considerations:** Links displayed safely; no competitor crawling without separate policy.

**Analytics events:** `finding_viewed/confirmed/dismissed`, `conversion_gap_detected`.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Precision/recall rubric passes curated fixtures; user decisions version graph.

**Definition of done:** Precision/recall rubric passes curated fixtures; user decisions version graph.

**Dependencies:** DOS-006, DOS-010.

**Risks:** Primary failure and trust risks: Ambiguous currencies, stale cache, competitor name collision, inaccessible checkout. Security risks: Links displayed safely; no competitor crawling without separate policy.

**Estimated complexity:** M

**Release wave:** Wave 1

---

## DOS-008 — Correct and confirm AI understanding

**ID:** DOS-008

**Epic:** Website intelligence

**Feature:** Correct and confirm AI understanding

**Priority:** P0

**Persona:** Small business owner

**User story:** As a small business owner, I want to correct and confirm the generated profile, so that assumptions do not become business truth.

**User problem:** Incorrect AI context contaminates every downstream action.

**Business outcome:** Material fields have explicit ownership and downstream recommendations use the latest confirmed version.

**Preconditions:** Dependencies are satisfied; Owner/admin/editor edit; viewer read; strategic changes may require approver by policy.

**Main workflow:** User edits audience and pricing, confirms, and triggers bounded re-analysis.

**Alternative workflows:** Confirm all unchanged fields; defer unknown; attach a note/source URL.

**Failure states:** Version conflict, invalid currency/URL, unauthorized edit, resynthesis failure.

**Acceptance criteria:** Edit records before/after, reason, actor, and timestamp; confirming changes assertion class to `user_confirmed`; material edits create a profile version and mark derived opportunities stale; conflicts use optimistic locking; undo creates a new version; profile completeness and unresolved unknowns are shown.

**Permissions:** Owner/admin/editor edit; viewer read; strategic changes may require approver by policy.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Profile/assertion versions, actor, evidence, dependency/staleness links.

**Data produced:** Tenant-scoped durable records for correct and confirm ai understanding, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Autosaved draft, diff review, stale-impact warning, success/conflict states.

**Backend work:** `PATCH /api/v1/business-profile` with ETag and confirmation command.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Explain inferred origin; resynthesize only affected derived artifacts.

**Workflow/job work:** Dependency invalidation and re-score job.

**Connector work:** None; do not manufacture a connector dependency.

**Security considerations:** Audit all edits; sanitize user text; tenant scope/version check.

**Analytics events:** `profile_field_edited`, `profile_confirmed`, `profile_conflict`.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Concurrent-edit, authorization, invalidation, audit, and end-to-end reanalysis tests pass.

**Definition of done:** Concurrent-edit, authorization, invalidation, audit, and end-to-end reanalysis tests pass.

**Dependencies:** DOS-006.

**Risks:** Primary failure and trust risks: Version conflict, invalid currency/URL, unauthorized edit, resynthesis failure. Security risks: Audit all edits; sanitize user text; tenant scope/version check.

**Estimated complexity:** M

**Release wave:** Wave 1

---

## DOS-009 — View the business graph as a business profile

**ID:** DOS-009

**Epic:** Business Graph

**Feature:** View the business graph as a business profile

**Priority:** P0

**Persona:** Executive

**User story:** As an executive, I want a comprehensible view of products, offers, audiences, channels, and evidence, so that I can assess the system’s operating context.

**User problem:** Raw graph data is unusable for commercial review.

**Business outcome:** Users locate the evidence and status of any material assertion in ≤3 clicks.

**Preconditions:** Dependencies are satisfied; Tenant viewers read; sensitive lead/payment nodes require separate scopes.

**Main workflow:** User opens an offer, follows “targets audience” edge, and inspects evidence.

**Alternative workflows:** Search entity; use relationship table; export selected subgraph.

**Failure states:** Dangling evidence, stale version, access revoked mid-session, query timeout.

**Acceptance criteria:** Default view is a structured profile, not a node cloud; each entity shows status, confidence band, freshness, owner, evidence count, and relationships; filters include confirmed/inferred/unknown/contradicted; empty/loading/error/stale states are defined; large graphs paginate.

**Permissions:** Tenant viewers read; sensitive lead/payment nodes require separate scopes.

**Approval requirements:** None for read-only analysis; any derived external side effect is a separate approval-gated action.

**Data required:** Nodes, edges, assertions, evidence summary, version/current flags.

**Data produced:** Tenant-scoped durable records for view the business graph as a business profile, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Profile sections, optional relationship explorer, provenance drawer.

**Backend work:** Tenant-scoped graph query with depth/page limits and field-level authorization.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Plain-language relationship summaries must cite graph IDs.

**Workflow/job work:** Read-model projection after graph events.

**Connector work:** None; do not manufacture a connector dependency.

**Security considerations:** Avoid graph traversal across workspace keys; redact restricted nodes.

**Analytics events:** `graph_viewed`, `entity_opened`, `evidence_traversed`.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Accessibility, 10k-node performance, field-scope, and cross-tenant tests pass.

**Definition of done:** Accessibility, 10k-node performance, field-scope, and cross-tenant tests pass.

**Dependencies:** DOS-004, DOS-006, DOS-061.

**Risks:** Primary failure and trust risks: Dangling evidence, stale version, access revoked mid-session, query timeout. Security risks: Avoid graph traversal across workspace keys; redact restricted nodes.

**Estimated complexity:** L

**Release wave:** Wave 1

---

## DOS-010 — Edit entities and typed relationships

**ID:** DOS-010

**Epic:** Business Graph

**Feature:** Edit entities and typed relationships

**Priority:** P1

**Persona:** Marketing manager

**User story:** As a marketing manager, I want to edit entities and valid relationships, so that strategy reflects current commercial reality.

**User problem:** Static AI output becomes stale and cannot coordinate a team.

**Business outcome:** Authorized edits update dependent decisions without corrupting graph integrity.

**Preconditions:** Dependencies are satisfied; Editor creates/edits; owner/admin archives/merges; viewer reads.

**Main workflow:** Manager adds an offer and links it to an audience and conversion path.

**Alternative workflows:** Merge duplicate entities; archive old offer; propose edit for approval.

**Failure states:** ETag conflict, invalid relationship, referenced active campaign, unauthorized archive.

**Acceptance criteria:** Entity types have schemas; relationship types constrain valid source/target; dates and evidence are optional only by rule; soft archive preserves history; material edits version graph and mark dependants stale; API rejects cross-tenant/dangling/cyclic relationships where forbidden.

**Permissions:** Editor creates/edits; owner/admin archives/merges; viewer reads.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Typed nodes/edges, constraints, validity window, author, reason.

**Data produced:** Tenant-scoped durable records for edit entities and typed relationships, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Schema-driven forms, relation picker, impact preview, diff/conflict UI.

**Backend work:** CRUD/merge endpoints, optimistic concurrency, constraint service.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Suggest relations only; never commit without user action/policy.

**Workflow/job work:** Recompute affected profile/opportunity read models.

**Connector work:** None; do not manufacture a connector dependency.

**Security considerations:** Server-enforced types and tenant keys; content sanitization.

**Analytics events:** `graph_entity_created/updated/archived`, `relationship_created`.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Constraint, merge lineage, dependency invalidation, and audit tests pass.

**Definition of done:** Constraint, merge lineage, dependency invalidation, and audit tests pass.

**Dependencies:** DOS-009, DOS-070.

**Risks:** Primary failure and trust risks: ETag conflict, invalid relationship, referenced active campaign, unauthorized archive. Security risks: Server-enforced types and tenant keys; content sanitization.

**Estimated complexity:** L

**Release wave:** Wave 2

---

## DOS-011 — Review assumptions, evidence, and contradictions

**ID:** DOS-011

**Epic:** Business Graph

**Feature:** Review assumptions, evidence, and contradictions

**Priority:** P0

**Persona:** Startup founder

**User story:** As a startup founder, I want assumptions and contradictory evidence surfaced, so that I can resolve the riskiest uncertainty before spending.

**User problem:** Hidden assumptions cause confidently wrong campaigns.

**Business outcome:** Every high-impact unverified assertion is visible and resolvable; no P0 action relies silently on contradicted evidence.

**Preconditions:** Dependencies are satisfied; Viewers inspect; editors propose; approver resolves material assertions.

**Main workflow:** User resolves target segment contradiction and dependent plan is rescored.

**Alternative workflows:** Defer low-impact assumption with review date; attach direct customer evidence.

**Failure states:** Source unavailable, hash mismatch, research timeout, user lacks resolve permission.

**Acceptance criteria:** Assumptions rank by impact×uncertainty; evidence cards show source/freshness/provenance; contradiction pairs preserve both records; user can confirm, reject, defer, or request research; action readiness blocks when policy-defined critical assumptions remain contradicted.

**Permissions:** Viewers inspect; editors propose; approver resolves material assertions.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Assumption impact, contradiction edges, evidence class, resolution/version.

**Data produced:** Tenant-scoped durable records for review assumptions, evidence, and contradictions, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Risk-sorted inbox, compare panel, blocked-action link.

**Backend work:** Assumption queue, resolution command, readiness integration.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Explain why evidence conflicts and propose validation, with uncertainty.

**Workflow/job work:** Freshness scan and dependent invalidation.

**Connector work:** None; do not manufacture a connector dependency.

**Security considerations:** Preserve immutable evidence; malware-safe source previews.

**Analytics events:** `assumption_reviewed/resolved/deferred`, `contradiction_detected`.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Readiness cannot pass a critical unresolved contradiction; trace test reaches source.

**Definition of done:** Readiness cannot pass a critical unresolved contradiction; trace test reaches source.

**Dependencies:** DOS-008, DOS-067.

**Risks:** Primary failure and trust risks: Source unavailable, hash mismatch, research timeout, user lacks resolve permission. Security risks: Preserve immutable evidence; malware-safe source previews.

**Estimated complexity:** M

**Release wave:** Wave 1

---

## DOS-012 — Track graph versions without tenant leakage

**ID:** DOS-012

**Epic:** Business Graph

**Feature:** Track graph versions without tenant leakage

**Priority:** P0

**Persona:** Agency owner

**User story:** As an agency owner, I want tenant-safe graph history and diffs, so that I can govern client changes without mixing data.

**User problem:** Shared infrastructure creates severe cross-client disclosure and accountability risk.

**Business outcome:** Every read/write/export proves tenant membership and every graph change is reconstructable.

**Preconditions:** Dependencies are satisfied; Owner/admin restore/export; viewers diff allowed fields; platform admin has audited break-glass only.

**Main workflow:** Owner compares versions and restores a prior positioning assertion as a new version.

**Alternative workflows:** Export a version; legal hold prevents purge; member sees permitted subset.

**Failure states:** Missing tenant context, stale cache, version pruned by policy, restore conflicts.

**Acceptance criteria:** Composite tenant keys or RLS protect nodes/edges; all repository methods require tenant context; version diff shows actor/reason/evidence; restore creates a forward version; caches/embeddings include tenant namespace; automated canary attempts cross-tenant IDs and gets indistinguishable 404.

**Permissions:** Owner/admin restore/export; viewers diff allowed fields; platform admin has audited break-glass only.

**Approval requirements:** None for read-only analysis; any derived external side effect is a separate approval-gated action.

**Data required:** Version/event sequence, tenant, actor, diff, retention/hold.

**Data produced:** Tenant-scoped durable records for track graph versions without tenant leakage, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Timeline, semantic diff, restore confirmation and impact warning.

**Backend work:** Tenant repository abstraction, RLS tests, version/diff/restore endpoints.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Memory retrieval must pass same tenant filters.

**Workflow/job work:** Retention job preserves holds and tombstones.

**Connector work:** None; do not manufacture a connector dependency.

**Security considerations:** IDOR, cache poisoning, embedding leakage, admin break-glass.

**Analytics events:** `graph_version_viewed/restored/exported`; security denials separately.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Property-based tenant isolation and restore lineage tests pass in CI.

**Definition of done:** Property-based tenant isolation and restore lineage tests pass in CI.

**Dependencies:** DOS-061, DOS-069, DOS-073.

**Risks:** Primary failure and trust risks: Missing tenant context, stale cache, version pruned by policy, restore conflicts. Security risks: IDOR, cache poisoning, embedding leakage, admin break-glass.

**Estimated complexity:** L

**Release wave:** Wave 0

---

## DOS-013 — See the current commercial state and revenue truth

**ID:** DOS-013

**Epic:** Mission Control

**Feature:** See the current commercial state and revenue truth

**Priority:** P0

**Persona:** Executive

**User story:** As an executive, I want one current-state view tied to verified revenue, so that I can decide what deserves attention now.

**User problem:** Fragmented tools obscure whether work creates business value.

**Business outcome:** In <30 seconds, a user can state lifecycle stage, verified revenue, funnel bottleneck, and next action.

**Preconditions:** Dependencies are satisfied; Viewer sees aggregate; financial detail needs revenue permission.

**Main workflow:** User sees one payment, its attribution band, and next bottleneck.

**Alternative workflows:** No revenue shows setup or first-action CTA; multiple currencies stay separate.

**Failure states:** Query partial, Stripe unhealthy, delayed events, authorization loss.

**Acceptance criteria:** Header shows mission stage/cycle/mode/freshness; revenue separates verified, refunded, pending, and attributed; funnel denominators are visible; cards link to source records; stale/partial connectors degrade explicitly; no fabricated zero-vs-unavailable ambiguity.

**Permissions:** Viewer sees aggregate; financial detail needs revenue permission.

**Approval requirements:** None for read-only analysis; any derived external side effect is a separate approval-gated action.

**Data required:** Mission read model, funnel events, payments/refunds, connector freshness.

**Data produced:** Tenant-scoped durable records for see the current commercial state and revenue truth, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** High-density responsive dashboard, text alternatives for charts.

**Backend work:** `GET /api/v1/mission-control` snapshot with as-of time/data-quality flags.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Summary uses only snapshot and labels inference.

**Workflow/job work:** Incremental read-model projection and reconciliation alerts.

**Connector work:** Capability-aware adapter work for connector, Stripe; verify scopes, health, rate limits, idempotency, receipts, revoke/reconnect, and simulation boundaries before claiming support.

**Security considerations:** Field-level financial authorization; safe cached tenant keys.

**Analytics events:** `mission_control_viewed`, `revenue_drilldown_opened`, time-to-decision CTA.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Data contract, accessibility, partial-data, currency, and revenue-trace E2Es pass.

**Definition of done:** Data contract, accessibility, partial-data, currency, and revenue-trace E2Es pass.

**Dependencies:** DOS-004, DOS-047, DOS-051.

**Risks:** Primary failure and trust risks: Query partial, Stripe unhealthy, delayed events, authorization loss. Security risks: Field-level financial authorization; safe cached tenant keys.

**Estimated complexity:** L

**Release wave:** Wave 1

---

## DOS-014 — Review and prioritize next actions

**ID:** DOS-014

**Epic:** Mission Control

**Feature:** Review and prioritize next actions

**Priority:** P0

**Persona:** Growth operator

**User story:** As a growth operator, I want a short ranked action queue with rationale, so that I spend time on the highest expected commercial value.

**User problem:** Long AI task lists create paralysis and diffuse learning.

**Business outcome:** A user accepts, edits, delegates, or dismisses a top-three action within 5 minutes.

**Preconditions:** Dependencies are satisfied; Members review; operators act; approvers approve; viewers cannot mutate.

**Main workflow:** User selects top action and opens prefilled experiment/approval flow.

**Alternative workflows:** Reorder; snooze; dismiss; delegate; request more evidence.

**Failure states:** No evidence-qualified action, stale score, policy blocks all channels, AI unavailable.

**Acceptance criteria:** Each card includes outcome, reason, evidence, source/freshness, confidence band, expected impact range, effort, risk, approval, dependency, and measurement; ranking formula/version visible; manual priority records reason; dismissed actions do not immediately recur unchanged.

**Permissions:** Members review; operators act; approvers approve; viewers cannot mutate.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Recommendation, score inputs, evidence refs, policy/readiness, decisions.

**Data produced:** Tenant-scoped durable records for review and prioritize next actions, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Three-item focus queue with expandable explanation and keyboard actions.

**Backend work:** Ranked recommendation query and decision/snooze commands.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Generate bounded recommendations; deterministic scorer orders eligible items.

**Workflow/job work:** Re-score on material events with debounce and versioning.

**Connector work:** None; do not manufacture a connector dependency.

**Security considerations:** Tool output cannot bypass eligibility; audit manual overrides.

**Analytics events:** `recommendation_viewed/accepted/edited/dismissed/snoozed`, `time_to_action`.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Recommendation template completeness and recurrence suppression tests pass.

**Definition of done:** Recommendation template completeness and recurrence suppression tests pass.

**Dependencies:** DOS-017, DOS-021, DOS-065.

**Risks:** Primary failure and trust risks: No evidence-qualified action, stale score, policy blocks all channels, AI unavailable. Security risks: Tool output cannot bypass eligibility; audit manual overrides.

**Estimated complexity:** M

**Release wave:** Wave 2

---

## DOS-015 — See blockers and running jobs

**ID:** DOS-015

**Epic:** Mission Control

**Feature:** See blockers and running jobs

**Priority:** P0

**Persona:** Marketing manager

**User story:** As a marketing manager, I want live blockers and job states, so that I can unblock delivery without assuming work happened.

**User problem:** Background automation is opaque and failures silently waste campaign windows.

**Business outcome:** Every active/blocked action has an owner, state, last update, and valid remediation.

**Preconditions:** Dependencies are satisfied; Members view mission jobs; operators retry/cancel; admins reconnect; approvers reapprove changed payload.

**Main workflow:** Expired Gmail token blocks job; owner reconnects; same job resumes without duplicate send.

**Alternative workflows:** Cancel before submission; acknowledge ambiguous result; assign human input.

**Failure states:** Worker lost lease, webhook delayed, provider timeout, poisoned job, reconnect denied.

**Acceptance criteria:** Job drawer shows queued/running/retrying/ambiguous/succeeded/failed/blocked/reconnection/human-input; provider acceptance differs from delivery; stale heartbeat alerts; retry button appears only for retryable/idempotent work; blocker deep-links to connector, approval, budget, or input.

**Permissions:** Members view mission jobs; operators retry/cancel; admins reconnect; approvers reapprove changed payload.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Job/attempt/lease/receipt/blocker records and provider event timestamps.

**Data produced:** Tenant-scoped durable records for see blockers and running jobs, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Real-time drawer, duration, attempt log, remediation CTAs.

**Backend work:** Job query/command endpoints with CAS transitions.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Summarize error safely; cannot relabel state.

**Workflow/job work:** Durable leases, heartbeats, retry classes, dead-letter handling.

**Connector work:** Capability-aware adapter work for provider, connector, Gmail; verify scopes, health, rate limits, idempotency, receipts, revoke/reconnect, and simulation boundaries before claiming support.

**Security considerations:** Redact payload/secrets; cancel authorization; tenant stream checks.

**Analytics events:** `job_viewed/retried/cancelled/unblocked`, `job_state_changed`.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Crash/retry/timeout/reconnect/duplicate chaos tests preserve exact-once business effect.

**Definition of done:** Crash/retry/timeout/reconnect/duplicate chaos tests preserve exact-once business effect.

**Dependencies:** DOS-039, DOS-070.

**Risks:** Primary failure and trust risks: Worker lost lease, webhook delayed, provider timeout, poisoned job, reconnect denied. Security risks: Redact payload/secrets; cancel authorization; tenant stream checks.

**Estimated complexity:** L

**Release wave:** Wave 1

---

## DOS-016 — Ask the AI COO an evidence-grounded question

**ID:** DOS-016

**Epic:** Mission Control

**Feature:** Ask the AI COO an evidence-grounded question

**Priority:** P1

**Persona:** Solo builder

**User story:** As a solo builder, I want to ask an AI COO what to do next, so that I receive a concise decision grounded in my current business evidence.

**User problem:** Generic chat lacks state, provenance, and operational follow-through.

**Business outcome:** ≥80% of rated answers are useful and every material claim is cited or labeled assumption.

**Preconditions:** Dependencies are satisfied; Members ask within readable scope; actions need separate operator/approver permission.

**Main workflow:** User asks how to get first 10 leads; COO compares opportunities and proposes one experiment.

**Alternative workflows:** Ask for explanation, counterargument, source, or simulation.

**Failure states:** No evidence, conflicting sources, model timeout, unsafe request, budget exceeded.

**Acceptance criteria:** Answer includes recommendation, reason, evidence links, confidence/freshness, expected impact, risks, approval, and proposed next action; retrieval is tenant/permission scoped; it says “unknown” when evidence is absent; draft artifacts require explicit user creation; no direct execution from chat.

**Permissions:** Members ask within readable scope; actions need separate operator/approver permission.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Question, authorized graph/evidence snapshot, prompt/model versions, citations, feedback.

**Data produced:** Tenant-scoped durable records for ask the ai coo an evidence-grounded question, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Citation chips, suggested questions, stop/retry, create-draft CTA.

**Backend work:** Streaming conversation endpoint and retrieval authorization.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** AI COO prompt/tool allowlist, structured recommendation envelope, safety checks.

**Workflow/job work:** Long research becomes visible async run.

**Connector work:** None; do not manufacture a connector dependency.

**Security considerations:** Prompt injection, data exfiltration, indirect tool injection, cost/rate limits.

**Analytics events:** `coo_question_asked`, `citation_opened`, `answer_rated`, `draft_created_from_answer`.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Retrieval isolation, hallucination rubric, unsafe-request, no-evidence, and action-separation evals pass.

**Definition of done:** Retrieval isolation, hallucination rubric, unsafe-request, no-evidence, and action-separation evals pass.

**Dependencies:** DOS-009, DOS-067, DOS-077.

**Risks:** Primary failure and trust risks: No evidence, conflicting sources, model timeout, unsafe request, budget exceeded. Security risks: Prompt injection, data exfiltration, indirect tool injection, cost/rate limits.

**Estimated complexity:** L

**Release wave:** Wave 2

---

## DOS-017 — Review an evidence-backed strategic brief

**ID:** DOS-017

**Epic:** Strategic Intelligence

**Feature:** Review an evidence-backed strategic brief

**Priority:** P0

**Persona:** Startup founder

**User story:** As a startup founder, I want a concise strategic brief from confirmed business context, so that the team aligns on audience, positioning, offer, and next objective.

**User problem:** Tactical work diverges when commercial assumptions are not explicit.

**Business outcome:** A confirmed brief defines one primary segment, proposition, objective, and constraint for the current cycle.

**Preconditions:** Dependencies are satisfied; Editors draft; owner/strategy approver confirms; viewers read.

**Main workflow:** Founder reviews evidence, edits positioning, and confirms the cycle brief.

**Alternative workflows:** Save draft; compare prior version; request specific research.

**Failure states:** Critical profile unknown, contradictory evidence, concurrent edit, generation timeout.

**Acceptance criteria:** Brief includes situation, goal, audience, pain, alternative, differentiation, offer, channel thesis, risks, unknowns, evidence, confidence, KPI/denominator, timebox; unconfirmed fields are labeled; edits version the strategy; all generated plans reference a strategy version.

**Permissions:** Editors draft; owner/strategy approver confirms; viewers read.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Confirmed profile, evidence, opportunity history, strategy versions.

**Data produced:** Tenant-scoped durable records for review an evidence-backed strategic brief, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** One-page brief with confidence/evidence rails and diff view.

**Backend work:** Brief generation, CRUD/version/diff, strategy confirmation command.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Synthesis constrained to inputs; dissent/uncertainty section required.

**Workflow/job work:** Generate/resynthesize; invalidate downstream drafts on version change.

**Connector work:** None; do not manufacture a connector dependency.

**Security considerations:** Tenant retrieval and sanitization; audit strategic confirmation.

**Analytics events:** `brief_generated/edited/confirmed`, time-to-confirmation.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Template completeness, citation coverage, version linkage, and permission tests pass.

**Definition of done:** Template completeness, citation coverage, version linkage, and permission tests pass.

**Dependencies:** DOS-008, DOS-011.

**Risks:** Primary failure and trust risks: Critical profile unknown, contradictory evidence, concurrent edit, generation timeout. Security risks: Tenant retrieval and sanitization; audit strategic confirmation.

**Estimated complexity:** M

**Release wave:** Wave 1

---

## DOS-018 — Compare audience and positioning options

**ID:** DOS-018

**Epic:** Strategic Intelligence

**Feature:** Compare audience and positioning options

**Priority:** P1

**Persona:** Content strategist

**User story:** As a content strategist, I want to compare bounded audience-positioning options, so that messaging choices are explicit and testable.

**User problem:** One premature AI answer hides strategic alternatives and tradeoffs.

**Business outcome:** User selects a testable option or declares evidence insufficient.

**Preconditions:** Dependencies are satisfied; Editors compare; strategy approver selects production positioning.

**Main workflow:** User selects one positioning for a timeboxed experiment.

**Alternative workflows:** Combine only compatible elements; reject all; request customer evidence.

**Failure states:** Options materially duplicate, lack evidence, violate forbidden claim, or target prohibited audience.

**Acceptance criteria:** Produce ≤3 options; each states target, job/pain, promise, proof, alternative, channel implication, expected outcome, evidence coverage, risk, and disconfirming signal; comparison uses same criteria; selection creates a version/hypothesis, not permanent truth.

**Permissions:** Editors compare; strategy approver selects production positioning.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Audience/offer/competitor assertions, prior outcomes, brand/policy constraints.

**Data produced:** Tenant-scoped durable records for compare audience and positioning options, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Accessible comparison table/cards and “what would change my mind?” section.

**Backend work:** Comparison and selection endpoints with schema validation.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Diversity constraint, evidence scoring, forbidden-claim screening.

**Workflow/job work:** Selection triggers dependent content/experiment draft refresh.

**Connector work:** None; do not manufacture a connector dependency.

**Security considerations:** Bias/protected-class review; no sensitive targeting inference.

**Analytics events:** `positioning_options_generated/compared/selected/rejected`.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Rubric detects duplicate/unsupported options; selection trace reaches experiment.

**Definition of done:** Rubric detects duplicate/unsupported options; selection trace reaches experiment.

**Dependencies:** DOS-017, DOS-031.

**Risks:** Primary failure and trust risks: Options materially duplicate, lack evidence, violate forbidden claim, or target prohibited audience. Security risks: Bias/protected-class review; no sensitive targeting inference.

**Estimated complexity:** M

**Release wave:** Wave 2

---

## DOS-019 — Refresh intelligence when material evidence changes

**ID:** DOS-019

**Epic:** Strategic Intelligence

**Feature:** Refresh intelligence when material evidence changes

**Priority:** P1

**Persona:** Marketing manager

**User story:** As a marketing manager, I want strategy freshness tracked, so that campaigns do not run from stale pricing, offers, or audience assumptions.

**User problem:** Silent source changes invalidate live messaging and measurement.

**Business outcome:** Material changes are detected before affected future actions execute.

**Preconditions:** Dependencies are satisfied; System marks stale; editor resolves; approver reauthorizes.

**Main workflow:** Pricing page changes; scheduled price claim is blocked and owner reviews diff.

**Alternative workflows:** User marks change immaterial with reason; defer refresh.

**Failure states:** Site unavailable, noisy dynamic page, false materiality, resynthesis failure.

**Acceptance criteria:** Source-specific TTL and content hashes identify change; semantic diff classifies materiality; affected assertions/briefs/opportunities/actions become `stale`; already approved material payloads become blocked and require reapproval; user sees exact changed evidence and impact.

**Permissions:** System marks stale; editor resolves; approver reauthorizes.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Crawl versions, hashes, materiality rules, dependency graph, approvals.

**Data produced:** Tenant-scoped durable records for refresh intelligence when material evidence changes, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Change inbox, semantic diff, affected-artifact list.

**Backend work:** Refresh policy and stale dependency query/commands.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Classify materiality under deterministic high-risk overrides.

**Workflow/job work:** Scheduled recrawl, debounce, reanalysis, action gate integration.

**Connector work:** None; do not manufacture a connector dependency.

**Security considerations:** Repeat SSRF validation; protect against page-based denial and poisoning.

**Analytics events:** `material_change_detected`, `artifact_marked_stale`, `stale_action_blocked`.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Pricing/CTA/audience fixture changes invalidate correct artifacts and leave unrelated ones valid.

**Definition of done:** Pricing/CTA/audience fixture changes invalidate correct artifacts and leave unrelated ones valid.

**Dependencies:** DOS-005, DOS-070.

**Risks:** Primary failure and trust risks: Site unavailable, noisy dynamic page, false materiality, resynthesis failure. Security risks: Repeat SSRF validation; protect against page-based denial and poisoning.

**Estimated complexity:** L

**Release wave:** Wave 2

---

## DOS-020 — Detect bounded market and distribution opportunities

**ID:** DOS-020

**Epic:** Opportunity Engine

**Feature:** Detect bounded market and distribution opportunities

**Priority:** P1

**Persona:** Growth operator

**User story:** As a growth operator, I want evidence-qualified opportunities detected, so that I test real leverage rather than generate random campaign ideas.

**User problem:** Unbounded ideation wastes scarce time and budget.

**Business outcome:** System proposes 3–7 non-duplicate opportunities connected to a measurable funnel constraint.

**Preconditions:** Dependencies are satisfied; Members view; operators generate; policy controls data sources.

**Main workflow:** Low conversion plus strong audience evidence produces a positioning experiment.

**Alternative workflows:** No execution opportunity produces customer-research task; user requests refresh.

**Failure states:** No primary metric, stale profile, insufficient evidence, model/schema failure.

**Acceptance criteria:** Opportunity names audience, pain, channel, mechanism, offer/CTA, funnel stage, expected outcome, evidence/unknowns, confidence, risk, effort, timing, and validation step; prohibited/unavailable channels are excluded or blocked; duplicates cluster; weak evidence yields research opportunity, not execution.

**Permissions:** Members view; operators generate; policy controls data sources.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Graph, funnel, past experiments, channel capabilities, policies, evidence freshness.

**Data produced:** Tenant-scoped durable records for detect bounded market and distribution opportunities, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Opportunity queue with evidence/risk previews and empty research state.

**Backend work:** Opportunity generation/version store and eligibility filter.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Candidate generation; deterministic validation/deduplication.

**Workflow/job work:** Recompute on meaningful events, not every metric tick.

**Connector work:** None; do not manufacture a connector dependency.

**Security considerations:** No private/prohibited source use; prompt-injection isolation.

**Analytics events:** `opportunities_generated`, `opportunity_qualified`, count/evidence coverage.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Curated scenarios yield relevant, non-prohibited, schema-complete opportunities.

**Definition of done:** Curated scenarios yield relevant, non-prohibited, schema-complete opportunities.

**Dependencies:** DOS-017, DOS-051, DOS-059.

**Risks:** Primary failure and trust risks: No primary metric, stale profile, insufficient evidence, model/schema failure. Security risks: No private/prohibited source use; prompt-injection isolation.

**Estimated complexity:** L

**Release wave:** Wave 2

---

## DOS-021 — Rank and explain opportunity scores

**ID:** DOS-021

**Epic:** Opportunity Engine

**Feature:** Rank and explain opportunity scores

**Priority:** P1

**Persona:** Startup founder

**User story:** As a startup founder, I want explainable opportunity ranking, so that I can choose based on revenue potential, effort, risk, and evidence.

**User problem:** Opaque scores manufacture precision and reduce trust.

**Business outcome:** User can identify why an opportunity ranks above another and override it responsibly.

**Preconditions:** Dependencies are satisfied; Viewers inspect; operators override within policy; owner sets weighting policy.

**Main workflow:** User compares top two and selects the lower-effort learning option.

**Alternative workflows:** Change scenario constraints; manually prioritize; exclude a channel.

**Failure states:** Missing normalization, incomparable currencies/timeframes, stale score, invalid input.

**Acceptance criteria:** Versioned deterministic score combines audience fit, pain, channel fit, competition, timing, effort, expected conversion, revenue potential, confidence, and risk; raw inputs/ranges and missing penalties visible; sensitivity shows top drivers; score timestamp/version shown; override requires reason.

**Permissions:** Viewers inspect; operators override within policy; owner sets weighting policy.

**Approval requirements:** None for read-only analysis; any derived external side effect is a separate approval-gated action.

**Data required:** Component inputs/provenance, scoring version, constraints, override reason.

**Data produced:** Tenant-scoped durable records for rank and explain opportunity scores, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Ranked list, score breakdown, sensitivity and caveat drawer.

**Backend work:** Pure scoring service and ranking endpoint; reproducible snapshots.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Explain score from stored components; cannot alter numeric result.

**Workflow/job work:** Re-score when versioned input changes.

**Connector work:** None; do not manufacture a connector dependency.

**Security considerations:** Prevent model/user injection into policy weights; audit overrides.

**Analytics events:** `opportunity_score_opened`, `ranking_overridden`, `score_driver_viewed`.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Fixed fixtures reproduce exact rankings and explanations across releases.

**Definition of done:** Fixed fixtures reproduce exact rankings and explanations across releases.

**Dependencies:** DOS-020, DOS-065.

**Risks:** Primary failure and trust risks: Missing normalization, incomparable currencies/timeframes, stale score, invalid input. Security risks: Prevent model/user injection into policy weights; audit overrides.

**Estimated complexity:** M

**Release wave:** Wave 2

---

## DOS-022 — Create an opportunity brief

**ID:** DOS-022

**Epic:** Opportunity Engine

**Feature:** Create an opportunity brief

**Priority:** P1

**Persona:** Marketing manager

**User story:** As a marketing manager, I want a decision-ready opportunity brief, so that an approver can evaluate it without reconstructing the research.

**User problem:** Scores alone omit execution and measurement consequences.

**Business outcome:** Approver can accept, reject, or request evidence in ≤10 minutes.

**Preconditions:** Dependencies are satisfied; Editors create; approvers decide; viewers read.

**Main workflow:** Manager reviews, assigns owner, and converts to experiment.

**Alternative workflows:** Request research; edit as new version; share read-only link within tenant.

**Failure states:** Capability removed, evidence expires, owner/budget missing, policy conflict.

**Acceptance criteria:** Brief includes problem, audience, insight, proposed mechanism, channel capability, offer/CTA, expected impact range and assumptions, effort/cost, risks/compliance, evidence/freshness, confidence, measurement, kill rule, dependencies, and required approval; version is immutable after decision.

**Permissions:** Editors create; approvers decide; viewers read.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Opportunity snapshot, evidence set, score, policies, connector capabilities.

**Data produced:** Tenant-scoped durable records for create an opportunity brief, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Printable decision page, checklist, decision controls.

**Backend work:** Brief generation/version and readiness endpoint.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Structured narrative with citations and downside case.

**Workflow/job work:** Invalidate readiness on material dependency change.

**Connector work:** Capability-aware adapter work for connector, provider; verify scopes, health, rate limits, idempotency, receipts, revoke/reconnect, and simulation boundaries before claiming support.

**Security considerations:** Tenant-bound sharing; no secret/provider token exposure.

**Analytics events:** `opportunity_brief_created/viewed`, `evidence_requested`.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Brief readiness blocks missing metric/budget/capability/evidence fields.

**Definition of done:** Brief readiness blocks missing metric/budget/capability/evidence fields.

**Dependencies:** DOS-021, DOS-059.

**Risks:** Primary failure and trust risks: Capability removed, evidence expires, owner/budget missing, policy conflict. Security risks: Tenant-bound sharing; no secret/provider token exposure.

**Estimated complexity:** M

**Release wave:** Wave 2

---

## DOS-023 — Convert an opportunity into an experiment

**ID:** DOS-023

**Epic:** Opportunity Engine

**Feature:** Convert an opportunity into an experiment

**Priority:** P0

**Persona:** Growth operator

**User story:** As a growth operator, I want to convert an opportunity into a prefilled experiment, so that insight becomes a measurable action without losing provenance.

**User problem:** Manual handoff breaks traceability and delays execution.

**Business outcome:** Experiment is ready for refinement in <5 minutes and retains opportunity/strategy/evidence lineage.

**Preconditions:** Dependencies are satisfied; Operator creates; budget/strategy approval remains separate.

**Main workflow:** User reviews prefilled fields, fixes sample target, saves draft.

**Alternative workflows:** Clone into alternate channel experiment; create research-only experiment.

**Failure states:** Missing measurement capability, invalid deadline/budget, archived opportunity, stale strategy.

**Acceptance criteria:** Conversion prepopulates objective, falsifiable hypothesis, audience, channel, offer/content, CTA, owner, budget, dates, primary metric/denominator, target, instrumentation, approval, risk, and kill rule; source opportunity stays immutable; duplicate conversion warns; creation does not equal approval.

**Permissions:** Operator creates; budget/strategy approval remains separate.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Opportunity/brief/version refs, experiment inputs, creator.

**Data produced:** Tenant-scoped durable records for convert an opportunity into an experiment, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Prefilled wizard, provenance banner, readiness errors.

**Backend work:** Transactional conversion command with idempotency key.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Suggest missing values with reasons; deterministic validation.

**Workflow/job work:** Create instrumentation tasks and approval request only on submit.

**Connector work:** None; do not manufacture a connector dependency.

**Security considerations:** Prevent ID swapping/cross-tenant conversion; policy validation.

**Analytics events:** `opportunity_converted`, `experiment_prefill_changed`, conversion time.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: One command creates exactly one linked experiment under retries; lineage E2E passes.

**Definition of done:** One command creates exactly one linked experiment under retries; lineage E2E passes.

**Dependencies:** DOS-022.

**Risks:** Primary failure and trust risks: Missing measurement capability, invalid deadline/budget, archived opportunity, stale strategy. Security risks: Prevent ID swapping/cross-tenant conversion; policy validation.

**Estimated complexity:** M

**Release wave:** Wave 2

---

## DOS-024 — Dismiss, archive, and learn from opportunity outcomes

**ID:** DOS-024

**Epic:** Opportunity Engine

**Feature:** Dismiss, archive, and learn from opportunity outcomes

**Priority:** P1

**Persona:** Indie hacker

**User story:** As an indie hacker, I want to dismiss opportunities and track their outcomes, so that bad ideas stop recurring and good patterns compound.

**User problem:** Recommendation systems repeat rejected advice and lose decision context.

**Business outcome:** Dismissed opportunities recur only when material evidence changes; completed opportunities report commercial outcome.

**Preconditions:** Dependencies are satisfied; Operators dismiss/snooze; admins archive/reopen; viewers read.

**Main workflow:** User dismisses unavailable channel; it remains suppressed until connector capability changes.

**Alternative workflows:** Snooze; archive after run; reopen with reason.

**Failure states:** Active experiment prevents archive; invalid revisit date; stale outcome projection.

**Acceptance criteria:** Dismiss requires reason category/note and optional revisit condition/date; archive preserves score/evidence; linked experiment outcome updates opportunity result; recurrence compares new evidence and explains change; outcome dashboard separates won/lost/inconclusive/not-run.

**Permissions:** Operators dismiss/snooze; admins archive/reopen; viewers read.

**Approval requirements:** None for read-only analysis; any derived external side effect is a separate approval-gated action.

**Data required:** Decision, reason, condition, evidence version, linked outcomes/revenue.

**Data produced:** Tenant-scoped durable records for dismiss, archive, and learn from opportunity outcomes, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Reason dialog, archive, outcome chips, “why it returned” panel.

**Backend work:** State machine and suppression/recurrence rules.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Use prior dismissals as scoped negative feedback, not absolute truth.

**Workflow/job work:** Revisit scheduler and outcome projection.

**Connector work:** Capability-aware adapter work for connector; verify scopes, health, rate limits, idempotency, receipts, revoke/reconnect, and simulation boundaries before claiming support.

**Security considerations:** Audit decisions; user notes sanitized and tenant-scoped.

**Analytics events:** `opportunity_dismissed/snoozed/reopened/archived`, outcome value.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Suppression and evidence-change recurrence scenarios pass deterministic tests.

**Definition of done:** Suppression and evidence-change recurrence scenarios pass deterministic tests.

**Dependencies:** DOS-020, DOS-040, DOS-083.

**Risks:** Primary failure and trust risks: Active experiment prevents archive; invalid revisit date; stale outcome projection. Security risks: Audit decisions; user notes sanitized and tenant-scoped.

**Estimated complexity:** M

**Release wave:** Wave 2

---

## DOS-025 — Generate a measurable content strategy

**ID:** DOS-025

**Epic:** Content OS

**Feature:** Generate a measurable content strategy

**Priority:** P1

**Persona:** Content strategist

**User story:** As a content strategist, I want a content strategy tied to one audience and funnel objective, so that publishing creates qualified demand rather than volume.

**User problem:** Content calendars optimize output while disconnecting from conversion.

**Business outcome:** Every proposed content pillar has a business hypothesis, audience, CTA, channel rationale, and metric.

**Preconditions:** Dependencies are satisfied; Editors generate/edit; content approver confirms.

**Main workflow:** User selects lead-generation objective and approves a four-week draft strategy.

**Alternative workflows:** Choose research or conversion objective; edit cadence; save unapproved draft.

**Failure states:** No audience/offer, unsupported claims, policy-prohibited channel, stale brief.

**Acceptance criteria:** Strategy specifies objective, segment, journey stage, messages, proof, pillars, formats, channel, cadence, CTA, reuse rules, primary/guardrail metrics, risks, evidence, confidence, and exclusions; it references a confirmed strategy version; unavailable channels are marked simulated/blocked.

**Permissions:** Editors generate/edit; content approver confirms.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Strategy/profile, evidence, past content outcomes, channel capabilities, brand/policy.

**Data produced:** Tenant-scoped durable records for generate a measurable content strategy, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Strategy canvas with outcome chain and evidence drawer.

**Backend work:** Versioned content-strategy resource and validation.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Content strategist agent; novelty and evidence-grounding rubric.

**Workflow/job work:** Revalidate on strategy/policy change.

**Connector work:** None; do not manufacture a connector dependency.

**Security considerations:** No inferred sensitive targeting; brand/claim policy enforced.

**Analytics events:** `content_strategy_generated/edited/approved`, objective selected.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Every pillar traces to metric/evidence; stale strategy blocks approval.

**Definition of done:** Every pillar traces to metric/evidence; stale strategy blocks approval.

**Dependencies:** DOS-017, DOS-059.

**Risks:** Primary failure and trust risks: No audience/offer, unsupported claims, policy-prohibited channel, stale brief. Security risks: No inferred sensitive targeting; brand/claim policy enforced.

**Estimated complexity:** M

**Release wave:** Wave 2

---

## DOS-026 — Generate and prioritize content ideas

**ID:** DOS-026

**Epic:** Content OS

**Feature:** Generate and prioritize content ideas

**Priority:** P1

**Persona:** Solo builder

**User story:** As a solo builder, I want a small ranked set of content ideas, so that I can create the most commercially useful asset first.

**User problem:** Large generic idea lists overwhelm users and repeat themes.

**Business outcome:** User selects one of ≤10 evidence-backed ideas in under 5 minutes.

**Preconditions:** Dependencies are satisfied; Members view; editors generate/convert.

**Main workflow:** User filters by low effort and converts an idea to draft.

**Alternative workflows:** Refresh from new evidence; request variants; dismiss/snooze.

**Failure states:** Evidence too weak, ideas duplicate, channel unavailable, generation quota exceeded.

**Acceptance criteria:** Each idea includes audience insight, hook, promise, proof/evidence, format, channel, CTA, expected funnel effect, effort, risk, confidence, and experiment link; duplicates cluster; forbidden claims and used topics are flagged; dismissal is remembered.

**Permissions:** Members view; editors generate/convert.

**Approval requirements:** None for read-only analysis; any derived external side effect is a separate approval-gated action.

**Data required:** Content strategy, performance history, dismissals, evidence, brand rules.

**Data produced:** Tenant-scoped durable records for generate and prioritize content ideas, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Ranked cards, filters, evidence preview, empty state.

**Backend work:** Idea generation/ranking and state endpoints.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Candidate generation and semantic dedupe; deterministic eligibility.

**Workflow/job work:** Async generation with cache by source versions.

**Connector work:** None; do not manufacture a connector dependency.

**Security considerations:** Prevent source text injection and prohibited targeting.

**Analytics events:** `content_ideas_generated/viewed/selected/dismissed`.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Relevance/deduplication eval passes; no unsupported idea reaches draft unlabeled.

**Definition of done:** Relevance/deduplication eval passes; no unsupported idea reaches draft unlabeled.

**Dependencies:** DOS-025, DOS-077.

**Risks:** Primary failure and trust risks: Evidence too weak, ideas duplicate, channel unavailable, generation quota exceeded. Security risks: Prevent source text injection and prohibited targeting.

**Estimated complexity:** M

**Release wave:** Wave 2

---

## DOS-027 — Create channel-specific content and variants

**ID:** DOS-027

**Epic:** Content OS

**Feature:** Create channel-specific content and variants

**Priority:** P0

**Persona:** Content strategist

**User story:** As a content strategist, I want channel-native content variants, so that I can test messages without losing brand, evidence, or CTA consistency.

**User problem:** Generic repurposing ignores platform constraints and destroys experiment validity.

**Business outcome:** Drafts meet connector limits and expose exactly what differs between variants.

**Preconditions:** Dependencies are satisfied; Editors create/edit; approvers approve; viewers preview.

**Main workflow:** User creates two email subject variants with identical body/CTA.

**Alternative workflows:** Rewrite tone; duplicate asset; manually edit; choose supported fallback format.

**Failure states:** Length/format violation, missing CTA, stale claim, model timeout, connector capability absent.

**Acceptance criteria:** Draft stores hook/body/CTA/format/channel/character count/source idea/strategy/evidence; channel validator enforces limits; variants change one declared dimension where experiment requires; unsupported media is blocked; simulation preview is labeled; save does not approve.

**Permissions:** Editors create/edit; approvers approve; viewers preview.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Asset versions, variant relation/dimension, platform constraints, brand voice.

**Data produced:** Tenant-scoped durable records for create channel-specific content and variants, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Editor, platform preview, diff, autosave/conflict states.

**Backend work:** Content CRUD/duplicate/version endpoints and capability validator.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Structured generation with constraint and brand checks.

**Workflow/job work:** Generate asynchronously; mark stale on source change.

**Connector work:** Capability-aware adapter work for connector; verify scopes, health, rate limits, idempotency, receipts, revoke/reconnect, and simulation boundaries before claiming support.

**Security considerations:** Sanitize rendered HTML/links; no secret or PII leakage.

**Analytics events:** `content_draft_created/edited/duplicated`, `variant_created`.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Platform fixture and variant-isolation tests pass; approved snapshot is immutable.

**Definition of done:** Platform fixture and variant-isolation tests pass; approved snapshot is immutable.

**Dependencies:** DOS-026.

**Risks:** Primary failure and trust risks: Length/format violation, missing CTA, stale claim, model timeout, connector capability absent. Security risks: Sanitize rendered HTML/links; no secret or PII leakage.

**Estimated complexity:** L

**Release wave:** Wave 1

---

## DOS-028 — Review quality and unsupported claims before approval

**ID:** DOS-028

**Epic:** Content OS

**Feature:** Review quality and unsupported claims before approval

**Priority:** P0

**Persona:** Marketing manager

**User story:** As a marketing manager, I want claim and quality checks before publishing, so that the company avoids deceptive or off-brand content.

**User problem:** Fluent AI copy can contain unsupported, risky, or prohibited claims.

**Business outcome:** 100% of public/outbound assets pass deterministic policy and claim review before approval.

**Preconditions:** Dependencies are satisfied; Editors remediate; approvers approve; only owner/compliance role may permitted-override.

**Main workflow:** User replaces unsupported “guaranteed” claim with sourced language and review passes.

**Alternative workflows:** Attach evidence; request legal/owner review; archive asset.

**Failure states:** Checker unavailable, evidence stale, unsafe link, conflicting policy, override forbidden.

**Acceptance criteria:** Review reports claim text, type, evidence support, confidence, severity, policy match, accessibility/readability, brand issues, links, and remediation; critical unsupported/forbidden claims block approval; override needs authorized reason where policy allows; any edit invalidates review and approval.

**Permissions:** Editors remediate; approvers approve; only owner/compliance role may permitted-override.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Asset version/hash, claim spans, evidence, brand/forbidden policies, review version.

**Data produced:** Tenant-scoped durable records for review quality and unsupported claims before approval, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Inline annotations, severity summary, resolve/attach-source actions.

**Backend work:** Deterministic rules + model-assisted review endpoint and approval gate.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Extract/classify claims; never adjudicate permission.

**Workflow/job work:** Review job, re-run on edit, policy version pinning.

**Connector work:** None; do not manufacture a connector dependency.

**Security considerations:** Link scanning, output escaping, regulated/protected-class rules.

**Analytics events:** `content_review_started/passed/failed`, `claim_resolved/overridden`.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Adversarial claims fixture yields zero critical false negatives at acceptance threshold.

**Definition of done:** Adversarial claims fixture yields zero critical false negatives at acceptance threshold.

**Dependencies:** DOS-027, DOS-065, DOS-067.

**Risks:** Primary failure and trust risks: Checker unavailable, evidence stale, unsafe link, conflicting policy, override forbidden. Security risks: Link scanning, output escaping, regulated/protected-class rules.

**Estimated complexity:** L

**Release wave:** Wave 1

---

## DOS-029 — Track content performance to business outcomes

**ID:** DOS-029

**Epic:** Content OS

**Feature:** Track content performance to business outcomes

**Priority:** P1

**Persona:** Content strategist

**User story:** As a content strategist, I want content performance linked to leads and revenue, so that future creative decisions use commercial evidence.

**User problem:** Reach and likes encourage activity that may not convert.

**Business outcome:** Each published asset shows reach-to-revenue funnel, cost, freshness, and attribution confidence where data exists.

**Preconditions:** Dependencies are satisfied; Content viewers see aggregate; lead/revenue detail needs respective scopes.

**Main workflow:** User sees lower reach variant produce higher qualified-lead rate.

**Alternative workflows:** Manual offline outcome with declared source; incomplete connector data.

**Failure states:** Metric mismatch, delayed webhook, duplicate event, timezone/currency conflict.

**Acceptance criteria:** Separate provider-reported reach/engagement/clicks, first-party visits/leads, replies/meetings, conversions/payments/refunds; show denominators and unavailable data; compare variants only over compatible windows/audiences; annotate external changes; learning uses verified events.

**Permissions:** Content viewers see aggregate; lead/revenue detail needs respective scopes.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Asset/action/touchpoint/campaign/lead/payment links, costs, metric definitions.

**Data produced:** Tenant-scoped durable records for track content performance to business outcomes, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Outcome-first performance view with accessible data table.

**Backend work:** Content funnel query and metric normalization.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Explain patterns with limitations, not causal certainty.

**Workflow/job work:** Provider sync, late-event recomputation.

**Connector work:** Capability-aware adapter work for provider, connector, Provider; verify scopes, health, rate limits, idempotency, receipts, revoke/reconnect, and simulation boundaries before claiming support.

**Security considerations:** Aggregate privacy thresholds; tenant-scoped event joins.

**Analytics events:** `content_performance_viewed`, `metric_drilldown`, `learning_created_from_content`.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Known event fixture reconciles exact funnel and never double-counts.

**Definition of done:** Known event fixture reconciles exact funnel and never double-counts.

**Dependencies:** DOS-033, DOS-051, DOS-054.

**Risks:** Primary failure and trust risks: Metric mismatch, delayed webhook, duplicate event, timezone/currency conflict. Security risks: Aggregate privacy thresholds; tenant-scoped event joins.

**Estimated complexity:** L

**Release wave:** Wave 2

---

## DOS-030 — Connect the first real distribution channel

**ID:** DOS-030

**Epic:** Distribution channels

**Feature:** Connect the first real distribution channel

**Priority:** P0

**Persona:** Workspace owner

**User story:** As a workspace owner, I want to connect one genuinely supported distribution channel, so that approved content can be executed and proven.

**User problem:** A catalog entry without a working adapter creates false trust.

**Business outcome:** The initial Resend connection passes domain, capability, send, signed-event, revoke, and compliance tests; later channel adapters must pass equivalent provider-specific gates.

**Preconditions:** Dependencies are satisfied; Owner/admin installs; operators use granted capabilities; viewers see status only.

**Main workflow:** Owner authorizes a verified sending domain and sees tested small-campaign send and signed-event capabilities.

**Alternative workflows:** Sandbox/test recipient; simulation; reconnect or rotate credential; later choose another provider that passed the gate.

**Failure states:** Invalid/revoked key, unverified domain, missing capability, provider outage, consent/policy incompatibility.

**Acceptance criteria:** MVP provider is Resend for a workspace-owned, consented audience; API key/domain authorization uses least privilege and encrypted secret reference; installation is `connected` only after domain and capability test; account/domain and terms constraints shown; simulation distinct; unsupported capabilities blocked; support claim gated by conformance suite. Any replacement/additional social provider requires a written API/terms feasibility gate before backlog commitment.

**Permissions:** Owner/admin installs; operators use granted capabilities; viewers see status only.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Installation, provider account, scopes, capabilities/version, token ref, consent, health.

**Data produced:** Tenant-scoped durable records for connect the first real distribution channel, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Permission/domain review, account confirmation, test/status states.

**Backend work:** Resend credential/domain connect, rotate/revoke, and adapter contract; OAuth contract remains required for later OAuth providers.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** None controls auth; agents query capability registry only.

**Workflow/job work:** Credential/domain health and periodic capability probe; OAuth refresh applies to later providers.

**Connector work:** Capability-aware adapter work for Resend, provider, connector; verify scopes, health, rate limits, idempotency, receipts, revoke/reconnect, and simulation boundaries before claiming support.

**Security considerations:** Encrypted secret vault, domain ownership, signed events, no key in client/model/log; OAuth providers additionally require CSRF/PKCE and callback allowlist.

**Analytics events:** `connector_connect_started/completed/failed`, `capability_tested`.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Resend sandbox/test-recipient conformance, signed events, revoke/rotation, security, consent, and receipt E2E pass; docs state exact limits.

**Definition of done:** Resend sandbox/test-recipient conformance, signed events, revoke/rotation, security, consent, and receipt E2E pass; docs state exact limits.

**Dependencies:** DOS-059, DOS-073.

**Risks:** Primary failure and trust risks: Invalid/revoked key, unverified domain, missing capability, provider outage, consent/policy incompatibility. Security risks: Encrypted secret vault, domain ownership, signed events, no key in client/model/log; OAuth providers additionally require CSRF/PKCE and callback allowlist.

**Estimated complexity:** XL (split by discovery/OAuth/adapter/webhook/UI)

**Release wave:** Wave 1

---

## DOS-031 — Validate connector scopes and capabilities

**ID:** DOS-031

**Epic:** Distribution channels

**Feature:** Validate connector scopes and capabilities

**Priority:** P0

**Persona:** Growth operator

**User story:** As a growth operator, I want the system to validate capabilities before planning, so that it never promises an action the account cannot perform.

**User problem:** Provider/account/plan differences make connector names unreliable.

**Business outcome:** Every executable plan references a fresh successful capability probe.

**Preconditions:** Dependencies are satisfied; All members view safe capabilities; admins reauthorize; only system sets tested status.

**Main workflow:** Scheduler confirms publish+delete unsupported and omits delete workflow.

**Alternative workflows:** Degraded read-only mode; simulate unsupported write.

**Failure states:** Scope revoked, provider schema changed, probe throttled, account restricted.

**Acceptance criteria:** Capability contract defines action, input schema, scopes, account limits, simulation, webhook/poll support, rate limit, compliance notes, tested-at/version; readiness blocks missing/stale capability; UI distinguishes catalog, installed, healthy, degraded, unavailable.

**Permissions:** All members view safe capabilities; admins reauthorize; only system sets tested status.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Capability manifests/probe results/scopes/provider versions/errors.

**Data produced:** Tenant-scoped durable records for validate connector scopes and capabilities, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Capability matrix and remediation links.

**Backend work:** `GET /api/v1/connectors/{id}/capabilities`; signed/versioned adapter manifest.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Tool availability generated from authorized manifest.

**Workflow/job work:** Scheduled/just-in-time probes with backoff.

**Connector work:** Capability-aware adapter work for connector, Provider, provider; verify scopes, health, rate limits, idempotency, receipts, revoke/reconnect, and simulation boundaries before claiming support.

**Security considerations:** Server verifies provider response; least privilege; no client status promotion.

**Analytics events:** `capability_check_run/failed`, `action_blocked_missing_capability`.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Revoked scope blocks queued action before external call; contract tests pass.

**Definition of done:** Revoked scope blocks queued action before external call; contract tests pass.

**Dependencies:** DOS-030.

**Risks:** Primary failure and trust risks: Scope revoked, provider schema changed, probe throttled, account restricted. Security risks: Server verifies provider response; least privilege; no client status promotion.

**Estimated complexity:** M

**Release wave:** Wave 1

---

## DOS-032 — Schedule and publish an approved asset

**ID:** DOS-032

**Epic:** Distribution channels

**Feature:** Schedule and publish an approved asset

**Priority:** P0

**Persona:** Marketing manager

**User story:** As a marketing manager, I want to schedule and publish the exact approved asset, so that execution is timely and governed.

**User problem:** Copy/payload drift between review and publishing creates brand and compliance risk.

**Business outcome:** Approved actions publish once within the schedule SLO and store provider evidence.

**Preconditions:** Dependencies are satisfied; Editor schedules draft; approver approves; operator cancels/retries per role.

**Main workflow:** Approved post queues, runs, receives provider ID, and later metrics.

**Alternative workflows:** Publish now; cancel before claim; reschedule and reapprove; simulate.

**Failure states:** Expired approval/token, quiet hours, quota/rate limit, provider rejection/timeout, ambiguous response.

**Acceptance criteria:** Schedule uses workspace timezone and future window; action snapshot includes payload hash, connector/account, cost ceiling, approver, expiry; worker rechecks hash/policy/capability/budget/token at execution; provider request uses idempotency when supported; `succeeded` requires receipt; edit/schedule/account change invalidates approval.

**Permissions:** Editor schedules draft; approver approves; operator cancels/retries per role.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Immutable payload, approval, schedule/timezone, attempt, provider receipt.

**Data produced:** Tenant-scoped durable records for schedule and publish an approved asset, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Exact preview, timezone, approval diff, status timeline.

**Backend work:** Schedule/execute commands with CAS and idempotency.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** No mutation after approval; agent may propose schedule.

**Workflow/job work:** Durable timer, lease, preflight, submit, reconcile.

**Connector work:** Capability-aware adapter work for provider, connector; verify scopes, health, rate limits, idempotency, receipts, revoke/reconnect, and simulation boundaries before claiming support.

**Security considerations:** Server-side policy; safe URLs; secret isolation; audit exact hash.

**Analytics events:** `publish_scheduled/started/provider_accepted/succeeded/cancelled`.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Clock/DST/crash/duplicate/changed-payload/provider-timeout tests pass.

**Definition of done:** Clock/DST/crash/duplicate/changed-payload/provider-timeout tests pass.

**Dependencies:** DOS-028, DOS-030, DOS-065, DOS-070.

**Risks:** Primary failure and trust risks: Expired approval/token, quiet hours, quota/rate limit, provider rejection/timeout, ambiguous response. Security risks: Server-side policy; safe URLs; secret isolation; audit exact hash.

**Estimated complexity:** L

**Release wave:** Wave 1

---

## DOS-033 — Recover failed publishing without duplicates

**ID:** DOS-033

**Epic:** Distribution channels

**Feature:** Recover failed publishing without duplicates

**Priority:** P0

**Persona:** Growth operator

**User story:** As a growth operator, I want safe failure recovery, so that retries do not duplicate public actions or hide ambiguous outcomes.

**User problem:** Naive retries create duplicate posts/messages and reputational harm.

**Business outcome:** Duplicate external effects are zero in conformance/chaos tests; ambiguous attempts are reconciled before retry.

**Preconditions:** Dependencies are satisfied; Operators retry definitive-safe; admins resolve ambiguous; content mutation requires reapproval.

**Main workflow:** Provider 429 retries once later and succeeds with same key.

**Alternative workflows:** Reconnect then resume; operator confirms external occurrence; clone as new action.

**Failure states:** Retry exhausted, lookup unavailable, provider lacks idempotency, dead-letter, receipt mismatch.

**Acceptance criteria:** Errors classify retryable/definitive/ambiguous/reconnect/human/policy; stable idempotency key per business action; attempt records precede call; exponential backoff honors `Retry-After`; circuit breaker protects provider; lookup/poll resolves ambiguity where possible; manual resolution is audited; real and simulated timelines never merge.

**Permissions:** Operators retry definitive-safe; admins resolve ambiguous; content mutation requires reapproval.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Attempts, error class, keys, receipts, provider lookups, decisions.

**Data produced:** Tenant-scoped durable records for recover failed publishing without duplicates, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Failure explanation, attempts, safe available actions.

**Backend work:** Error taxonomy, reconciliation and dead-letter commands.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** May summarize; deterministic code selects retry.

**Workflow/job work:** Backoff/jitter/circuit breaker/reconciliation/dead-letter queue.

**Connector work:** Capability-aware adapter work for provider, Provider; verify scopes, health, rate limits, idempotency, receipts, revoke/reconnect, and simulation boundaries before claiming support.

**Security considerations:** No sensitive raw errors; audit manual outcome; abuse rate limits.

**Analytics events:** `publish_failed/retried/reconciled`, `duplicate_prevented`, ambiguity duration.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Fault-injection matrix proves state truth and at-most-once effect where provider supports it.

**Definition of done:** Fault-injection matrix proves state truth and at-most-once effect where provider supports it.

**Dependencies:** DOS-032, DOS-070.

**Risks:** Primary failure and trust risks: Retry exhausted, lookup unavailable, provider lacks idempotency, dead-letter, receipt mismatch. Security risks: No sensitive raw errors; audit manual outcome; abuse rate limits.

**Estimated complexity:** L

**Release wave:** Wave 1

---

## DOS-034 — Create a campaign around a commercial objective

**ID:** DOS-034

**Epic:** Campaigns

**Feature:** Create a campaign around a commercial objective

**Priority:** P1

**Persona:** Marketing manager

**User story:** As a marketing manager, I want to create a campaign with a measurable objective, so that coordinated actions share ownership and outcome.

**User problem:** Disconnected assets and tasks cannot be governed or evaluated together.

**Business outcome:** Campaign creation yields a coherent draft plan, not immediate execution.

**Preconditions:** Dependencies are satisfied; Campaign editor creates; owner manages; approver authorizes spend/actions.

**Main workflow:** Manager converts opportunity into a campaign and assigns owners.

**Alternative workflows:** Start blank; clone prior campaign without approvals/results; save incomplete draft.

**Failure states:** Invalid dates/budget, stale strategy, duplicate name allowed but warned, inaccessible audience.

**Acceptance criteria:** Require name, objective, funnel stage, audience, offer/CTA, owner, dates, primary metric/denominator/target, budget/currency, channels, attribution window, risks, approval policy, and linked strategy/opportunity; status begins `draft`; unsupported channels are blocked/simulated.

**Permissions:** Campaign editor creates; owner manages; approver authorizes spend/actions.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Campaign/version, members, objectives, linked artifacts, policy snapshot.

**Data produced:** Tenant-scoped durable records for create a campaign around a commercial objective, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Progressive wizard, readiness panel, clear draft badge.

**Backend work:** Campaign CRUD/version/readiness contracts.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Suggest bounded plan fields with citations.

**Workflow/job work:** None until submitted; projection for Mission Control.

**Connector work:** None; do not manufacture a connector dependency.

**Security considerations:** Tenant/member validation; no audience PII in analytics.

**Analytics events:** `campaign_created/edited/readiness_checked`.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Schema/permission/version/readiness tests and create E2E pass.

**Definition of done:** Schema/permission/version/readiness tests and create E2E pass.

**Dependencies:** DOS-017, DOS-023.

**Risks:** Primary failure and trust risks: Invalid dates/budget, stale strategy, duplicate name allowed but warned, inaccessible audience. Security risks: Tenant/member validation; no audience PII in analytics.

**Estimated complexity:** M

**Release wave:** Wave 2

---

## DOS-035 — Define audience, budget, timeline, and measurement plan

**ID:** DOS-035

**Epic:** Campaigns

**Feature:** Define audience, budget, timeline, and measurement plan

**Priority:** P0

**Persona:** Growth operator

**User story:** As a growth operator, I want campaign constraints and measurement defined before launch, so that success and safety are decidable.

**User problem:** Campaigns launch with vague audiences, vanity metrics, and no stop condition.

**Business outcome:** 100% of launched campaigns have valid instrumentation, cost ceiling, target, and kill rule.

**Preconditions:** Dependencies are satisfied; Operators configure; finance/owner approves threshold spend; compliance approves restricted audiences.

**Main workflow:** Operator tests CTA event, estimates sample, and submits plan.

**Alternative workflows:** Manual outcome source with lower confidence; zero-spend organic campaign.

**Failure states:** Audience empty/prohibited, denominator missing, budget conflict, event not observed, dates too short.

**Acceptance criteria:** Audience references graph segment and exclusion/suppression sets; budget has total/daily/action limits; timeline includes timezone; primary metric has exact event/denominator/baseline/target/window; guardrails and kill rule are executable; tracking test must pass or campaign remains blocked.

**Permissions:** Operators configure; finance/owner approves threshold spend; compliance approves restricted audiences.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Segment snapshot, suppression list, budget, metric definitions, tracking test.

**Data produced:** Tenant-scoped durable records for define audience, budget, timeline, and measurement plan, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Constraint editor, budget summary, instrumentation test and blockers.

**Backend work:** Readiness validator, budget reservation, event test endpoint.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Recommend values and sample caveats; cannot waive controls.

**Workflow/job work:** Budget reservation expiry and tracking health checks.

**Connector work:** None; do not manufacture a connector dependency.

**Security considerations:** Consent/suppression enforcement, sensitive audience prohibition.

**Analytics events:** `campaign_constraints_completed`, `tracking_test_run`, `budget_reserved`.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Launch cannot pass missing/invalid constraints; boundary tests cover currency/timezone.

**Definition of done:** Launch cannot pass missing/invalid constraints; boundary tests cover currency/timezone.

**Dependencies:** DOS-034, DOS-051, DOS-065.

**Risks:** Primary failure and trust risks: Audience empty/prohibited, denominator missing, budget conflict, event not observed, dates too short. Security risks: Consent/suppression enforcement, sensitive audience prohibition.

**Estimated complexity:** L

**Release wave:** Wave 2

---

## DOS-036 — Approve and execute a campaign plan

**ID:** DOS-036

**Epic:** Campaigns

**Feature:** Approve and execute a campaign plan

**Priority:** P0

**Persona:** Executive

**User story:** As an executive, I want to approve a campaign and its bounded actions, so that the team can execute within explicit risk and spend limits.

**User problem:** Blanket campaign approval can hide later payload or cost changes.

**Business outcome:** Execution occurs only within the approved version and envelope.

**Preconditions:** Dependencies are satisfied; Policy-defined approver; creator self-approval can be forbidden; operators execute approved scope.

**Main workflow:** Owner approves plan and three scheduled actions queue.

**Alternative workflows:** Approve subset; reject; request changes; set lower cap; expire.

**Failure states:** Separation-of-duties violation, stale evidence, connector degraded, budget changed, approval expired.

**Acceptance criteria:** Review shows exact actions/assets/accounts/schedules, max spend, audiences/exclusions, evidence, risks, measurement, and policy; approval hashes plan plus action manifests; additions or material changes require delta/reapproval; low-risk auto-approval operates only within configured envelope; pause stops unclaimed jobs.

**Permissions:** Policy-defined approver; creator self-approval can be forbidden; operators execute approved scope.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Campaign/action versions, approval envelope, policy version, actor, expiry.

**Data produced:** Tenant-scoped durable records for approve and execute a campaign plan, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Approval summary, diff, subset selection, typed confirmation for high risk.

**Backend work:** Campaign approval/delta/pause commands and readiness gate.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Risk summary only; never records approval.

**Workflow/job work:** Fan-out approved actions; pause/cancel coordination.

**Connector work:** Capability-aware adapter work for connector; verify scopes, health, rate limits, idempotency, receipts, revoke/reconnect, and simulation boundaries before claiming support.

**Security considerations:** Exact hashes, CSRF protection, role/SoD/budget checks at execution.

**Analytics events:** `campaign_approval_requested/approved/rejected/paused`, approved spend.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Mutation and expired-policy tests block execution; subset fan-out is exact.

**Definition of done:** Mutation and expired-policy tests block execution; subset fan-out is exact.

**Dependencies:** DOS-032, DOS-035, DOS-065, DOS-066.

**Risks:** Primary failure and trust risks: Separation-of-duties violation, stale evidence, connector degraded, budget changed, approval expired. Security risks: Exact hashes, CSRF protection, role/SoD/budget checks at execution.

**Estimated complexity:** L

**Release wave:** Wave 2

---

## DOS-037 — Measure a campaign and expose data quality

**ID:** DOS-037

**Epic:** Campaigns

**Feature:** Measure a campaign and expose data quality

**Priority:** P1

**Persona:** Marketing manager

**User story:** As a marketing manager, I want campaign results with data-quality context, so that I can decide whether to continue, change, or stop.

**User problem:** Aggregated dashboards hide missing and incomparable data.

**Business outcome:** Campaign review produces a documented decision based on defined metric and costs.

**Preconditions:** Dependencies are satisfied; Viewers see aggregate; operator recommends; campaign owner decides.

**Main workflow:** Target missed after minimum sample; manager stops and records reason.

**Alternative workflows:** Extend timebox with approval; declare inconclusive; segment analysis.

**Failure states:** Tracking loss, provider lag, metric definition changed, sample contamination.

**Acceptance criteria:** Show actual vs baseline/target for primary and guardrail metrics; event counts include denominators/window/freshness/source; cost separates incurred/committed; status identifies insufficient data; late events revise versioned result; annotations explain pauses/changes; revenue attribution band visible.

**Permissions:** Viewers see aggregate; operator recommends; campaign owner decides.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Campaign version, normalized events, costs, attribution, annotations, decision.

**Data produced:** Tenant-scoped durable records for measure a campaign and expose data quality, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Outcome summary, funnel, data-quality banner, decision CTA.

**Backend work:** Campaign result query/snapshot and decision endpoint.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Explain variance with cited evidence and alternatives.

**Workflow/job work:** Scheduled aggregation and late-event recompute.

**Connector work:** Capability-aware adapter work for provider; verify scopes, health, rate limits, idempotency, receipts, revoke/reconnect, and simulation boundaries before claiming support.

**Security considerations:** Privacy thresholds; immutable historical metric definitions.

**Analytics events:** `campaign_results_viewed`, `campaign_decision_recorded`, data gaps.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Fixture reconciles source events/cost/revenue exactly; no-data is not zero.

**Definition of done:** Fixture reconciles source events/cost/revenue exactly; no-data is not zero.

**Dependencies:** DOS-035, DOS-036, DOS-051.

**Risks:** Primary failure and trust risks: Tracking loss, provider lag, metric definition changed, sample contamination. Security risks: Privacy thresholds; immutable historical metric definitions.

**Estimated complexity:** L

**Release wave:** Wave 2

---

## DOS-038 — Define a falsifiable experiment

**ID:** DOS-038

**Epic:** Experiments

**Feature:** Define a falsifiable experiment

**Priority:** P0

**Persona:** Growth operator

**User story:** As a growth operator, I want to define a falsifiable hypothesis and success rule, so that an action produces knowledge even when it fails.

**User problem:** Post-hoc interpretation turns every result into a success story.

**Business outcome:** Every started experiment has a precommitted decision rule.

**Preconditions:** Dependencies are satisfied; Editors draft; experiment owner starts; spend/action approvers authorize dependencies.

**Main workflow:** Operator validates event and starts approved A/B test.

**Alternative workflows:** Before/after or qualitative discovery design with explicit lower causal confidence.

**Failure states:** Non-falsifiable wording, missing denominator, overlapping variant, no tracking, approval absent.

**Acceptance criteria:** Require “If [change] for [audience], then [metric] moves from [baseline] to [target] by [date], because [mechanism]”; define denominator, sample expectation, variants/baseline, guardrails, budget, owner, instrumentation, kill rule, attribution window, and limitations; freeze snapshot at start.

**Permissions:** Editors draft; experiment owner starts; spend/action approvers authorize dependencies.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Hypothesis, design, metrics, assignments, version, approvals.

**Data produced:** Tenant-scoped durable records for define a falsifiable experiment, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Guided hypothesis builder and preflight checklist.

**Backend work:** Experiment schema/readiness/start commands.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Critique falsifiability and confounders; user retains decision.

**Workflow/job work:** Snapshot/freeze and assignment scheduling.

**Connector work:** None; do not manufacture a connector dependency.

**Security considerations:** Avoid sensitive experimentation; consent and exclusion policy.

**Analytics events:** `experiment_created/readiness_failed/started`.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Invalid design fixtures cannot start; started definition is immutable.

**Definition of done:** Invalid design fixtures cannot start; started definition is immutable.

**Dependencies:** DOS-023, DOS-035.

**Risks:** Primary failure and trust risks: Non-falsifiable wording, missing denominator, overlapping variant, no tracking, approval absent. Security risks: Avoid sensitive experimentation; consent and exclusion policy.

**Estimated complexity:** M

**Release wave:** Wave 2

---

## DOS-039 — Execute and safely compare experiment variants

**ID:** DOS-039

**Epic:** Experiments

**Feature:** Execute and safely compare experiment variants

**Priority:** P1

**Persona:** Growth operator

**User story:** As a growth operator, I want variant assignment and execution kept comparable, so that observed differences support a defensible decision.

**User problem:** Unequal audiences, time windows, or extra changes invalidate comparisons.

**Business outcome:** Variant exposure is deterministic, auditable, and contamination is visible.

**Preconditions:** Dependencies are satisfied; Operator manages run; approver authorizes variant payloads; analyst excludes with audit.

**Main workflow:** Eligible leads are deterministically split and each receives one approved variant.

**Alternative workflows:** Manual alternation is labeled quasi-experiment; pause all arms; exclude invalid events with reason.

**Failure states:** Assignment service unavailable, duplicate exposure, crossover, variant payload changed.

**Acceptance criteria:** Assignment unit/key/ratio recorded before exposure; one declared variable per simple test; actions retain variant ID; exposure event precedes outcome; sample-ratio mismatch, overlap, early peeking, and missing exposure alerts appear; users may stop by kill rule.

**Permissions:** Operator manages run; approver authorizes variant payloads; analyst excludes with audit.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Assignment/exposure/outcome, eligibility snapshot, variants, exclusions.

**Data produced:** Tenant-scoped durable records for execute and safely compare experiment variants, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Variant balance, contamination/data-quality alerts.

**Backend work:** Assignment service and comparison query.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** No assignment decisions; explain methodological limits.

**Workflow/job work:** Scheduled assignments and guardrail/kill monitoring.

**Connector work:** None; do not manufacture a connector dependency.

**Security considerations:** Stable pseudonymous IDs; consent; prevent discriminatory allocation.

**Analytics events:** `variant_assigned/exposed`, `experiment_contamination_detected`, `kill_rule_triggered`.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Determinism, ratio, duplicate, crossover, and crash tests pass.

**Definition of done:** Determinism, ratio, duplicate, crossover, and crash tests pass.

**Dependencies:** DOS-038, DOS-070.

**Risks:** Primary failure and trust risks: Assignment service unavailable, duplicate exposure, crossover, variant payload changed. Security risks: Stable pseudonymous IDs; consent; prevent discriminatory allocation.

**Estimated complexity:** L

**Release wave:** Wave 2

---

## DOS-040 — Declare a winner, failure, or inconclusive result and record learning

**ID:** DOS-040

**Epic:** Experiments

**Feature:** Declare a winner, failure, or inconclusive result and record learning

**Priority:** P1

**Persona:** Startup founder

**User story:** As a startup founder, I want an evidence-based experiment conclusion, so that strategy changes reflect what the test actually learned.

**User problem:** Teams overclaim small samples and forget failed tests.

**Business outcome:** Every ended experiment has one of `won`, `lost`, `inconclusive`, `invalidated`, with a reusable lesson and next decision.

**Preconditions:** Dependencies are satisfied; Analyst prepares; experiment owner declares; major strategy update requires approval.

**Main workflow:** Variant B exceeds target without guardrail harm; owner declares winner and proposes rollout.

**Alternative workflows:** Stop failure; extend with approval; invalidate contaminated run.

**Failure states:** Insufficient sample, missing denominator, metric drift, late refund reverses value.

**Acceptance criteria:** Result shows sample, effect/interval or qualitative evidence, primary/guardrail metrics, costs, revenue, data quality, confounders, decision rule comparison, confidence, and limitations; system recommends but owner declares; late data versions result; lesson states supported/refuted/unchanged belief and next test.

**Permissions:** Analyst prepares; experiment owner declares; major strategy update requires approval.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Frozen design, event snapshot, statistics, costs/payments/refunds, decision/lesson.

**Data produced:** Tenant-scoped durable records for declare a winner, failure, or inconclusive result and record learning, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Comparison, uncertainty visualization, declaration modal.

**Backend work:** Analysis snapshot, declaration, result version and lesson creation.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Narrative analysis cites computed values; never invents significance.

**Workflow/job work:** Recompute for late events/refunds and notify version change.

**Connector work:** Capability-aware adapter work for Gmail; verify scopes, health, rate limits, idempotency, receipts, revoke/reconnect, and simulation boundaries before claiming support.

**Security considerations:** Immutable raw outcomes; audit exclusions/declaration.

**Analytics events:** `experiment_result_viewed/declared/revised`, outcome class.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Statistical fixtures and no/late/invalid data cases produce correct status.

**Definition of done:** Statistical fixtures and no/late/invalid data cases produce correct status.

**Dependencies:** DOS-039, DOS-083.

**Risks:** Primary failure and trust risks: Insufficient sample, missing denominator, metric drift, late refund reverses value. Security risks: Immutable raw outcomes; audit exclusions/declaration.

**Estimated complexity:** L

**Release wave:** Wave 2

---

## DOS-041 — Capture and deduplicate a lead lawfully

**ID:** DOS-041

**Epic:** Leads and CRM

**Feature:** Capture and deduplicate a lead lawfully

**Priority:** P0

**Persona:** Sales operator

**User story:** As a sales operator, I want leads captured with source and consent context, so that I can follow up quickly without creating duplicates or spam risk.

**User problem:** Anonymous or duplicated leads lose attribution and create repeated contact.

**Business outcome:** ≥99% of lead submissions create/update one tenant contact and preserve acquisition source.

**Preconditions:** Dependencies are satisfied; Public endpoint creates bounded record; operators view; import requires permission.

**Main workflow:** CTA form creates lead and attributable touchpoint, then notifies owner.

**Alternative workflows:** Manual/CSV/API capture; partial anonymous event later linked with consent.

**Failure states:** Invalid/disposable email policy, duplicate ambiguity, missing consent for channel, bot abuse.

**Acceptance criteria:** Capture validates fields; records first/last source, UTM/click/campaign/action, consent/legal basis, privacy version, timestamps; normalizes email within tenant; deterministic match proposes merge without cross-tenant lookup; suppressed/unsubscribed status survives re-import; bot/rate checks apply.

**Permissions:** Public endpoint creates bounded record; operators view; import requires permission.

**Approval requirements:** None for read-only analysis; any derived external side effect is a separate approval-gated action.

**Data required:** Contact, identity keys, source/touchpoints, consent, suppression, form version.

**Data produced:** Tenant-scoped durable records for capture and deduplicate a lead lawfully, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Embeddable/native form, consent, truthful success/error; lead list empty state.

**Backend work:** Capture endpoint, dedupe/merge candidates, idempotency.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Optional qualification after capture; no consent inference.

**Workflow/job work:** Enrichment/notification queued after commit.

**Connector work:** None; do not manufacture a connector dependency.

**Security considerations:** Encryption/PII minimization, abuse prevention, injection, retention.

**Analytics events:** `lead_form_viewed/submitted/rejected`, `lead_created/deduplicated`.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Replay/concurrency/suppression/tenant/security tests pass.

**Definition of done:** Replay/concurrency/suppression/tenant/security tests pass.

**Dependencies:** DOS-051, DOS-061.

**Risks:** Primary failure and trust risks: Invalid/disposable email policy, duplicate ambiguity, missing consent for channel, bot abuse. Security risks: Encryption/PII minimization, abuse prevention, injection, retention.

**Estimated complexity:** L

**Release wave:** Wave 1

---

## DOS-042 — View, assign, and advance a lead lifecycle

**ID:** DOS-042

**Epic:** Leads and CRM

**Feature:** View, assign, and advance a lead lifecycle

**Priority:** P0

**Persona:** Sales operator

**User story:** As a sales operator, I want an attributable lead profile and clear lifecycle, so that the right person takes the right next action.

**User problem:** Leads decay when ownership, context, and stage are unclear.

**Business outcome:** New qualified leads are assigned within target SLA and every stage change is attributable.

**Preconditions:** Dependencies are satisfied; Sales roles view/update assigned or all per policy; viewers see aggregates only.

**Main workflow:** Operator claims qualified lead, records conversation, advances to meeting.

**Alternative workflows:** Reassign; reject with reason; merge duplicate; mark converted offline with declared evidence.

**Failure states:** Concurrent assignment, invalid transition, deleted user, restricted PII, merge conflict.

**Acceptance criteria:** Profile shows identity, company/role, source, evidence, consent/suppression, score rationale, owner, status, touchpoints, conversations, tasks, payments; lifecycle transitions are validated; assignment records actor/time; stale lead flag uses workspace SLA; conversion requires customer/payment or declared reason.

**Permissions:** Sales roles view/update assigned or all per policy; viewers see aggregates only.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Contact/customer, owner, statuses, events, tasks, touchpoints, evidence.

**Data produced:** Tenant-scoped durable records for view, assign, and advance a lead lifecycle, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Queue and responsive master-detail timeline, bulk actions limited.

**Backend work:** Lead query/update/assign/merge with ETags and state machine.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Summarize timeline using authorized fields.

**Workflow/job work:** SLA timers/escalations and read-model updates.

**Connector work:** None; do not manufacture a connector dependency.

**Security considerations:** Field-level PII access, export audit, tenant dedupe only.

**Analytics events:** `lead_viewed/assigned/status_changed/merged`, assignment latency.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Lifecycle/concurrency/PII/merge and mobile accessibility tests pass.

**Definition of done:** Lifecycle/concurrency/PII/merge and mobile accessibility tests pass.

**Dependencies:** DOS-041, DOS-061.

**Risks:** Primary failure and trust risks: Concurrent assignment, invalid transition, deleted user, restricted PII, merge conflict. Security risks: Field-level PII access, export audit, tenant dedupe only.

**Estimated complexity:** L

**Release wave:** Wave 1

---

## DOS-043 — Detect and explain lead intent

**ID:** DOS-043

**Epic:** Leads and CRM

**Feature:** Detect and explain lead intent

**Priority:** P1

**Persona:** Sales operator

**User story:** As a sales operator, I want lead intent summarized from permitted behavior, so that I prioritize timely, relevant follow-up.

**User problem:** Operators cannot manually interpret every interaction before intent decays.

**Business outcome:** High-intent leads are reviewed faster without opaque profiling.

**Preconditions:** Dependencies are satisfied; Authorized sales users; score components respect event/PII permissions.

**Main workflow:** Pricing visit plus demo request creates high-intent alert with evidence.

**Alternative workflows:** Low data returns unknown; user overrides with reason; account-level rollup.

**Failure states:** Tracking missing, identity merge uncertain, stale signals, model unavailable.

**Acceptance criteria:** Intent score uses permitted explicit events (form, reply, pricing visit, meeting, purchase) with versioned weights, freshness decay, evidence list, confidence, and exclusions; sensitive traits and unconsented cross-site data forbidden; score cannot send automatically; user can correct label.

**Permissions:** Authorized sales users; score components respect event/PII permissions.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Consented events, lead lifecycle, timestamps, score version, correction.

**Data produced:** Tenant-scoped durable records for detect and explain lead intent, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Intent label, evidence timeline, correction and freshness.

**Backend work:** Deterministic scoring service and explanation endpoint.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Summarize signals; deterministic service owns score.

**Workflow/job work:** Event-driven recompute and decay schedule.

**Connector work:** None; do not manufacture a connector dependency.

**Security considerations:** Profiling transparency, data minimization, protected-trait exclusion.

**Analytics events:** `intent_score_changed/viewed/corrected`, lead response latency.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Fixed fixtures reproduce score; fairness/privacy review and correction tests pass.

**Definition of done:** Fixed fixtures reproduce score; fairness/privacy review and correction tests pass.

**Dependencies:** DOS-041, DOS-051.

**Risks:** Primary failure and trust risks: Tracking missing, identity merge uncertain, stale signals, model unavailable. Security risks: Profiling transparency, data minimization, protected-trait exclusion.

**Estimated complexity:** M

**Release wave:** Wave 2

---

## DOS-044 — Connect Gmail with least privilege

**ID:** DOS-044

**Epic:** Gmail workflows

**Feature:** Connect Gmail with least privilege

**Priority:** P0

**Persona:** Workspace owner

**User story:** As a workspace owner, I want to connect Gmail with clear scopes and account identity, so that approved one-to-one follow-up can be sent and correlated safely.

**User problem:** Email execution requires sensitive access and provider trust.

**Business outcome:** Connection can send/read only the golden-path capabilities explicitly consented to and can be revoked.

**Preconditions:** Dependencies are satisfied; Owner/admin connects; email operator uses capability; no member sees tokens.

**Main workflow:** Owner grants scopes and test verifies draft/send plus reply-watch capability.

**Alternative workflows:** Send-only connection limits reply tracking; simulation; reconnect another account.

**Failure states:** Consent denied, scope unavailable, unverified app restriction, admin policy, token revoked.

**Acceptance criteria:** OAuth state+PKCE; exact Google account confirmed; incremental least-privilege scopes; encrypted refresh token reference; domain/account policy checked; send and history/watch capabilities probed; connection health/expiry/revoke visible; production verification requirements documented; no batch scope implied.

**Permissions:** Owner/admin connects; email operator uses capability; no member sees tokens.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Installation, account identity, scopes, token ref/expiry, consent, watch state.

**Data produced:** Tenant-scoped durable records for connect gmail with least privilege, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Scope rationale, account confirmation, verification/reconnect states.

**Backend work:** Google OAuth/callback/refresh/revoke and Gmail adapter.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** None in authentication.

**Workflow/job work:** Refresh, watch renewal, capability health.

**Connector work:** Capability-aware adapter work for Gmail, provider, gmail; verify scopes, health, rate limits, idempotency, receipts, revoke/reconnect, and simulation boundaries before claiming support.

**Security considerations:** Vault/KMS, OAuth CSRF, secret redaction, Google data policy/retention.

**Analytics events:** `gmail_connect_started/completed/failed/revoked`, scopes granted.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Google test account send/watch/revoke conformance and security review pass.

**Definition of done:** Google test account send/watch/revoke conformance and security review pass.

**Dependencies:** DOS-059, DOS-073.

**Risks:** Primary failure and trust risks: Consent denied, scope unavailable, unverified app restriction, admin policy, token revoked. Security risks: Vault/KMS, OAuth CSRF, secret redaction, Google data policy/retention.

**Estimated complexity:** XL (split OAuth/send/watch/revoke/UI)

**Release wave:** Wave 1

---

## DOS-045 — Draft, approve, and send a personalized Gmail follow-up

**ID:** DOS-045

**Epic:** Gmail workflows

**Feature:** Draft, approve, and send a personalized Gmail follow-up

**Priority:** P0

**Persona:** Sales operator

**User story:** As a sales operator, I want a relevant follow-up drafted and sent only after approval, so that I respond quickly without surrendering judgment.

**User problem:** Slow follow-up loses demand; automatic generic outreach creates spam and brand risk.

**Business outcome:** Median qualified-lead response time falls below configured SLA while complaint/approval violations remain zero.

**Preconditions:** Dependencies are satisfied; Sales editor drafts; email approver approves; authorized operator sends.

**Main workflow:** Operator edits suggested draft, requests approval, approver accepts, one email sends.

**Alternative workflows:** Save draft in Gmail only; schedule; reject/request changes; simulate.

**Failure states:** Unsubscribed, duplicate recipient window, expired approval/token, provider timeout/ambiguity, thread missing.

**Acceptance criteria:** Draft cites lead intent/context and excludes unsupported personalization; exact to/from/subject/body/thread/CTA are previewed; consent/suppression/quiet hours/frequency/policy/connector/budget checks pass; approval hash expires; send creates attempt before call and requires Gmail message/thread receipt; no BCC/mass send in MVP.

**Permissions:** Sales editor drafts; email approver approves; authorized operator sends.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Lead/consent, thread context, approved payload/hash, policies, attempt/receipt.

**Data produced:** Tenant-scoped durable records for draft, approve, and send a personalized gmail follow-up, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Composer, context/evidence rail, exact approval diff/status timeline.

**Backend work:** Draft/preflight/approval/execute contracts and Gmail adapter.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Draft with tone/claim/privacy guardrails; never sends.

**Workflow/job work:** Scheduled send, idempotency, reconcile ambiguous result.

**Connector work:** Capability-aware adapter work for Gmail, connector, provider; verify scopes, health, rate limits, idempotency, receipts, revoke/reconnect, and simulation boundaries before claiming support.

**Security considerations:** Prompt injection in inbound email, PII, header injection, spam rules.

**Analytics events:** `followup_drafted/edited/approval_requested/sent/delivered`, response time.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Consent/duplicate/mutation/timeout/thread and provider E2Es pass.

**Definition of done:** Consent/duplicate/mutation/timeout/thread and provider E2Es pass.

**Dependencies:** DOS-028, DOS-041, DOS-044, DOS-065, DOS-070.

**Risks:** Primary failure and trust risks: Unsubscribed, duplicate recipient window, expired approval/token, provider timeout/ambiguity, thread missing. Security risks: Prompt injection in inbound email, PII, header injection, spam rules.

**Estimated complexity:** L

**Release wave:** Wave 1

---

## DOS-046 — Correlate replies and enforce unsubscribe/suppression

**ID:** DOS-046

**Epic:** Gmail workflows

**Feature:** Correlate replies and enforce unsubscribe/suppression

**Priority:** P0

**Persona:** Sales operator

**User story:** As a sales operator, I want replies and unsubscribe requests correlated to the lead and experiment, so that I can continue genuine conversations and stop unwanted contact.

**User problem:** Delivery is not reply; missed replies lose sales and ignored opt-outs create legal/reputation risk.

**Business outcome:** ≥95% of eligible replies link automatically; suppression takes effect before any later send.

**Preconditions:** Dependencies are satisfied; Sales users read permitted mailbox-derived content; owner manages suppression policy.

**Main workflow:** Lead replies with question; timeline updates, owner alerted, experiment reply metric increments.

**Alternative workflows:** Manual thread link; out-of-office schedules no automatic resend; not-now follow-up requires approval.

**Failure states:** Watch expired, history gap, ambiguous forwarded mail, spoofed headers, parsing failure.

**Acceptance criteria:** Gmail history/watch events are authenticated/deduped; thread/message headers map reply to outbound action/lead; uncertain matches queue human review; intent categories include positive/question/objection/not-now/unsubscribe/out-of-office; explicit unsubscribe immediately suppresses workspace contact; future sends fail closed; manual correction audited.

**Permissions:** Sales users read permitted mailbox-derived content; owner manages suppression policy.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Provider messages/threads, minimal content refs, mapping, classification, suppression.

**Data produced:** Tenant-scoped durable records for correlate replies and enforce unsubscribe/suppression, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Conversation timeline, ambiguous inbox, unsubscribe lock state.

**Backend work:** Gmail event ingestion, correlation, suppression endpoint.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Treat inbound body as hostile; classify intent with confidence/evidence.

**Workflow/job work:** Watch renewal, history backfill, retry/dedupe, alerts.

**Connector work:** Capability-aware adapter work for Gmail, resend, Provider, Stripe; verify scopes, health, rate limits, idempotency, receipts, revoke/reconnect, and simulation boundaries before claiming support.

**Security considerations:** Inbound prompt injection, phishing links, mailbox privacy, retention, unsubscribe law.

**Analytics events:** `reply_received/correlated/classified`, `unsubscribe_recorded`, `send_suppressed`.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Reply/forward/gap/unsubscribe/adversarial-email fixtures pass; no send after suppression.

**Definition of done:** Reply/forward/gap/unsubscribe/adversarial-email fixtures pass; no send after suppression.

**Dependencies:** DOS-044, DOS-045, DOS-070.

**Risks:** Primary failure and trust risks: Watch expired, history gap, ambiguous forwarded mail, spoofed headers, parsing failure. Security risks: Inbound prompt injection, phishing links, mailbox privacy, retention, unsubscribe law.

**Estimated complexity:** XL (split ingestion/correlation/classification/suppression)

**Release wave:** Wave 1

---

## DOS-047 — Connect Stripe and synchronize commercial references

**ID:** DOS-047

**Epic:** Revenue and Stripe

**Feature:** Connect Stripe and synchronize commercial references

**Priority:** P0

**Persona:** Workspace owner

**User story:** As a workspace owner, I want to connect the correct Stripe account and synchronize products/customers, so that revenue can be verified against my commercial graph.

**User problem:** Webhook-only payments lack durable product/customer mapping and account consent.

**Business outcome:** Correct account is healthy, backfill is bounded, and product/customer refs are tenant-linked without copying unnecessary data.

**Preconditions:** Dependencies are satisfied; Owner/admin connects/maps; finance role views customer details.

**Main workflow:** Owner connects test account and selected products map to offers.

**Alternative workflows:** Webhook-only MVP with explicit mapping gaps; manual offer mapping.

**Failure states:** Wrong mode/account, restricted key, webhook setup failure, pagination/rate limit, revoked access.

**Acceptance criteria:** Stripe Connect OAuth or approved key model identifies account; least scopes; webhook endpoint/secret configured; test/live mode distinct; products/prices/customers sync incrementally with cursor and checkpoints; deleted objects tombstoned; data minimization rules apply; connection reports health/freshness.

**Permissions:** Owner/admin connects/maps; finance role views customer details.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Account/mode, token ref, webhook config, external refs, sync cursors/mappings.

**Data produced:** Tenant-scoped durable records for connect stripe and synchronize commercial references, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Account/mode warning, sync progress, offer mapping and reconnect.

**Backend work:** Stripe auth/install, sync adapters, mapping endpoints.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Suggest product-offer mapping; user confirms.

**Workflow/job work:** Incremental backfill, webhook reconciliation, token health.

**Connector work:** Capability-aware adapter work for Stripe, stripe; verify scopes, health, rate limits, idempotency, receipts, revoke/reconnect, and simulation boundaries before claiming support.

**Security considerations:** Signed webhooks, encrypted secrets, PCI boundary, financial PII.

**Analytics events:** `stripe_connected/disconnected`, `stripe_sync_started/completed/failed`, mapping confirmed.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Stripe test-mode connect/sync/revoke/rate-limit tests and security review pass.

**Definition of done:** Stripe test-mode connect/sync/revoke/rate-limit tests and security review pass.

**Dependencies:** DOS-059, DOS-073.

**Risks:** Primary failure and trust risks: Wrong mode/account, restricted key, webhook setup failure, pagination/rate limit, revoked access. Security risks: Signed webhooks, encrypted secrets, PCI boundary, financial PII.

**Estimated complexity:** XL (split install/sync/mapping/UI)

**Release wave:** Wave 1

---

## DOS-048 — Verify and record payment events

**ID:** DOS-048

**Epic:** Revenue and Stripe

**Feature:** Verify and record payment events

**Priority:** P0

**Persona:** Executive

**User story:** As an executive, I want payments recorded only from verified Stripe events, so that displayed revenue is commercial truth.

**User problem:** Client events or AI assertions can fabricate revenue.

**Business outcome:** 100% of counted payments have valid signature, account/workspace mapping, provider identity, and replay-safe state transition.

**Preconditions:** Dependencies are satisfied; Public webhook uses signature authority; finance users view; no user creates verified payment.

**Main workflow:** `payment_intent.succeeded` creates verified payment and mission counter once.

**Alternative workflows:** Event lacks attribution but remains workspace revenue; pending later succeeds.

**Failure states:** Bad signature, unknown account, malformed amount, duplicate/out-of-order, DB failure.

**Acceptance criteria:** Verify raw-body signature/tolerance before parse; dedupe event ID; require workspace/account binding; handle selected payment/checkout/invoice events; preserve event and payment identities; transitions are idempotent/out-of-order safe; amount/currency/status/mode/received/occurred recorded; persistence failure returns retryable non-2xx.

**Permissions:** Public webhook uses signature authority; finance users view; no user creates verified payment.

**Approval requirements:** None for read-only analysis; any derived external side effect is a separate approval-gated action.

**Data required:** Webhook inbox/hash, provider event/payment/customer IDs, amount/currency/status.

**Data produced:** Tenant-scoped durable records for verify and record payment events, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Verified badge/source/time; delayed webhook status.

**Backend work:** Raw webhook boundary, inbox/dedupe, payment state machine.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** None determines verification.

**Workflow/job work:** Async processing after durable inbox; replay/reconciliation.

**Connector work:** Capability-aware adapter work for Stripe, provider, stripe; verify scopes, health, rate limits, idempotency, receipts, revoke/reconnect, and simulation boundaries before claiming support.

**Security considerations:** Signature/replay/tenant mapping, secret rotation, safe raw-event retention.

**Analytics events:** Operational `stripe_webhook_verified/rejected/deduplicated`, `payment_verified`.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Stripe fixture suite, replay/out-of-order/failure and tenant-metadata tests pass.

**Definition of done:** Stripe fixture suite, replay/out-of-order/failure and tenant-metadata tests pass.

**Dependencies:** DOS-047, DOS-070.

**Risks:** Primary failure and trust risks: Bad signature, unknown account, malformed amount, duplicate/out-of-order, DB failure. Security risks: Signature/replay/tenant mapping, secret rotation, safe raw-event retention.

**Estimated complexity:** L

**Release wave:** Wave 1

---

## DOS-049 — Handle refunds and reconcile discrepancies

**ID:** DOS-049

**Epic:** Revenue and Stripe

**Feature:** Handle refunds and reconcile discrepancies

**Priority:** P0

**Persona:** Finance-aware owner

**User story:** As a business owner, I want refunds and discrepancies reconciled to original payments, so that net revenue and campaign economics remain true.

**User problem:** Gross success counts remain inflated after refunds, disputes, missed events, or mapping errors.

**Business outcome:** Net verified revenue matches Stripe within defined tolerance and unresolved differences have owners.

**Preconditions:** Dependencies are satisfied; Finance/owner reviews and resolves; system ingests; manual adjustment needs approval.

**Main workflow:** Partial refund reduces net attributed revenue and revises experiment outcome.

**Alternative workflows:** Manual declared adjustment stays unverified; replay missing event; remap customer after review.

**Failure states:** Original payment absent, currency mismatch, API unavailable, closed period/hold.

**Acceptance criteria:** Refund/dispute/chargeback events link to original payment; partial/multiple refunds supported; net and gross remain separate; reconciliation compares provider objects to ledger by window/currency/mode; discrepancies classify missing/duplicate/status/amount/mapping; resolution never overwrites raw event; attribution reverses proportionally and result versions.

**Permissions:** Finance/owner reviews and resolves; system ingests; manual adjustment needs approval.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Payment/refund/dispute lineage, reconciliation runs/items/resolutions.

**Data produced:** Tenant-scoped durable records for handle refunds and reconcile discrepancies, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Gross/net/refund view and discrepancy work queue.

**Backend work:** Refund state, reconciliation query/job, resolution commands.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Explain likely cause only; no financial mutation.

**Workflow/job work:** Daily reconciliation with backoff and alerts.

**Connector work:** Capability-aware adapter work for Stripe, provider; verify scopes, health, rate limits, idempotency, receipts, revoke/reconnect, and simulation boundaries before claiming support.

**Security considerations:** Financial audit immutability, least privilege, PII redaction.

**Analytics events:** `refund_verified`, `reconciliation_run`, `discrepancy_opened/resolved`.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Partial/multiple/out-of-order refund fixtures reconcile exactly.

**Definition of done:** Partial/multiple/out-of-order refund fixtures reconcile exactly.

**Dependencies:** DOS-048, DOS-070.

**Risks:** Primary failure and trust risks: Original payment absent, currency mismatch, API unavailable, closed period/hold. Security risks: Financial audit immutability, least privilege, PII redaction.

**Estimated complexity:** L

**Release wave:** Wave 1

---

## DOS-050 — Display revenue truth without overstating attribution

**ID:** DOS-050

**Epic:** Revenue and Stripe

**Feature:** Display revenue truth without overstating attribution

**Priority:** P0

**Persona:** Executive

**User story:** As an executive, I want gross, net, pending, refunded, and attributed revenue separated, so that I make decisions from verified money rather than optimistic dashboards.

**User problem:** Revenue and attributed revenue are distinct, and collapsing them misleads decision-makers.

**Business outcome:** Users can reconcile any displayed total to provider records and understand unattributed share.

**Preconditions:** Dependencies are satisfied; Revenue viewers see totals; finance role sees customer/payment details.

**Main workflow:** Owner drills from net revenue to payment, refund, and touchpoint attribution.

**Alternative workflows:** Filter test mode; view currency separately; inspect unattributed queue.

**Failure states:** Stale Stripe, reconciliation open, FX unavailable, permission-limited aggregate.

**Acceptance criteria:** Totals group currency/mode/status; never sum currencies without explicit FX source; show gross/net/refunds/pending/unattributed and attribution confidence bands; each value has as-of/freshness and drilldown; simulation excluded by default; no-data differs from zero; exported totals use same query/version.

**Permissions:** Revenue viewers see totals; finance role sees customer/payment details.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Verified payment/refund ledger, attribution versions, connector freshness.

**Data produced:** Tenant-scoped durable records for display revenue truth without overstating attribution, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Truth-first cards, waterfall/table, data quality and mode labels.

**Backend work:** Revenue summary/detail/export contract with shared calculation library.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Narrative cites exact aggregate snapshot.

**Workflow/job work:** Projection rebuild and reconciliation status.

**Connector work:** Capability-aware adapter work for Stripe, provider, connector; verify scopes, health, rate limits, idempotency, receipts, revoke/reconnect, and simulation boundaries before claiming support.

**Security considerations:** Financial field authorization; prevent spreadsheet formula injection in export.

**Analytics events:** `revenue_viewed/drilled/exported`, `unattributed_revenue_viewed`.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Ledger fixtures equal UI/API/export totals; accessibility and permission tests pass.

**Definition of done:** Ledger fixtures equal UI/API/export totals; accessibility and permission tests pass.

**Dependencies:** DOS-048, DOS-049, DOS-052.

**Risks:** Primary failure and trust risks: Stale Stripe, reconciliation open, FX unavailable, permission-limited aggregate. Security risks: Financial field authorization; prevent spreadsheet formula injection in export.

**Estimated complexity:** M

**Release wave:** Wave 1

---

## DOS-051 — Capture source, campaign, and UTM touchpoints

**ID:** DOS-051

**Epic:** Attribution

**Feature:** Capture source, campaign, and UTM touchpoints

**Priority:** P0

**Persona:** Growth operator

**User story:** As a growth operator, I want consented source and campaign touchpoints captured consistently, so that I can connect distribution work to downstream demand.

**User problem:** Inconsistent UTMs and client-only tracking break the causal chain before a lead appears.

**Business outcome:** At least 95% of golden-path visits and leads carry a normalized source or an explicit `unknown` reason.

**Preconditions:** Dependencies are satisfied; Public collection uses scoped write keys; workspace analysts read; PII linkage requires sales permission.

**Main workflow:** An approved action link produces visit, CTA, form, and lead touchpoints under one campaign.

**Alternative workflows:** Direct visit; privacy-preserving aggregate; GA/PostHog import; offline source declared by a user.

**Failure states:** Blocked script, malformed UTM, duplicate event, identity conflict, consent denied.

**Acceptance criteria:** Versioned event schema accepts server/client events; UTMs and click/action/campaign IDs are normalized; anonymous IDs merge to a lead only with permitted evidence; dedupe and late arrival are deterministic; bot/internal traffic is labeled; consent is enforced; missing is distinct from direct.

**Permissions:** Public collection uses scoped write keys; workspace analysts read; PII linkage requires sales permission.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Event ID, tenant, session/subject refs, source/medium/campaign/content/term, action, timestamps, consent, evidence.

**Data produced:** Tenant-scoped durable records for capture source, campaign, and utm touchpoints, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Tracking builder, live debugger, touchpoint timeline, consent and quality states.

**Backend work:** `/v1/events` ingestion, schema registry, identity-link and touchpoint query APIs.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** None may invent missing source; AI may explain observed paths.

**Workflow/job work:** Dedupe, enrichment, bot labeling, late-event projection rebuild.

**Connector work:** Capability-aware adapter work for PostHog; verify scopes, health, rate limits, idempotency, receipts, revoke/reconnect, and simulation boundaries before claiming support.

**Security considerations:** Signed keys, origin limits, data minimization, no fingerprinting, injection-safe dimensions.

**Analytics events:** `tracking_event_accepted/rejected/deduplicated`, coverage and unknown-source rate.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Browser/server fixtures prove consent, ordering, dedupe, tenant isolation, and end-to-end traceability.

**Definition of done:** Browser/server fixtures prove consent, ordering, dedupe, tenant isolation, and end-to-end traceability.

**Dependencies:** DOS-032, DOS-070.

**Risks:** Primary failure and trust risks: Blocked script, malformed UTM, duplicate event, identity conflict, consent denied. Security risks: Signed keys, origin limits, data minimization, no fingerprinting, injection-safe dimensions.

**Estimated complexity:** L

**Release wave:** Wave 1

---

## DOS-052 — Attribute conversions and revenue with confidence

**ID:** DOS-052

**Epic:** Attribution

**Feature:** Attribute conversions and revenue with confidence

**Priority:** P0

**Persona:** Executive

**User story:** As an executive, I want conversions and verified payments attributed with an explainable confidence level, so that I invest without mistaking correlation for causation.

**User problem:** Last-click dashboards hide uncertainty and over-credit visible channels.

**Business outcome:** Every attributed payment exposes its model, eligible touchpoints, confidence, and limitations.

**Preconditions:** Dependencies are satisfied; Analysts view aggregates; finance/sales permissions govern identifiable drilldown.

**Main workflow:** Stripe customer matches a lead whose tracked campaign touchpoints produce explainable first/last attribution.

**Alternative workflows:** Coupon or declared sales source raises partial confidence; multi-device remains uncertain; no touchpoint is unattributed.

**Failure states:** Conflicting identity, missing UTM, late refund, cross-currency total, model job failure.

**Acceptance criteria:** First-touch and last-touch models ship first; windows and eligibility are versioned; deterministic identity rules link payment/customer/lead; confidence derives from identity and tracking completeness; unattributed remains visible; recalculation creates a new version; totals never exceed verified net revenue.

**Permissions:** Analysts view aggregates; finance/sales permissions govern identifiable drilldown.

**Approval requirements:** None for read-only analysis; any derived external side effect is a separate approval-gated action.

**Data required:** Touchpoints, identity links, conversions, payments/refunds, model/window version, confidence factors.

**Data produced:** Tenant-scoped durable records for attribute conversions and revenue with confidence, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Path view, model selector, confidence breakdown, unattributed queue.

**Backend work:** Versioned attribution engine and result/explanation APIs.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Explain results from frozen inputs; cannot alter weights or payment truth.

**Workflow/job work:** Recalculate on identity, event, payment, refund, or model changes.

**Connector work:** Capability-aware adapter work for Stripe; verify scopes, health, rate limits, idempotency, receipts, revoke/reconnect, and simulation boundaries before claiming support.

**Security considerations:** Tenant-safe identity graph, purpose limitation, export controls.

**Analytics events:** `attribution_viewed/model_changed/explained`, attributed share and confidence distribution.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Golden fixtures reconcile across model versions, refunds, late events, and UI/API/export.

**Definition of done:** Golden fixtures reconcile across model versions, refunds, late events, and UI/API/export.

**Dependencies:** DOS-048, DOS-049, DOS-051.

**Risks:** Primary failure and trust risks: Conflicting identity, missing UTM, late refund, cross-currency total, model job failure. Security risks: Tenant-safe identity graph, purpose limitation, export controls.

**Estimated complexity:** L

**Release wave:** Wave 1

---

## DOS-053 — Detect missing or broken measurement

**ID:** DOS-053

**Epic:** Analytics

**Feature:** Detect missing or broken measurement

**Priority:** P1

**Persona:** Growth operator

**User story:** As a growth operator, I want tracking gaps detected before launch, so that an experiment does not spend time or money without learnable evidence.

**User problem:** Campaigns often launch with missing events, mismatched domains, or unresolvable conversion paths.

**Business outcome:** Measurement readiness is a blocking preflight for governed actions.

**Preconditions:** Dependencies are satisfied; Operator runs tests; approver may accept warnings; security blocks non-overridable risks.

**Main workflow:** Test visit reaches the conversion event and returns the expected campaign/action identifiers.

**Alternative workflows:** Server-side conversion test; manual evidence for offline conversion; simulation.

**Failure states:** CSP/cookie block, redirect strips UTM, wrong domain, stale analytics, event schema mismatch.

**Acceptance criteria:** Preflight checks destination reachability, approved domains, UTM persistence, CTA/form event, identity link, conversion/payment mapping, connector freshness, sample/test traffic, and consent; each check is pass/warn/block with remediation; overrides require authorized reason and expire.

**Permissions:** Operator runs tests; approver may accept warnings; security blocks non-overridable risks.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Plan, URLs, schema, test run, expected/observed events, connector health.

**Data produced:** Tenant-scoped durable records for detect missing or broken measurement, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Readiness checklist with live test trace and blocked launch state.

**Backend work:** Measurement preflight and remediation contracts.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Summarize likely cause from deterministic check output.

**Workflow/job work:** Scheduled health probes and pre-launch recheck.

**Connector work:** Capability-aware adapter work for connector; verify scopes, health, rate limits, idempotency, receipts, revoke/reconnect, and simulation boundaries before claiming support.

**Security considerations:** Safe URL fetch, synthetic-data labeling, no production PII in tests.

**Analytics events:** `measurement_preflight_started/passed/blocked/overridden`, gap categories.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Fault injection catches every golden-path break and blocks execution as configured.

**Definition of done:** Fault injection catches every golden-path break and blocks execution as configured.

**Dependencies:** DOS-005, DOS-035, DOS-051.

**Risks:** Primary failure and trust risks: CSP/cookie block, redirect strips UTM, wrong domain, stale analytics, event schema mismatch. Security risks: Safe URL fetch, synthetic-data labeling, no production PII in tests.

**Estimated complexity:** M

**Release wave:** Wave 2

---

## DOS-054 — Explain metric changes and connect activity to revenue

**ID:** DOS-054

**Epic:** Analytics

**Feature:** Explain metric changes and connect activity to revenue

**Priority:** P1

**Persona:** Marketing manager

**User story:** As a marketing manager, I want material metric changes explained from evidence, so that I know which action to continue, stop, or investigate.

**User problem:** Charts reveal changes but not whether instrumentation, mix, seasonality, or action performance caused them.

**Business outcome:** Users reach a supported next decision faster without causal overclaiming.

**Preconditions:** Dependencies are satisfied; Analysts view authorized aggregates; evidence drilldown respects source permissions.

**Main workflow:** Reply conversion rises for a winning variant and the explanation links the approved content, cohort, replies, and revenue.

**Alternative workflows:** Change is below threshold; instrumentation explains delta; insufficient sample returns inconclusive.

**Failure states:** Stale connector, changed metric definition, missing baseline, currency mismatch, model unavailable.

**Acceptance criteria:** Compare fixed windows/cohorts and denominators; surface data-quality changes first; show funnel deltas from reach through verified revenue; candidate explanations cite evidence and counterevidence; causal language is prohibited without valid experiment; recommendation includes impact, confidence, risk, and next test.

**Permissions:** Analysts view authorized aggregates; evidence drilldown respects source permissions.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Versioned metrics, cohorts, actions, experiments, evidence, attribution, quality flags.

**Data produced:** Tenant-scoped durable records for explain metric changes and connect activity to revenue, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Funnel delta, annotated timeline, explanation/counterevidence rail.

**Backend work:** Metric comparison snapshots and explanation evidence bundle.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Generate bounded explanation from supplied calculations; structured claim validator.

**Workflow/job work:** Anomaly detection, snapshot freeze, notification routing.

**Connector work:** Capability-aware adapter work for connector; verify scopes, health, rate limits, idempotency, receipts, revoke/reconnect, and simulation boundaries before claiming support.

**Security considerations:** Minimum cohort sizes, no sensitive inference, prompt/evidence isolation.

**Analytics events:** `metric_change_detected/viewed`, `explanation_accepted/rejected`, decision time.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Evaluation set rejects unsupported causality and reproduces all displayed calculations.

**Definition of done:** Evaluation set rejects unsupported causality and reproduces all displayed calculations.

**Dependencies:** DOS-040, DOS-050, DOS-052, DOS-067.

**Risks:** Primary failure and trust risks: Stale connector, changed metric definition, missing baseline, currency mismatch, model unavailable. Security risks: Minimum cohort sizes, no sensitive inference, prompt/evidence isolation.

**Estimated complexity:** L

**Release wave:** Wave 2

---

## DOS-055 — Use an evidence-grounded AI COO

**ID:** DOS-055

**Epic:** AI Workforce

**Feature:** Use an evidence-grounded AI COO

**Priority:** P1

**Persona:** Founder

**User story:** As a founder, I want an AI COO to answer commercial questions and propose the next decision, so that I can act across the operating loop without losing evidence or control.

**User problem:** Users must synthesize fragmented product, campaign, lead, and revenue context themselves.

**Business outcome:** Answers shorten decision time and always distinguish observed fact, inference, unknown, and proposed action.

**Preconditions:** Dependencies are satisfied; Any member asks within access; proposed actions require their normal capabilities.

**Main workflow:** Founder asks why revenue stalled and receives a cited funnel diagnosis plus a proposed experiment.

**Alternative workflows:** Clarifying question; compare strategies; read-only mobile answer; handoff to specialist.

**Failure states:** Retrieval unavailable, conflicting evidence, permission gap, model timeout, unsafe requested action.

**Acceptance criteria:** Retrieval is tenant/permission scoped; response schema contains answer, evidence, freshness, confidence, risks, unknowns, and next action; write/tool actions are previews; approval is requested through policy service; citations open exact records; abstain when evidence is insufficient.

**Permissions:** Any member asks within access; proposed actions require their normal capabilities.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Authorized graph/evidence/metrics, question, prompt/model/tool versions, response evaluation.

**Data produced:** Tenant-scoped durable records for use an evidence-grounded ai coo, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Persistent command bar/chat, citations, confidence, proposed-action preview.

**Backend work:** Conversation/run endpoints, retrieval authorization, structured response validation.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Orchestrate read tools only by default; enforce evidence coverage and abstention.

**Workflow/job work:** Long analysis can run durably with cancel/resume and progress.

**Connector work:** None; do not manufacture a connector dependency.

**Security considerations:** Prompt injection defense, tool allowlists, output encoding, retention controls.

**Analytics events:** `coo_question_asked/answered/abstained`, citation opened, proposal accepted.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Permission, injection, citation, hallucination, timeout, and accessibility eval suites pass.

**Definition of done:** Permission, injection, citation, hallucination, timeout, and accessibility eval suites pass.

**Dependencies:** DOS-016, DOS-061, DOS-066, DOS-069.

**Risks:** Primary failure and trust risks: Retrieval unavailable, conflicting evidence, permission gap, model timeout, unsafe requested action. Security risks: Prompt injection defense, tool allowlists, output encoding, retention controls.

**Estimated complexity:** L

**Release wave:** Wave 2

---

## DOS-056 — Invoke role-bounded specialist agents

**ID:** DOS-056

**Epic:** AI Workforce

**Feature:** Invoke role-bounded specialist agents

**Priority:** P1

**Persona:** Growth operator

**User story:** As a growth operator, I want specialist agents for content, growth, market, revenue, customer research, and analytics, so that each task uses an explicit method and permission boundary.

**User problem:** One omnipotent assistant obscures expertise, inputs, evaluation, and accountability.

**Business outcome:** Specialist outputs are reproducible artifacts that can be reviewed and measured.

**Preconditions:** Dependencies are satisfied; Run authorization intersects user, role, workspace policy, and tool capability.

**Main workflow:** Growth agent requests market evidence, then creates a scored experiment proposal.

**Alternative workflows:** User chooses one specialist; deterministic template fallback; agent abstains.

**Failure states:** Tool denied, budget exhausted, invalid structure, evidence too stale, dependency agent fails.

**Acceptance criteria:** Each role declares allowed tools/data, input/output schema, prompt/eval version, cost/time ceiling, approval needs, and fallback; six agents produce drafts only unless capability policy allows more; role cannot inherit caller permissions; result shows evidence/confidence/limitations.

**Permissions:** Run authorization intersects user, role, workspace policy, and tool capability.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Agent definition, run, task, tool calls, costs, artifacts, evaluation.

**Data produced:** Tenant-scoped durable records for invoke role-bounded specialist agents, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Workforce roster, scope cards, run detail, artifact compare.

**Backend work:** Agent registry, run/artifact APIs, capability tokens.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Versioned specialist prompts, routers, validators, evaluation sets.

**Workflow/job work:** Durable runs with quotas, cancellation, timeouts, retry classification.

**Connector work:** None; do not manufacture a connector dependency.

**Security considerations:** Least privilege, data boundary labels, sandboxed untrusted content.

**Analytics events:** `agent_run_started/completed/failed`, cost, latency, artifact adoption.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Contract, authorization, budget, fallback, and domain-quality evals pass per agent.

**Definition of done:** Contract, authorization, budget, fallback, and domain-quality evals pass per agent.

**Dependencies:** DOS-055, DOS-061, DOS-069, DOS-071.

**Risks:** Primary failure and trust risks: Tool denied, budget exhausted, invalid structure, evidence too stale, dependency agent fails. Security risks: Least privilege, data boundary labels, sandboxed untrusted content.

**Estimated complexity:** XL (deliver one role at a time)

**Release wave:** Wave 2

---

## DOS-057 — Coordinate and delegate agent tasks transparently

**ID:** DOS-057

**Epic:** AI Workforce

**Feature:** Coordinate and delegate agent tasks transparently

**Priority:** P2

**Persona:** Marketing manager

**User story:** As a marketing manager, I want agents to delegate bounded subtasks with visible dependencies, so that complex plans complete without hidden actions.

**User problem:** Opaque multi-agent chains are hard to debug, govern, or trust.

**Business outcome:** Every delegated task has an owner, scope, budget, status, artifact, and trace.

**Preconditions:** Dependencies are satisfied; Delegated rights are a strict subset of initiating user's current rights.

**Main workflow:** COO delegates audience research and content options, then synthesizes one proposal.

**Alternative workflows:** Sequential fallback; user completes task; one branch abstains.

**Failure states:** Deadlock, cost ceiling, conflicting artifacts, stale parent, child timeout.

**Acceptance criteria:** Parent creates typed task DAG; cycles and unbounded fan-out rejected; child receives minimum context/capabilities; shared writes use optimistic concurrency; user can inspect, cancel, retry, or take over; failed child yields partial result; no agent can approve another agent's action.

**Permissions:** Delegated rights are a strict subset of initiating user's current rights.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Task graph, dependencies, context refs, capabilities, states, artifacts, costs.

**Data produced:** Tenant-scoped durable records for coordinate and delegate agent tasks transparently, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Run graph, progress, blockers, costs, cancel/take-over controls.

**Backend work:** Task DAG commands/queries and scoped capability issuance.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Planner constrained by task and fan-out schemas; deterministic merge checks.

**Workflow/job work:** Durable DAG scheduling, compensation, lease recovery.

**Connector work:** None; do not manufacture a connector dependency.

**Security considerations:** Confused-deputy prevention, context minimization, revocation propagation.

**Analytics events:** `agent_task_delegated/completed/taken_over`, chain success/cost.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Cycle, revocation, partial failure, concurrency, and cost-cap tests pass.

**Definition of done:** Cycle, revocation, partial failure, concurrency, and cost-cap tests pass.

**Dependencies:** DOS-056, DOS-063, DOS-069.

**Risks:** Primary failure and trust risks: Deadlock, cost ceiling, conflicting artifacts, stale parent, child timeout. Security risks: Confused-deputy prevention, context minimization, revocation propagation.

**Estimated complexity:** XL

**Release wave:** Wave 3

---

## DOS-058 — Review agent approval requests

**ID:** DOS-058

**Epic:** AI Workforce

**Feature:** Review agent approval requests

**Priority:** P1

**Persona:** Approver

**User story:** As an approver, I want agent-proposed actions in the normal approval queue, so that AI never bypasses commercial controls.

**User problem:** Conversational consent is ambiguous and can conceal material payload changes.

**Business outcome:** Zero agent-originated executions occur without a valid deterministic authorization decision.

**Preconditions:** Dependencies are satisfied; Policy-selected approvers; agents and request creators cannot self-approve where separation applies.

**Main workflow:** Content agent submits a post; approver edits, triggering a new version, then approves it.

**Alternative workflows:** Bulk review only for identical low-risk class; delegate approver temporarily; simulation.

**Failure states:** Stale evidence, unavailable connector, changed budget, missing approver, expired request.

**Acceptance criteria:** Request includes origin agent/run, exact payload/hash, evidence, confidence, cost, risk, policy checks, expiry, and diff; approve/reject/request-change supported; mutation invalidates; separation of duties configurable; approval is not execution; expired/revoked requests block.

**Permissions:** Policy-selected approvers; agents and request creators cannot self-approve where separation applies.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Agent run, action version/hash, policy evaluation, decision, actor, timestamps.

**Data produced:** Tenant-scoped durable records for review agent approval requests, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Unified inbox with AI-origin badge, diff, evidence, and expiry.

**Backend work:** Agent proposal adapter into generic approval commands.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Generates rationale only; cannot mutate after submission.

**Workflow/job work:** Expiry/escalation and revocation cancel queued executions.

**Connector work:** Capability-aware adapter work for connector; verify scopes, health, rate limits, idempotency, receipts, revoke/reconnect, and simulation boundaries before claiming support.

**Security considerations:** Non-repudiation, replay prevention, delegated-approval boundaries.

**Analytics events:** `agent_approval_requested/approved/rejected/expired`, cycle time.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Bypass, self-approval, mutation, expiry, revocation, and race tests pass.

**Definition of done:** Bypass, self-approval, mutation, expiry, revocation, and race tests pass.

**Dependencies:** DOS-056, DOS-062, DOS-063.

**Risks:** Primary failure and trust risks: Stale evidence, unavailable connector, changed budget, missing approver, expired request. Security risks: Non-repudiation, replay prevention, delegated-approval boundaries.

**Estimated complexity:** M

**Release wave:** Wave 2

---

## DOS-059 — Store and govern agent memory

**ID:** DOS-059

**Epic:** Agent Memory

**Feature:** Store and govern agent memory

**Priority:** P1

**Persona:** Workspace owner

**User story:** As a workspace owner, I want agent memory to be inspectable, correctable, and source-linked, so that automation learns without turning guesses into truth.

**User problem:** Hidden long-term memory compounds stale facts, tenant leakage, and unsupported assumptions.

**Business outcome:** Reused context is accurate, permission-aware, and deletable.

**Preconditions:** Dependencies are satisfied; Owners set policy; members see/edit authorized memories; agents only propose or use allowed types.

**Main workflow:** User-confirmed brand preference is reused with a visible memory citation.

**Alternative workflows:** Session-only mode; proposed lesson awaits confirmation; conflicting memory marked disputed.

**Failure states:** Source deleted, stale entry, embedding unavailable, access revoked, deletion backlog.

**Acceptance criteria:** Memory types are session, workspace fact, preference, lesson, and proposed memory; every durable entry has source, confidence, freshness, owner, sensitivity, retention, and version; facts require observed/provider/user-confirmed source; user can edit/archive/forget; retrieval filters permissions and staleness; deletion propagates to semantic indexes.

**Permissions:** Owners set policy; members see/edit authorized memories; agents only propose or use allowed types.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Memory/version/source refs, sensitivity, retention, embeddings optional, access log.

**Data produced:** Tenant-scoped durable records for store and govern agent memory, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Memory browser, provenance, correction, retention, used-in-run view.

**Backend work:** Memory CRUD/search/forget APIs and authorization filters.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Extraction proposes structured memories; retrieval cites IDs and ignores instructions in content.

**Workflow/job work:** Freshness decay, re-index, retention deletion, source revocation.

**Connector work:** Capability-aware adapter work for provider; verify scopes, health, rate limits, idempotency, receipts, revoke/reconnect, and simulation boundaries before claiming support.

**Security considerations:** Tenant-separated indexes, PII classification, right-to-delete, poisoning defense.

**Analytics events:** `memory_proposed/confirmed/corrected/forgotten/used`, stale-use rate.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Isolation, provenance, correction, deletion, poisoning, and stale-retrieval tests pass.

**Definition of done:** Isolation, provenance, correction, deletion, poisoning, and stale-retrieval tests pass.

**Dependencies:** DOS-011, DOS-061, DOS-066.

**Risks:** Primary failure and trust risks: Source deleted, stale entry, embedding unavailable, access revoked, deletion backlog. Security risks: Tenant-separated indexes, PII classification, right-to-delete, poisoning defense.

**Estimated complexity:** L

**Release wave:** Wave 2

---

## DOS-060 — Recover failed agent runs and display calibrated confidence

**ID:** DOS-060

**Epic:** AI Workforce

**Feature:** Recover failed agent runs and display calibrated confidence

**Priority:** P1

**Persona:** Growth operator

**User story:** As a growth operator, I want failed agent work to recover safely and confidence to reflect evidence quality, so that I can decide whether to trust, retry, or take over.

**User problem:** Silent retries and decorative confidence hide cost, partial work, and uncertainty.

**Business outcome:** Agent failures are recoverable without duplicate side effects and confidence is empirically monitored.

**Preconditions:** Dependencies are satisfied; Run owner/operator controls retries; model/cost changes respect workspace policy.

**Main workflow:** Model timeout resumes from last completed research artifact and produces one result.

**Alternative workflows:** Switch approved model; accept partial; cancel; deterministic fallback.

**Failure states:** Invalid checkpoint, repeated permanent failure, tool outcome ambiguous, cost cap, model outage.

**Acceptance criteria:** Run states include queued/running/waiting/partial/succeeded/failed/cancelled/blocked; checkpoints persist before tool calls; retry only classified transient failures; side-effect tools require idempotency; partial artifacts visible; confidence includes model calibration band, evidence coverage/freshness, and sample caveat; user can retry from safe checkpoint or take over.

**Permissions:** Run owner/operator controls retries; model/cost changes respect workspace policy.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Run/checkpoints/attempts, tool receipts, error class, cost, confidence components, eval version.

**Data produced:** Tenant-scoped durable records for recover failed agent runs and display calibrated confidence, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** State timeline, partial artifacts, retry/takeover, confidence breakdown.

**Backend work:** Run-control and confidence-explanation APIs.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Self-report is not confidence; use evaluation/calibration service.

**Workflow/job work:** Leases, heartbeat, retry budget, dead-letter and reconciliation.

**Connector work:** None; do not manufacture a connector dependency.

**Security considerations:** Redacted errors, no retry of unauthorized or unsafe calls, checkpoint encryption.

**Analytics events:** `agent_run_retried/recovered/taken_over`, calibration error, duplicate side effects.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Crash/timeout/ambiguous-tool/cancel/cost and calibration tests pass.

**Definition of done:** Crash/timeout/ambiguous-tool/cancel/cost and calibration tests pass.

**Dependencies:** DOS-056, DOS-069, DOS-070.

**Risks:** Primary failure and trust risks: Invalid checkpoint, repeated permanent failure, tool outcome ambiguous, cost cap, model outage. Security risks: Redacted errors, no retry of unauthorized or unsafe calls, checkpoint encryption.

**Estimated complexity:** L

**Release wave:** Wave 2

---

## DOS-061 — Configure approval and autonomy policies

**ID:** DOS-061

**Epic:** Governance

**Feature:** Configure approval and autonomy policies

**Priority:** P0

**Persona:** Workspace owner

**User story:** As a workspace owner, I want policies by risk, channel, action, and autonomy level, so that execution matches my tolerance and obligations.

**User problem:** A single autonomy switch cannot express spending, publishing, outreach, or role risk.

**Business outcome:** Every action receives a deterministic allow, require-approval, or deny decision with reasons.

**Preconditions:** Dependencies are satisfied; Owner/admin edits; members read relevant rules; platform safety rules read-only.

**Main workflow:** Owner permits scheduled low-risk drafts but requires approval for public publish and every email send.

**Alternative workflows:** Template by persona; stricter channel override; temporary policy with expiry.

**Failure states:** Conflicting rule, invalid scope, stale client version, no eligible approver, policy service unavailable.

**Acceptance criteria:** Policies support action/channel/recipient/source/risk, autonomy level, confidence/evidence minimum, budget, schedule, role, and connector health; deny overrides allow; system safety rules cannot be weakened; versions have effective times; dry-run shows affected capabilities; default is approval-required; promotion/demotion criteria are measurable.

**Permissions:** Owner/admin edits; members read relevant rules; platform safety rules read-only.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Policy/set/version/rules, author, effective/expiry, test cases, evaluation log.

**Data produced:** Tenant-scoped durable records for configure approval and autonomy policies, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Plain-language builder, conflict warnings, capability matrix, version diff.

**Backend work:** Policy CRUD, compile, dry-run, evaluate, rollback APIs.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** May suggest rules; deterministic engine validates/evaluates.

**Workflow/job work:** Re-evaluate queued work on policy/revocation changes.

**Connector work:** Capability-aware adapter work for connector; verify scopes, health, rate limits, idempotency, receipts, revoke/reconnect, and simulation boundaries before claiming support.

**Security considerations:** Fail closed, signed/versioned decisions, privilege escalation tests.

**Analytics events:** `policy_created/changed/tested/rolled_back`, deny/approval rates.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Decision-table, precedence, migration, outage, and authorization tests pass.

**Definition of done:** Decision-table, precedence, migration, outage, and authorization tests pass.

**Dependencies:** DOS-075, DOS-076.

**Risks:** Primary failure and trust risks: Conflicting rule, invalid scope, stale client version, no eligible approver, policy service unavailable. Security risks: Fail closed, signed/versioned decisions, privilege escalation tests.

**Estimated complexity:** L

**Release wave:** Wave 0

---

## DOS-062 — Approve, reject, or request changes to an action

**ID:** DOS-062

**Epic:** Governance

**Feature:** Approve, reject, or request changes to an action

**Priority:** P0

**Persona:** Approver

**User story:** As an approver, I want to inspect the exact proposed action and decide it, so that nothing material executes by implication.

**User problem:** Chat acknowledgements and blanket approvals are ambiguous and unauditable.

**Business outcome:** Approval decisions are fast, attributable, and bound to immutable payloads.

**Preconditions:** Dependencies are satisfied; Only resolved approver role; separation of duties and delegation apply.

**Main workflow:** Approver opens request, checks evidence, approves exact version, and sees it queued.

**Alternative workflows:** Reject; request edit; delegate; batch only within policy-defined homogeneous class.

**Failure states:** Already decided, mutated, expired, permission revoked, evidence stale, connector unhealthy.

**Acceptance criteria:** Queue shows payload/diff, audience, evidence, risk, cost, connector, schedule, confidence, policy, and simulation status; approve/reject/request-change requires reason as configured; payload hash and version bind decision; optimistic locking prevents double decision; approval does not imply success.

**Permissions:** Only resolved approver role; separation of duties and delegation apply.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Action/version/payload hash, policy result, request, decision, actor, comments.

**Data produced:** Tenant-scoped durable records for approve, reject, or request changes to an action, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Inbox, detail/diff, keyboard review, decision confirmation, status timeline.

**Backend work:** Approval commands with ETag/idempotency and decision queries.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Summarize evidence; never records the human decision.

**Workflow/job work:** On approval enqueue only after fresh preflight; notify on decision.

**Connector work:** Capability-aware adapter work for connector; verify scopes, health, rate limits, idempotency, receipts, revoke/reconnect, and simulation boundaries before claiming support.

**Security considerations:** CSRF, session reauthentication for high risk, non-repudiation.

**Analytics events:** `approval_opened/approved/rejected/changes_requested`, review time.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Mutation, race, replay, delegation, expiry, and accessibility tests pass.

**Definition of done:** Mutation, race, replay, delegation, expiry, and accessibility tests pass.

**Dependencies:** DOS-061, DOS-066.

**Risks:** Primary failure and trust risks: Already decided, mutated, expired, permission revoked, evidence stale, connector unhealthy. Security risks: CSRF, session reauthentication for high risk, non-repudiation.

**Estimated complexity:** M

**Release wave:** Wave 1

---

## DOS-063 — Enforce spend, channel, and autonomous-action limits

**ID:** DOS-063

**Epic:** Governance

**Feature:** Enforce spend, channel, and autonomous-action limits

**Priority:** P0

**Persona:** Workspace owner

**User story:** As a workspace owner, I want hard limits on spend, channels, recipients, and autonomous actions, so that automation cannot exceed its mandate.

**User problem:** Approval without execution-time limits leaves race conditions and cumulative-risk gaps.

**Business outcome:** Zero executions exceed reserved budget or a current channel/autonomy restriction.

**Preconditions:** Dependencies are satisfied; Owner configures; finance may manage budgets; operators see remaining allowance.

**Main workflow:** Approved action reserves its cost, executes below ceiling, and settles actual cost.

**Alternative workflows:** No-cost action; owner raises future limit; simulation estimates without reserve.

**Failure states:** Insufficient budget, concurrent reservation, stale FX, restricted channel, policy changed mid-run.

**Acceptance criteria:** Per-action/day/month currency budgets, recipient/frequency caps, channel allowlist, risk exclusions, and autonomy ceiling enforced transactionally; reserve before queue, consume from provider result, release on terminal failure; currency conversion never assumed; queued work rechecked; platform abuse limits non-overridable.

**Permissions:** Owner configures; finance may manage budgets; operators see remaining allowance.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Budget/limit/period, reservations, actuals, policy/action/connector refs.

**Data produced:** Tenant-scoped durable records for enforce spend, channel, and autonomous-action limits, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Limit editor, remaining budget, preflight block and transaction history.

**Backend work:** Atomic reserve/settle/release and limit query APIs.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Can propose allocation; cannot reserve or modify limits.

**Workflow/job work:** Expire reservations, reconcile provider cost, stop scheduled jobs.

**Connector work:** Capability-aware adapter work for provider, connector; verify scopes, health, rate limits, idempotency, receipts, revoke/reconnect, and simulation boundaries before claiming support.

**Security considerations:** Integer minor units, concurrency, authorization, tamper-proof ledger.

**Analytics events:** `budget_reserved/settled/released/blocked`, utilization and violations.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Concurrency/property tests prove no overspend or bypass across retries.

**Definition of done:** Concurrency/property tests prove no overspend or bypass across retries.

**Dependencies:** DOS-061, DOS-066.

**Risks:** Primary failure and trust risks: Insufficient budget, concurrent reservation, stale FX, restricted channel, policy changed mid-run. Security risks: Integer minor units, concurrency, authorization, tamper-proof ledger.

**Estimated complexity:** L

**Release wave:** Wave 1

---

## DOS-064 — Revoke or expire approval and execution permission

**ID:** DOS-064

**Epic:** Governance

**Feature:** Revoke or expire approval and execution permission

**Priority:** P0

**Persona:** Workspace owner

**User story:** As a workspace owner, I want approvals and delegated permissions to expire or be revoked, so that stale authorization cannot produce future actions.

**User problem:** Delayed jobs may execute after context, personnel, policy, or intent has changed.

**Business outcome:** Revocation propagates to every queued or resumable action before the next side effect.

**Preconditions:** Dependencies are satisfied; Grant issuer, owner, or policy-defined administrator revokes; emergency rule restricted.

**Main workflow:** Owner revokes a scheduled post; worker cancels it and releases reservation.

**Alternative workflows:** Re-approval creates new version; revoke delegated approver; emergency channel kill switch.

**Failure states:** Provider already executing, worker offline, revoke race, partial multi-step action.

**Acceptance criteria:** Approvals have expiry and use count; owner/authorized approver can revoke; role/connector/policy changes invalidate affected grants; worker checks authorization immediately before each external call; queued job becomes blocked/cancelled; already accepted provider action is reconciled, not falsely undone; audit records propagation.

**Permissions:** Grant issuer, owner, or policy-defined administrator revokes; emergency rule restricted.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Grant/approval, expiry/use, revocation, affected jobs, provider state.

**Data produced:** Tenant-scoped durable records for revoke or expire approval and execution permission, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Revoke controls, impact preview, propagation status.

**Backend work:** Revoke command, grant introspection, impacted-work query.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** None controls revocation.

**Workflow/job work:** Cancellation signals, pre-side-effect introspection, compensation/reconcile.

**Connector work:** Capability-aware adapter work for connector, provider, Provider; verify scopes, health, rate limits, idempotency, receipts, revoke/reconnect, and simulation boundaries before claiming support.

**Security considerations:** Fail closed on introspection failure; race and replay protection.

**Analytics events:** `approval_expired/revoked`, `job_cancelled_by_revocation`, propagation latency.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Queue/running/partial/provider-race and outage tests pass.

**Definition of done:** Queue/running/partial/provider-race and outage tests pass.

**Dependencies:** DOS-062, DOS-063.

**Risks:** Primary failure and trust risks: Provider already executing, worker offline, revoke race, partial multi-step action. Security risks: Fail closed on introspection failure; race and replay protection.

**Estimated complexity:** M

**Release wave:** Wave 1

---

## DOS-065 — Review complete governance history

**ID:** DOS-065

**Epic:** Governance

**Feature:** Review complete governance history

**Priority:** P1

**Persona:** Auditor

**User story:** As an authorized auditor, I want to review who proposed, approved, changed, executed, or revoked an action, so that accountability is demonstrable.

**User problem:** Separate logs cannot prove authorization and execution continuity.

**Business outcome:** An audit reviewer can reconstruct the full governed action lifecycle.

**Preconditions:** Dependencies are satisfied; Owner/auditor; platform admins have no implicit tenant payload access.

**Main workflow:** Auditor traces one Gmail message from agent proposal through human approval to provider receipt.

**Alternative workflows:** Export signed manifest; inspect denied attempt; compare versions.

**Failure states:** Missing event, integrity mismatch, storage lag, retention hold, export failure.

**Acceptance criteria:** Append-only timeline includes actor/service, tenant, action/version/hash, policy/version/result, approval, revocation, attempts, receipts, outcome, and correlation IDs; filters/export are deterministic; sensitive fields redacted by role; clock/source displayed; integrity check reports gaps.

**Permissions:** Owner/auditor; platform admins have no implicit tenant payload access.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Audit/evidence/events and actor/service identity.

**Data produced:** Tenant-scoped durable records for review complete governance history, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Searchable timeline, filters, diff and integrity status.

**Backend work:** Append/query/export/integrity APIs with cursor pagination.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** May summarize selected records with citations; no log mutation.

**Workflow/job work:** Export generation, integrity scan, retention/legal hold.

**Connector work:** Capability-aware adapter work for Gmail, provider; verify scopes, health, rate limits, idempotency, receipts, revoke/reconnect, and simulation boundaries before claiming support.

**Security considerations:** Append-only storage, hash chaining/signing option, redaction, export watermark.

**Analytics events:** `audit_viewed/exported/integrity_failed`.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Lifecycle fixture reconstructs exactly; tamper, permission, pagination, export tests pass.

**Definition of done:** Lifecycle fixture reconstructs exactly; tamper, permission, pagination, export tests pass.

**Dependencies:** DOS-062, DOS-064, DOS-066.

**Risks:** Primary failure and trust risks: Missing event, integrity mismatch, storage lag, retention hold, export failure. Security risks: Append-only storage, hash chaining/signing option, redaction, export watermark.

**Estimated complexity:** M

**Release wave:** Wave 1

---

## DOS-066 — Record immutable sources and provenance

**ID:** DOS-066

**Epic:** Evidence Ledger

**Feature:** Record immutable sources and provenance

**Priority:** P0

**Persona:** Growth operator

**User story:** As a growth operator, I want every material claim linked to an immutable source record, so that I can verify what the system believes and why.

**User problem:** URLs and generated prose alone do not preserve source content, capture time, or transformation lineage.

**Business outcome:** Every strategic artifact meets an evidence-coverage threshold or exposes its gap.

**Preconditions:** Dependencies are satisfied; Source access follows original sensitivity plus workspace role.

**Main workflow:** Pricing assertion opens the exact sanitized page snapshot and extraction span.

**Alternative workflows:** User statement, provider event, analytics aggregate, manual document.

**Failure states:** Source unavailable, hash mismatch, expired retention, access revoked, unsupported format.

**Acceptance criteria:** Source record stores tenant, type, locator, capture/observed time, freshness policy, content hash, bounded artifact ref, consent/access, extractor/version, and parent lineage; raw untrusted content is immutable; correction adds record; deletion uses tombstone/retention policy; claims link supporting or contradicting evidence.

**Permissions:** Source access follows original sensitivity plus workspace role.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Evidence/source/artifact/claim links, hashes, provenance, freshness.

**Data produced:** Tenant-scoped durable records for record immutable sources and provenance, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Evidence drawer, source preview, provenance chain, missing-access state.

**Backend work:** Evidence append/read/link/tombstone APIs and content-addressed storage.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Must cite evidence IDs in structured output; webpage instructions never become tools.

**Workflow/job work:** Capture, sanitize, hash, malware scan, freshness marking.

**Connector work:** Capability-aware adapter work for provider; verify scopes, health, rate limits, idempotency, receipts, revoke/reconnect, and simulation boundaries before claiming support.

**Security considerations:** SSRF/file safety, immutable audit, object-store tenant keys, PII retention.

**Analytics events:** `evidence_recorded/viewed/linked/staled`, coverage rate.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Hash, lineage, access, tamper, stale, and deletion-policy tests pass.

**Definition of done:** Hash, lineage, access, tamper, stale, and deletion-policy tests pass.

**Dependencies:** DOS-076.

**Risks:** Primary failure and trust risks: Source unavailable, hash mismatch, expired retention, access revoked, unsupported format. Security risks: SSRF/file safety, immutable audit, object-store tenant keys, PII retention.

**Estimated complexity:** L

**Release wave:** Wave 0

---

## DOS-067 — Record recommendations, decisions, executions, and outcomes

**ID:** DOS-067

**Epic:** Evidence Ledger

**Feature:** Record recommendations, decisions, executions, and outcomes

**Priority:** P0

**Persona:** Founder

**User story:** As a founder, I want the entire decision-to-outcome chain recorded, so that the system learns from what actually happened rather than from generated plans.

**User problem:** Recommendations, decisions, attempts, and outcomes are often conflated or lost.

**Business outcome:** Every completed experiment has a traceable causal record and explicit unresolved gaps.

**Preconditions:** Dependencies are satisfied; Writers use scoped service/user identities; readers follow underlying artifact access.

**Main workflow:** Opportunity becomes approved campaign, provider action, lead, payment, attribution, and lesson chain.

**Alternative workflows:** Recommendation rejected; execution fails; payment unattributed; experiment inconclusive.

**Failure states:** Broken lineage, missing receipt, delayed metric, duplicate webhook, projection lag.

**Acceptance criteria:** Typed ledger entries cover recommendation, user/system decision, approval, attempt, provider result, metric outcome, revenue evidence, and lesson; each references prior entries and frozen artifact versions; states remain distinct; late/corrective entries append; simulations cannot satisfy real outcome; contradictions trigger review.

**Permissions:** Writers use scoped service/user identities; readers follow underlying artifact access.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Typed entries, lineage edges, correlations, actors, state, payload hashes.

**Data produced:** Tenant-scoped durable records for record recommendations, decisions, executions, and outcomes, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Evidence chain/timeline and gap/contradiction indicators.

**Backend work:** Ledger append/query/lineage and invariant validation.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Generates recommendation/lesson drafts; deterministic services append execution/payment facts.

**Workflow/job work:** Outbox append, projection, lineage validation, gap alerts.

**Connector work:** Capability-aware adapter work for provider; verify scopes, health, rate limits, idempotency, receipts, revoke/reconnect, and simulation boundaries before claiming support.

**Security considerations:** Append-only, idempotency, authorization per entry, no secret payloads.

**Analytics events:** `ledger_entry_created`, `lineage_gap_detected`, trace completion rate.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Golden-path and every terminal/failure path form valid, queryable lineage.

**Definition of done:** Golden-path and every terminal/failure path form valid, queryable lineage.

**Dependencies:** DOS-066.

**Risks:** Primary failure and trust risks: Broken lineage, missing receipt, delayed metric, duplicate webhook, projection lag. Security risks: Append-only, idempotency, authorization per entry, no secret payloads.

**Estimated complexity:** L

**Release wave:** Wave 1

---

## DOS-068 — Display freshness and contradictory evidence

**ID:** DOS-068

**Epic:** Evidence Ledger

**Feature:** Display freshness and contradictory evidence

**Priority:** P1

**Persona:** Content strategist

**User story:** As a content strategist, I want stale and contradictory evidence surfaced before reuse, so that published claims remain trustworthy.

**User problem:** Business facts change and multiple sources can disagree.

**Business outcome:** No material stale or contradicted assertion silently enters an approved asset.

**Preconditions:** Dependencies are satisfied; Editors view; authorized owner resolves material business truth.

**Main workflow:** New pricing conflicts with old profile; owner confirms new source and affected draft refreshes.

**Alternative workflows:** Time-scoped facts both valid; low-severity wording difference; unknown remains unresolved.

**Failure states:** Refresh blocked, source inaccessible, extraction ambiguity, user lacks permission.

**Acceptance criteria:** Freshness is policy-derived, not cosmetic; contradiction detector groups claims by entity/field/time and preserves both sources; severity and evidence shown; authoritative resolution requires user/provider evidence; dependent recommendations/assets become `review_required`; refresh, accept-temporary, and correct flows are audited.

**Permissions:** Editors view; authorized owner resolves material business truth.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Claims, normalized values, temporal validity, source authority, dependencies, resolution.

**Data produced:** Tenant-scoped durable records for display freshness and contradictory evidence, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Freshness badges, side-by-side evidence, affected-artifact list.

**Backend work:** Freshness/contradiction query, resolution command, dependency invalidation.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Proposes contradiction candidates and neutral summary; cannot select business truth.

**Workflow/job work:** Scheduled freshness scan and dependent-artifact invalidation.

**Connector work:** Capability-aware adapter work for provider; verify scopes, health, rate limits, idempotency, receipts, revoke/reconnect, and simulation boundaries before claiming support.

**Security considerations:** Treat sources as untrusted, prevent resolution through prompt injection.

**Analytics events:** `contradiction_detected/viewed/resolved`, stale-claim block rate.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Temporal, semantic, resolution, dependency, and permission fixtures pass.

**Definition of done:** Temporal, semantic, resolution, dependency, and permission fixtures pass.

**Dependencies:** DOS-011, DOS-028, DOS-066.

**Risks:** Primary failure and trust risks: Refresh blocked, source inaccessible, extraction ambiguity, user lacks permission. Security risks: Treat sources as untrusted, prevent resolution through prompt injection.

**Estimated complexity:** M

**Release wave:** Wave 2

---

## DOS-069 — Export auditable evidence records

**ID:** DOS-069

**Epic:** Evidence Ledger

**Feature:** Export auditable evidence records

**Priority:** P1

**Persona:** Workspace owner

**User story:** As a workspace owner, I want a portable audit export, so that I can verify, retain, or share the system's commercial record.

**User problem:** Trust depends on data portability and independent verification.

**Business outcome:** Authorized users can export a scoped, integrity-checkable record without leaking secrets or unrelated tenant data.

**Preconditions:** Dependencies are satisfied; Owner/auditor; finance/PII fields require corresponding role.

**Main workflow:** Owner exports one experiment's evidence-to-revenue chain and validates checksums.

**Alternative workflows:** JSON/CSV bundle; metadata-only due source restriction; legal hold.

**Failure states:** Oversized request, permission change, artifact unavailable, generation timeout, expired link.

**Acceptance criteria:** User selects time/types/artifacts/redaction; async export contains schema/version, entries, lineage, source metadata, checksums, omissions, and manifest; no OAuth tokens/raw secrets; CSV fields resist formula injection; download expires; export event audited; large exports paginate/checkpoint.

**Permissions:** Owner/auditor; finance/PII fields require corresponding role.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Export request/snapshot, authorized ledger/source records, manifest/checksums.

**Data produced:** Tenant-scoped durable records for export auditable evidence records, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Scope/redaction wizard, progress, omissions, expiring download.

**Backend work:** Export request/status/download and snapshot authorization.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** None required.

**Workflow/job work:** Durable streaming export, malware scan, expiry deletion.

**Connector work:** Capability-aware adapter work for Connector; verify scopes, health, rate limits, idempotency, receipts, revoke/reconnect, and simulation boundaries before claiming support.

**Security considerations:** Reauthorize at download, encryption, signed URL, redaction, tenant tests.

**Analytics events:** `evidence_export_requested/completed/downloaded/expired`.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Large, revoked-access, redaction, checksum, formula, and expiry tests pass.

**Definition of done:** Large, revoked-access, redaction, checksum, formula, and expiry tests pass.

**Dependencies:** DOS-065, DOS-066, DOS-067.

**Risks:** Primary failure and trust risks: Oversized request, permission change, artifact unavailable, generation timeout, expired link. Security risks: Reauthorize at download, encryption, signed URL, redaction, tenant tests.

**Estimated complexity:** M

**Release wave:** Wave 2

---

## DOS-070 — Execute external actions with durable idempotent jobs

**ID:** DOS-070

**Epic:** Distribution Fabric

**Feature:** Execute external actions with durable idempotent jobs

**Priority:** P0

**Persona:** Growth operator

**User story:** As a growth operator, I want approved actions executed by durable jobs with truthful states, so that retries never fabricate or duplicate external work.

**User problem:** Request-bound execution loses state and provider timeouts create duplicate or falsely successful actions.

**Business outcome:** Every attempt is recoverable, observable, idempotent, and reconciled to a provider receipt or explicit ambiguity.

**Preconditions:** Dependencies are satisfied; Worker receives short-lived scoped capability after execution-time policy check.

**Main workflow:** Approved send queues, worker reserves capability, provider returns receipt, projections update.

**Alternative workflows:** Simulation; scheduled job; partial multi-step; reconcile prior ambiguous attempt.

**Failure states:** Worker crash, rate limit, token expiry, provider timeout, policy revoke, receipt mismatch.

**Acceptance criteria:** State machine supports draft/awaiting approval/approved/queued/running/succeeded/failed/blocked/simulated/partial/reconnect/human-input; attempt persists before side effect; key scopes tenant+connector+action version; retry matrix distinguishes transient/permanent/ambiguous; leases/heartbeats recover crashes; provider receipt required for success; outbox prevents lost enqueue.

**Permissions:** Worker receives short-lived scoped capability after execution-time policy check.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Job/attempt/lease/checkpoint, action/version, idempotency key, receipt/error, outbox.

**Data produced:** Tenant-scoped durable records for execute external actions with durable idempotent jobs, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Live status timeline, retry/reconnect/human-input actions.

**Backend work:** Job commands/status/reconcile and transactional outbox.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Cannot set execution state; may explain classified errors.

**Workflow/job work:** Queue, lease, backoff+jitter, dead letter, reconciliation, projection.

**Connector work:** Capability-aware adapter work for provider, connector; verify scopes, health, rate limits, idempotency, receipts, revoke/reconnect, and simulation boundaries before claiming support.

**Security considerations:** Capability tokens, payload encryption/redaction, replay and confused-deputy protection.

**Analytics events:** `job_queued/started/succeeded/failed/blocked/reconciled`, duplicate rate.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Crash/race/timeout/replay/revoke/rate-limit chaos tests show no duplicate side effects.

**Definition of done:** Crash/race/timeout/replay/revoke/rate-limit chaos tests show no duplicate side effects.

**Dependencies:** DOS-061, DOS-063, DOS-066, DOS-073.

**Risks:** Primary failure and trust risks: Worker crash, rate limit, token expiry, provider timeout, policy revoke, receipt mismatch. Security risks: Capability tokens, payload encryption/redaction, replay and confused-deputy protection.

**Estimated complexity:** XL (split state/outbox/worker/reconcile/UI)

**Release wave:** Wave 1

---

## DOS-071 — Discover connectors and test declared capabilities

**ID:** DOS-071

**Epic:** Connectors

**Feature:** Discover connectors and test declared capabilities

**Priority:** P1

**Persona:** Workspace admin

**User story:** As a workspace admin, I want to see only genuinely supported connector capabilities and test them, so that plans never depend on marketing claims.

**User problem:** A connected logo does not prove that the required API, scope, or provider feature works.

**Business outcome:** Users plan against a runtime capability contract with verified health and mode.

**Preconditions:** Dependencies are satisfied; All view catalog; admin connects/tests; only platform release process marks support.

**Main workflow:** Admin tests Gmail send and reply-watch separately and sees both verified.

**Alternative workflows:** Read-only capability; sandbox-only; waitlist for planned connector.

**Failure states:** Provider degradation, removed scope, contract mismatch, test quota, regional restriction.

**Acceptance criteria:** Catalog distinguishes available/beta/planned/unavailable; manifest declares auth, scopes, read/write capabilities, webhooks, limits, compliance, retention, simulation, contract version, and test status; installation probe returns capability-level pass/warn/fail; unsupported calls reject before queue; last verified time visible.

**Permissions:** All view catalog; admin connects/tests; only platform release process marks support.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Connector manifest/version, installation, probes, status, limitations.

**Data produced:** Tenant-scoped durable records for discover connectors and test declared capabilities, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Capability matrix, mode/health/freshness, limitation disclosure.

**Backend work:** Catalog/manifest/probe APIs and adapter conformance interface.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Reads capability registry; never assumes from connector name.

**Workflow/job work:** Periodic probes within rate limits and change alerts.

**Connector work:** Capability-aware adapter work for connector, Connector, provider, Gmail, Provider; verify scopes, health, rate limits, idempotency, receipts, revoke/reconnect, and simulation boundaries before claiming support.

**Security considerations:** Safe non-destructive probes, no secret display, least-scope rationale.

**Analytics events:** `connector_viewed/capability_tested`, probe success and feature demand.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Manifest validation and provider sandbox contract tests gate support label.

**Definition of done:** Manifest validation and provider sandbox contract tests gate support label.

**Dependencies:** DOS-070, DOS-073.

**Risks:** Primary failure and trust risks: Provider degradation, removed scope, contract mismatch, test quota, regional restriction. Security risks: Safe non-destructive probes, no secret display, least-scope rationale.

**Estimated complexity:** M

**Release wave:** Wave 1

---

## DOS-072 — Handle rate limits and connector errors visibly

**ID:** DOS-072

**Epic:** Connectors

**Feature:** Handle rate limits and connector errors visibly

**Priority:** P0

**Persona:** Growth operator

**User story:** As a growth operator, I want provider limits and failures handled safely, so that work resumes without duplicates or hidden delays.

**User problem:** Blind retries amplify outages and can violate provider policies.

**Business outcome:** Connector reliability meets SLO while every delay or terminal failure is truthful.

**Preconditions:** Dependencies are satisfied; Operator views/retries allowed states; admin changes tenant-safe scheduling policy.

**Main workflow:** Rate-limited publish waits until provider reset then succeeds once.

**Alternative workflows:** User reschedules; circuit half-open probe; provider-specific remediation.

**Failure states:** Clock skew, missing retry header, shared quota exhausted, permanent policy rejection, outage.

**Acceptance criteria:** Normalize provider errors to auth/rate/transient/permanent/policy/ambiguous; honor retry headers; token-bucket limits apply per tenant/provider/capability; backoff+jitter has deadline/budget; circuit breaker protects outage; UI shows next retry and impact; manual retry cannot bypass limits; logs link provider request ID.

**Permissions:** Operator views/retries allowed states; admin changes tenant-safe scheduling policy.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Limit buckets, error taxonomy, attempts, provider IDs, retry/deadline.

**Data produced:** Tenant-scoped durable records for handle rate limits and connector errors visibly, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Error detail, retry countdown, impact and remediation.

**Backend work:** Adapter error contract, limiter and circuit status endpoints.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Explains normalized error only; cannot override limiter.

**Workflow/job work:** Fair queue, backoff, circuit breaker, dead letter.

**Connector work:** Capability-aware adapter work for connector, Connector, provider; verify scopes, health, rate limits, idempotency, receipts, revoke/reconnect, and simulation boundaries before claiming support.

**Security considerations:** Avoid provider error/secret leakage and retry-based abuse.

**Analytics events:** `connector_rate_limited/error/retry_scheduled`, recovery and saturation.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Fault/clock/concurrency/property tests verify fairness, caps, and no duplicate call.

**Definition of done:** Fault/clock/concurrency/property tests verify fairness, caps, and no duplicate call.

**Dependencies:** DOS-070, DOS-071.

**Risks:** Primary failure and trust risks: Clock skew, missing retry header, shared quota exhausted, permanent policy rejection, outage. Security risks: Avoid provider error/secret leakage and retry-based abuse.

**Estimated complexity:** L

**Release wave:** Wave 1

---

## DOS-073 — Connect, inspect, refresh, and disconnect services securely

**ID:** DOS-073

**Epic:** Connectors

**Feature:** Connect, inspect, refresh, and disconnect services securely

**Priority:** P0

**Persona:** Workspace admin

**User story:** As a workspace admin, I want to manage service authorization and health, so that external access remains intentional and recoverable.

**User problem:** Tokens expire, scopes drift, and disconnected integrations can leave unsafe queued work.

**Business outcome:** Every installation has explicit consent, least privilege, visible health, and a complete revocation path.

**Preconditions:** Dependencies are satisfied; Owner/admin manages; operators view capability/health, never credentials.

**Main workflow:** Admin authorizes scopes, verifies account, passes capability probes, later disconnects cleanly.

**Alternative workflows:** API key where provider requires; partial scopes; reconnect; credential rotation.

**Failure states:** CSRF mismatch, denied consent, refresh race, revoked token, provider revoke failure.

**Acceptance criteria:** OAuth uses state+PKCE and exact redirect; tokens encrypted by reference, refreshed with single-flight locking and rotation; scopes/account/mode/consent/health visible; expiry/revocation triggers reconnect state and blocks jobs; disconnect previews affected work, revokes provider token where possible, stops webhooks/sync, preserves required audit, and deletes credentials.

**Permissions:** Owner/admin manages; operators view capability/health, never credentials.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Installation/account, scope, consent, encrypted secret ref, health, webhook, retention.

**Data produced:** Tenant-scoped durable records for connect, inspect, refresh, and disconnect services securely, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Connect wizard, scope rationale, account confirmation, impact/reconnect.

**Backend work:** OAuth/callback/refresh/revoke, health, disconnect lifecycle.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** No access to raw tokens.

**Workflow/job work:** Refresh, health probe, webhook renew, disconnect compensation.

**Connector work:** Capability-aware adapter work for Connector, provider, connector; verify scopes, health, rate limits, idempotency, receipts, revoke/reconnect, and simulation boundaries before claiming support.

**Security considerations:** Vault/KMS, secret redaction, CSRF, redirect allowlist, audit.

**Analytics events:** `connector_connect_started/completed/failed/refreshed/disconnected`.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: OAuth threat-model and refresh/disconnect/race/provider-failure tests pass.

**Definition of done:** OAuth threat-model and refresh/disconnect/race/provider-failure tests pass.

**Dependencies:** DOS-061, DOS-066, DOS-076.

**Risks:** Primary failure and trust risks: CSRF mismatch, denied consent, refresh race, revoked token, provider revoke failure. Security risks: Vault/KMS, secret redaction, CSRF, redirect allowlist, audit.

**Estimated complexity:** L

**Release wave:** Wave 1

---

## DOS-074 — Inspect connector logs without exposing secrets

**ID:** DOS-074

**Epic:** Connectors

**Feature:** Inspect connector logs without exposing secrets

**Priority:** P1

**Persona:** Workspace admin

**User story:** As a workspace admin, I want searchable connector activity logs, so that I can diagnose failures without accessing credentials or unrelated tenant data.

**User problem:** Operational debugging either lacks detail or leaks raw payloads and secrets.

**Business outcome:** Most connector incidents are diagnosable from correlated, redacted metadata.

**Preconditions:** Dependencies are satisfied; Admin/auditor; support access is time-bound, consented, and audited.

**Main workflow:** Admin follows a failed send from job to provider error and reconnect action.

**Alternative workflows:** Support bundle with consent; aggregate health only for limited role.

**Failure states:** Logging pipeline delay, redaction failure, provider ID absent, retention expired.

**Acceptance criteria:** Logs include tenant-safe correlation, connector/capability, attempt, normalized state/error, latency, retry, provider request ID, and redacted request/response summary; secret/authorization/PII denylist enforced at write and display; sampling never drops errors; retention and export policy apply.

**Permissions:** Admin/auditor; support access is time-bound, consented, and audited.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Structured logs, correlations, redaction version, access/export audit.

**Data produced:** Tenant-scoped durable records for inspect connector logs without exposing secrets, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Filterable log viewer with copy-safe identifiers and delayed state.

**Backend work:** Scoped log query/export and redaction pipeline.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** May summarize already-redacted logs.

**Workflow/job work:** Indexing, retention, redaction canary, access expiry.

**Connector work:** Capability-aware adapter work for connector, Connector, provider; verify scopes, health, rate limits, idempotency, receipts, revoke/reconnect, and simulation boundaries before claiming support.

**Security considerations:** Write-time redaction, log-injection defense, minimum support access.

**Analytics events:** `connector_logs_viewed/exported`, incident diagnosis time.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Secret canary, tenant isolation, log injection, retention, and support-access tests pass.

**Definition of done:** Secret canary, tenant isolation, log injection, retention, and support-access tests pass.

**Dependencies:** DOS-065, DOS-070, DOS-073.

**Risks:** Primary failure and trust risks: Logging pipeline delay, redaction failure, provider ID absent, retention expired. Security risks: Write-time redaction, log-injection defense, minimum support access.

**Estimated complexity:** M

**Release wave:** Wave 1

---

## DOS-075 — Invite members and enforce role-based access

**ID:** DOS-075

**Epic:** Workspace management

**Feature:** Invite members and enforce role-based access

**Priority:** P0

**Persona:** Workspace owner

**User story:** As a workspace owner, I want to invite teammates into explicit roles, so that collaboration does not grant unnecessary commercial or customer access.

**User problem:** Shared credentials and coarse admin roles create approval and privacy risk.

**Business outcome:** Every workspace request and action is authorized by current membership and capability.

**Preconditions:** Dependencies are satisfied; Owner manages owners/admins; delegated admin within policy.

**Main workflow:** Owner invites content editor who can draft but not approve, send, view finance, or connect services.

**Alternative workflows:** Resend/revoke invite; custom role later; agency guest with workspace-only access.

**Failure states:** Expired/wrong-email invite, duplicate membership, last-owner removal, stale token.

**Acceptance criteria:** Invite is email-bound, single-use, expiring, revocable; roles include owner/admin/approver/operator/editor/sales/finance/analyst/viewer/auditor with composable capabilities; least privilege defaults; role changes invalidate sessions/capabilities and queued grants; last owner protected; member removal reassigns or blocks owned work.

**Permissions:** Owner manages owners/admins; delegated admin within policy.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** User/org/workspace/membership/role/capability, invite, session/version.

**Data produced:** Tenant-scoped durable records for invite members and enforce role-based access, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Team table, role matrix, invite/status/remove/reassign flow.

**Backend work:** Invite/membership/role commands and centralized authorization middleware.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** None grants access.

**Workflow/job work:** Invite email, expiry, access-revocation propagation.

**Connector work:** Capability-aware adapter work for Resend, provider; verify scopes, health, rate limits, idempotency, receipts, revoke/reconnect, and simulation boundaries before claiming support.

**Security considerations:** Enumeration prevention, session invalidation, confused deputy, audit.

**Analytics events:** `member_invited/joined/role_changed/removed`, invite conversion.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Role matrix, invite abuse, stale session, last-owner, and queue revocation tests pass.

**Definition of done:** Role matrix, invite abuse, stale session, last-owner, and queue revocation tests pass.

**Dependencies:** Identity-provider integration; no story dependency.

**Risks:** Primary failure and trust risks: Expired/wrong-email invite, duplicate membership, last-owner removal, stale token. Security risks: Enumeration prevention, session invalidation, confused deputy, audit.

**Estimated complexity:** L

**Release wave:** Wave 0

---

## DOS-076 — Prove tenant isolation at every boundary

**ID:** DOS-076

**Epic:** Security

**Feature:** Prove tenant isolation at every boundary

**Priority:** P0

**Persona:** Business owner

**User story:** As a business owner, I want my workspace data and actions isolated from every other tenant, so that I can trust the platform with commercial context.

**User problem:** One cross-tenant read, cache key, event, agent retrieval, or connector call is catastrophic.

**Business outcome:** Automated controls demonstrate zero cross-tenant access across UI, API, jobs, storage, logs, and AI.

**Preconditions:** Dependencies are satisfied; All access uses evaluated membership; break-glass is separate, time-bound, consent/audit controlled.

**Main workflow:** Identical resource IDs in two tenants return only the caller's authorized resource.

**Alternative workflows:** Explicit organization portfolio aggregate with per-workspace authorization.

**Failure states:** Missing tenant context, stale membership, poisoned cache, event misroute, support impersonation attempt.

**Acceptance criteria:** Tenant derives server-side from authenticated membership; every tenant table/index/key/object/event/job/trace includes tenant; repository API requires scope; database RLS targeted with PostgreSQL; caches and vectors partition; connector account binds tenant; platform support has no implicit access; cross-tenant adversarial suite runs in CI.

**Permissions:** All access uses evaluated membership; break-glass is separate, time-bound, consent/audit controlled.

**Approval requirements:** None for read-only analysis; any derived external side effect is a separate approval-gated action.

**Data required:** Tenant-scoped domain records, request/job actor context, authorization audit.

**Data produced:** Tenant-scoped durable records for prove tenant isolation at every boundary, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Workspace identity always visible; switch clears local state.

**Backend work:** Tenant-scoped repositories/middleware, RLS migration plan, key builders.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Retrieval/tool context hard-scoped outside prompts.

**Workflow/job work:** Tenant context signed in messages and validated by workers.

**Connector work:** Capability-aware adapter work for connector; verify scopes, health, rate limits, idempotency, receipts, revoke/reconnect, and simulation boundaries before claiming support.

**Security considerations:** Primary security invariant; fuzz/property tests and external review.

**Analytics events:** Security-only `tenant_scope_violation_blocked`; never product analytics payload.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Isolation matrix and penetration tests pass across every storage/execution surface.

**Definition of done:** Isolation matrix and penetration tests pass across every storage/execution surface.

**Dependencies:** DOS-075, centralized request context.

**Risks:** Primary failure and trust risks: Missing tenant context, stale membership, poisoned cache, event misroute, support impersonation attempt. Security risks: Primary security invariant; fuzz/property tests and external review.

**Estimated complexity:** XL (continuous control)

**Release wave:** Wave 0

---

## DOS-077 — Protect ingestion from SSRF, prompt injection, and poisoned content

**ID:** DOS-077

**Epic:** Security

**Feature:** Protect ingestion from SSRF, prompt injection, and poisoned content

**Priority:** P0

**Persona:** Platform administrator

**User story:** As a platform administrator, I want public-site ingestion isolated and bounded, so that a submitted URL cannot reach private systems or control agents.

**User problem:** Website ingestion crosses hostile network and content boundaries.

**Business outcome:** Unsafe targets/files/instructions are blocked and safe content is treated only as quoted evidence.

**Preconditions:** Dependencies are satisfied; Public submit is rate-limited; authenticated user creates workspace only after validation.

**Main workflow:** Bounded crawl of a normal public site stores sanitized, hashed evidence.

**Alternative workflows:** User pastes public text; crawl only homepage; allowed manual redirect confirmation.

**Failure states:** Private resolution, redirect to metadata, DNS change, oversized file, decompression bomb, prompt injection.

**Acceptance criteria:** HTTPS default; canonicalize and resolve DNS before each request/redirect; block loopback/private/link-local/reserved/metadata and rebinding; allow ports/types; cap redirects/pages/bytes/time/depth; sandbox parsing; malware/file rejection; strip active content; webpage instructions labeled untrusted and never enter system/tool prompt; robots/terms policy; egress logs and kill switch.

**Permissions:** Public submit is rate-limited; authenticated user creates workspace only after validation.

**Approval requirements:** None for read-only analysis; any derived external side effect is a separate approval-gated action.

**Data required:** Crawl request, DNS/redirect trace, policy decisions, response metadata/hash, rejection.

**Data produced:** Tenant-scoped durable records for protect ingestion from ssrf, prompt injection, and poisoned content, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Safe progress, exact blocked reason, retry/edit URL; no raw unsafe render.

**Backend work:** Isolated fetch service, DNS/IP validator, parser boundary, quotas.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Data/instruction separation, content delimiters, tool calls disabled during extraction.

**Workflow/job work:** Bounded crawl, cancellation, quarantine, safe cleanup.

**Connector work:** None; do not manufacture a connector dependency.

**Security considerations:** SSRF, injection, malware, poisoning, abuse, legal compliance.

**Analytics events:** `ingestion_security_blocked` by category, false-positive review rate.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: OWASP SSRF corpus, rebinding/redirect/file/injection fuzz and sandbox tests pass.

**Definition of done:** OWASP SSRF corpus, rebinding/redirect/file/injection fuzz and sandbox tests pass.

**Dependencies:** DOS-005, DOS-066, DOS-076.

**Risks:** Primary failure and trust risks: Private resolution, redirect to metadata, DNS change, oversized file, decompression bomb, prompt injection. Security risks: SSRF, injection, malware, poisoning, abuse, legal compliance.

**Estimated complexity:** L

**Release wave:** Wave 0

---

## DOS-078 — Export or delete workspace data safely

**ID:** DOS-078

**Epic:** Privacy and compliance

**Feature:** Export or delete workspace data safely

**Priority:** P1

**Persona:** Workspace owner

**User story:** As a workspace owner, I want to export or delete workspace data, so that I retain control over business and personal information.

**User problem:** Data lock-in and incomplete deletion undermine trust and legal compliance.

**Business outcome:** Portable exports and verified deletion complete within published SLA, subject to disclosed holds.

**Preconditions:** Dependencies are satisfied; Owner only for workspace; subject-request role for individual records.

**Main workflow:** Owner requests deletion, reconnects none, cooling period expires, and receives completion proof.

**Alternative workflows:** Cancel during cooling; delete one data class/lead; legal hold delays subset.

**Failure states:** Active billing dispute, revocation failure, storage deletion lag, backup expiry pending.

**Acceptance criteria:** Export inventory covers domain records/artifacts/config except secrets; deletion shows impact, requires reauth+typed confirmation and cooling period, cancels jobs/revokes connectors/deletes credentials, tombstones tenant, cascades primary/object/vector/cache data, preserves minimal legally required audit with anonymization/hold disclosure, and issues completion report; restore only during cooling period.

**Permissions:** Owner only for workspace; subject-request role for individual records.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Inventory, deletion/export request, holds, tasks, verification report.

**Data produced:** Tenant-scoped durable records for export or delete workspace data safely, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Inventory/impact, reauth, cooling countdown, status/report.

**Backend work:** Export/delete orchestration and per-store deletion adapters.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Memory/vector deletion participates; no retention exception by agent.

**Workflow/job work:** Revoke, cancel, cascade, verify, backup-expiry tracking.

**Connector work:** Capability-aware adapter work for connector; verify scopes, health, rate limits, idempotency, receipts, revoke/reconnect, and simulation boundaries before claiming support.

**Security considerations:** Destructive confirmation, recovery window, identity verification, audit minimization.

**Analytics events:** `data_export_requested`, `workspace_deletion_requested/cancelled/completed`.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Full store inventory and deletion/export/hold/failure recovery tests pass.

**Definition of done:** Full store inventory and deletion/export/hold/failure recovery tests pass.

**Dependencies:** DOS-069, DOS-073, DOS-075, DOS-076.

**Risks:** Primary failure and trust risks: Active billing dispute, revocation failure, storage deletion lag, backup expiry pending. Security risks: Destructive confirmation, recovery window, identity verification, audit minimization.

**Estimated complexity:** XL

**Release wave:** Wave 2

---

## DOS-079 — Prevent spam, abuse, and unsafe automation

**ID:** DOS-079

**Epic:** Trust and safety

**Feature:** Prevent spam, abuse, and unsafe automation

**Priority:** P0

**Persona:** Workspace owner

**User story:** As a workspace owner, I want outreach and publishing guardrails, so that growth work protects recipients, platforms, and my reputation.

**User problem:** Autonomous distribution can scale spam, deception, harassment, or platform abuse.

**Business outcome:** Prohibited actions are blocked before provider calls and complaint signals reduce autonomy.

**Preconditions:** Dependencies are satisfied; Safety rules non-overridable; trained admins review appeals; operators see remediation.

**Main workflow:** Consented lead receives one approved contextual reply and opt-out is honored.

**Alternative workflows:** Transactional email; manually initiated relationship follow-up; blocked action appealed.

**Failure states:** Unknown consent, suppression service unavailable, abuse evasion, sudden complaint spike.

**Acceptance criteria:** Prohibit purchased/scraped lists, fake engagement, deceptive claims, harassment, credential sharing, and mass unsolicited send; require source/consent/lawful basis and suppression/frequency checks; per-user/workspace/IP limits; content and recipient risk rules; complaint/bounce/provider-policy events trigger circuit breaker and autonomy downgrade; appeal and incident review audited.

**Permissions:** Safety rules non-overridable; trained admins review appeals; operators see remediation.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Consent/source, suppression, frequency, complaints/bounces, risk decision, appeal.

**Data produced:** Tenant-scoped durable records for prevent spam, abuse, and unsafe automation, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Clear block reason, safe alternative, complaint health, appeal flow.

**Backend work:** Abuse preflight, suppression and rate-limiting services, kill switch.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Classifier assists; deterministic hard rules and human review own decisions.

**Workflow/job work:** Reputation monitor, circuit breaker, quarantine, incident alert.

**Connector work:** Capability-aware adapter work for provider; verify scopes, health, rate limits, idempotency, receipts, revoke/reconnect, and simulation boundaries before claiming support.

**Security considerations:** Adversarial evasion, protected classes, reviewer privacy, platform terms.

**Analytics events:** `abuse_action_blocked/appealed`, complaints, bounces, autonomy downgrade.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Abuse/red-team corpus and suppression/outage/circuit-breaker E2Es pass.

**Definition of done:** Abuse/red-team corpus and suppression/outage/circuit-breaker E2Es pass.

**Dependencies:** DOS-045, DOS-061, DOS-063, DOS-070.

**Risks:** Primary failure and trust risks: Unknown consent, suppression service unavailable, abuse evasion, sudden complaint spike. Security risks: Adversarial evasion, protected classes, reviewer privacy, platform terms.

**Estimated complexity:** L

**Release wave:** Wave 1

---

## DOS-080 — Detect underperformance and generate bounded lessons

**ID:** DOS-080

**Epic:** Self-improvement

**Feature:** Detect underperformance and generate bounded lessons

**Priority:** P1

**Persona:** Growth operator

**User story:** As a growth operator, I want underperforming actions detected and translated into evidence-bound lessons, so that repeated work improves rather than merely repeats.

**User problem:** Teams repeat weak tactics or draw strong conclusions from noisy data.

**Business outcome:** Completed experiments produce a disposition and reusable, appropriately scoped lesson.

**Preconditions:** Dependencies are satisfied; Operator reviews; strategist/owner approves material learning application.

**Main workflow:** Variant misses lead threshold with adequate sample and becomes a scoped negative lesson.

**Alternative workflows:** Stop early for safety; instrumentation invalidates; extend window with approval.

**Failure states:** Missing denominator, contaminated cohorts, delayed conversions, changed goal, model failure.

**Acceptance criteria:** Evaluate against frozen hypothesis/metric/denominator/window/guardrails/kill rule; classify winning/losing/inconclusive/invalid; compare historical cohorts and uncertainty; lesson states what changed, scope, evidence, counterevidence, confidence, expiry, and next test; never generalize across audience/channel without evidence; user confirms durable strategy change.

**Permissions:** Operator reviews; strategist/owner approves material learning application.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Experiment snapshot/results, evidence, cohorts, lesson/version, review decision.

**Data produced:** Tenant-scoped durable records for detect underperformance and generate bounded lessons, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Result card, uncertainty, lesson editor, affected recommendations.

**Backend work:** Evaluation/lesson/proposal APIs with statistical utility.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Draft narrative after deterministic analysis; no silent graph mutation.

**Workflow/job work:** Window close evaluation, late-outcome revision, lesson expiry.

**Connector work:** None; do not manufacture a connector dependency.

**Security considerations:** No sensitive-segment conclusions; immutable prior versions.

**Analytics events:** `underperformance_detected`, `lesson_generated/confirmed/rejected/revised`.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Winner/loser/inconclusive/invalid/late-data fixtures and narrative evals pass.

**Definition of done:** Winner/loser/inconclusive/invalid/late-data fixtures and narrative evals pass.

**Dependencies:** DOS-040, DOS-054, DOS-067.

**Risks:** Primary failure and trust risks: Missing denominator, contaminated cohorts, delayed conversions, changed goal, model failure. Security risks: No sensitive-segment conclusions; immutable prior versions.

**Estimated complexity:** L

**Release wave:** Wave 2

---

## DOS-081 — Propose evidence-based strategy changes with approval

**ID:** DOS-081

**Epic:** Self-improvement

**Feature:** Propose evidence-based strategy changes with approval

**Priority:** P1

**Persona:** Founder

**User story:** As a founder, I want recurring patterns to produce reviewable strategy changes, so that the operating system compounds learning without rewriting my business autonomously.

**User problem:** Isolated lessons do not change decisions, while automatic strategy mutation is unsafe.

**Business outcome:** High-confidence patterns become versioned, approved changes and can be rolled back.

**Preconditions:** Dependencies are satisfied; System/strategist proposes; owner or strategic approver accepts.

**Main workflow:** Repeated high reply and conversion from one segment proposes raising its priority.

**Alternative workflows:** Accept as temporary test; reject with reason; ask for more evidence.

**Failure states:** Correlated samples, contradictory recent evidence, stale sources, no authorized owner.

**Acceptance criteria:** Pattern requires configured minimum independent experiments/time; proposal identifies affected profile/priority/channel/offer, evidence and counterexamples, expected impact, confidence, risks, diff, expiry, and validation plan; owner approval required for material change; creates new graph/strategy version; prior recommendations are re-evaluated; rollback preserves history.

**Permissions:** System/strategist proposes; owner or strategic approver accepts.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Lessons, experiments, graph/strategy versions, proposal/approval/outcome.

**Data produced:** Tenant-scoped durable records for propose evidence-based strategy changes with approval, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Proposal comparison, evidence matrix, approval and rollback.

**Backend work:** Pattern aggregation, strategy diff/apply/rollback APIs.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Finds candidates and drafts rationale; deterministic thresholds and versioning control apply.

**Workflow/job work:** Periodic pattern scan and downstream invalidation/recompute.

**Connector work:** None; do not manufacture a connector dependency.

**Security considerations:** Poisoning resistance, diversity checks, no protected-trait strategy.

**Analytics events:** `strategy_change_proposed/approved/rejected/rolled_back`, post-change lift.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Sample-independence, approval, version, rollback, and downstream tests pass.

**Definition of done:** Sample-independence, approval, version, rollback, and downstream tests pass.

**Dependencies:** DOS-059, DOS-068, DOS-080.

**Risks:** Primary failure and trust risks: Correlated samples, contradictory recent evidence, stale sources, no authorized owner. Security risks: Poisoning resistance, diversity checks, no protected-trait strategy.

**Estimated complexity:** L

**Release wave:** Wave 2

---

## DOS-082 — Receive actionable, preference-aware notifications

**ID:** DOS-082

**Epic:** Notifications

**Feature:** Receive actionable, preference-aware notifications

**Priority:** P1

**Persona:** Growth operator

**User story:** As a growth operator, I want timely notifications for decisions, failures, leads, and revenue, so that I act before value or trust decays.

**User problem:** Silent blockers lose conversions; noisy alerts train users to ignore the system.

**Business outcome:** Critical items meet notification SLO and users can reach the resolving action directly.

**Preconditions:** Dependencies are satisfied; Only recipients with current artifact access; access rechecked on open.

**Main workflow:** Qualified reply alerts assignee and opens the correlated conversation.

**Alternative workflows:** Daily digest; backup approver escalation; email delivery failure remains in-app.

**Failure states:** Missing recipient, invalid timezone, provider bounce, duplicate storm, stale deep link.

**Acceptance criteria:** Typed severity for approval, blocked/failed job, reconnect, high-intent lead, reply, payment, discrepancy, safety, and learning; in-app first plus verified email; dedupe/grouping, quiet hours, timezone, per-type preferences, escalation, read/resolve links; no sensitive content in lock-screen/email subject; delivery state visible.

**Permissions:** Only recipients with current artifact access; access rechecked on open.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Notification/type/subject, recipient preference, delivery attempts, resolution.

**Data produced:** Tenant-scoped durable records for receive actionable, preference-aware notifications, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Notification center, badges, preference matrix, grouped mobile cards.

**Backend work:** Notification preferences, inbox, delivery and acknowledgement APIs.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** May summarize authorized evidence; templates own sensitive-field rules.

**Workflow/job work:** Fan-out, dedupe, quiet-hour schedule, escalation, retry.

**Connector work:** Capability-aware adapter work for provider; verify scopes, health, rate limits, idempotency, receipts, revoke/reconnect, and simulation boundaries before claiming support.

**Security considerations:** No PII leakage, unsubscribe for optional email, signed expiring links.

**Analytics events:** `notification_sent/opened/resolved/muted`, time-to-resolution.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Dedupe, access revoke, quiet-hour, bounce, escalation, and accessibility tests pass.

**Definition of done:** Dedupe, access revoke, quiet-hour, bounce, escalation, and accessibility tests pass.

**Dependencies:** DOS-045, DOS-062, DOS-070, DOS-075.

**Risks:** Primary failure and trust risks: Missing recipient, invalid timezone, provider bounce, duplicate storm, stale deep link. Security risks: No PII leakage, unsubscribe for optional email, signed expiring links.

**Estimated complexity:** M

**Release wave:** Wave 1

---

## DOS-083 — Understand and control billing and AI usage

**ID:** DOS-083

**Epic:** Billing and usage

**Feature:** Understand and control billing and AI usage

**Priority:** P1

**Persona:** Workspace owner

**User story:** As a workspace owner, I want transparent plan limits, usage, and spend controls, so that Distribution OS creates value within a predictable cost.

**User problem:** Hidden model, crawl, storage, and connector usage damages trust and margin.

**Business outcome:** Customers understand current consumption and never incur platform overage outside chosen policy.

**Preconditions:** Dependencies are satisfied; Owner/billing admin manages; members view allowance relevant to tasks.

**Main workflow:** Owner sees monthly usage, sets hard AI cap, and receives threshold alert.

**Alternative workflows:** Trial, prepaid credits, agency pooled plan with workspace allocation.

**Failure states:** Meter lag, duplicate event, billing webhook delay, cap race, payment failure.

**Acceptance criteria:** Meter tenant usage by billable unit/version; estimate before costly run; hard/soft caps and alerts; separate customer campaign budget from platform subscription; Stripe billing webhooks verified; invoice/plan/status visible; downgrade grace and read-only behavior defined; disputes/credits append; AI run exposes token/model/cost without hidden chain-of-thought.

**Permissions:** Owner/billing admin manages; members view allowance relevant to tasks.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Plan/entitlement, meter events, aggregation, limits, invoice/subscription/customer refs.

**Data produced:** Tenant-scoped durable records for understand and control billing and ai usage, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Usage dashboard, estimate, cap settings, plan/payment state.

**Backend work:** Meter, entitlement, limit, Stripe Billing webhook and portal contracts.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Model gateway emits immutable usage; router respects cost policy.

**Workflow/job work:** Aggregate/reconcile meters, alerts, entitlement transitions.

**Connector work:** Capability-aware adapter work for connector, Stripe, provider; verify scopes, health, rate limits, idempotency, receipts, revoke/reconnect, and simulation boundaries before claiming support.

**Security considerations:** Signed billing webhooks, no card data storage, atomic quota, invoice privacy.

**Analytics events:** `usage_viewed/cap_set/cap_blocked`, trial conversion, gross margin.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Meter replay/concurrency/reconciliation/cap/downgrade/provider fixtures pass.

**Definition of done:** Meter replay/concurrency/reconciliation/cap/downgrade/provider fixtures pass.

**Dependencies:** DOS-048, DOS-060, DOS-063, DOS-070.

**Risks:** Primary failure and trust risks: Meter lag, duplicate event, billing webhook delay, cap race, payment failure. Security risks: Signed billing webhooks, no card data storage, atomic quota, invoice privacy.

**Estimated complexity:** L

**Release wave:** Wave 3

---

## DOS-084 — Operate the platform with safe administration controls

**ID:** DOS-084

**Epic:** Administration

**Feature:** Operate the platform with safe administration controls

**Priority:** P1

**Persona:** Distribution OS administrator

**User story:** As a platform administrator, I want health, feature, incident, and support controls without ambient tenant access, so that I can operate the service safely.

**User problem:** Production operations need intervention, but broad administrator access creates severe trust risk.

**Business outcome:** Incidents are mitigated within SLO using narrow, audited controls.

**Preconditions:** Dependencies are satisfied; Dedicated platform roles with hardware-backed MFA and separation of duties.

**Main workflow:** Admin disables a failing connector capability globally and affected tenants see truthful blocked status.

**Alternative workflows:** Workspace-scoped flag; consented read-only support session; replay dead-letter event.

**Failure states:** Flag propagation lag, approval unavailable, support session expiry, replay conflict.

**Acceptance criteria:** Admin console shows aggregate SLO/queues/connectors/model/cost/abuse; feature flags and connector kill switches are scoped/versioned/rollbackable; support access requires ticket, tenant consent where possible, role approval, reason, expiry, watermark, and audit; break-glass pages security and never reveals secrets; replay/reconcile tools are idempotent; tenant impersonation disabled by default.

**Permissions:** Dedicated platform roles with hardware-backed MFA and separation of duties.

**Approval requirements:** Required when the action is externally visible, sends a message, spends money, changes governance, or crosses the story-specific policy boundary; the approved payload and expiry are immutable.

**Data required:** Operational aggregates, flags, incidents, support grants/sessions, admin audit.

**Data produced:** Tenant-scoped durable records for operate the platform with safe administration controls, plus the audit and analytics events named below; simulated output is labeled and never becomes verified truth.

**Frontend work:** Operational dashboards, impact preview, approval and session banner.

**Backend work:** Separate admin plane, flag/kill/replay/support-grant APIs.

**Database work:** Use workspace-scoped keys and indexed queries; mutations require timestamps, constraints, idempotency or optimistic concurrency as applicable, and append-only evidence/audit linkage.

**AI/agent work:** Operational summaries use aggregate/redacted data; no autonomous admin actions.

**Workflow/job work:** Flag propagation, support expiry, incident notifications, replay.

**Connector work:** Capability-aware adapter work for connector; verify scopes, health, rate limits, idempotency, receipts, revoke/reconnect, and simulation boundaries before claiming support.

**Security considerations:** Separate identity/audience, MFA, IP/device policy, tamper alerts, least access.

**Analytics events:** Security-only `admin_action`, SLO/MTTR; exclude tenant product analytics.

**Observability:** Emit correlated structured logs, latency/success/failure counters, state-transition metrics, and an alert or operator-visible blocker for persistent failures; never log secrets or raw sensitive payloads.

**Automated tests:** Automate the stated acceptance and failure paths, permissions, tenant isolation, state transitions, and regression behavior. Existing ticket-specific gate: Privilege, approval, expiry, flag rollback, replay, and external security review pass.

**Definition of done:** Privilege, approval, expiry, flag rollback, replay, and external security review pass.

**Dependencies:** DOS-065, DOS-070, DOS-074, DOS-076.

**Risks:** Primary failure and trust risks: Flag propagation lag, approval unavailable, support session expiry, replay conflict. Security risks: Separate identity/audience, MFA, IP/device policy, tamper alerts, least access.

**Estimated complexity:** XL

**Release wave:** Wave 3
