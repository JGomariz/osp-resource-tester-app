# 03 — Header panel and URL composition

**What to build:** With CRMB2B → Lines selected, the user sees the header panel and watches the final URL build itself. Fields: Environment dropdown (ent1, ent2, ase), Document ID text field, the Resource's own param controls (productType and status dropdowns, each with an empty choice), a read-only Gateway indicator, an editable final-URL field, and a Send button (visible; wired in ticket 04).

Composition rules (all owned by the engine): Apigee base `https://api-{env}-openapi.cloudready-nonprod.cloud.si.orange.es/jwt`; Zuul bases `https://zuul-uat2.int.si.orange.es:9061` (ent1), `https://zuul-uat.int.si.orange.es:9061` (ent2), `https://zuul-ase.int.si.orange.es:9061` (ase); final URL = base + Resource path + query string; a param left empty disappears entirely (name and value). URL semantics are one-way: any input change recomposes and overwrites the field; a manual edit is preserved until the next input change and will be sent verbatim. The Gateway indicator derives live from the URL text — `https://zuul.`-prefixed → Zuul color, `https://api-`-prefixed → Apigee color, anything else → neutral — so it stays truthful under manual edits.

**Blocked by:** 02 — Catalog and tree.

**Status:** ready-for-agent

- [ ] Selecting Lines shows Environment, Document ID, productType and status controls, indicator, URL field and Send
- [ ] Changing any input recomposes the URL live; empty params leave no trace in the query string
- [ ] Manual URL edits survive until the next input change, which overwrites them
- [ ] Indicator shows distinct colors for Zuul / Apigee / neutral, derived only from the URL text
- [ ] Engine tests cover both Gateways across all three Environments, param omission, override semantics and indicator derivation
- [ ] All labels in Spanish
