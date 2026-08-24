# Resource Tester v1

Status: ready-for-agent

## Problem Statement

Engineers at MasOrange need to check whether backend Resources respond correctly in the non-production Environments (ent1, ent2, ase). Today that means hand-crafting HTTP requests — remembering per-Environment Gateway hosts, assembling Apigee token requests with nine exact headers, composing query strings, and eyeballing raw responses. It is slow, error-prone, and the knowledge lives in people's heads and scattered snippets.

## Solution

A branded desktop app — one double-clickable executable for Windows and macOS — that presents the known Services and Resources as a tree, composes the correct URL for the selected Resource, Environment and Document ID (handling the Apigee Token flow automatically), sends the request, and shows the response with pretty-printing and search. The set of Resources is driven by an editable Catalog, so new Resources are added without rebuilding the app.

## User Stories

1. As a tester, I want a side panel showing all Services and Resources as a collapsible tree, so that I can find the Resource I need quickly.
2. As a tester, I want undefined Resources and Services to appear muted with a "not configured" hint, so that I can see what is coming without mistaking it for something usable.
3. As a tester, I want selecting an undefined item to show an empty state instead of a broken form, so that the app never pretends it can send a request it cannot compose.
4. As a tester, I want to pick the Environment (ent1, ent2, ase) from a dropdown, so that the same Resource can be tested against any non-production target.
5. As a tester, I want a text field for the Document ID, so that requests and Token generation use the customer document I am investigating.
6. As a tester, I want a read-only indicator that shows whether the request goes via Zuul or Apigee, colored differently per Gateway, so that I know the routing at a glance.
7. As a tester, I want the Gateway indicator derived live from the URL text (https://zuul. → Zuul, https://api- → Apigee, anything else → neutral), so that it stays truthful even when I hand-edit the URL.
8. As a tester, I want each Resource's specific query params to appear as their own fields or dropdowns (for CRMB2B → Lines: productType with fixed/mobile/empty and status with active/inactive/empty), so that I never type query strings by hand.
9. As a tester, I want a param left empty to disappear entirely from the URL (name and value), so that the backend never receives an empty-valued param.
10. As a tester, I want an editable field showing the final composed URL, so that I can verify exactly what will be called.
11. As a tester, I want any change to Resource, Environment or params to recompose the URL (overwriting my manual edits), so that the field always reflects my inputs unless I deliberately edit it last.
12. As a tester, I want my manual URL edit to be sent verbatim if I press Send without touching other inputs, so that I have an escape hatch for unforeseen cases.
13. As a tester, I want a Send button that performs the request, so that testing a Resource is one click once inputs are set.
14. As a tester, I want the app to fetch a fresh Token automatically before every Apigee request and attach it as the Authorization header, so that I never manage authentication manually.
15. As a tester, I want to inspect and copy the last Token from a collapsible area, so that I can debug authentication or reuse the Token elsewhere.
16. As a tester, I want a failed Token generation to show the token endpoint's own response in the response panel, so that I can tell an auth failure from a Resource failure.
17. As a tester, I want the response shown in a scrollable panel with the HTTP status code color-coded and the response time displayed, so that I judge health at a glance.
18. As a tester, I want a Pretty/Raw selector where Pretty auto-detects JSON or XML and formats it, so that I can read structured payloads comfortably.
19. As a tester, I want a search field that highlights all matches in the response with a match counter and next/previous navigation, so that I can find a value in a large payload.
20. As a tester, I want network failures (timeout, DNS, connection refused, TLS) reported clearly in the response panel, so that I can distinguish "backend down" from "I am not on the VPN".
21. As a tester, I want non-2xx responses displayed exactly like successful ones (body, status, duration), so that error payloads are as inspectable as happy paths.
22. As a tester, I want an off-by-default "skip TLS verification" toggle, so that broken non-production certificates do not block testing.
23. As a catalog maintainer, I want the tree and request definitions read from a Catalog file copied to my OS config directory on first run, so that I can add or fix Resources without rebuilding the app.
24. As a catalog maintainer, I want an in-app affordance that opens the Catalog file location, so that I do not hunt through hidden directories.
25. As a catalog maintainer, I want a malformed Catalog to fall back to the bundled default with a visible warning, so that a typo never bricks the app.
26. As a user, I want the whole UI in Spanish, so that it matches the team's working language.
27. As a user, I want a light MasOrange-branded look (orange primary on light surfaces), so that the tool feels like ours.
28. As a user, I want a resizable window with a sensible default size, so that the app works on laptops and big screens alike.
29. As a user, I want the app as a single unsigned executable per OS with the first-open workaround documented, so that installing is "download and run".
30. As a maintainer, I want Windows and macOS binaries built automatically by CI, so that releases do not depend on anyone owning both machines.

## Implementation Decisions

- **Shell**: Tauri v2 (per ADR-0001). Frontend: React + TypeScript + Vite. Rust stays a thin layer.
- **Single seam — the engine**: a framework-free TypeScript module owning all decidable logic: Catalog parsing/validation, URL composition, Gateway-indicator derivation, Token-flow orchestration (HTTP transport injected), response classification and pretty-printing, and the header-panel state model (one-way compose with manual override). UI components are thin bindings over engine state.
- **All outbound HTTP goes through one Rust command** (`http_send`-style, using reqwest): the webview cannot skip TLS verification and is subject to CORS, the Rust side is neither. It receives method, URL, headers and the skip-TLS flag; returns status, headers, body and duration. It contains no domain logic.
- **Catalog contract**: a JSON document defining the tree. A node is a Service (name + children) or a Resource. A Resource declares: name, HTTP method, Gateway (`zuul` | `apigee`), path (appended to the Gateway base), and an ordered list of params, each with: query-param name, kind (`text` | `dropdown`), fixed options for dropdowns, source (`documentId` for params bound to the Document ID field), and empty-handling (omit the param entirely when empty). A tree entry without a request specification is an undefined Resource/Service. The bundled default Catalog contains the tree from the initial spec, with CRMB2B → Lines as the only defined Resource (GET, Apigee, path `/crbproductinventory/v1/lines`, params `docId` ← Document ID, `productType` ∈ {fixed, mobile, empty}, `status` ∈ {active, inactive, empty}).
- **Catalog loading**: bundled default ships in the binary; on first run it is copied to the OS config directory; that copy is the one read thereafter. If it fails to parse or validate, the app falls back to the bundled default and shows a warning naming the problem.
- **URL composition**: Apigee base is `https://api-{env}-openapi.cloudready-nonprod.cloud.si.orange.es/jwt`; Zuul bases are `https://zuul-uat2.int.si.orange.es:9061` (ent1), `https://zuul-uat.int.si.orange.es:9061` (ent2), `https://zuul-ase.int.si.orange.es:9061` (ase). Final URL = base + Resource path + query string of non-empty params. Each Resource is fixed to exactly one Gateway by the Catalog.
- **Token flow** (Apigee only): before every send, GET (no body) `https://api-{env}-openapi.cloudready-nonprod.cloud.si.orange.es/jwtgenerator/v1/token` with exactly these headers: `x-forwarded-server: areaclientes.si.orange.es`, `service: PAE`, `accept: application/json`, `Content-Type: application/json`, `z-document: {Document ID}`, `z-logintype: DOCID`, `z-login: {Document ID}`, `z-brand: orange`, `x-wassup-lra: MassMarketMobileUser,MassMarketFixUser`. Take the `Token-JWT` field from the response and send it verbatim (no `Bearer` prefix) as `Authorization` on the Resource request. No caching — fresh Token per send. Zuul requests carry no Token and no extra headers.
- **URL field semantics**: one-way. Inputs compose the URL; a manual edit is used verbatim on Send; any subsequent input change recomposes and overwrites. No back-parsing of the URL into inputs.
- **Networking defaults**: 30-second timeout; system certificate trust store; skip-TLS toggle is session-scoped and off on launch.
- **Response panel**: status code color-coded by class (2xx/4xx/5xx/network error), duration in ms, Pretty (auto-detect JSON vs XML from content) / Raw selector, search with match count and next/previous.
- **UI**: Spanish strings throughout; single light theme approximating the MasOrange palette with `#FF7900` primary (official palette may replace values later without structural change); default window ~1200×800, resizable.
- **v1 sends GET only**; the Catalog schema already records a method per Resource so other verbs slot in later.
- **Distribution**: GitHub Actions builds single-file unsigned binaries for Windows (portable .exe) and macOS (.app); release notes document the SmartScreen / Gatekeeper first-open workaround.

## Testing Decisions

- Tests assert **external behavior at the engine seam only** — inputs in, composed requests / states / formatted output out. No assertions on internal structure, no UI component tests, no e2e in v1.
- The engine's HTTP transport is **injected**; tests use a fake transport that records requests and scripts responses. Key behaviors under test: URL composition per Gateway and Environment; empty params omitted entirely; Token requested before the Resource call with exactly the specified headers and the `Token-JWT` value forwarded verbatim as `Authorization`; Token failure surfaces the token endpoint's response and aborts the Resource call; manual-URL-override and recompose-on-change semantics; indicator derivation from URL prefixes including the neutral case; Catalog validation including the malformed-fallback path; pretty-print auto-detection of JSON and XML and the Raw override; response classification of 2xx/4xx/5xx/timeout/network errors.
- Test runner: Vitest. The repo is greenfield, so there is no prior art — these tests establish the convention: one behavior per test, named in domain vocabulary (Resource, Gateway, Token, Catalog).
- The Rust `http_send` command gets **one smoke test** (round-trip against a local test server) and is otherwise trusted, as it contains no logic.

## Out of Scope

Request history; saving or exporting responses; multiple request tabs; free editing of headers or bodies beyond the defined params; sending non-GET methods; code signing and notarization; dark theme; languages other than Spanish; back-parsing a hand-edited URL into the input fields; proxy configuration; Token caching; auto-update.

## Further Notes

- Domain vocabulary is defined in `CONTEXT.md` (Resource, Service, Catalog, Environment, Gateway, Document ID, Token) — use it in code identifiers, test names and UI copy decisions.
- The stack decision is recorded in ADR-0001 (Tauri v2; Rust required locally; Windows binaries via CI).
- The target hosts are internal; being on the corporate VPN is the user's responsibility — the app just reports connection failures clearly.
- The MasOrange palette is an approximation pending official brand values.
