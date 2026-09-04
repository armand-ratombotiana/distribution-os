---
name: Feature request
about: Suggest a new capability or an improvement to an existing one
title: "feat: <short summary>"
labels: ["enhancement", "triage"]
assignees: []
---

## Problem

<!-- What is the user / operator trying to accomplish that the product
     currently does not support, or supports poorly? Frame this as the
     user's goal, not the proposed solution. -->

## Proposed solution

<!-- Describe the desired behaviour or capability. Include a concrete
     example (curl recipe, UI mockup, sample API response) whenever
     possible. -->

## Alternatives considered

<!-- What other ways could this be solved? Why are they worse? Include
     "do nothing" as one of the alternatives. -->

## API surface (if applicable)

<!-- If this needs a new endpoint or a change to an existing one,
     sketch the route, method, request and response shapes. -->

```http
<METHOD> /api/<resource>

{ "request": "shape" }
```

```json
{ "response": "shape" }
```

## Data model (if applicable)

<!-- New table / column / index? Sketch the Drizzle definition. Call
     out any FK-safe deletion-order implications for
     `POST /api/data-deletion`. -->

## Security & compliance review

- [ ] New outbound HTTP requests will go through `validatePublicUrl` +
      `fetchWithRedirectLimit` from `lib/url-safety.ts`.
- [ ] New external-content ingestion will run through
      `lib/content-sanitize-pure.ts` before reaching the model.
- [ ] New mutating endpoints will write a best-effort `audit_events`
      row.
- [ ] GDPR-sensitive fields will be projected through a
      `summarizeForDisplay` redactor before being returned.
- [ ] Brand-safety claims will be re-checked against
      `lib/brand-safety-pure.ts`.
- [ ] New budget-affecting spend will be gated by
      `workspace_settings` + `lib/budget-pure.ts`.

## Pure-module plan

<!-- New business logic should live in a `lib/*-pure.ts` module with a
     sibling `tests/*.test.ts`. List the modules you expect to add or
     touch. -->

- `lib/<name>-pure.ts` (new) —
- `tests/<name>.test.ts` (new) —
- `db/<name>-pure.ts` (if D1 access patterns change) —

## Workload estimate

<!-- Rough t-shirt size: S (< 1 day), M (1-3 days), L (> 3 days). -->

## Acceptance criteria

- [ ]
- [ ]
- [ ]

## Additional context

<!-- Screenshots, links to related issues, prior art, etc. -->
