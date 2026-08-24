import type { ResponseViewState, SendOutcome } from "../engine";
import { statusClass } from "../engine";
import { ResponseBody } from "./ResponseBody";
import { ResponseToolbar } from "./ResponseToolbar";

interface ResponsePanelProps {
  outcome: SendOutcome | null;
  isSending: boolean;
  view: ResponseViewState | null;
  onViewChange: (next: ResponseViewState) => void;
}

/** Response panel. The engine has already decided what kind of outcome this is. */
export function ResponsePanel(props: ResponsePanelProps) {
  return <section className="response-panel">{body(props)}</section>;
}

function body({ outcome, isSending, view, onViewChange }: ResponsePanelProps) {
  if (isSending) return <p className="empty-hint">Enviando…</p>;

  if (outcome === null) {
    return (
      <p className="empty-hint">
        Pulsa «Enviar» para lanzar la petición y ver la respuesta.
      </p>
    );
  }

  if (outcome.kind === "network-error") {
    return (
      <>
        <p className="response-error">No se pudo completar la petición.</p>
        <pre className="response-body">{outcome.message}</pre>
      </>
    );
  }

  return (
    <>
      {outcome.kind === "token-failure" && (
        <p className="response-error">
          No se pudo generar el token. Esta es la respuesta del endpoint de
          token, no del recurso.
        </p>
      )}
      <div className="response-meta">
        <span className={`status-code is-${statusClass(outcome.status)}`}>
          {outcome.status}
        </span>
        <span className="response-duration">{outcome.durationMs} ms</span>
      </div>
      {view === null ? (
        // No viewer state yet: still show the body rather than imply a failure.
        <pre className="response-body">{outcome.body}</pre>
      ) : (
        <>
          <ResponseToolbar view={view} onChange={onViewChange} />
          <ResponseBody view={view} />
        </>
      )}
    </>
  );
}
