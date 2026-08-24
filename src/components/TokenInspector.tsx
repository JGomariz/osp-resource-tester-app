import { useRef, useState } from "react";

interface TokenInspectorProps {
  /** The last Token of the session, or null before any Apigee send. */
  token: string | null;
}

type CopyResult = "idle" | "copied" | "failed";

const COPY_LABELS: Readonly<Record<CopyResult, string>> = {
  idle: "Copiar",
  copied: "Copiado",
  failed: "No se pudo copiar",
};

/**
 * Collapsed by default: the Token matters when authentication is in doubt, and
 * it is a wall of characters the rest of the time.
 */
export function TokenInspector({ token }: TokenInspectorProps) {
  const [copyResult, setCopyResult] = useState<CopyResult>("idle");
  const value = useRef<HTMLElement>(null);

  async function copy() {
    if (token === null) return;
    setCopyResult((await writeToClipboard(token, value.current))
      ? "copied"
      : "failed");
  }

  return (
    <details
      className="token-inspector"
      onToggle={() => setCopyResult("idle")}
    >
      <summary className="token-summary">Último token</summary>
      {token === null ? (
        <p className="empty-hint">
          Todavía no se ha generado ningún token. Se genera al enviar una
          petición por Apigee.
        </p>
      ) : (
        <div className="token-body">
          <button
            type="button"
            className="copy-button"
            onClick={copy}
            aria-live="polite"
          >
            {COPY_LABELS[copyResult]}
          </button>
          <code className="token-value" ref={value}>
            {token}
          </code>
        </div>
      )}
    </details>
  );
}

/**
 * `navigator.clipboard` needs a secure context, which the packaged app's
 * custom-scheme origin is not guaranteed to be, so selecting the text and
 * asking the document to copy it is kept as a fallback. Returns whether the
 * Token actually reached the clipboard: a copy button that silently does
 * nothing is worse than one that admits it failed, since the text on screen
 * can always be selected by hand.
 */
async function writeToClipboard(
  token: string,
  element: HTMLElement | null,
): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(token);
    return true;
  } catch {
    return copyBySelecting(element);
  }
}

function copyBySelecting(element: HTMLElement | null): boolean {
  const selection = window.getSelection();
  if (element === null || selection === null) return false;

  const range = document.createRange();
  range.selectNodeContents(element);
  selection.removeAllRanges();
  selection.addRange(range);
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    selection.removeAllRanges();
  }
}
