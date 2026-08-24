# 01 — Walking skeleton

**What to build:** A launchable, branded, empty app that proves every layer of the stack end to end. The user can start the app and see a window with the MasOrange light look (orange `#FF7900` primary on light surfaces), Spanish shell text, an empty side panel and an empty main panel, sized ~1200×800 and resizable. Under the hood, all the seams exist and are exercised: a framework-free TypeScript engine module consumed by the React UI, a Rust `http_send`-style command (method, URL, headers, skip-TLS flag in; status, headers, body, duration out) invocable from the frontend, Vitest running at least one real engine test, and a Rust smoke test round-tripping `http_send` against a local test server.

**Blocked by:** None — can start immediately.

**Status:** done

- [x] `npm run tauri dev` opens the branded, resizable, Spanish-labeled empty shell window
- [x] The engine is a framework-free TypeScript module; the UI imports it (no logic in components)
- [x] The Rust command performs a real HTTP request and returns status, headers, body and duration; it contains no domain logic
- [x] Vitest runs green with at least one engine test using an injected fake transport
- [x] The Rust smoke test runs green against a local test server
- [x] Theme values (colors, spacing) live as reusable tokens so later slices inherit the look

## Comments

**2026-08-24 (agent):** Implemented and verified on macOS. Notable decisions:

- The transport logic lives in the public `send` function in `src-tauri/src/lib.rs`; the `http_send` Tauri command is a private one-line delegate. A `pub` command at the crate root trips rustc E0255 because `#[tauri::command]` adds `#[macro_export]` to its generated helper macros for public functions. The smoke test exercises `send` directly.
- `tauri::generate_context!` requires real icon files even with bundling inactive, so `src-tauri/icons/` was generated with `tauri icon` from `app-icon.png` (1024×1024 MasOrange `#FF7900` rounded square, placeholder until branding lands in issue 08).

Verified: `npm run typecheck`, `npm test` (2 engine tests), `npm run build`, `cargo test` (smoke test round-trips against a local one-shot server, plus serde unit tests), and `npm run tauri dev` compiles, launches the app process, and serves the Spanish shell on port 1420.

Code review (standards + spec axes) found no hard violations; applied follow-ups: `bundle.targets` narrowed from `"all"` to `["app"]` (the ADR rejects installers), `HttpRequestInput` now derives from `HttpRequest` so the shapes can't drift, engine test URLs use neutral `.example` hosts, and Rust unit tests pin the camelCase serde mapping both ways since the real IPC bridge only runs inside a webview. Known gap accepted for the skeleton: the frontend→Rust invocation is proven by construction (command registered, transport typed, serde casing pinned), not end-to-end; ticket 04 exercises it for real.
