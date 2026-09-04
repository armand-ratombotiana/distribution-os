---
name: Bug report
about: Report something that is broken or behaves incorrectly
title: "bug: <short summary>"
labels: ["bug", "triage"]
assignees: []
---

## Summary

<!-- One or two sentences describing what is wrong. -->

## Expected behaviour

<!-- What you expected to happen. -->

## Actual behaviour

<!-- What actually happened. Include error messages, stack traces, or
     unexpected state changes. -->

## Steps to reproduce

1.
2.
3.

<!-- A minimal reproduction is the fastest path to a fix. If you can
     share a failing `tests/*.test.ts` case or a curl recipe, please do.
     Redact any secrets, workspace ids, or PII before pasting. -->

## Environment

- Distribution OS version / commit: <!-- e.g. `0.1.0` / `abc1234` -->
- Environment: <!-- `local` | `preview` | `production` -->
- Browser (if UI): <!-- e.g. Chrome 130, Safari 17 -->
- Node version: <!-- e.g. `22.13.0` -->
- Operating system: <!-- e.g. macOS 14, Ubuntu 24.04 -->

## API response (if applicable)

<!-- For backend bugs, paste the relevant request and response. Redact
     `OPENAI_API_KEY`, webhook secrets, and any `oai-authenticated-*`
     headers. -->

```http
POST /api/mission
Content-Type: application/json

{ "url": "https://example.com" }
```

```json
{
  "error": { "type": "internal", "message": "…" }
}
```

## Logs / audit trail

<!-- If you have access to the audit_events row id, agent_run id, or
     worker trace id, paste it here. Do NOT paste raw audit_events rows
     — they may contain IP hashes or PII projections. -->

## Severity

- [ ] Blocker — production is down or data is being lost.
- [ ] High — core flow broken, no workaround.
- [ ] Medium — feature broken, workaround exists.
- [ ] Low — cosmetic or edge case.

## Regression?

<!-- Was this working before? If so, in which version / commit? -->

## Additional context

<!-- Screenshots, related issues, anything else. -->
