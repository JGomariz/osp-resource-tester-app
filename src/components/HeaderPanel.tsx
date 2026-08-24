import type { Environment, HeaderPanelState } from "../engine";
import {
  ENVIRONMENTS,
  editUrl,
  gatewayIndicator,
  paramControls,
  setDocumentId,
  setEnvironment,
  setParam,
} from "../engine";

interface HeaderPanelProps {
  state: HeaderPanelState;
  onChange: (next: HeaderPanelState) => void;
}

const GATEWAY_LABELS = {
  zuul: "Zuul",
  apigee: "Apigee",
  neutral: "Sin identificar",
} as const;

/** Header panel. Every value and every recomposition comes from the engine. */
export function HeaderPanel({ state, onChange }: HeaderPanelProps) {
  const gateway = gatewayIndicator(state.url);
  const controls = paramControls(state);
  const changeParam = (name: string) => (value: string) =>
    onChange(setParam(state, name, value));

  return (
    <section className="header-panel">
      <div className="field-row">
        <label className="field">
          <span className="field-label">Entorno</span>
          <select
            className="field-control"
            value={state.environment}
            onChange={(event) =>
              onChange(
                setEnvironment(state, event.target.value as Environment),
              )
            }
          >
            {ENVIRONMENTS.map((environment) => (
              <option key={environment} value={environment}>
                {environment}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field-label">Document ID</span>
          <input
            className="field-control"
            type="text"
            value={state.documentId}
            placeholder="Documento del cliente"
            onChange={(event) =>
              onChange(setDocumentId(state, event.target.value))
            }
          />
        </label>

        <div className="field">
          <span className="field-label">Pasarela</span>
          <output
            aria-label="Pasarela"
            className={`gateway-indicator is-${gateway}`}
          >
            {GATEWAY_LABELS[gateway]}
          </output>
        </div>
      </div>

      {controls.length > 0 && (
        <div className="field-row">
          {controls.map((control) => {
            const onParamChange = changeParam(control.name);
            return (
              <label key={control.name} className="field">
                <span className="field-label">{control.name}</span>
                {control.kind === "dropdown" ? (
                  <select
                    className="field-control"
                    value={control.value}
                    onChange={(event) => onParamChange(event.target.value)}
                  >
                    {control.canBeEmpty && <option value="">(vacío)</option>}
                    {control.options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="field-control"
                    type="text"
                    value={control.value}
                    onChange={(event) => onParamChange(event.target.value)}
                  />
                )}
              </label>
            );
          })}
        </div>
      )}

      <label className="field field-wide">
        <span className="field-label">URL final</span>
        <input
          className="field-control url-field"
          type="text"
          value={state.url}
          spellCheck={false}
          onChange={(event) => onChange(editUrl(state, event.target.value))}
        />
      </label>

      <div className="field-row field-row-actions">
        <button type="button" className="send-button">
          Enviar
        </button>
      </div>
    </section>
  );
}
