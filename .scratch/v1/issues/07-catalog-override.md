# 07 — Catalog override

**What to build:** A catalog maintainer adds or edits a Resource with a text editor and no rebuild. On first run, the app copies the bundled default Catalog to the OS config directory (Application Support on macOS, AppData on Windows) and from then on reads that copy. If the copy is malformed or fails validation, the app falls back to the bundled default and shows a visible, dismissible warning naming what is wrong (file and reason) — a typo never bricks the app. An in-app affordance ("abrir catálogo") opens the Catalog file's location so nobody hunts through hidden directories.

**Blocked by:** 02 — Catalog and tree.

**Status:** done

- [x] First run creates the override as a copy of the bundled default; subsequent runs read the override
- [x] Editing the override (e.g. adding a Resource) and restarting shows the change in the tree
- [x] Malformed or invalid override → app starts on the bundled default with a visible warning naming the problem
- [x] "Abrir catálogo" opens the file location on both platforms
- [x] Engine tests cover the fallback decision and validation messages; file-location wiring verified manually

## Comments

**2026-08-24 (agent):** Implemented test-first in `src/engine/catalogSource.ts` (13 tests), with the Rust side gaining four commands and two tests. Decisions:

- **File access is an injected seam, exactly like the send flow's transport.** `loadCatalog(store, bundled)` takes a `CatalogStore` of `path` / `read` / `write`, so every branch — first run, valid override, broken JSON, invalid Catalog, unreadable file, unwritable directory, missing config directory — is decided in tested TypeScript and none of it needs a disk. The Rust side performs I/O and nothing else.
- **"Missing" is an answer, not an error.** `catalog_read` returns `Option<String>`, mapping `NotFound` to `None` and only genuine failures to `Err`. If a missing file arrived as an error the first run would look like a fault and the app would warn on a perfectly normal launch.
- **A broken override is never repaired or overwritten.** The maintainer's file stays byte-for-byte as they typed it, so the typo the warning describes is still there to find. Tested explicitly — the fallback path writes nothing.
- **Every failure ends with a working tree.** That is the point of the ticket, so the load is written as five guarded steps rather than one happy path: a config directory that cannot be located, a read that throws, a first-run write that fails, text that is not JSON, and JSON that is not a Catalog all end in the bundled Catalog plus a warning. Each warning names the file (where one is known) and the reason, and every one of them ends "Se ha usado el catálogo incluido en la aplicación." so the tree on screen is never a mystery.
- **The validator's own words are the warning's reason.** `parseCatalog` already produces Spanish errors that name the offending node, so an invalid override reports `nodes[0]: falta el campo 'name'` rather than a generic "catálogo inválido" that would send the maintainer hunting.
- **The seeded text is re-serialised, not copied as bytes.** `bundledCatalogSource()` runs `JSON.stringify(…, null, 2)`, which guarantees what lands on disk parses and keeps it indented for a human to edit. A committed test pins the round trip: the text a first run writes must parse back into the same Catalog, or the app would warn about a file it wrote itself one launch later.
- **The tree waits for the load rather than showing the bundled copy first.** Rendering the bundled Catalog immediately and swapping it a few milliseconds later would change the tree under the user's cursor; a brief "Cargando catálogo…" is the lesser evil.
- **"Abrir catálogo" selects the file rather than opening its folder**, via `open -R` on macOS and `explorer /select,` on Windows, falling back to opening the directory when the file is not there — which is exactly the state after a failed first-run write, when the user most needs to look. `xdg-open` covers Linux for developers.
- **No new dependency for revealing.** `tauri-plugin-opener` would be the idiomatic route but costs a Cargo dependency, a capability entry and a schema regeneration for one `std::process::Command`. The spec asks that Rust stay thin, and ten lines of platform `match` is thinner than a plugin. The command's shape is unit-tested per platform, which is the only decidable part of it.

**Verified:** `npm run typecheck`, `npm test` (106 tests, up from 92), `npm run build`, `cargo test` (5 tests, up from 3). Beyond the committed suite, a throwaway harness ran the whole lifecycle against a real temporary directory: first run created a 1405-byte file and reported `created`; the next run reported `override`; a Resource added to the file by hand appeared in the tree as "Recurso añadido a mano"; and a deliberately broken file fell back to the bundled Catalog with the warning `El catálogo de …/catalog.json no es válido: nodes[0]: falta el campo 'name'. Se ha usado el catálogo incluido en la aplicación.` The committed tests use the fake store, per the spec's testing decisions.

**Not verified:** the actual spawn of the file manager. The command built for each platform is asserted in a Rust test, but running it would open a Finder window on the machine doing the build, so the last hop is left to the manual check the ticket already asks for. The webview→Rust IPC hop is likewise unproven here, as in every previous ticket.
