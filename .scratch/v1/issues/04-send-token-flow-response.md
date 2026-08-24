# 04 — Send with Token flow and basic response

**What to build:** The user presses Send and sees the backend's answer — the app becomes useful here. The engine orchestrates the pipeline: if the effective URL is Apigee-prefixed (same derivation as the indicator, so behavior and indicator can never disagree), first generate a fresh Token — GET, no body, to `https://api-{env}-openapi.cloudready-nonprod.cloud.si.orange.es/token` with exactly the nine headers from the spec (`x-forwarded-server`, `service`, `accept`, `Content-Type`, `z-document`, `z-logintype`, `z-login`, `z-brand`, `x-wassup-lra`, with Document ID filling `z-document` and `z-login`) — take `Token-JWT` from its response and send it verbatim (no `Bearer` prefix) as the `Authorization` header of the Resource request. Zuul-prefixed URLs send token-free with no extra headers. No Token caching: fresh per send.

The response panel below the header shows the outcome: HTTP status code color-coded by class, response time in ms, and the raw body in a scrollable area. A failed Token generation aborts the Resource call and shows the *token endpoint's* response in the same panel, clearly labeled, so auth failures are distinguishable from Resource failures. All requests go through the Rust command with a 30-second timeout.

**Blocked by:** 03 — Header panel and URL composition.

**Status:** ready-for-agent

- [ ] Send on an Apigee URL performs Token request then Resource request, in order, with the exact specified headers
- [ ] `Token-JWT` value is forwarded verbatim as `Authorization` (no prefix)
- [ ] Send on a Zuul-prefixed URL (e.g. hand-edited) performs no Token request
- [ ] Response panel shows color-coded status, duration and scrollable raw body
- [ ] Token failure aborts the Resource call and displays the token endpoint's response, labeled as such
- [ ] Engine tests with fake transport cover ordering, headers, verbatim Authorization, Zuul token-free path and Token-failure abort
