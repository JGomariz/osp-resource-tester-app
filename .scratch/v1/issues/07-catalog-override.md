# 07 — Catalog override

**What to build:** A catalog maintainer adds or edits a Resource with a text editor and no rebuild. On first run, the app copies the bundled default Catalog to the OS config directory (Application Support on macOS, AppData on Windows) and from then on reads that copy. If the copy is malformed or fails validation, the app falls back to the bundled default and shows a visible, dismissible warning naming what is wrong (file and reason) — a typo never bricks the app. An in-app affordance ("abrir catálogo") opens the Catalog file's location so nobody hunts through hidden directories.

**Blocked by:** 02 — Catalog and tree.

**Status:** ready-for-agent

- [ ] First run creates the override as a copy of the bundled default; subsequent runs read the override
- [ ] Editing the override (e.g. adding a Resource) and restarting shows the change in the tree
- [ ] Malformed or invalid override → app starts on the bundled default with a visible warning naming the problem
- [ ] "Abrir catálogo" opens the file location on both platforms
- [ ] Engine tests cover the fallback decision and validation messages; file-location wiring verified manually
