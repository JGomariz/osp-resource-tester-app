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

**2026-08-24 (agent):** Implemented test-first across `src/engine/networkError.ts` (24 tests), `src/engine/session.ts` (8 tests) and `src/engine/sendFlow.ts` (20 tests). Decisions:

- **`reqwest`'s error text alone could not have carried this ticket.** Since 0.12 its `Display` prints only `error sending request for url (…)` — the cause is not in it. The old `map_err(|e| e.to_string())` therefore threw away the one thing that tells DNS from refused from TLS, and any classifier reading it would have answered "unknown" for every failure. `http_send` now rejects with `{timedOut, detail}`: `timed_out` is `reqwest`'s own verdict (the only judgement the engine genuinely cannot make, since a timeout and a dropped connection read alike), and `detail` is the error joined with every cause beneath it. **Which** failure that describes stays the engine's call, so the Rust layer still decides nothing.
- **Classification is substring matching, ordered timeout → TLS → refused → unreachable.** The markers are deliberately phrases no host name could contain: bare `tls` or `ssl` would classify a perfectly ordinary refused connection to a host called `ssl-gateway.int.si.orange.es` as a certificate failure. There is a test pinning exactly that case.
- **`certificate` is the TLS marker, not the rustls wording.** `reqwest` here resolves to `native-tls` (`hyper-tls` in `Cargo.lock`), so the text comes from Security.framework on macOS and schannel on Windows — different sentences, both containing "certificate". Matching only rustls's `invalid peer certificate: UnknownIssuer` would have worked on neither shipping platform.
- **An unrecognised failure says so** rather than guessing, and every classification keeps the transport's own words under a collapsed "Detalle técnico". A marker that misses degrades to "No se pudo completar la petición." plus the raw text — never to a confident wrong answer.
- **A `SessionState` holds what a relaunch forgets**: the skip-TLS switch and the last Token. It deliberately sits above `HeaderPanelState`, which is rebuilt per Resource — putting the switch there would have silently re-enabled certificate verification, and dropped the Token the user was about to copy, every time the selection changed. Reset-on-relaunch needs no code: nothing is persisted, so `createSession()` is both the initial state and the restored one.
- **The switch reaches both requests.** A Token fetched over a loosened connection is no use if the Resource call then refuses the same certificate.
- **`sendResource` now returns `{outcome, token}`.** The Token is reported beside the outcome rather than inside it because it is worth keeping even when the Resource call that followed it fell over — that send genuinely obtained a Token, and that is the one the user needs to debug with.
- **"Omitir verificación TLS" is single-sourced** as `SKIP_TLS_LABEL` in `session.ts`. The TLS hint tells the user to go and switch on a control *by name*; two literals would let a rename leave the hint pointing at something that no longer exists.
- **The refused hint avoids the word "servicio".** In this app a Service is a node in the tree, so "el servicio puede estar parado" reads as the user's selection being at fault. It now says "Puede que no haya nada escuchando en ese puerto." Caught in review against `CONTEXT.md`.
- **A failure renders unlike a response on purpose**: no status code, no duration, no `<pre>` body — a bordered block headed "Sin respuesta", so it cannot be mistaken for something the backend actually said. Non-2xx answers keep going through the ordinary path, with tests at 404 and 500.

**From the spec review, five things changed:**

- **The timeout hint now names the VPN too.** Story 20 wants the user to tell "backend down" from "I am not on the VPN", and the first implementation only said VPN on the DNS path. But an internal host with the VPN off usually swallows the packets rather than failing to resolve, so the symptom the user actually meets is the 30-second timeout. The letter of the ticket was met while its purpose was not.
- **The diagnostics moved out of the main panel into an app footer.** They were rendering only inside the `resource` branch, so selecting a Service or an undefined Resource made the switch and the Token disappear — story 15 is unconditional, and session-scoped state has no business living inside a panel that is rebuilt per Resource. Verified by rendering the whole app with nothing selected.
- **The URL is stripped before markers are matched.** The chain quotes the request's target as well as its cause, so a Resource path like `/certificates/v1/list` would have been read as a certificate failure. The URL is still shown to the user untouched; it is only ignored for classifying.
- **More native-tls wording.** macOS and Windows say "not trusted" where rustls says "invalid peer certificate", and a bare `OSStatus` carries neither. Added "not trusted", "untrusted", "ssl error", "tls error". A bare numeric status still falls to `unknown` — where the raw detail is shown, so the user is not stranded, only unhinted.
- **Copy has a fallback.** `navigator.clipboard` exists only in a secure context. The dev server is `http://localhost:1420`, which is one; the packaged app is served from `tauri://localhost`, which is not guaranteed to be. Copy would have worked all through development and been dead in the shipped binary, so it now falls back to a throwaway selection.

**Deviation worth recording:** the spec says `http_send` "gets **one smoke test** and is otherwise trusted, **as it contains no logic**". This ticket added a cause-chain walk to that layer, so it added tests for it — four unit tests plus a second integration test that opens and drops a TCP port and drives a real refused connection through `reqwest`, asserting the cause survives into `detail`. That last one is the only proof that the classifier's markers match reality rather than an assumption about error strings, and it costs 20 ms. Flagged rather than widened silently.

**Not proven end-to-end:** the DNS and TLS markers are matched against documented `hyper`/native-tls phrasings, not against a live failure — a DNS test depends on the network resolving `.invalid` correctly (corporate wildcard DNS would break it) and a TLS test needs a bad-certificate server. Refused and timeout are covered for real. The `unknown` fallback keeps a missed marker honest. Likewise the clipboard: the fallback makes it very likely to work in the packaged app, but only running the built binary proves it.

**The 30 seconds is stated twice** — `TIMEOUT_SECONDS` in `networkError.ts` for the message, `REQUEST_TIMEOUT` in `lib.rs` for the behaviour — with each naming the other in a comment. They cannot be shared across the TypeScript/Rust boundary, so this is a cross-reference, not a guarantee.

**Vocabulary gap for `/domain-modeling`:** this ticket introduced two concepts `CONTEXT.md` does not define — **Session** (what the app remembers until relaunch: the TLS switch and the last Token) and **Diagnostics** (the panel grouping them). Both are load-bearing in code now; neither was invented lightly, but neither is in the glossary.

Verified: `npm run typecheck`, `npm test` (115 tests, up from 74), `npm run build`, and `cargo test` (8 tests, up from 3). The new UI states — five failure classes, a 404 rendering as an ordinary response, the Token inspector empty and populated, and the whole app rendered with nothing selected to prove the diagnostics survive it — were checked as rendered markup via a throwaway harness, since the spec rules out committed UI component tests. Not checked: the webview→Rust IPC hop and the clipboard write, both of which need UI automation the repo does not have; a failed copy reports "No se pudo copiar" rather than leaving a dead button.
