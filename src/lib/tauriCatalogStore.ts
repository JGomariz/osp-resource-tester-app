import { invoke } from "@tauri-apps/api/core";
import type { CatalogStore } from "../engine";

/**
 * Production CatalogStore: the OS config directory, reached through the Rust
 * commands. Only the OS knows where that directory is, so the path is asked
 * for rather than built here.
 */
export const tauriCatalogStore: CatalogStore = {
  path: () => invoke<string>("catalog_path"),
  read: () => invoke<string | null>("catalog_read"),
  write: (contents: string) => invoke<void>("catalog_write", { contents }),
};

/** Opens the Catalog in the OS file manager. */
export function revealCatalog(): Promise<void> {
  return invoke<void>("catalog_reveal");
}
