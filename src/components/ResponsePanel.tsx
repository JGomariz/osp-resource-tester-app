import type { SendOutcome } from "../engine";
import { statusClass } from "../engine";

interface ResponsePanelProps {
  outcome: SendOutcome | null;
  isSending: boolean;
}

/** Response panel. The engine has already decided what kind of outcome this is. */
export function ResponsePanel({ outcome, isSending }: ResponsePanelProps) {
  return (
    <section className="response-panel">
      {body(outcome, isSending)}
    </section>
  );
}

function body(outcome: SendOutcome | null, isSending: boolean) {
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
      <pre className="response-body">{outcome.body}</pre>
    </>
  );
}
