import type { TreeRow } from "../engine";

interface CatalogTreeProps {
  rows: readonly TreeRow[];
  onSelect: (id: string) => void;
}

/**
 * Side-panel tree. Every visibility and muting decision arrives in `rows`.
 * The list items are `role="none"` so each button is a direct treeitem child.
 */
export function CatalogTree({ rows, onSelect }: CatalogTreeProps) {
  return (
    <ul className="tree" role="tree">
      {rows.map((row) => (
        <li key={row.id} role="none">
          <button
            type="button"
            role="treeitem"
            aria-level={row.depth + 1}
            aria-selected={row.isSelected}
            aria-expanded={row.isExpandable ? row.isExpanded : undefined}
            className={[
              "tree-row",
              row.isSelected ? "is-selected" : "",
              row.isDefined ? "" : "is-undefined",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{ paddingLeft: `calc(var(--space-2) + ${row.depth} * var(--space-4))` }}
            onClick={() => onSelect(row.id)}
          >
            <span className="tree-twisty" aria-hidden="true">
              {row.isExpandable ? (row.isExpanded ? "▾" : "▸") : ""}
            </span>
            <span className="tree-name">{row.name}</span>
            {!row.isDefined && <span className="tree-hint">sin configurar</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}
