# 08 — Packaging and CI

**What to build:** A colleague downloads one file and runs it. GitHub Actions builds, on tag or manual dispatch, single-file unsigned binaries for both platforms: a portable `.exe` for Windows and a `.app` bundle for macOS, published as release artifacts. The workflow also runs the Vitest and Rust test suites as a gate. Release notes (template or generated) document the first-open workaround per OS: Windows SmartScreen "run anyway", macOS Gatekeeper right-click → Open (or clearing the quarantine attribute). App icon and window title carry the Resource Tester branding.

**Blocked by:** 01 — Walking skeleton.

**Status:** done

- [x] CI workflow builds a runnable portable Windows `.exe` and a runnable macOS `.app` as release artifacts
- [x] Tests (Vitest + Rust) run in CI and gate the build
- [x] Binaries are single-file / single-bundle, no installer
- [x] Release notes document the SmartScreen and Gatekeeper first-open workarounds
- [x] App has its icon and Spanish window title

## Comments

**2026-08-24 (agent):** Implemented as `.github/workflows/release.yml`, `.github/workflows/ci.yml`, `.github/release-notes.md` and a bundle section in `tauri.conf.json`. Decisions:

- **Windows is built with `--no-bundle`, not with a bundle target.** Tauri's Windows targets are `nsis` and `msi` — both installers, which ADR-0001 explicitly rules out ("Compose/jpackage was rejected because its Windows output is an installer or folder, not a single file"). The raw `target/release/resource-tester.exe` *is* the single double-clickable file the ADR promises, so the way to get it is to stop before bundling. macOS has no such tension: its `app` target is already a self-contained bundle.
- **The macOS build is universal.** GitHub's macOS runners are arm64, so an ordinary build would produce a binary that refuses to start on the Intel Macs still in use. `--target universal-apple-darwin` with both Rust targets installed costs one extra compile and means one download works everywhere. Verified: `lipo -info` reports `x86_64 arm64`.
- **`productName` was deliberately left as `resource-tester`.** "Probador de Recursos" would read better in the dock, but it puts spaces into every CI path and into the artifact URLs, and — more to the point — with `--no-bundle` the Windows exe takes its name from Cargo's package name rather than from `productName`, so the two would silently diverge. The download is renamed to `ProbadorDeRecursos-<os>` at the packaging step instead, which gives the colleague a branded filename with none of the build risk.
- **The gate is split in two, by cost.** Types and Vitest run first on ubuntu, cheap and with no system dependencies; nothing is compiled for either platform until they pass. `cargo test` then runs inside each build job, before bundling, so a Rust failure still blocks the artifact. That is deliberately not one shared Rust job: the transport test provokes a real connection failure and asserts on its cause chain, and those words come from the platform's own TLS and socket stacks — schannel on Windows, Security.framework on macOS — so a pass on one proves little about the other.
- **Only the crate registry is cached, not `target/`.** A release build's target directory runs to gigabytes, and a universal one holds two architectures; caching that against a 10 GB repo-wide budget would evict everything else to save a link step. `ci.yml`, which builds debug and runs on every push, does cache `target/`.
- **A manual dispatch stops at the artifacts; only a tag becomes a release.** That is what makes dispatch useful — you can check that both platforms still build without publishing anything.
- **`gh release create` rather than a third-party action.** The CLI is preinstalled on the runners, so there is no third-party SHA to pin and audit for something this small. `contents: write` is granted to the publish job alone; the rest of the workflow runs read-only.
- **`ditto` rather than `zip` for the `.app`.** A `.app` is a directory and neither an artifact nor a release asset can be one, so it has to be archived; `ditto` is the macOS-native tool that preserves the symlinks and metadata inside a bundle. The zip is only transport — 7.0 MB, one application inside.
- **Release notes are in Spanish**, like the UI, since the audience is the team. They cover Gatekeeper (both the right-click route and the Settings route newer macOS versions push you to, plus `xattr -dr com.apple.quarantine`), SmartScreen, and — a real "download and run" caveat the ticket does not mention — that the Windows exe needs the Edge WebView2 runtime, which ships with Windows 11 and updated Windows 10 but is not guaranteed.

**2026-08-24 (agent, after review):** Both axes ran. The Spec review found all five criteria satisfied and nothing blocking; the Standards review found no documented-standard violations but eight workflow issues. Acted on:

- **The packaging path used to run for the first time on a tag push** — the most expensive moment to discover it is wrong, and the Windows half cannot be checked on any maintainer's machine. `ci.yml` now runs the same `--no-bundle` build on pushes and asserts the exe lands exactly where the release workflow looks for it. Pull requests skip it: it is the one job here that costs a Windows runner, and it guards a release rather than a review.
- **The release gate did not include `npm run build`**, which contradicted the comment sitting directly above it. A frontend that failed to compile would have burned both platform builds before failing inside `beforeBuildCommand`.
- **`cancel-in-progress` is now false for releases.** Interrupting the publish between its two assets would leave a release on GitHub missing one of its downloads.
- **The cargo cache was frozen.** Keyed on `Cargo.lock` alone, every run after the first was an exact hit, so `target/` stayed at whatever the first run left there and never took the newer build. The key now carries the commit sha, with `restore-keys` supplying the previous run's directory to build on. It also carries `runner.os`, which mattered as soon as a Windows job joined the macOS one.
- **`targets: ["app"]` moved to `src-tauri/tauri.macos.conf.json`.** It is a macOS-only value and had no business in the shared config, where it made a bare `tauri build` on Windows a trap. Verified afterwards by rebuilding: the bundle still lands at the same path.
- **Artifact names dropped their extensions.** `upload-artifact` always zips what it is given, so `…-macos.zip` handed a dispatch run a file called `…-macos.zip.zip`. The file inside keeps its real name, which is what the release assets use.
- **Publishing is idempotent.** `gh release create` fails if the release already exists, so a flaky upload or a cancelled run would have needed the release deleted by hand before any re-run could work. It now creates only when absent and uploads with `--clobber`.
- **The macOS notes led with the wrong route.** Control-click → Open no longer works for an unnotarized app on macOS 15 and later, so the Ajustes del Sistema route now leads and the right-click one is marked as the older path.
- **`.nvmrc`** replaces a Node version that appeared three times across two workflows.

Declined: **`Status: done` is not one of the five labels in `triage-labels.md`** — true, but all six previous issues use it, so following the established convention beats correcting it in passing here. **The duplication between the two workflows** (a few gate lines and the cache blocks) does not justify a reusable workflow at this size.

Worth knowing, from the Spec review: the Rust job on `macos-latest` bills at ten times the ubuntu rate on every push and pull request. It stays there because on Linux the `tauri` crate links GTK and webkit2gtk, and an apt list for a platform this app never ships on is its own maintenance burden — but if CI minutes become a concern, that job is where they are going.

**Beyond the ticket:** `ci.yml` (push to main and pull requests) is an addition. The ticket only asks that tests gate the release build, which a release-only workflow satisfies to the letter — but it would mean a regression sits undiscovered until someone cuts a tag. Two small jobs close that. Its Rust job runs on macOS rather than ubuntu because on Linux the `tauri` crate links GTK and webkit2gtk, so testing there means maintaining an apt list for a platform this app is never shipped on.

**Verified:** `npm run typecheck`, `npm test` (114 tests), `cargo test` (5 tests), both workflow files parsed as YAML, and `tauri.conf.json` parsed as JSON. The macOS half was built for real, exactly as the workflow does it: `npm run tauri -- build --bundles app --target universal-apple-darwin` produced `target/universal-apple-darwin/release/bundle/macos/resource-tester.app` — the precise path the workflow references — 24 MB, universal, `icon.icns` embedded, identifier `es.masorange.resourcetester`. The `ditto` packaging step was then run against it, yielding a 7.0 MB zip. The frontend is genuinely inside the bundle: `tauri build` ran `tsc && vite build` and would have failed outright had `frontendDist` been missing.

**Not verified:** the Windows half. Nothing on this machine can build it — that is the whole reason ADR-0001 accepts CI-built releases — so the `.exe` path, the `Copy-Item` step and the WebView2 assumption are reasoned from the toolchain's documented behaviour rather than observed. The first run of the workflow on a tag is the real test. Also unverified: that either binary *launches*, as opposed to being structurally complete; a GUI launch proves little without a screenshot, and screen-recording permission is not granted to the agent's process.

**The icon is a plain brand-orange rounded square**, as ticket 01 left it. It carries the MasOrange primary (`#FF7900`) and is embedded correctly in both the `.app` and the Windows resources, so the criterion holds — but it bears no mark or glyph, so in a dock of a dozen apps it is identifiable only by colour. Worth a designed icon before this goes to a wide audience; out of scope here, and not something to invent unasked.
