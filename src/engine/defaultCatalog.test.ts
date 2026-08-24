import { describe, expect, it } from "vitest";
import { bundledCatalogSource } from "../catalog/bundledCatalog";
import defaultCatalogJson from "../catalog/default-catalog.json";
import { parseCatalog } from "./catalog";
import { createTreeState, treeRows } from "./catalogTree";

function defaultCatalog() {
  const result = parseCatalog(defaultCatalogJson);
  if (!result.ok) {
    throw new Error(`El catálogo por defecto no es válido: ${result.errors}`);
  }
  return result.catalog;
}

describe("the bundled default Catalog", () => {
  it("is valid", () => {
    expect(parseCatalog(defaultCatalogJson).ok).toBe(true);
  });

  // This text is what a first run writes to the override, and the run after
  // it reads that file back. If the two ever disagree the app would warn
  // about a file it wrote itself, one launch later.
  it("survives the round trip through the text seeded into the override", () => {
    const { catalog, text } = bundledCatalogSource();

    const reparsed = parseCatalog(JSON.parse(text));

    expect(reparsed.ok).toBe(true);
    if (!reparsed.ok) return;
    expect(reparsed.catalog).toEqual(catalog);
  });

  it("holds the tree the spec asks for, CRMB2B first with its three Resources", () => {
    const rows = treeRows(createTreeState(defaultCatalog()));

    expect(rows.map((row) => `${"  ".repeat(row.depth)}${row.name}`)).toEqual([
      "CRMB2B",
      "  Lines",
      "  Customer Products",
      "  ServiciosCentrex",
      "MDG",
      "Line Usage B2B",
      "Customer View B2B",
      "Eunomia",
      "Excalibur",
      "Profiler",
    ]);
  });

  it("leaves every node except CRMB2B → Lines waiting to be configured", () => {
    const rows = treeRows(createTreeState(defaultCatalog()));

    expect(
      rows.filter((row) => row.isDefined).map((row) => row.id),
    ).toEqual(["CRMB2B", "CRMB2B/Lines"]);
  });

  it("defines Lines as the spec does: GET via Apigee with docId, productType and status", () => {
    const crmb2b = defaultCatalog().nodes[0];
    if (crmb2b?.kind !== "service") throw new Error("CRMB2B debe ser servicio");
    const lines = crmb2b.children[0];

    expect(lines).toEqual({
      kind: "resource",
      id: "CRMB2B/Lines",
      name: "Lines",
      request: {
        method: "GET",
        gateway: "apigee",
        path: "/crbproductinventory/v1/lines",
        params: [
          {
            name: "docId",
            kind: "text",
            options: [],
            source: "documentId",
            omitWhenEmpty: true,
          },
          {
            name: "productType",
            kind: "dropdown",
            options: ["fixed", "mobile"],
            source: null,
            omitWhenEmpty: true,
          },
          {
            name: "status",
            kind: "dropdown",
            options: ["active", "inactive"],
            source: null,
            omitWhenEmpty: true,
          },
        ],
      },
    });
  });
});
