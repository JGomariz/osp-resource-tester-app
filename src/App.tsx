import { useRef, useState } from "react";
import { bundledCatalog } from "./catalog/bundledCatalog";
import type { HeaderPanelState, SendOutcome } from "./engine";
import {
  createSession,
  createTreeState,
  headerPanelFor,
  mainPanelView,
  rememberToken,
  selectNode,
  sendResource,
  treeRows,
} from "./engine";
import { tauriTransport } from "./lib/tauriTransport";
import { CatalogTree } from "./components/CatalogTree";
import { DiagnosticsPanel } from "./components/DiagnosticsPanel";
import { MainPanel } from "./components/MainPanel";

const initialState = createTreeState(bundledCatalog());

export default function App() {
  const [tree, setTree] = useState(initialState);
  const [header, setHeader] = useState<HeaderPanelState | null>(null);
  const [outcome, setOutcome] = useState<SendOutcome | null>(null);
  const [isSending, setIsSending] = useState(false);
  /** Lives above the Resource, and is never persisted: a relaunch resets it. */
  const [session, setSession] = useState(createSession);
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
      setIsSending(false);
    }
  }

  async function send() {
    if (header === null) return;
    const thisSend = (currentSend.current += 1);
    setIsSending(true);
    const result = await sendResource(tauriTransport, header, session);
    if (currentSend.current !== thisSend) return;
    setOutcome(result.outcome);
    // Folded into whatever the session is by now, so a TLS toggle flipped
    // mid-send is not undone by the answer landing.
    setSession((current) => rememberToken(current, result.token));
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
          />
        </main>
      </div>
      {/* Outside the main panel on purpose: the switch and the Token belong to
          the session, not to whatever happens to be selected, so they stay put
          when the selection is a Service or an undefined Resource. */}
      <footer className="app-footer">
        <DiagnosticsPanel session={session} onChange={setSession} />
      </footer>
    </div>
  );
}
