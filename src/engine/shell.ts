/**
 * View state of the app shell. The Catalog slice will populate `services`;
 * until then the UI renders empty-state hints from this model.
 */

export interface ShellState {
  /** Service names shown in the side panel. */
  services: readonly string[];
  /** Selected Resource; null shows the main-panel empty state. */
  selectedResource: string | null;
}

export function createInitialShellState(): ShellState {
  return {
    services: [],
    selectedResource: null,
  };
}
