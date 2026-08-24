import { useState } from "react";
import { bundledCatalog } from "./catalog/bundledCatalog";
import { createTreeState, mainPanelView, selectNode, treeRows } from "./engine";
import { CatalogTree } from "./components/CatalogTree";
import { MainPanel } from "./components/MainPanel";

const initialState = createTreeState(bundledCatalog());

export default function App() {
  const [tree, setTree] = useState(initialState);

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1 className="app-title">Probador de Recursos</h1>
      </header>
      <div className="app-body">
        <aside className="side-panel">
          <h2 className="panel-title">Servicios</h2>
          <CatalogTree
            rows={treeRows(tree)}
            onSelect={(id) => setTree(selectNode(tree, id))}
          />
        </aside>
        <main className="main-panel">
          <MainPanel view={mainPanelView(tree)} />
        </main>
      </div>
    </div>
  );
}
