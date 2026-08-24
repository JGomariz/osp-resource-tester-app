# 02 — Catalog and tree

**What to build:** The user launches the app and browses the real tree of Services and Resources in the side panel. The tree comes from a bundled default Catalog (JSON) containing exactly the tree from the spec: CRMB2B (with Lines, Customer Products, ServiciosCentrex), MDG, Line Usage B2B, Customer View B2B, Eunomia, Excalibur, Profiler — where CRMB2B → Lines is the only *defined* Resource (GET via Apigee, path `/crbproductinventory/v1/lines`, params: `docId` bound to the Document ID field; `productType` dropdown fixed/mobile/empty; `status` dropdown active/inactive/empty; empty params omitted). Tree items collapse/expand. Undefined Resources and Services render muted with a "sin configurar" hint; selecting one shows an empty state in the main panel, never a broken form. Selecting Lines shows a placeholder for the header panel (built in ticket 03).

The Catalog contract established here is the one from the spec's Implementation Decisions: nodes are Services (name + children) or Resources (name, method, Gateway `zuul`|`apigee`, path, ordered params with query-param name, kind text|dropdown, dropdown options, Document-ID binding, omit-when-empty). The engine owns parsing and validation with actionable error messages.

**Blocked by:** 01 — Walking skeleton.

**Status:** ready-for-agent

- [ ] Side panel shows the full spec tree, collapsible, from the bundled Catalog
- [ ] Undefined items are visually muted with a "sin configurar" hint and are selectable
- [ ] Selecting an undefined item shows an empty state in the main panel
- [ ] Engine tests cover Catalog parsing, validation failures with clear messages, and the defined/undefined distinction
- [ ] The Lines definition in the bundled Catalog matches the spec exactly
