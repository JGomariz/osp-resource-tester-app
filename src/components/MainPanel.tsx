import type { MainPanelView } from "../engine";

interface MainPanelProps {
  view: MainPanelView;
}

/** Main panel. The engine has already decided which of the three states it is. */
export function MainPanel({ view }: MainPanelProps) {
  if (view.kind === "resource") {
    return (
      <section className="resource-panel">
        <h2 className="resource-name">{view.resource.name}</h2>
        <p className="panel-placeholder">
          Aquí irá el panel de cabecera: entorno, Document ID, parámetros, URL
          final y el botón de envío.
        </p>
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
