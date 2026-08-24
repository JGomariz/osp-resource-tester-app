import { describe, expect, it } from "vitest";
import type { DefinedResource } from "./catalogTree";
import { parseCatalog } from "./catalog";
import {
  createHeaderPanelState,
  editUrl,
  gatewayIndicator,
  headerPanelFor,
  paramControls,
  setDocumentId,
  setEnvironment,
  setParam,
} from "./headerPanel";

/**
 * Builds a defined Resource through the parser, so these fixtures can never
 * drift from the shape a real Catalog produces.
 */
function resource(spec: {
  name?: string;
  gateway: "zuul" | "apigee";
  path: string;
  params?: readonly unknown[];
}): DefinedResource {
  const result = parseCatalog({
    nodes: [
      {
        kind: "resource",
        name: spec.name ?? "Lines",
        method: "GET",
        gateway: spec.gateway,
        path: spec.path,
        params: spec.params,
      },
    ],
  });
  if (!result.ok) throw new Error(result.errors.join(" "));
  const node = result.catalog.nodes[0];
  if (node === undefined || node.kind !== "resource") {
    throw new Error("el fixture debe ser un recurso");
  }
  const { request } = node;
  if (request === null) {
    throw new Error("el fixture debe ser un recurso definido");
  }
  return { ...node, request };
}

/** CRMB2B → Lines as the bundled Catalog defines it. */
function lines(): DefinedResource {
  return resource({
    gateway: "apigee",
    path: "/crbproductinventory/v1/lines",
    params: [
      { name: "docId", kind: "text", source: "documentId" },
      { name: "productType", kind: "dropdown", options: ["fixed", "mobile"] },
      { name: "status", kind: "dropdown", options: ["active", "inactive"] },
    ],
  });
}

describe("createHeaderPanelState", () => {
  it("composes the Apigee base and Resource path, with no params filled in yet", () => {
    const state = createHeaderPanelState(lines());

    expect(state.url).toBe(
      "https://api-ent1-openapi.cloudready-nonprod.cloud.si.orange.es/jwt/crbproductinventory/v1/lines",
    );
    expect(state.environment).toBe("ent1");
    expect(state.documentId).toBe("");
    expect(state.urlIsManual).toBe(false);
  });
});

/** The part of the URL after the Resource path, which is what most tests vary. */
const LINES_PREFIX =
  "https://api-ent1-openapi.cloudready-nonprod.cloud.si.orange.es/jwt/crbproductinventory/v1/lines";

describe("the composed query string", () => {
  it("feeds the Document ID into the param bound to it", () => {
    const state = setDocumentId(createHeaderPanelState(lines()), "12345678Z");

    expect(state.url).toBe(`${LINES_PREFIX}?docId=12345678Z`);
  });

  it("adds the Resource's own params in the order the Catalog lists them", () => {
    let state = setDocumentId(createHeaderPanelState(lines()), "12345678Z");
    state = setParam(state, "status", "active");
    state = setParam(state, "productType", "fixed");

    expect(state.url).toBe(
      `${LINES_PREFIX}?docId=12345678Z&productType=fixed&status=active`,
    );
  });

  it("leaves no trace of a param cleared back to empty", () => {
    let state = setDocumentId(createHeaderPanelState(lines()), "12345678Z");
    state = setParam(state, "productType", "mobile");
    state = setParam(state, "productType", "");

    expect(state.url).toBe(`${LINES_PREFIX}?docId=12345678Z`);
  });

  it("drops the whole query string once every param is empty again", () => {
    let state = setDocumentId(createHeaderPanelState(lines()), "12345678Z");
    state = setDocumentId(state, "");

    expect(state.url).toBe(LINES_PREFIX);
  });

  it("escapes values so a typed space cannot break the URL", () => {
    const state = setDocumentId(createHeaderPanelState(lines()), "12 34&56");

    expect(state.url).toBe(`${LINES_PREFIX}?docId=12%2034%2656`);
  });
});

describe("the Gateway base", () => {
  const urlsPerEnvironment = (gateway: "zuul" | "apigee") => {
    const state = createHeaderPanelState(resource({ gateway, path: "/ping" }));
    return {
      ent1: setEnvironment(state, "ent1").url,
      ent2: setEnvironment(state, "ent2").url,
      ase: setEnvironment(state, "ase").url,
    };
  };

  it("aims an Apigee Resource at the Environment's Apigee host", () => {
    expect(urlsPerEnvironment("apigee")).toEqual({
      ent1: "https://api-ent1-openapi.cloudready-nonprod.cloud.si.orange.es/jwt/ping",
      ent2: "https://api-ent2-openapi.cloudready-nonprod.cloud.si.orange.es/jwt/ping",
      ase: "https://api-ase-openapi.cloudready-nonprod.cloud.si.orange.es/jwt/ping",
    });
  });

  it("aims a Zuul Resource at the Environment's Zuul host", () => {
    expect(urlsPerEnvironment("zuul")).toEqual({
      ent1: "https://zuul-uat2.int.si.orange.es:9061/ping",
      ent2: "https://zuul-uat.int.si.orange.es:9061/ping",
      ase: "https://zuul-ase.int.si.orange.es:9061/ping",
    });
  });
});

