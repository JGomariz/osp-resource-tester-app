# 05 — Response viewer: Pretty and search

**What to build:** The user inspects large payloads comfortably. The response panel gains a style selector — Pretty / Raw — where Pretty auto-detects JSON vs XML from the content and formats it (indentation; syntax coloring welcome but secondary), falling back to raw text when neither is detected. It also gains a search field: typing highlights every match in the response, shows a match counter ("3 de 17"), and next/previous controls (with Enter / Shift+Enter) navigate between matches, scrolling the current one into view.

**Blocked by:** 04 — Send with Token flow and basic response.

**Status:** ready-for-agent

- [ ] Pretty mode formats JSON and XML correctly, auto-detected from the content
- [ ] Undetectable content renders as raw text without errors, in either mode
- [ ] Raw mode always shows the body exactly as received
- [ ] Search highlights all matches, shows a Spanish match counter, and next/previous navigation scrolls the active match into view
- [ ] Engine tests cover JSON detection, XML detection, the fallback, and formatting output
- [ ] Search behaves on both Pretty and Raw views
