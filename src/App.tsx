import { createInitialShellState } from "./engine";

const shell = createInitialShellState();

export default function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <h1 className="app-title">Probador de Recursos</h1>
      </header>
      <div className="app-body">
        <aside className="side-panel">
          <h2 className="panel-title">Servicios</h2>
          {shell.services.length === 0 && (
            <p className="empty-hint">Aún no hay servicios configurados.</p>
          )}
        </aside>
        <main className="main-panel">
          {shell.selectedResource === null && (
            <p className="empty-hint">Selecciona un recurso para empezar.</p>
          )}
        </main>
      </div>
    </div>
  );
}
