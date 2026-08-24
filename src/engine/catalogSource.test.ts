import { describe, expect, it } from "vitest";
import { parseCatalog } from "./catalog";
import type { Catalog } from "./catalog";
import type { BundledCatalog, CatalogStore } from "./catalogSource";
import { loadCatalog } from "./catalogSource";

const PATH = "/Users/tester/Library/Application Support/es.masorange.resourcetester/catalog.json";

function catalogText(resourceName: string): string {
  return JSON.stringify({
    nodes: [
      {
        kind: "resource",
        name: resourceName,
        method: "GET",
        gateway: "apigee",
        path: "/crbproductinventory/v1/lines",
        params: [],
      },
    ],
  });
}

function parsed(text: string): Catalog {
  const result = parseCatalog(JSON.parse(text));
  if (!result.ok) throw new Error(result.errors.join(" "));
  return result.catalog;
}

const BUNDLED_TEXT = catalogText("Lines");

function bundled(): BundledCatalog {
  return { catalog: parsed(BUNDLED_TEXT), text: BUNDLED_TEXT };
}

/** Names of the Resources a Catalog lists, to see which one was loaded. */
function resourceNames(catalog: Catalog): readonly string[] {
  return catalog.nodes.map((node) => node.name);
}

interface FakeStore extends CatalogStore {
  written: string[];
}

/** A store whose three operations can each be scripted to answer or throw. */
function fakeStore(script: {
  path?: string | Error;
  read?: string | null | Error;
  write?: Error;
}): FakeStore {
  const written: string[] = [];
  return {
    written,
    async path() {
      if (script.path instanceof Error) throw script.path;
      return script.path ?? PATH;
    },
    async read() {
      if (script.read instanceof Error) throw script.read;
      return script.read ?? null;
    },
    async write(text: string) {
      if (script.write instanceof Error) throw script.write;
      written.push(text);
    },
  };
}

describe("the first run, with no override yet", () => {
  it("creates the override as a copy of the bundled default", async () => {
    const store = fakeStore({ read: null });

    const load = await loadCatalog(store, bundled());

    expect(store.written).toEqual([BUNDLED_TEXT]);
    expect(load.origin).toBe("created");
    expect(load.warning).toBeNull();
    expect(load.path).toBe(PATH);
  });

  it("starts on the bundled Catalog it just wrote", async () => {
    const load = await loadCatalog(fakeStore({ read: null }), bundled());

    expect(resourceNames(load.catalog)).toEqual(["Lines"]);
  });
});

describe("a later run, with a valid override", () => {
  it("reads the override rather than the bundled default", async () => {
    const store = fakeStore({ read: catalogText("Lines editadas") });

    const load = await loadCatalog(store, bundled());

    expect(load.origin).toBe("override");
    expect(load.warning).toBeNull();
    // What a maintainer edited into the file is what the tree will show.
    expect(resourceNames(load.catalog)).toEqual(["Lines editadas"]);
  });

  it("does not rewrite the file it just read", async () => {
    const store = fakeStore({ read: catalogText("Lines") });

    await loadCatalog(store, bundled());

    expect(store.written).toEqual([]);
  });
});

describe("an override that is not JSON at all", () => {
  it("falls back to the bundled Catalog", async () => {
    const load = await loadCatalog(
      fakeStore({ read: "{ esto no es json" }),
      bundled(),
    );

    expect(load.origin).toBe("bundled");
    expect(resourceNames(load.catalog)).toEqual(["Lines"]);
  });

  it("warns, naming the file and saying the JSON is the problem", async () => {
    const load = await loadCatalog(
      fakeStore({ read: "{ esto no es json" }),
      bundled(),
    );

    expect(load.warning).toContain(PATH);
    expect(load.warning).toContain("JSON");
  });
});

describe("an override that is JSON but not a valid Catalog", () => {
  const invalid = JSON.stringify({ nodes: [{ kind: "resource" }] });

  it("falls back to the bundled Catalog", async () => {
    const load = await loadCatalog(fakeStore({ read: invalid }), bundled());

    expect(load.origin).toBe("bundled");
    expect(resourceNames(load.catalog)).toEqual(["Lines"]);
  });

  it("warns with the validator's own reasons, not a generic message", async () => {
    const reasons = parseCatalog(JSON.parse(invalid));
    if (reasons.ok) throw new Error("el fixture debe ser inválido");

    const load = await loadCatalog(fakeStore({ read: invalid }), bundled());

    expect(load.warning).toContain(PATH);
    for (const reason of reasons.errors) {
      expect(load.warning).toContain(reason);
    }
  });

  it("leaves the broken file alone rather than overwriting the maintainer's work", async () => {
    const store = fakeStore({ read: invalid });

    await loadCatalog(store, bundled());

    expect(store.written).toEqual([]);
  });
});

describe("a Catalog file that cannot be reached", () => {
  it("still starts, on the bundled Catalog, when the read fails", async () => {
    const load = await loadCatalog(
      fakeStore({ read: new Error("permiso denegado") }),
      bundled(),
    );

    expect(load.origin).toBe("bundled");
    expect(load.warning).toContain(PATH);
    expect(load.warning).toContain("permiso denegado");
  });

  it("still starts when the first-run copy cannot be written", async () => {
    const load = await loadCatalog(
      fakeStore({ read: null, write: new Error("disco lleno") }),
      bundled(),
    );

    expect(load.origin).toBe("bundled");
    expect(load.warning).toContain("disco lleno");
  });

  it("still starts when the config directory cannot even be located", async () => {
    const load = await loadCatalog(
      fakeStore({ path: new Error("sin directorio de configuración") }),
      bundled(),
    );

    expect(load.origin).toBe("bundled");
    expect(load.path).toBeNull();
    expect(load.warning).toContain("sin directorio de configuración");
  });
});

describe("every warning", () => {
  it("says the app fell back, so the tree on screen is never a mystery", async () => {
    const load = await loadCatalog(
      fakeStore({ read: "{ roto" }),
      bundled(),
    );

    expect(load.warning).toContain("catálogo incluido en la aplicación");
  });
});
