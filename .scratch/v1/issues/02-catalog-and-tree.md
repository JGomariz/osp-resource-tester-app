# 02 — Catalog and tree

**What to build:** The user launches the app and browses the real tree of Services and Resources in the side panel. The tree comes from a bundled default Catalog (JSON) containing exactly the tree from the spec: CRMB2B (with Lines, Customer Products, ServiciosCentrex), MDG, Line Usage B2B, Customer View B2B, Eunomia, Excalibur, Profiler — where CRMB2B → Lines is the only *defined* Resource (GET via Apigee, path `/crbproductinventory/v1/lines`, params: `docId` bound to the Document ID field; `productType` dropdown fixed/mobile/empty; `status` dropdown active/inactive/empty; empty params omitted). Tree items collapse/expand. Undefined Resources and Services render muted with a "sin configurar" hint; selecting one shows an empty state in the main panel, never a broken form. Selecting Lines shows a placeholder for the header panel (built in ticket 03).

The Catalog contract established here is the one from the spec's Implementation Decisions: nodes are Services (name + children) or Resources (name, method, Gateway `zuul`|`apigee`, path, ordered params with query-param name, kind text|dropdown, dropdown options, Document-ID binding, omit-when-empty). The engine owns parsing and validation with actionable error messages.

**Blocked by:** 01 — Walking skeleton.

**Status:** done

- [x] Side panel shows the full spec tree, collapsible, from the bundled Catalog
- [x] Undefined items are visually muted with a "sin configurar" hint and are selectable
- [x] Selecting an undefined item shows an empty state in the main panel
- [x] Engine tests cover Catalog parsing, validation failures with clear messages, and the defined/undefined distinction
- [x] The Lines definition in the bundled Catalog matches the spec exactly

## Comments

**2026-08-24 (agent):** Implemented test-first at the engine seam. Contract and design decisions:

- **The Catalog JSON is flat, the parsed model is normalized.** On disk a Resource carries `method`/`gateway`/`path`/`params` as sibling fields (easy to hand-edit, which is the point of ticket 07); `parseCatalog` folds them into a single `request` object so "defined vs undefined" is one presence check (`request: null`). A Resource is *defined* iff it declares all three of `method`, `gateway`, `path` — declaring some but not all is a validation error naming the missing ones, which catches the "I wrote params but forgot the path" mistake.
- **`kind` is a required discriminator** (`service` | `resource`). Inferring it from the presence of `children` would misread the childless top-level entries (MDG, Eunomia, …) as Resources when the spec means Services with no Resources yet.
- **Node identity is the slash-joined path of names** (`CRMB2B/Lines`). Sibling names must be unique, and names may not contain `/` — otherwise a top-level Service named `CRMB2B/Lines` could forge a child's id. Both are validation errors.
- **Validation collects every problem in one pass**, in Spanish, each naming the offending node and what to fix, so a maintainer editing the override in ticket 07 fixes everything in one edit rather than one error per restart.
- **`mainPanelView` is one call returning one of three states** (`no-resource-selected` / `not-configured` / `resource`), so the main panel is a switch with no decisions of its own. A Service holding Resources reads as `no-resource-selected`, not `not-configured` — it *is* configured, it just isn't callable.
- **`selectNode` is the single click entry point**: it selects, and flips expansion when the node is a Service with children. The UI hands over every click without checking anything first; unknown ids are ignored.
- `src/engine/shell.ts` was deleted — it was ticket 01's explicit placeholder for exactly this state model, and keeping it would have left two competing models.
- Tokens `--color-hover` and `--color-selected` were added to `styles/tokens.css` rather than hard-coded, per ticket 01's convention.

Verified: `npm run typecheck`, `npm test` (37 engine tests, up from 2), `npm run build`, `cargo test`, and `npm run tauri dev` compiles and launches the app process serving on 1420. The rendered markup for the tree and all three main-panel states was checked with a throwaway server-render script (deleted — the spec forbids committed UI tests). No screenshot: screen-recording permission is not granted to the agent's process, so the window was not visually inspected.

Two-axis code review found no hard standards violations and no spec gaps. Applied follow-ups: names containing `/` are now rejected (the id-collision hole above, found during review); `describe()` renamed to `asWritten()` to stop colliding with Vitest's `describe` in readers' heads; `isDefinedResource` un-exported from the engine's public interface since nothing outside uses it.
