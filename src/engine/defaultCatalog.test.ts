import { describe, expect, it } from "vitest";
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
