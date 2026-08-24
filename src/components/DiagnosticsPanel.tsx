import { useEffect, useState } from "react";
import type { SessionState } from "../engine";
import { SKIP_TLS_LABEL, setSkipTlsVerification } from "../engine";

interface DiagnosticsPanelProps {
  session: SessionState;
  onChange: (next: SessionState) => void;
}

/**
 * The two session-scoped diagnostics: the switch that stops verifying
 * certificates, and the last Token, there to be read or copied. Both belong to
 * the session rather than to the Resource, so switching Resource leaves them be.
 */
export function DiagnosticsPanel({ session, onChange }: DiagnosticsPanelProps) {
  return (
    <section className="diagnostics-panel">
      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={session.skipTlsVerification}
          onChange={(event) =>
            onChange(setSkipTlsVerification(session, event.target.checked))
          }
        />
        <span>{SKIP_TLS_LABEL}</span>
      </label>

      <TokenInspector token={session.lastToken} />
    </section>
  );
}

/** How the last copy attempt went; shown briefly, then forgotten. */
type CopyState = "idle" | "copied" | "failed";

const COPY_FEEDBACK: Readonly<Record<CopyState, string>> = {
  idle: "",
  copied: "Copiado",
  failed: "No se pudo copiar",
};

function TokenInspector({ token }: { token: string | null }) {
  const [copyState, setCopyState] = useState<CopyState>("idle");

  useEffect(() => {
    if (copyState === "idle") return;
    const timer = window.setTimeout(() => setCopyState("idle"), 2500);
    return () => window.clearTimeout(timer);
  }, [copyState]);

  async function copy() {
    if (token === null) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopyState("copied");
    } catch {
      // No clipboard, or permission refused. Saying so beats a dead button.
      setCopyState("failed");
    }
  }

  return (
    <details className="token-inspector">
      <summary className="token-summary">Último token</summary>
      {token === null ? (
        <p className="empty-hint token-empty">
          Todavía no se ha generado ningún token en esta sesión.
        </p>
      ) : (
        <div className="token-body">
          <code className="token-value">{token}</code>
          <div className="token-actions">
            <button type="button" className="copy-button" onClick={copy}>
              Copiar
            </button>
            <span className="copy-feedback" role="status">
              {COPY_FEEDBACK[copyState]}
            </span>
          </div>
        </div>
      )}
    </details>
  );
}
