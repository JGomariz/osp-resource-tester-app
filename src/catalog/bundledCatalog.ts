import type { BundledCatalog, Catalog } from "../engine";
import { parseCatalog } from "../engine";
import defaultCatalogJson from "./default-catalog.json";

/**
 * The Catalog that ships inside the binary. Its validity is covered by
 * `defaultCatalog.test.ts`, so a failure here means the bundle was tampered
 * with, not that a maintainer made a typo — that case arrives with the
 * user-editable override.
 */
export function bundledCatalog(): Catalog {
  const result = parseCatalog(defaultCatalogJson);
  if (!result.ok) {
    throw new Error(
      `El catálogo incluido en la aplicación no es válido: ${result.errors.join(" ")}`,
    );
  }
  return result.catalog;
}

/**
 * The bundled Catalog together with the text to seed the override with on a
 * first run. Re-serialised rather than read as bytes so what lands on disk is
 * guaranteed to parse, and indented because a person is going to edit it.
 */
export function bundledCatalogSource(): BundledCatalog {
  return {
    catalog: bundledCatalog(),
    text: `${JSON.stringify(defaultCatalogJson, null, 2)}\n`,
  };
}
