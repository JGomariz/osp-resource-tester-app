interface CatalogWarningProps {
  warning: string;
  onDismiss: () => void;
}

/**
 * Says the Catalog on screen is not the one on disk, and why. Dismissible:
 * the maintainer reads it, goes and fixes the file, and does not need it
 * shouting at them for the rest of the session.
 */
export function CatalogWarning({ warning, onDismiss }: CatalogWarningProps) {
  return (
    <div className="catalog-warning" role="alert">
      <p className="catalog-warning-text">{warning}</p>
      <button
        type="button"
        className="catalog-warning-dismiss"
        onClick={onDismiss}
        aria-label="Descartar aviso"
      >
        ×
      </button>
    </div>
  );
}
