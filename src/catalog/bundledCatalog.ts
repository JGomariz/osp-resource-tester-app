import type { Catalog } from "../engine";
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
