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

/**
 * Copies through the Clipboard API where it exists, and through a throwaway
 * selection where it does not.
 *
 * The fallback is not belt and braces: `navigator.clipboard` is only defined
 * in a secure context, and while the dev server is `http://localhost:1420`,
 * which counts as one, the packaged app is served from `tauri://localhost`,
 * which is not guaranteed to. Without this, Copy could work all through
 * development and be dead in the shipped binary.
 */
async function writeToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return copyBySelection(text);
  }
}

function copyBySelection(text: string): boolean {
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.appendChild(field);
  field.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    field.remove();
  }
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
    setCopyState((await writeToClipboard(token)) ? "copied" : "failed");
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
