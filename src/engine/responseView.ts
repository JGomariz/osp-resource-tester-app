/**
 * Response viewer state: how a body is displayed (pretty-printed or exactly as
 * received) and what a search finds in it. Formatting never throws — an
 * unrecognised body is shown as the text it is.
 */

import type { SendOutcome } from "./sendFlow";

export type BodyKind = "json" | "xml" | "text";

/**
 * What the body looks like, judged by parsing it rather than by the response's
 * content type, which non-production backends are not reliable about.
 */
export function detectBodyKind(body: string): BodyKind {
  const trimmed = body.trim();
  if (trimmed === "") return "text";
  if (isJsonObjectOrArray(trimmed)) return "json";
  if (isXml(trimmed)) return "xml";
  return "text";
}

/**
 * Only objects and arrays count: a bare `42` is valid JSON but pretty-printing
 * it would achieve nothing.
 */
function isJsonObjectOrArray(trimmed: string): boolean {
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return false;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    return typeof parsed === "object" && parsed !== null;
  } catch {
    return false;
  }
}

function isXml(trimmed: string): boolean {
  return (
    trimmed.startsWith("<") && trimmed.endsWith(">") && /<[^\s/!?]/.test(trimmed)
  );
}

export type ViewMode = "pretty" | "raw";

export interface ResponseViewState {
  /** The body exactly as received; Raw mode shows this untouched. */
  readonly body: string;
  readonly mode: ViewMode;
  readonly query: string;
  /** Zero-based index of the highlighted match. */
  readonly activeMatch: number;
}

export function createResponseViewState(body: string): ResponseViewState {
  return { body, mode: "pretty", query: "", activeMatch: 0 };
}

/**
 * The viewer for the outcome now on screen. Mode and search text are the
 * user's choices, so they survive a re-send; the highlight does not, because
 * its offsets belonged to the previous body. An outcome with no body — nothing
 * sent, or a request that never completed — has nothing to view.
 */
export function responseViewFor(
  outcome: SendOutcome | null,
  current: ResponseViewState | null,
): ResponseViewState | null {
  if (outcome === null || outcome.kind === "network-error") return null;
  return {
    body: outcome.body,
    mode: current?.mode ?? "pretty",
    query: current?.query ?? "",
    activeMatch: 0,
  };
}

export function setMode(
  state: ResponseViewState,
  mode: ViewMode,
): ResponseViewState {
  // Offsets belong to the text on screen, so a mode change invalidates them.
  return { ...state, mode, activeMatch: 0 };
}

export function setQuery(
  state: ResponseViewState,
  query: string,
): ResponseViewState {
  return { ...state, query, activeMatch: 0 };
}

/** Half-open range of one match within {@link displayedText}. */
export interface MatchRange {
  readonly start: number;
  readonly end: number;
}

/** Every occurrence of the query, case-insensitive and non-overlapping. */
export function matches(state: ResponseViewState): readonly MatchRange[] {
  const query = state.query;
  if (query === "") return [];

  const haystack = displayedText(state).toLowerCase();
  const needle = query.toLowerCase();
  const found: MatchRange[] = [];
  for (
    let at = haystack.indexOf(needle);
    at !== -1;
    at = haystack.indexOf(needle, at + needle.length)
  ) {
    found.push({ start: at, end: at + needle.length });
  }
  return found;
}

/** The counter beside the search field, or null while nothing is searched. */
export function matchCounter(state: ResponseViewState): string | null {
  if (state.query === "") return null;
  const total = matches(state).length;
  return total === 0 ? "Sin resultados" : `${state.activeMatch + 1} de ${total}`;
}

export function nextMatch(state: ResponseViewState): ResponseViewState {
  return stepMatch(state, 1);
}

export function previousMatch(state: ResponseViewState): ResponseViewState {
  return stepMatch(state, -1);
}

/** Moves the highlight, wrapping at both ends so navigation never dead-ends. */
function stepMatch(state: ResponseViewState, by: number): ResponseViewState {
  const total = matches(state).length;
  if (total === 0) return state;
  const activeMatch = (state.activeMatch + by + total) % total;
  return { ...state, activeMatch };
}

/** The text the viewer puts on screen. */
export function displayedText(state: ResponseViewState): string {
  return state.mode === "raw" ? state.body : prettyPrint(state.body);
}

function prettyPrint(body: string): string {
  switch (detectBodyKind(body)) {
    case "json":
      return prettyJson(body);
    case "xml":
      return prettyXml(body.trim());
    case "text":
      return body;
  }
}

function prettyJson(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    // detectBodyKind already parsed it, so this is unreachable in practice —
    // but formatting must never be the reason a response cannot be read.
    return body;
  }
}

const INDENT = "  ";

/**
 * Indents one level per open element. Whitespace between tags is dropped, so
 * text keeps the line of the element holding it: `<id>1</id>` stays intact.
 */
function prettyXml(xml: string): string {
  const lines = xml.replace(/>\s+</g, "><").split(/(?<=>)(?=<)/);
  let depth = 0;
  return lines
    .map((line) => {
      if (closesAnElement(line) && !opensAnElement(line)) depth -= 1;
      const indented = `${INDENT.repeat(Math.max(depth, 0))}${line}`;
      if (opensAnElement(line) && !closesAnElement(line)) depth += 1;
      return indented;
    })
    .join("\n");
}

/** True for `<tag …>`, but not for `</tag>`, `<tag/>`, `<?…?>` or `<!…>`. */
function opensAnElement(line: string): boolean {
  return /^<[^/!?][^>]*[^/]>/.test(line) || /^<[^/!?]>/.test(line);
}

function closesAnElement(line: string): boolean {
  return line.includes("</");
}
