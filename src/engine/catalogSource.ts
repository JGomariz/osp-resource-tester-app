/**
 * Where the Catalog comes from: the user-editable override in the OS config
 * directory, or the copy bundled in the binary.
 *
 * The rule this file exists to enforce is that a maintainer's typo never
 * bricks the app. Every way the override can fail — missing, unreadable,
 * unparseable, invalid — ends with a working tree on screen and a warning
 * that names the file and the reason, never with a dead application.
 *
 * File access is injected, the same way the send flow injects its transport,
 * so the decision is testable without touching a disk.
 */

import type { Catalog } from "./catalog";
import { parseCatalog } from "./catalog";

export interface CatalogStore {
  /** Absolute path of the override, whether or not it exists yet. */
  path(): Promise<string>;
  /** The override's contents, or null when it is not there. */
  read(): Promise<string | null>;
  write(text: string): Promise<void>;
}

/** The Catalog compiled into the binary, and the exact text to copy from it. */
export interface BundledCatalog {
  readonly catalog: Catalog;
  readonly text: string;
}

export type CatalogOrigin =
  /** Read from the override. */
  | "override"
  /** The override did not exist and has just been written. */
  | "created"
  /** The override could not be used; the bundled copy is on screen. */
  | "bundled";

export interface CatalogLoad {
  readonly catalog: Catalog;
  readonly origin: CatalogOrigin;
  /** The override's path, or null when it could not even be located. */
  readonly path: string | null;
  /** Spanish warning naming file and reason, or null when all was well. */
  readonly warning: string | null;
}

const FELL_BACK = "Se ha usado el catálogo incluido en la aplicación.";

export async function loadCatalog(
  store: CatalogStore,
  bundled: BundledCatalog,
): Promise<CatalogLoad> {
  let path: string;
  try {
    path = await store.path();
  } catch (error) {
    // Without a path there is no override to speak of, and nothing to name in
    // a message beyond the reason itself.
    return fallback(bundled, null, `No se pudo localizar la carpeta de configuración: ${reasonOf(error)}.`);
  }

  let text: string | null;
  try {
    text = await store.read();
  } catch (error) {
    return fallback(bundled, path, `No se pudo abrir el catálogo de ${path}: ${reasonOf(error)}.`);
  }

  if (text === null) return create(store, bundled, path);

  return use(text, bundled, path);
}

/** First run: the override becomes a copy of the bundled default. */
async function create(
  store: CatalogStore,
  bundled: BundledCatalog,
  path: string,
): Promise<CatalogLoad> {
  try {
    await store.write(bundled.text);
  } catch (error) {
    return fallback(bundled, path, `No se pudo crear el catálogo en ${path}: ${reasonOf(error)}.`);
  }
  return {
    catalog: bundled.catalog,
    origin: "created",
    path,
    warning: null,
  };
}

/**
 * Reads what the maintainer left in the file. A file that cannot be used is
 * never repaired or overwritten — their work stays exactly as they typed it,
 * so they can find the typo the warning describes.
 */
function use(
  text: string,
  bundled: BundledCatalog,
  path: string,
): CatalogLoad {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    return fallback(
      bundled,
      path,
      `El catálogo de ${path} no es un JSON válido: ${reasonOf(error)}.`,
    );
  }

  const result = parseCatalog(json);
  if (!result.ok) {
    return fallback(
      bundled,
      path,
      `El catálogo de ${path} no es válido: ${result.errors.join(" ")}`,
    );
  }

  return { catalog: result.catalog, origin: "override", path, warning: null };
}

function fallback(
  bundled: BundledCatalog,
  path: string | null,
  problem: string,
): CatalogLoad {
  return {
    catalog: bundled.catalog,
    origin: "bundled",
    path,
    warning: `${problem} ${FELL_BACK}`,
  };
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
