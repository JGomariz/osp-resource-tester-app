# 08 — Packaging and CI

**What to build:** A colleague downloads one file and runs it. GitHub Actions builds, on tag or manual dispatch, single-file unsigned binaries for both platforms: a portable `.exe` for Windows and a `.app` bundle for macOS, published as release artifacts. The workflow also runs the Vitest and Rust test suites as a gate. Release notes (template or generated) document the first-open workaround per OS: Windows SmartScreen "run anyway", macOS Gatekeeper right-click → Open (or clearing the quarantine attribute). App icon and window title carry the Resource Tester branding.

**Blocked by:** 01 — Walking skeleton.

**Status:** ready-for-agent

- [ ] CI workflow builds a runnable portable Windows `.exe` and a runnable macOS `.app` as release artifacts
- [ ] Tests (Vitest + Rust) run in CI and gate the build
- [ ] Binaries are single-file / single-bundle, no installer
- [ ] Release notes document the SmartScreen and Gatekeeper first-open workarounds
- [ ] App has its icon and Spanish window title
