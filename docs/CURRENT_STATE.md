# Distribution OS: Current State

Last verified: 2026-09-06.

This document is the authority for claims about what the repository actually does today. Architecture and API documents may also describe target-state components; those are not proof of a runtime capability.

## Product thesis

Distribution OS exists to compress the path from a founder’s public website to the first attributable, provider-verified payment. The product optimizes for truth, learning speed, and reversible decisions—not output volume, dashboards, or anthropomorphic agent activity.

The domain hierarchy is:

`Organization → Workspace → Mission → Strategy version → Experiment → Action → Touchpoint → Evidence → Outcome`

The operating loop is:

`observe → decide → approve → act → measure → learn`

Three distinctions are non-negotiable:

1. Observed facts, model inferences, and provider-verified outcomes are different evidence states.
2. Preparing an action, approving its exact payload, executing it, and observing its result are different events.
3. Simulation, AI synthesis, and real external execution must never share a misleading status label.

## Verified in the current slice

### URL to durable mission graph

- Public URLs are validated against private-network and redirect abuse.
- Fetched HTML is sanitized and bounded before entering a model prompt.
- Live and simulation mission documents use the same strict schema.
- The server assigns mission identifiers; callers and model output cannot choose them.
- Mission creation writes the mission, lifecycle events, a completed synthesis run, website evidence, inferred assumptions, mission and strategy versions, experiments, content drafts, and one prepared action.
- Artifact persistence is compensating rather than fully transactional: if a downstream artifact write fails, the newly created mission graph is deleted and the request fails.

### Governed lifecycle

- The canonical six-stage lifecycle includes the explicit `approve` stage.
- Stage advancement uses server-side readiness queries.
- Approval requires an unexpired prepared action and records the approving identity.
- The `act` and `measure` boundaries require executed actions and measurement signals respectively.
- Compare-and-swap stage updates prevent two callers from silently applying the same transition.

### Tenant and execution safety

- Mission creation cannot reassign an existing mission identifier to another workspace.
- Workspace initialization no longer claims legacy rows with a null workspace owner.
- Mission event streams require identity and re-check workspace ownership while polling.
- Connector setup requests cannot self-declare a connector connected.
- Approved `send_email` actions can execute through the real Resend HTTPS API only when the requested connector, server credential, exact tenant, exact sender, and recipient sandbox allowlist all match.
- The Resend boundary re-checks the immutable payload hash, quiet hours, configured claims, budgets, and rolling 24-hour action limit before any network call.
- Execution attempts are persisted before submission with a database-unique idempotency key; the same key is sent to Resend. Confirmed, definitive-failure, and ambiguous outcomes remain distinct.
- Signed Resend webhooks are verified from their raw bodies and deduplicated by `svix-id`. Events matching a persisted succeeded attempt are linked to the provider request, action, mission, touchpoint, and evidence ledger. Signed events arriving before that attempt are safely persisted as unmatched (`action_id` null) and reconciled when the successful attempt is persisted or the provider redelivers. Only `email.delivered` becomes verified delivery evidence.
- Every other outbound action type remains fail-closed with `501`.
- Data-deletion audit events are created only after the deletion batch succeeds.

### Revenue truth

- Only Stripe is accepted by the generic webhook route.
- Stripe signatures are verified before processing.
- Payment events require explicit workspace metadata; there is no shared “unattributed” tenant.
- Optional mission, action, and experiment references are validated against that workspace.
- Recognized payment events persist amounts, currency, status, attribution metadata, and update the mission’s succeeded-payment count.
- Persistence failures bubble to Stripe as a non-success response so delivery can be retried.

### Workspace UI and tooling

- Actions, evidence, experiments, content, revenue, contacts, run telemetry, and settings render from authenticated APIs.
- Preview and simulation are labelled as such; “running” and revenue states are not fabricated.
- Default build, lint, test, dev, and start commands use a cross-platform Node launcher.

## Intentionally blocked or incomplete

These are product gaps, not hidden successes:

- The deployed adapter is disabled until an operator supplies a sending-only Resend key, webhook secret, exact workspace id, exact sender, and sandbox recipient allowlist. No credential is committed to this repository.
- Resend is the only outbound adapter. Social, ad, CRM, batch email, HTML email, attachment, and publishing actions remain blocked.
- The 15-agent registry is a conceptual scheduling model. Mission synthesis is currently one validated model request represented as one recorded synthesis run, not 15 independently executing agents.
- There is no durable background job/lease runtime driving the lifecycle without a request.
- Connector catalog entries and setup records are not OAuth installations and do not prove account health.
- Action preparation deduplication is still checked in application code, but outbound execution now has a database-enforced unique idempotency key.
- Mission graph creation uses compensation, not one D1 transaction spanning every artifact.
- Stripe ingestion supports the selected event families, but full customer/touchpoint lineage, refund reconciliation to the original charge, and unit-economics reporting are incomplete.
- The Versions workspace view does not yet load its canonical API.
- Delivery webhooks prove mail-server delivery, opens and clicks, but replies and conversion attribution still require a correlation design beyond the narrow adapter.

## Next best implementation wave

Activate and prove the Resend sandbox with operator-supplied secrets, then add durable jobs/leases for retries and webhook reconciliation. After provider acceptance and signed delivery are observed in production, add reply correlation and conversion attribution to the originating experiment. Breadth should follow proof of that golden path, not precede it.
