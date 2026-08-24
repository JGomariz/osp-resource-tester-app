/**
 * Side-panel state model: what the tree shows, what is expanded and what is
 * selected. The UI renders {@link treeRows} and reports clicks back; every
 * decision (visibility, depth, muting) is made here.
 */

import type {
  Catalog,
  CatalogNode,
  CatalogResource,
  ResourceRequest,
} from "./catalog";

export interface TreeState {
  readonly catalog: Catalog;
  /** Ids of the Services currently showing their children. */
  readonly expanded: ReadonlySet<string>;
  readonly selectedId: string | null;
}

/** One rendered line of the side panel. */
export interface TreeRow {
  readonly id: string;
  readonly name: string;
  readonly kind: CatalogNode["kind"];
  /** Nesting level, 0 for a top-level node. */
  readonly depth: number;
  readonly isExpandable: boolean;
  readonly isExpanded: boolean;
  readonly isSelected: boolean;
  /** False for a node with nothing configured yet — shown muted. */
  readonly isDefined: boolean;
}

/** Opens every Service, so the first thing the user sees is the whole tree. */
export function createTreeState(catalog: Catalog): TreeState {
  return {
    catalog,
    expanded: new Set(expandableIds(catalog.nodes)),
    selectedId: null,
  };
}

function expandableIds(nodes: readonly CatalogNode[]): readonly string[] {
  return nodes.flatMap((node) =>
    node.kind === "service" && node.children.length > 0
      ? [node.id, ...expandableIds(node.children)]
      : [],
  );
}

/**
 * Applies a click on a tree row: the node becomes the selection, and a Service
 * holding Resources also flips between showing and hiding them. Unknown ids
 * are ignored, so the UI can hand over every click without checking first.
 */
export function selectNode(state: TreeState, id: string): TreeState {
  const node = findNode(state.catalog.nodes, id);
  if (node === null) return state;

  const expanded = new Set(state.expanded);
  if (node.kind === "service" && node.children.length > 0) {
    if (!expanded.delete(id)) expanded.add(id);
  }
  return { ...state, expanded, selectedId: id };
}

function findNode(
  nodes: readonly CatalogNode[],
  id: string,
): CatalogNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.kind === "service") {
      const found = findNode(node.children, id);
      if (found !== null) return found;
    }
  }
  return null;
}

/** The visible nodes, flattened top to bottom in the order they render. */
export function treeRows(state: TreeState): readonly TreeRow[] {
  return rowsOf(state.catalog.nodes, 0, state);
}

function rowsOf(
  nodes: readonly CatalogNode[],
  depth: number,
  state: TreeState,
): readonly TreeRow[] {
  return nodes.flatMap((node) => {
    const isExpandable = node.kind === "service" && node.children.length > 0;
    const isExpanded = isExpandable && state.expanded.has(node.id);
    const row: TreeRow = {
      id: node.id,
      name: node.name,
      kind: node.kind,
      depth,
      isExpandable,
      isExpanded,
      isSelected: state.selectedId === node.id,
      isDefined: isDefined(node),
    };
    return isExpanded && node.kind === "service"
      ? [row, ...rowsOf(node.children, depth + 1, state)]
      : [row];
  });
}

/** A Service is configured once it holds Resources; a Resource, once callable. */
function isDefined(node: CatalogNode): boolean {
  return node.kind === "service"
    ? node.children.length > 0
    : node.request !== null;
}

/** A Resource the app can actually compose a request for. */
export type DefinedResource = CatalogResource & {
  readonly request: ResourceRequest;
};

function isDefinedResource(node: CatalogNode): node is DefinedResource {
  return node.kind === "resource" && node.request !== null;
}

/** What the main panel should show — the one decision it needs from the engine. */
export type MainPanelView =
  | { readonly kind: "no-resource-selected" }
  | { readonly kind: "not-configured"; readonly name: string }
  | { readonly kind: "resource"; readonly resource: DefinedResource };

export function mainPanelView(state: TreeState): MainPanelView {
  const node =
    state.selectedId === null
      ? null
      : findNode(state.catalog.nodes, state.selectedId);

  if (node === null) return { kind: "no-resource-selected" };
  if (isDefinedResource(node)) return { kind: "resource", resource: node };
  if (!isDefined(node)) return { kind: "not-configured", name: node.name };
  return { kind: "no-resource-selected" };
}
