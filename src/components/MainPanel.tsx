import type { HeaderPanelState, MainPanelView } from "../engine";
import { HeaderPanel } from "./HeaderPanel";

interface MainPanelProps {
  view: MainPanelView;
  header: HeaderPanelState | null;
  onHeaderChange: (next: HeaderPanelState) => void;
}

/** Main panel. The engine has already decided which of the three states it is. */
export function MainPanel({ view, header, onHeaderChange }: MainPanelProps) {
  if (view.kind === "resource" && header !== null) {
    return (
      <section className="resource-panel">
        <h2 className="resource-name">{view.resource.name}</h2>
        <HeaderPanel state={header} onChange={onHeaderChange} />
      </section>
    );
  }

  if (view.kind === "not-configured") {
    return (
      <div className="empty-state">
        <p className="empty-state-title">
          «{view.name}» todavía no está configurado
        </p>
        <p className="empty-hint">
          Cuando su petición se defina en el catálogo, podrás lanzarla desde
          aquí.
        </p>
      </div>
    );
  }

  return (
    <div className="empty-state">
      <p className="empty-hint">Selecciona un recurso para empezar.</p>
    </div>
  );
}
