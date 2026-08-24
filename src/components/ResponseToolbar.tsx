import type { ResponseViewState, ViewMode } from "../engine";
import {
  matchCounter,
  nextMatch,
  previousMatch,
  setMode,
  setQuery,
} from "../engine";

interface ResponseToolbarProps {
  view: ResponseViewState;
  onChange: (next: ResponseViewState) => void;
}

const MODES: readonly { value: ViewMode; label: string }[] = [
  { value: "pretty", label: "Formateado" },
  { value: "raw", label: "Sin formato" },
];

/** Style selector and search field for the response body. */
export function ResponseToolbar({ view, onChange }: ResponseToolbarProps) {
  const counter = matchCounter(view);

  return (
    <div className="response-toolbar">
      <div className="mode-switch" role="group" aria-label="Formato">
        {MODES.map((mode) => (
          <button
            key={mode.value}
            type="button"
            className={
              view.mode === mode.value ? "mode-button is-on" : "mode-button"
            }
            aria-pressed={view.mode === mode.value}
            onClick={() => onChange(setMode(view, mode.value))}
          >
            {mode.label}
          </button>
        ))}
      </div>

      <div className="search-group">
        <input
          className="field-control search-field"
          type="search"
          value={view.query}
          placeholder="Buscar en la respuesta"
          aria-label="Buscar en la respuesta"
          spellCheck={false}
          onChange={(event) => onChange(setQuery(view, event.target.value))}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            onChange(
              event.shiftKey ? previousMatch(view) : nextMatch(view),
            );
          }}
        />
        {counter !== null && (
          <>
            <span className="match-counter" aria-live="polite">
              {counter}
            </span>
            <button
              type="button"
              className="step-button"
              aria-label="Coincidencia anterior"
              onClick={() => onChange(previousMatch(view))}
            >
              ↑
            </button>
            <button
              type="button"
              className="step-button"
              aria-label="Coincidencia siguiente"
              onClick={() => onChange(nextMatch(view))}
            >
              ↓
            </button>
          </>
        )}
      </div>
    </div>
  );
}
