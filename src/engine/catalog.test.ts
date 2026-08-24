import { describe, expect, it } from "vitest";
import { parseCatalog } from "./catalog";

/** A single defined Resource named Lines, so param tests vary only the params. */
function definedResourceWithParams(params: readonly unknown[]) {
  return parseCatalog({
    nodes: [
      {
        kind: "resource",
        name: "Lines",
        method: "GET",
        gateway: "apigee",
        path: "/lines",
        params,
      },
    ],
  });
}

describe("parseCatalog", () => {
  it("reads a Service containing a defined Resource", () => {
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
              params: [
                { name: "docId", kind: "text", source: "documentId" },
                {
                  name: "status",
                  kind: "dropdown",
                  options: ["active", "inactive"],
                },
              ],
            },
          ],
        },
      ],
    });

    expect(result).toEqual({
      ok: true,
      catalog: {
        nodes: [
          {
            kind: "service",
            id: "CRMB2B",
            name: "CRMB2B",
            children: [
              {
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
                      name: "status",
                      kind: "dropdown",
                      options: ["active", "inactive"],
                      source: null,
                      omitWhenEmpty: true,
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
    });
  });

  it("reads a Resource with no request specification as an undefined Resource", () => {
    const result = parseCatalog({
      nodes: [{ kind: "resource", name: "Customer Products" }],
    });

    expect(result).toEqual({
      ok: true,
      catalog: {
        nodes: [
          {
            kind: "resource",
            id: "Customer Products",
            name: "Customer Products",
            request: null,
          },
        ],
      },
    });
  });

  it("rejects a Catalog whose root has no list of nodes", () => {
    expect(parseCatalog({ servicios: [] })).toEqual({
      ok: false,
      errors: ["El catálogo debe tener una lista 'nodes' en la raíz."],
    });
  });

  it("rejects a Catalog that is not an object", () => {
    expect(parseCatalog("CRMB2B")).toEqual({
      ok: false,
      errors: ["El catálogo debe ser un objeto JSON."],
    });
  });

  it("rejects a node with no name, pointing at its position", () => {
    expect(parseCatalog({ nodes: [{ kind: "service" }] })).toEqual({
      ok: false,
      errors: ["nodes[0]: falta el campo 'name'."],
    });
  });

  it("rejects a node whose kind is neither service nor resource", () => {
    expect(
      parseCatalog({ nodes: [{ kind: "endpoint", name: "MDG" }] }),
    ).toEqual({
      ok: false,
      errors: ["MDG: 'kind' debe ser 'service' o 'resource', no 'endpoint'."],
    });
  });

  it("names the containing Service when a child node is malformed", () => {
    expect(
      parseCatalog({
        nodes: [{ kind: "service", name: "CRMB2B", children: ["Lines"] }],
      }),
    ).toEqual({
      ok: false,
      errors: ["CRMB2B/children[0]: cada nodo debe ser un objeto JSON."],
    });
  });

  it("rejects a Service whose children are not a list", () => {
    expect(
      parseCatalog({
        nodes: [{ kind: "service", name: "CRMB2B", children: {} }],
      }),
    ).toEqual({
      ok: false,
      errors: ["CRMB2B: 'children' debe ser una lista."],
    });
  });

  it("rejects a half-specified Resource, naming the missing field", () => {
    expect(
      parseCatalog({
        nodes: [
          {
            kind: "resource",
            name: "Lines",
            method: "GET",
            gateway: "apigee",
          },
        ],
      }),
    ).toEqual({
      ok: false,
      errors: [
        "Lines: falta 'path'. Un recurso definido necesita 'method', 'gateway' y 'path'; quítalos todos para dejarlo sin configurar.",
      ],
    });
  });

  it("rejects a Resource whose gateway is neither zuul nor apigee", () => {
    expect(
      parseCatalog({
        nodes: [
          {
            kind: "resource",
            name: "Lines",
            method: "GET",
            gateway: "kong",
            path: "/lines",
          },
        ],
      }),
    ).toEqual({
      ok: false,
      errors: ["Lines: 'gateway' debe ser 'zuul' o 'apigee', no 'kong'."],
    });
  });

  it("rejects a Resource path that does not start with a slash", () => {
    expect(
      parseCatalog({
        nodes: [
          {
            kind: "resource",
            name: "Lines",
            method: "GET",
            gateway: "apigee",
            path: "crbproductinventory/v1/lines",
          },
        ],
      }),
    ).toEqual({
      ok: false,
      errors: ["Lines: 'path' debe empezar por '/'."],
    });
  });

  it("rejects params declared on a Resource left without a request", () => {
    expect(
      parseCatalog({
        nodes: [
          {
            kind: "resource",
            name: "Customer Products",
            params: [{ name: "docId", kind: "text" }],
          },
        ],
      }),
    ).toEqual({
      ok: false,
      errors: [
        "Customer Products: 'params' solo se admite en un recurso con 'method', 'gateway' y 'path'.",
      ],
    });
  });

  it("rejects a param with no query-param name", () => {
    expect(definedResourceWithParams([{ kind: "text" }])).toEqual({
      ok: false,
      errors: ["Lines: params[0] necesita un campo 'name'."],
    });
  });

  it("rejects a param whose kind is neither text nor dropdown", () => {
    expect(
      definedResourceWithParams([{ name: "status", kind: "checkbox" }]),
    ).toEqual({
      ok: false,
      errors: [
        "Lines: params[0] ('status'): 'kind' debe ser 'text' o 'dropdown', no 'checkbox'.",
      ],
    });
  });

  it("rejects a dropdown param with no options to choose from", () => {
    expect(
      definedResourceWithParams([{ name: "status", kind: "dropdown" }]),
    ).toEqual({
      ok: false,
      errors: [
        "Lines: params[0] ('status'): un desplegable necesita 'options' con al menos una opción.",
      ],
    });
  });

  it("rejects a param bound to an unknown source", () => {
    expect(
      definedResourceWithParams([
        { name: "docId", kind: "text", source: "environment" },
      ]),
    ).toEqual({
      ok: false,
      errors: [
        "Lines: params[0] ('docId'): 'source' solo admite 'documentId', no 'environment'.",
      ],
    });
  });

  it("rejects two sibling nodes sharing a name, since names identify nodes", () => {
    expect(
      parseCatalog({
        nodes: [
          {
            kind: "service",
            name: "CRMB2B",
            children: [
              { kind: "resource", name: "Lines" },
              { kind: "resource", name: "Lines" },
            ],
          },
          { kind: "service", name: "CRMB2B" },
        ],
      }),
    ).toEqual({
      ok: false,
      errors: [
        "CRMB2B tiene dos nodos llamados 'Lines'.",
        "El catálogo tiene dos nodos llamados 'CRMB2B'.",
      ],
    });
  });

  it("rejects a slash in a name, which would forge another node's identity", () => {
    expect(
      parseCatalog({ nodes: [{ kind: "service", name: "CRMB2B/Lines" }] }),
    ).toEqual({
      ok: false,
      errors: [
        "nodes[0]: el nombre 'CRMB2B/Lines' no puede contener '/', porque los nombres identifican a los nodos.",
      ],
    });
  });

  it("reports every problem at once so a maintainer fixes them in one pass", () => {
    expect(
      parseCatalog({
        nodes: [
          { kind: "service" },
          { kind: "resource", name: "Lines", gateway: "kong" },
        ],
      }),
    ).toEqual({
      ok: false,
      errors: [
        "nodes[0]: falta el campo 'name'.",
        "Lines: faltan 'method' y 'path'. Un recurso definido necesita 'method', 'gateway' y 'path'; quítalos todos para dejarlo sin configurar.",
      ],
    });
  });

  it("reads a Service with no children as an undefined Service", () => {
    const result = parseCatalog({ nodes: [{ kind: "service", name: "MDG" }] });

    expect(result).toEqual({
      ok: true,
      catalog: {
        nodes: [{ kind: "service", id: "MDG", name: "MDG", children: [] }],
      },
    });
  });
});