describe("editUrl", () => {
  it("keeps a hand-typed URL exactly as typed", () => {
    const state = editUrl(
      createHeaderPanelState(lines()),
      "https://otro.host/probando?a=1",
    );

    expect(state.url).toBe("https://otro.host/probando?a=1");
    expect(state.urlIsManual).toBe(true);
  });

  it("is overwritten by the next change to any input", () => {
    const edited = editUrl(createHeaderPanelState(lines()), "https://a-mano");

    for (const state of [
      setEnvironment(edited, "ase"),
      setDocumentId(edited, "12345678Z"),
      setParam(edited, "status", "active"),
    ]) {
      expect(state.url).not.toBe("https://a-mano");
      expect(state.urlIsManual).toBe(false);
    }
  });

  it("changes the Gateway the indicator reports, because it reads the text", () => {
    const state = editUrl(
      createHeaderPanelState(lines()),
      "https://zuul-uat.int.si.orange.es:9061/crbproductinventory/v1/lines",
    );

    expect(gatewayIndicator(state.url)).toBe("zuul");
  });

  it("leaves the inputs untouched, since composition is one-way", () => {
    const state = editUrl(
      setDocumentId(createHeaderPanelState(lines()), "12345678Z"),
      "https://api-ase-openapi.cloudready-nonprod.cloud.si.orange.es/jwt/otra?docId=99",
    );

    expect(state.environment).toBe("ent1");
    expect(state.documentId).toBe("12345678Z");
  });
});

describe("headerPanelFor", () => {
  it("opens a fresh panel for a newly selected Resource", () => {
    const state = headerPanelFor({ kind: "resource", resource: lines() }, null);

    expect(state?.resource.name).toBe("Lines");
    expect(state?.documentId).toBe("");
  });

  it("keeps what the user typed when the same Resource is selected again", () => {
    const typed = setDocumentId(createHeaderPanelState(lines()), "12345678Z");

    expect(
      headerPanelFor({ kind: "resource", resource: lines() }, typed),
    ).toBe(typed);
  });

  it("starts over when a different Resource is selected", () => {
    const typed = setDocumentId(createHeaderPanelState(lines()), "12345678Z");
    const other = resource({
      name: "Customer Products",
      gateway: "zuul",
      path: "/otra",
    });

    expect(
      headerPanelFor({ kind: "resource", resource: other }, typed)?.documentId,
    ).toBe("");
  });

  it("closes the panel when the selection is not a defined Resource", () => {
    const typed = setDocumentId(createHeaderPanelState(lines()), "12345678Z");

    expect(headerPanelFor({ kind: "no-resource-selected" }, typed)).toBeNull();
    expect(
      headerPanelFor({ kind: "not-configured", name: "MDG" }, typed),
    ).toBeNull();
  });
});

describe("paramControls", () => {
  it("offers a control per param, skipping the one the Document ID field feeds", () => {
    const state = setParam(
      createHeaderPanelState(lines()),
      "productType",
      "mobile",
    );

    expect(paramControls(state)).toEqual([
      {
        name: "productType",
        kind: "dropdown",
        options: ["fixed", "mobile"],
        value: "mobile",
        canBeEmpty: true,
      },
      {
        name: "status",
        kind: "dropdown",
        options: ["active", "inactive"],
        value: "",
        canBeEmpty: true,
      },
    ]);
  });

  it("gives a text param its own control when nothing else feeds it", () => {
    const state = createHeaderPanelState(
      resource({
        gateway: "zuul",
        path: "/ping",
        params: [{ name: "msisdn", kind: "text" }],
      }),
    );

    expect(paramControls(state)).toEqual([
      {
        name: "msisdn",
        kind: "text",
        options: [],
        value: "",
        canBeEmpty: true,
      },
    ]);
  });
});

describe("gatewayIndicator", () => {
  it("reads an api- host as Apigee", () => {
    expect(
      gatewayIndicator(
        "https://api-ent1-openapi.cloudready-nonprod.cloud.si.orange.es/jwt/lines",
      ),
    ).toBe("apigee");
  });

  it("reads a zuul host as Zuul, both the dotted and the dashed form", () => {
    expect(gatewayIndicator("https://zuul.int.si.orange.es:9061/lines")).toBe(
      "zuul",
    );
    expect(
      gatewayIndicator("https://zuul-uat2.int.si.orange.es:9061/lines"),
    ).toBe("zuul");
  });

  it("stays neutral for anything else, including an empty field", () => {
    expect(gatewayIndicator("")).toBe("neutral");
    expect(gatewayIndicator("https://otro.host/lines")).toBe("neutral");
    expect(gatewayIndicator("http://api-ent1-openapi.example/jwt")).toBe(
      "neutral",
    );
    expect(gatewayIndicator("https://zuulnope.example/lines")).toBe("neutral");
  });
});
