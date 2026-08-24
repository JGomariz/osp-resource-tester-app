# 04 — Send with Token flow and basic response

**What to build:** The user presses Send and sees the backend's answer — the app becomes useful here. The engine orchestrates the pipeline: if the effective URL is Apigee-prefixed (same derivation as the indicator, so behavior and indicator can never disagree), first generate a fresh Token — GET, no body, to `https://api-{env}-openapi.cloudready-nonprod.cloud.si.orange.es/token` with exactly the nine headers from the spec (`x-forwarded-server`, `service`, `accept`, `Content-Type`, `z-document`, `z-logintype`, `z-login`, `z-brand`, `x-wassup-lra`, with Document ID filling `z-document` and `z-login`) — take `Token-JWT` from its response and send it verbatim (no `Bearer` prefix) as the `Authorization` header of the Resource request. Zuul-prefixed URLs send token-free with no extra headers. No Token caching: fresh per send.

The response panel below the header shows the outcome: HTTP status code color-coded by class, response time in ms, and the raw body in a scrollable area. A failed Token generation aborts the Resource call and shows the *token endpoint's* response in the same panel, clearly labeled, so auth failures are distinguishable from Resource failures. All requests go through the Rust command with a 30-second timeout.

**Blocked by:** 03 — Header panel and URL composition.

**Status:** done

- [x] Send on an Apigee URL performs Token request then Resource request, in order, with the exact specified headers
- [x] `Token-JWT` value is forwarded verbatim as `Authorization` (no prefix)
- [x] Send on a Zuul-prefixed URL (e.g. hand-edited) performs no Token request
- [x] Response panel shows color-coded status, duration and scrollable raw body
- [x] Token failure aborts the Resource call and displays the token endpoint's response, labeled as such
- [x] Engine tests with fake transport cover ordering, headers, verbatim Authorization, Zuul token-free path and Token-failure abort

## Comments

**2026-08-24 (agent):** Implemented test-first in `src/engine/sendFlow.ts` (12 tests). Decisions:

- **The Gateway decision reuses `gatewayIndicator(state.url)`** rather than the Catalog's declared Gateway, exactly as the ticket asks — so the indicator on screen and the requests actually made cannot disagree, including after a hand-edit. A consequence worth knowing: the Catalog's `gateway` field now only picks the *base* at composition time; once a URL exists, the URL decides.
- **What counts as a failed Token generation**: a non-2xx status, a body that is not JSON, or JSON without a non-empty `Token-JWT` string. All three abort before the Resource call and surface the token endpoint's own status, duration and body under a label saying it is the token endpoint answering, not the Resource. A non-2xx token answer is a failure *even if* it carries a JWT — using a token the endpoint rejected would only produce a confusing second failure.
- **The token endpoint's Environment comes from the dropdown, not the URL.** With a hand-edited URL pointing at another Environment's Apigee host, the Token is still generated for the selected Environment. That follows the spec's two explicit rules (token URL from the selected Environment; no back-parsing of the URL) but it is a real edge: hand-editing across Environments needs the dropdown moved too.
- **`network-error` is deliberately unclassified here.** A rejecting transport returns the raw message so the app cannot crash on a failed request; ticket 06 owns turning it into plain Spanish (timeout / DNS / refused / TLS).
- **A stale-response guard was added in `App.tsx`.** The tree stays clickable during a send, so an in-flight answer could otherwise land under a different Resource's name. A send-sequence ref discards answers whose Resource is no longer selected. Found while reviewing this ticket's own work, not in the ticket.
- `skipTlsVerification` is hard-coded false, which is the documented launch default; ticket 06 adds the toggle.

Verified: `npm run typecheck`, `npm test` (70 tests, up from 58), `npm run build`, `cargo test` (3 tests), and `npm run tauri dev` running clean with HMR picking up both edited files.

**Ticket 01 left the frontend→Rust chain "proven by construction, not end-to-end" and pointed here.** Closing that as far as automation allows: a throwaway harness (deleted) ran the real pipeline against a local `node:http` server through a `fetch`-based transport that rewrote only the host, so the engine's genuine `https://api-…` URLs still derived as Apigee. Observed on the wire: `/token` first, then `/jwt/crbproductinventory/v1/lines?docId=12345678Z`; all nine token headers present and exact; `authorization: real.jwt.value` with no prefix. Every link is now covered — engine orchestration over real HTTP, `send`'s own Rust smoke test, and the serde casing tests — **except the webview→Rust IPC hop itself**, which needs UI automation the repo does not have. The seven response-panel states were checked as rendered markup. No screenshot: screen-recording permission is not granted to the agent's process.
