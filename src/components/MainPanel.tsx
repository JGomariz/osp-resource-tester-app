import type {
  HeaderPanelState,
  MainPanelView,
  SendOutcome,
  SessionState,
} from "../engine";
import { DiagnosticsPanel } from "./DiagnosticsPanel";
import { HeaderPanel } from "./HeaderPanel";
import { ResponsePanel } from "./ResponsePanel";

interface MainPanelProps {
  view: MainPanelView;
  header: HeaderPanelState | null;
  onHeaderChange: (next: HeaderPanelState) => void;
  onSend: () => void;
  isSending: boolean;
  outcome: SendOutcome | null;
  session: SessionState;
  onSessionChange: (next: SessionState) => void;
}

/** Main panel. The engine has already decided which of the three states it is. */
export function MainPanel({
  view,
  header,
  onHeaderChange,
  onSend,
  isSending,
  outcome,
  session,
  onSessionChange,
}: MainPanelProps) {
  if (view.kind === "resource" && header !== null) {
    return (
      <section className="resource-panel">
        <h2 className="resource-name">{view.resource.name}</h2>
        <HeaderPanel
          state={header}
          onChange={onHeaderChange}
          onSend={onSend}
          isSending={isSending}
        />
        <DiagnosticsPanel session={session} onChange={onSessionChange} />
        <ResponsePanel outcome={outcome} isSending={isSending} />
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
