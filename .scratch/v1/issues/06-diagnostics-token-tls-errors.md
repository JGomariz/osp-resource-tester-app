# 06 — Diagnostics: Token inspector, TLS toggle, error clarity

**What to build:** When things fail, the user can tell why. Three pieces:

1. **Token inspector** — a collapsible area showing the last Token obtained (for the current session), with a copy button, so authentication can be debugged or the Token reused elsewhere.
2. **Skip-TLS toggle** — an off-by-default, session-scoped switch ("omitir verificación TLS") that makes the Rust command accept invalid certificates, for broken non-production certs. Resets to off on every launch.
3. **Error clarity** — network-level failures are classified and reported in plain Spanish in the response panel, visually distinct from HTTP responses: timeout (30 s), unreachable host / DNS failure (suggesting VPN), connection refused, and TLS errors (suggesting the toggle). Non-2xx HTTP responses keep rendering like any response — body, status, duration — never as app errors.

**Blocked by:** 04 — Send with Token flow and basic response.

**Status:** ready-for-agent

- [ ] Last Token visible in a collapsible area and copyable; empty state before any Apigee send
- [ ] TLS toggle off by default, effective when on, and reset on relaunch
- [ ] Timeout, DNS/unreachable, connection-refused and TLS failures each produce a distinct, plain-Spanish message
- [ ] TLS failure message points at the toggle; unreachable-host message points at the VPN
- [ ] Non-2xx responses render as normal responses, not as errors
- [ ] Engine tests cover the error classification from transport failures
