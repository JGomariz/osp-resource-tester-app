/**
 * Header-panel state model: the inputs that aim a request at an Environment,
 * and the URL they compose. Composition is one-way — inputs build the URL, the
 * URL is never parsed back into inputs.
 */

import type { ParamKind } from "./catalog";
import type { DefinedResource, MainPanelView } from "./catalogTree";

export type Environment = "ent1" | "ent2" | "ase";

/** The Environments a request can be aimed at, in dropdown order. */
export const ENVIRONMENTS: readonly Environment[] = ["ent1", "ent2", "ase"];

export interface HeaderPanelState {
  readonly resource: DefinedResource;
  readonly environment: Environment;
  readonly documentId: string;
  /** Values of the params that have their own control, keyed by param name. */
  readonly paramValues: ReadonlyMap<string, string>;
  /** Text of the URL field — what Send will use. */
  readonly url: string;
  /** True once the user edits the URL, until the next input change. */
  readonly urlIsManual: boolean;
}

export function createHeaderPanelState(
  resource: DefinedResource,
): HeaderPanelState {
  return recompose({
    resource,
    environment: "ent1",
    documentId: "",
    paramValues: new Map(),
    url: "",
    urlIsManual: false,
  });
}

/** Rebuilds the URL from the inputs, discarding any manual edit. */
function recompose(state: HeaderPanelState): HeaderPanelState {
  return { ...state, url: composeUrl(state), urlIsManual: false };
}

/**
 * Takes the URL field's text verbatim. Nothing is parsed back into the inputs;
 * the text survives until the next input change recomposes over it.
 */
export function editUrl(
  state: HeaderPanelState,
  url: string,
): HeaderPanelState {
  return { ...state, url, urlIsManual: true };
}

export function setEnvironment(
  state: HeaderPanelState,
  environment: Environment,
): HeaderPanelState {
  return recompose({ ...state, environment });
}

export function setDocumentId(
  state: HeaderPanelState,
  documentId: string,
): HeaderPanelState {
  return recompose({ ...state, documentId });
}

export function setParam(
  state: HeaderPanelState,
  name: string,
  value: string,
): HeaderPanelState {
  const paramValues = new Map(state.paramValues);
  paramValues.set(name, value);
  return recompose({ ...state, paramValues });
}

function apigeeBase(environment: Environment): string {
  return `https://api-${environment}-openapi.cloudready-nonprod.cloud.si.orange.es/jwt`;
}

const ZUUL_BASES: Readonly<Record<Environment, string>> = {
  ent1: "https://zuul-uat2.int.si.orange.es:9061",
  ent2: "https://zuul-uat.int.si.orange.es:9061",
  ase: "https://zuul-ase.int.si.orange.es:9061",
};

/**
 * The header panel that belongs with the current selection: a fresh one for a
 * newly chosen Resource, the existing one when the same Resource is chosen
 * again (so typed input survives a stray click), and none at all when the
 * selection cannot be sent.
 */
export function headerPanelFor(
  view: MainPanelView,
  current: HeaderPanelState | null,
): HeaderPanelState | null {
  if (view.kind !== "resource") return null;
  return current?.resource.id === view.resource.id
    ? current
    : createHeaderPanelState(view.resource);
}

/** One param control the header panel renders. */
export interface ParamControl {
  readonly name: string;
  readonly kind: ParamKind;
  /** Choices for a dropdown; empty for a text control. */
  readonly options: readonly string[];
  readonly value: string;
  /** True when leaving it empty is allowed and drops it from the URL. */
  readonly canBeEmpty: boolean;
}

/**
 * The params the user drives directly. A param fed by the Document ID field
 * gets no control of its own — it would be a second place to type the same
 * value.
 */
export function paramControls(
  state: HeaderPanelState,
): readonly ParamControl[] {
  return state.resource.request.params
    .filter((param) => param.source === null)
    .map((param) => ({
      name: param.name,
      kind: param.kind,
      options: param.options,
      value: state.paramValues.get(param.name) ?? "",
      canBeEmpty: param.omitWhenEmpty,
    }));
}

/** What the read-only Gateway indicator reports; never stored, always derived. */
export type GatewayIndicator = "zuul" | "apigee" | "neutral";

/**
 * Reads the Gateway out of the URL text, so the indicator stays truthful even
 * when the field has been hand-edited.
 *
 * The spec words the Zuul rule as the `https://zuul.` prefix, but every Zuul
 * base it mandates is `https://zuul-…` (zuul-uat2, zuul-uat, zuul-ase), so the
 * literal rule would report neutral for every real Zuul request. Both forms
 * count as Zuul here; see the ticket 03 comment.
 */
export function gatewayIndicator(url: string): GatewayIndicator {
  if (url.startsWith("https://zuul.") || url.startsWith("https://zuul-")) {
    return "zuul";
  }
  if (url.startsWith("https://api-")) return "apigee";
  return "neutral";
}

function composeUrl(state: HeaderPanelState): string {
  const { gateway, path } = state.resource.request;
  const base =
    gateway === "apigee"
      ? apigeeBase(state.environment)
      : ZUUL_BASES[state.environment];
  const query = composeQuery(state);
  return `${base}${path}${query === "" ? "" : `?${query}`}`;
}

/** Params keep the Catalog's order; an empty one leaves no name and no value. */
function composeQuery(state: HeaderPanelState): string {
  return state.resource.request.params
    .map((param) => ({ param, value: valueOf(param, state) }))
    .filter(({ param, value }) => value !== "" || !param.omitWhenEmpty)
    .map(
      ({ param, value }) =>
        `${encodeURIComponent(param.name)}=${encodeURIComponent(value)}`,
    )
    .join("&");
}

function valueOf(
  param: DefinedResource["request"]["params"][number],
  state: HeaderPanelState,
): string {
  return param.source === "documentId"
    ? state.documentId
    : (state.paramValues.get(param.name) ?? "");
}
