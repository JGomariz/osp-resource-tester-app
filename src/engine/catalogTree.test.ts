import { describe, expect, it } from "vitest";
import type { Catalog } from "./catalog";
import { parseCatalog } from "./catalog";
import { createTreeState, mainPanelView, selectNode, treeRows } from "./catalogTree";

/** The shape of the real Catalog in miniature: nesting, defined and not. */
function specCatalog(): Catalog {
  const result = parseCatalog({
    nodes: [
      {
        kind: "service",
        name: "CRMB2B",
        children: [
          {
            kind: "resource",
            name: "Lines",
            method: "GET",
            gateway: "apigee",
            path: "/crbproductinventory/v1/lines",
          },
          { kind: "resource", name: "Customer Products" },
        ],
      },
      { kind: "service", name: "MDG" },
    ],
  });
  if (!result.ok) throw new Error(result.errors.join(" "));
  return result.catalog;
}

describe("treeRows", () => {
  it("lists every node with its depth, Services expanded so the whole tree shows", () => {
    const rows = treeRows(createTreeState(specCatalog()));

    expect(rows).toEqual([
      {
        id: "CRMB2B",
        name: "CRMB2B",
        kind: "service",
        depth: 0,
        isExpandable: true,
        isExpanded: true,
        isSelected: false,
        isDefined: true,
      },
      {
        id: "CRMB2B/Lines",
        name: "Lines",
        kind: "resource",
        depth: 1,
        isExpandable: false,
        isExpanded: false,
        isSelected: false,
        isDefined: true,
      },
      {
        id: "CRMB2B/Customer Products",
        name: "Customer Products",
        kind: "resource",
        depth: 1,
        isExpandable: false,
        isExpanded: false,
        isSelected: false,
        isDefined: false,
      },
      {
        id: "MDG",
        name: "MDG",
        kind: "service",
        depth: 0,
        isExpandable: false,
        isExpanded: false,
        isSelected: false,
        isDefined: false,
      },
    ]);
  });
});

/** The ids a given state renders, top to bottom. */
function visibleIds(state: Parameters<typeof treeRows>[0]): string[] {
  return treeRows(state).map((row) => row.id);
}

describe("selectNode", () => {
  it("marks the chosen node as the only selected row", () => {
    const state = selectNode(createTreeState(specCatalog()), "CRMB2B/Lines");

    expect(
      treeRows(state)
        .filter((row) => row.isSelected)
        .map((row) => row.id),
    ).toEqual(["CRMB2B/Lines"]);
  });

  it("choosing an expanded Service collapses it, hiding its Resources", () => {
    const collapsed = selectNode(createTreeState(specCatalog()), "CRMB2B");

    expect(visibleIds(collapsed)).toEqual(["CRMB2B", "MDG"]);
    expect(treeRows(collapsed)[0]?.isExpanded).toBe(false);
  });

  it("choosing a collapsed Service brings its Resources back", () => {
    const state = createTreeState(specCatalog());
    const reopened = selectNode(selectNode(state, "CRMB2B"), "CRMB2B");

    expect(visibleIds(reopened)).toEqual(visibleIds(state));
  });

  it("leaves the tree shape alone for a node that cannot expand", () => {
    const state = createTreeState(specCatalog());

    expect(visibleIds(selectNode(state, "MDG"))).toEqual(visibleIds(state));
    expect(visibleIds(selectNode(state, "CRMB2B/Lines"))).toEqual(
      visibleIds(state),
    );
  });

  it("ignores an id that is not in the Catalog", () => {
    const state = createTreeState(specCatalog());

    expect(selectNode(state, "Eunomia/Ghost")).toEqual(state);
  });
});

describe("mainPanelView", () => {
  it("asks for a Resource while nothing is selected", () => {
    expect(mainPanelView(createTreeState(specCatalog()))).toEqual({
      kind: "no-resource-selected",
    });
  });

  it("asks for a Resource while a Service holding Resources is selected", () => {
    const state = selectNode(createTreeState(specCatalog()), "CRMB2B");

    expect(mainPanelView(state)).toEqual({ kind: "no-resource-selected" });
  });

  it("reports an unconfigured Resource by name instead of a form", () => {
    const state = selectNode(
      createTreeState(specCatalog()),
      "CRMB2B/Customer Products",
    );

    expect(mainPanelView(state)).toEqual({
      kind: "not-configured",
      name: "Customer Products",
    });
  });

  it("reports an empty Service as unconfigured too", () => {
    const state = selectNode(createTreeState(specCatalog()), "MDG");

    expect(mainPanelView(state)).toEqual({
      kind: "not-configured",
      name: "MDG",
    });
  });

  it("hands over the request specification of a defined Resource", () => {
    const state = selectNode(createTreeState(specCatalog()), "CRMB2B/Lines");

    expect(mainPanelView(state)).toEqual({
      kind: "resource",
      resource: {
        kind: "resource",
        id: "CRMB2B/Lines",
        name: "Lines",
        request: {
          method: "GET",
          gateway: "apigee",
          path: "/crbproductinventory/v1/lines",
          params: [],
        },
      },
    });
  });
});
