import { useEffect, useRef, useState } from "react";
import { bundledCatalogSource } from "./catalog/bundledCatalog";
import type {
  CatalogLoad,
  HeaderPanelState,
  ResponseViewState,
  SendOutcome,
  TreeState,
} from "./engine";
import {
  createTreeState,
  headerPanelFor,
  loadCatalog,
  mainPanelView,
  responseViewFor,
  selectNode,
  sendResource,
  treeRows,
} from "./engine";
import { tauriTransport } from "./lib/tauriTransport";
import { revealCatalog, tauriCatalogStore } from "./lib/tauriCatalogStore";
import { CatalogTree } from "./components/CatalogTree";
import { CatalogWarning } from "./components/CatalogWarning";
import { MainPanel } from "./components/MainPanel";

export default function App() {
  /**
   * Null until the Catalog has been read off disk. The tree is not rendered
   * from the bundled copy first: it would be replaced a moment later, and a
   * tree that changes under the user is worse than one that arrives late.
   */
  const [tree, setTree] = useState<TreeState | null>(null);
  const [load, setLoad] = useState<CatalogLoad | null>(null);
  const [warningDismissed, setWarningDismissed] = useState(false);
  const [header, setHeader] = useState<HeaderPanelState | null>(null);
  const [outcome, setOutcome] = useState<SendOutcome | null>(null);
  const [view, setView] = useState<ResponseViewState | null>(null);
  const [isSending, setIsSending] = useState(false);
  /**
   * Identifies the send whose answer is still wanted. The tree stays clickable
   * during a send, so without this an in-flight answer could land under a
   * different Resource's name.
   */
  const currentSend = useRef(0);

  useEffect(() => {
    let live = true;
    void loadCatalog(tauriCatalogStore, bundledCatalogSource()).then(
      (result) => {
        if (!live) return;
        setLoad(result);
        setTree(createTreeState(result.catalog));
      },
    );
    return () => {
      live = false;
    };
  }, []);

  function select(id: string) {
    if (tree === null) return;
    const next = selectNode(tree, id);
    const nextHeader = headerPanelFor(mainPanelView(next), header);
    setTree(next);
    setHeader(nextHeader);
    // A different Resource means the response on screen is no longer its own,
    // and neither is any answer still on its way.
    if (nextHeader !== header) {
      currentSend.current += 1;
      setOutcome(null);
      setView(null);
      setIsSending(false);
    }
  }

  async function send() {
    if (header === null) return;
    const thisSend = (currentSend.current += 1);
    setIsSending(true);
    const result = await sendResource(tauriTransport, header);
    if (currentSend.current !== thisSend) return;
    setOutcome(result);
    setView(responseViewFor(result, view));
    setIsSending(false);
  }

  const warning = load?.warning ?? null;

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1 className="app-title">Probador de Recursos</h1>
      </header>
      {warning !== null && !warningDismissed && (
        <CatalogWarning
          warning={warning}
          onDismiss={() => setWarningDismissed(true)}
        />
      )}
      <div className="app-body">
        <aside className="side-panel">
          <h2 className="panel-title">Servicios</h2>
          {tree === null ? (
            <p className="empty-hint">Cargando catálogo…</p>
          ) : (
            <CatalogTree rows={treeRows(tree)} onSelect={select} />
          )}
          <button
            type="button"
            className="catalog-button"
            onClick={() => void revealCatalog()}
            title={load?.path ?? undefined}
          >
            Abrir catálogo
          </button>
        </aside>
        <main className="main-panel">
          {tree === null ? (
            <div className="empty-state">
              <p className="empty-hint">Cargando catálogo…</p>
            </div>
          ) : (
            <MainPanel
              view={mainPanelView(tree)}
              header={header}
              onHeaderChange={setHeader}
              onSend={send}
              isSending={isSending}
              outcome={outcome}
              responseView={view}
              onResponseViewChange={setView}
            />
          )}
        </main>
      </div>
    </div>
  );
}
