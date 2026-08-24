# 03 — Header panel and URL composition

**What to build:** With CRMB2B → Lines selected, the user sees the header panel and watches the final URL build itself. Fields: Environment dropdown (ent1, ent2, ase), Document ID text field, the Resource's own param controls (productType and status dropdowns, each with an empty choice), a read-only Gateway indicator, an editable final-URL field, and a Send button (visible; wired in ticket 04).

Composition rules (all owned by the engine): Apigee base `https://api-{env}-openapi.cloudready-nonprod.cloud.si.orange.es/jwt`; Zuul bases `https://zuul-uat2.int.si.orange.es:9061` (ent1), `https://zuul-uat.int.si.orange.es:9061` (ent2), `https://zuul-ase.int.si.orange.es:9061` (ase); final URL = base + Resource path + query string; a param left empty disappears entirely (name and value). URL semantics are one-way: any input change recomposes and overwrites the field; a manual edit is preserved until the next input change and will be sent verbatim. The Gateway indicator derives live from the URL text — `https://zuul.`-prefixed → Zuul color, `https://api-`-prefixed → Apigee color, anything else → neutral — so it stays truthful under manual edits.

**Blocked by:** 02 — Catalog and tree.

**Status:** done

- [x] Selecting Lines shows Environment, Document ID, productType and status controls, indicator, URL field and Send
- [x] Changing any input recomposes the URL live; empty params leave no trace in the query string
- [x] Manual URL edits survive until the next input change, which overwrites them
- [x] Indicator shows distinct colors for Zuul / Apigee / neutral, derived only from the URL text
- [x] Engine tests cover both Gateways across all three Environments, param omission, override semantics and indicator derivation
- [x] All labels in Spanish

## Comments

**2026-08-24 (agent):** Implemented test-first in `src/engine/headerPanel.ts` (20 tests). Decisions and one spec defect:

- **The spec's Zuul indicator rule contradicts its own Zuul bases.** The rule is worded as the `https://zuul.` prefix, but every mandated Zuul base is `https://zuul-…` (`zuul-uat2`, `zuul-uat`, `zuul-ase`). Read literally, the indicator would report *neutral* for every real Zuul request — the one case it exists to identify. `gatewayIndicator` therefore treats **both** `https://zuul.` and `https://zuul-` as Zuul, which satisfies the literal rule and is truthful for the real hosts. The dotted form is kept under test so the original wording stays covered. **If the `.` was deliberate and Zuul is meant to read neutral, this is the line to change** — `gatewayIndicator` in `headerPanel.ts`, one condition.
- **The indicator is never stored**, per `CONTEXT.md` ("derived from the final URL prefix, never stored"): `gatewayIndicator(state.url)` is a pure function the UI calls on the field's current text, which is what keeps it truthful under a manual edit.
- **Query values are percent-encoded.** The spec is silent on encoding; a Document ID typed with a space or `&` would otherwise produce a malformed URL. Encoding is a no-op for realistic inputs, so the composed URLs still read plainly.
- **`headerPanelFor(view, current)`** owns the one coordination decision between the tree and the panel: fresh state for a newly chosen Resource, the *existing* state when the same Resource is clicked again (so a stray click doesn't wipe a typed Document ID), and none when the selection cannot be sent. That keeps `App.tsx` a pure binding rather than growing reset logic.
- **`paramControls(state)`** decides which params get a control: a param with `source: "documentId"` gets none, since it would be a second place to type the same value. `docId` is therefore driven by the Document ID field alone.
- Dropdowns render an explicit `(vacío)` choice for the empty case, which is what makes "a param left empty disappears entirely" reachable from the UI.
- Spanish labels: Entorno, Document ID, Pasarela, URL final, Enviar. "Document ID" stays as-is — `CONTEXT.md` fixes it as the domain term. Param labels show the raw query-param names (`productType`, `status`) because that is what the user is setting.
- Gateway colours are new tokens (`--color-zuul`, `--color-apigee`, plus surfaces), deliberately not the brand orange so the indicator never reads as a primary action.

The Send button is present but inert, as the ticket specifies — ticket 04 wires it.

Verified: `npm run typecheck`, `npm test` (57 tests, up from 37), `npm run build`, `cargo test`, and `npm run tauri dev`. Rendered markup was checked with a throwaway server-render script (deleted): all controls present with Spanish labels, `(vacío)` on both dropdowns, Apigee indicator by default, URL composing in Catalog order, the Environment switch rewriting the host, and a manual edit to `https://zuul-uat.int.si.orange.es:9061/x` flipping the indicator to Zuul — the exact case the literal spec rule would have gotten wrong. No screenshot: screen-recording permission is not granted to the agent's process.
