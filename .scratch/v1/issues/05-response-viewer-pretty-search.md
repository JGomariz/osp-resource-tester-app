# 05 — Response viewer: Pretty and search

**What to build:** The user inspects large payloads comfortably. The response panel gains a style selector — Pretty / Raw — where Pretty auto-detects JSON vs XML from the content and formats it (indentation; syntax coloring welcome but secondary), falling back to raw text when neither is detected. It also gains a search field: typing highlights every match in the response, shows a match counter ("3 de 17"), and next/previous controls (with Enter / Shift+Enter) navigate between matches, scrolling the current one into view.

**Blocked by:** 04 — Send with Token flow and basic response.

**Status:** done

- [x] Pretty mode formats JSON and XML correctly, auto-detected from the content
- [x] Undetectable content renders as raw text without errors, in either mode
- [x] Raw mode always shows the body exactly as received
- [x] Search highlights all matches, shows a Spanish match counter, and next/previous navigation scrolls the active match into view
- [x] Engine tests cover JSON detection, XML detection, the fallback, and formatting output
- [x] Search behaves on both Pretty and Raw views

## Comments

**2026-08-24 (agent):** Implemented test-first in `src/engine/responseView.ts` (22 tests). Decisions:

- **Detection parses rather than trusting the content type**, which non-production backends are not reliable about. JSON means an object or array that `JSON.parse` accepts — a bare `42` is valid JSON but pretty-printing it achieves nothing, so it stays text. XML means it opens with `<`, closes with `>`, and has at least one real element tag. Everything else is text, and text is shown exactly as it arrived.
- **Formatting never throws.** Every path that could fail falls back to the body as received, so a malformed payload is still readable. Probed against namespaced SOAP, comments, self-closing elements, attributes containing `/`, unbalanced tags and a stray closing tag: none throw. The SOAP case is now a committed test since it is realistic traffic for these backends.
- **The XML formatter drops whitespace between tags only**, so text keeps the line of the element holding it (`<id>1</id>` stays intact). Known cosmetic quirks, both harmless: an empty `<r></r>` splits over two lines, and genuinely unbalanced input indents oddly. An attribute value containing a raw unescaped `>` would split wrongly — that is invalid XML, and the fallback is to show the text.
- **Search runs over the text on screen, not the raw body.** That is what makes highlighting possible at all, and it means Pretty and Raw legitimately answer differently: in Pretty, `"status":` does not match because the formatter inserts a space after the colon. There is a test pinning exactly that, so the behaviour is deliberate rather than a surprise.
- **Search is case-insensitive and non-overlapping.** The ticket does not specify; case-insensitive is the more useful default for hunting field names.
- **Mode and search text survive a re-send** — they are the user's choices — but the active highlight resets, because its offsets belonged to the previous body. Same for a mode switch.
- **Counter copy**: `"2 de 5"` when there are matches, `"Sin resultados"` when the query finds nothing, hidden entirely while the field is empty. Labels: Formateado / Sin formato, "Buscar en la respuesta".
- A `network-error` outcome gets no viewer: it has no body, only a message.

Found and fixed while reviewing this ticket's own work: `ResponsePanel` had begun treating "no viewer state" the same as a network error, which would have labelled a perfectly good response "No se pudo completar la petición". It now shows the body plainly in that case instead of claiming a failure.

Verified: `npm run typecheck`, `npm test` (92 tests, up from 70), `npm run build`, `cargo test`, and `npm run tauri dev` clean with HMR. Rendered markup checked with a throwaway script (deleted): JSON indented two spaces, XML indented per level, Raw byte-exact, text fallback intact, and a search for `status` marking both matches with `is-active` on the second and the counter reading "2 de 2". No screenshot: screen-recording permission is not granted to the agent's process, so the highlight colours and toolbar layout are unverified by eye.
