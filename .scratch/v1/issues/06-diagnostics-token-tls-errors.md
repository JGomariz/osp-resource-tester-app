# 06 — Diagnostics: Token inspector, TLS toggle, error clarity

**What to build:** When things fail, the user can tell why. Three pieces:

1. **Token inspector** — a collapsible area showing the last Token obtained (for the current session), with a copy button, so authentication can be debugged or the Token reused elsewhere.
2. **Skip-TLS toggle** — an off-by-default, session-scoped switch ("omitir verificación TLS") that makes the Rust command accept invalid certificates, for broken non-production certs. Resets to off on every launch.
3. **Error clarity** — network-level failures are classified and reported in plain Spanish in the response panel, visually distinct from HTTP responses: timeout (30 s), unreachable host / DNS failure (suggesting VPN), connection refused, and TLS errors (suggesting the toggle). Non-2xx HTTP responses keep rendering like any response — body, status, duration — never as app errors.

**Blocked by:** 04 — Send with Token flow and basic response.

**Status:** done

- [x] Last Token visible in a collapsible area and copyable; empty state before any Apigee send
- [x] TLS toggle off by default, effective when on, and reset on relaunch
- [x] Timeout, DNS/unreachable, connection-refused and TLS failures each produce a distinct, plain-Spanish message
- [x] TLS failure message points at the toggle; unreachable-host message points at the VPN
- [x] Non-2xx responses render as normal responses, not as errors
- [x] Engine tests cover the error classification from transport failures

## Comments

**2026-08-24 (agent):** Implemented test-first in `src/engine/diagnostics.ts` (8 new tests), with 9 more added to `sendFlow.test.ts` (21 in total) and 2 to `http.test.ts` (4 in total). The Rust side gained one wire-shape unit test and one integration test, the latter proving a real failure's cause chain and verdict survive the trip to the frontend. Decisions:

- **The failure text had to be fixed in Rust before anything could be classified.** reqwest 0.12's `Display` prints one frame — `error sending request for url (…)` — and stops, so every failure reached the frontend saying nothing about its cause. `http_send` now returns `HttpSendError { message, timedOut, failedToConnect }`, where the message is the whole cause chain joined. Reporting the chain is transport work, not domain logic; naming the failure in Spanish stays in the engine.
- **The two booleans are reqwest's own verdicts** (`is_timeout`, `is_connect`), carried because message text alone is not enough. Provoking real failures showed a genuine TLS handshake error reading `client error (Connect): record overflow` — no "TLS", no "certificate", nothing to match on. Over https, a connection that never opened and matches none of the known causes is the secure channel failing, which is the one case the toggle answers, so it is diagnosed as TLS rather than shrugged at.
- **Classification patterns come from captured strings, not guesses.** Real chains for timeout, DNS failure, connection refused, self-signed and expired certificates were captured by provoking each against a local server and badssl.com, and are the fixtures in `diagnostics.test.ts`. Wordings for the platforms not to hand (Windows schannel, OpenSSL) are matched too and labelled as such.
- **The URL decides only whether TLS was in play.** Both requests of a send share a scheme — the token endpoint is https, like the Apigee URL that asks for it — so the URL field answers that question correctly whichever of the two failed.
- **The skip-TLS toggle covers the Token request as well as the Resource request.** A broken certificate on the token endpoint would otherwise block the send before the Resource is ever reached. It lives in App state with no persistence, so "off on launch" holds by construction rather than by a reset.
- **The Token is reported by the outcome, and the session keeps it.** `lastTokenAfter` mirrors `responseViewFor`: a send that generated no Token (Zuul, or a token failure) leaves the previous one standing. A `network-error` outcome carries the Token too — when the Token was obtained and the Resource call then fell over is exactly when the user wants to see it.
- **A failure is drawn as a diagnosis, not as a response**: slate rather than any status colour, no status code, no duration, with the transport's own words behind a "Detalle técnico" disclosure. Non-2xx responses were already ordinary responses and stay that way.

**2026-08-24 (agent, after review):** Both review axes ran. Changes made in response:

- **A reset connection is no longer inferred as TLS.** The https-connect inference was claiming any unrecognised connect failure, including `connection reset by peer` — a firewall or proxy in the path, which turning certificate checks off cannot help. Reset, `reset by peer` and `broken pipe` are now named causes that fall through to the generic message.
- **A timeout is also read from the words**, not only from the transport's verdict. `transportFailureFrom` deliberately supports a verdict-less rejection, and on that path a real timeout was losing the "30 segundos" wording the ticket asks for.
- **The copy button no longer fails silently.** `navigator.clipboard` needs a secure context, which the packaged app's custom-scheme origin is not guaranteed to be, so a select-and-`execCommand` fallback was added and the button now reports "No se pudo copiar" when both routes fail. The text stays selectable by hand either way.
- **The Token inspector moved out of the Resource panel** into the main area, so a Token that belongs to the session stays reachable when an undefined Service or Resource is selected — and one prop-drilling hop disappeared with it.
- **The `network-error` outcome now holds the `NetworkFailure` object** instead of re-declaring its three fields flat and copying them across one by one.
- **The Rust unit test on the private `cause_chain` helper was dropped**, along with its ~25-line test double: the integration test already proves a real failure's chain survives through the public `send`, and the spec asks for no assertions on internal structure.

Declined, with reasons: **prop drilling through `MainPanel`** for the TLS toggle follows the pattern every existing prop in that component already uses, and a store for one boolean would be the larger deviation. **`SendOptions` wrapping a single boolean** stays, because `sendResource(t, s, true)` at a call site says nothing about what is true. **The guard shape shared by `lastTokenAfter` and `responseViewFor`** is two unrelated decisions that happen to look alike; merging them would couple them. **`HttpSendError::from_reqwest` on the client-builder failure** keeps the full cause chain of a TLS-backend init error, and its two verdicts are correctly false.
