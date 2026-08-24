import { useState } from "react";
import { bundledCatalog } from "./catalog/bundledCatalog";
import type { HeaderPanelState } from "./engine";
import {
  createTreeState,
  headerPanelFor,
  mainPanelView,
  selectNode,
  treeRows,
} from "./engine";
import { CatalogTree } from "./components/CatalogTree";
import { MainPanel } from "./components/MainPanel";

const initialState = createTreeState(bundledCatalog());

export default function App() {
  const [tree, setTree] = useState(initialState);
  const [header, setHeader] = useState<HeaderPanelState | null>(null);

  function select(id: string) {
    const next = selectNode(tree, id);
    setTree(next);
    setHeader(headerPanelFor(mainPanelView(next), header));
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1 className="app-title">Probador de Recursos</h1>
      </header>
      <div className="app-body">
        <aside className="side-panel">
          <h2 className="panel-title">Servicios</h2>
          <CatalogTree rows={treeRows(tree)} onSelect={select} />
        </aside>
        <main className="main-panel">
          <MainPanel
            view={mainPanelView(tree)}
            header={header}
            onHeaderChange={setHeader}
          />
        </main>
      </div>
    </div>
  );
}
