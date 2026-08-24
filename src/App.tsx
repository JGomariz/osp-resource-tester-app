import { useRef, useState } from "react";
import { bundledCatalog } from "./catalog/bundledCatalog";
import type {
  HeaderPanelState,
  ResponseViewState,
  SendOutcome,
} from "./engine";
import {
  createTreeState,
  headerPanelFor,
  lastTokenAfter,
  mainPanelView,
  responseViewFor,
  selectNode,
  sendResource,
  treeRows,
} from "./engine";
import { tauriTransport } from "./lib/tauriTransport";
import { CatalogTree } from "./components/CatalogTree";
import { MainPanel } from "./components/MainPanel";
import { TokenInspector } from "./components/TokenInspector";

const initialState = createTreeState(bundledCatalog());

export default function App() {
  const [tree, setTree] = useState(initialState);
  const [header, setHeader] = useState<HeaderPanelState | null>(null);
  const [outcome, setOutcome] = useState<SendOutcome | null>(null);
  const [view, setView] = useState<ResponseViewState | null>(null);
  const [isSending, setIsSending] = useState(false);
  /**
   * Session-scoped, both of them: they belong to this run of the app rather
   * than to a Resource, so switching Resource leaves them alone and closing
   * the app forgets them. Nothing is persisted, so the toggle is off on every
   * launch by construction.
   */
  const [skipTlsVerification, setSkipTlsVerification] = useState(false);
  const [lastToken, setLastToken] = useState<string | null>(null);
  /**
   * Identifies the send whose answer is still wanted. The tree stays clickable
   * during a send, so without this an in-flight answer could land under a
   * different Resource's name.
   */
  const currentSend = useRef(0);

  function select(id: string) {
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
    const result = await sendResource(tauriTransport, header, {
      skipTlsVerification,
    });
    if (currentSend.current !== thisSend) return;
    setOutcome(result);
    setView(responseViewFor(result, view));
    setLastToken(lastTokenAfter(result, lastToken));
    setIsSending(false);
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
            onSend={send}
            isSending={isSending}
            outcome={outcome}
            responseView={view}
            onResponseViewChange={setView}
            skipTlsVerification={skipTlsVerification}
            onSkipTlsVerificationChange={setSkipTlsVerification}
          />
          {/* Outside the panel: the Token belongs to the session, so it stays
              reachable whatever the tree selection is. */}
          <TokenInspector token={lastToken} />
        </main>
      </div>
    </div>
  );
}
