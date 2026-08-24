/**
 * Catalog slice of the engine: the JSON contract that drives the tree of
 * Services and Resources, and its parser. Framework-free by design — the
 * caller decides where the JSON came from (bundled default or override).
 */

export type Gateway = "zuul" | "apigee";

export type ParamKind = "text" | "dropdown";

/** The only input a param can be bound to instead of its own control. */
export type ParamSource = "documentId";

export interface CatalogParam {
  /** Query-param name as sent to the backend. */
  readonly name: string;
  readonly kind: ParamKind;
  /** Fixed choices for a dropdown; empty for a text param. */
  readonly options: readonly string[];
  /** Non-null when the value comes from a shared field, not its own control. */
  readonly source: ParamSource | null;
  /** When true the param leaves no trace in the query string if empty. */
  readonly omitWhenEmpty: boolean;
}

/** The request specification of a defined Resource. */
export interface ResourceRequest {
  readonly method: string;
  readonly gateway: Gateway;
  /** Appended to the Gateway base URL; starts with "/". */
  readonly path: string;
  readonly params: readonly CatalogParam[];
}

export interface CatalogResource {
  readonly kind: "resource";
  /** Slash-joined path of names, unique within the Catalog. */
  readonly id: string;
  readonly name: string;
  /** Null for an undefined Resource — listed in the tree, not yet callable. */
  readonly request: ResourceRequest | null;
}

export interface CatalogService {
  readonly kind: "service";
  readonly id: string;
  readonly name: string;
  readonly children: readonly CatalogNode[];
}

export type CatalogNode = CatalogService | CatalogResource;

export interface Catalog {
  readonly nodes: readonly CatalogNode[];
}

export type ParseCatalogResult =
  | { readonly ok: true; readonly catalog: Catalog }
  | { readonly ok: false; readonly errors: readonly string[] };

/**
 * Turns untrusted JSON into a Catalog, or into every reason it could not be
 * one. Errors are Spanish, name the offending node and say what to fix.
 */
export function parseCatalog(input: unknown): ParseCatalogResult {
  const errors: string[] = [];
  const nodes = readNodes(input, errors);
  return errors.length > 0 ? { ok: false, errors } : { ok: true, catalog: { nodes } };
}

function readNodes(input: unknown, errors: string[]): readonly CatalogNode[] {
  if (!isObject(input)) {
    errors.push("El catálogo debe ser un objeto JSON.");
    return [];
  }
  if (!Array.isArray(input.nodes)) {
    errors.push("El catálogo debe tener una lista 'nodes' en la raíz.");
    return [];
  }
  return readChildren(input.nodes, "", errors);
}

function isObject(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

/** @param parentId id of the containing Service, "" at the root. */
function readChildren(
  input: unknown,
  parentId: string,
  errors: string[],
): readonly CatalogNode[] {
  if (input === undefined) return [];
  if (!Array.isArray(input)) {
    errors.push(`${parentId}: 'children' debe ser una lista.`);
    return [];
  }

  // Where this list lives in the JSON, so errors can point at a position.
  const listLabel = parentId === "" ? "nodes" : `${parentId}/children`;
  const nodes = input
    .map((node, index) =>
      readNode(node, parentId, `${listLabel}[${index}]`, errors),
    )
    .filter((node): node is CatalogNode => node !== null);

  reportDuplicateNames(nodes, parentId, errors);
  return nodes;
}

/** Names identify nodes, so siblings sharing one would be indistinguishable. */
function reportDuplicateNames(
  nodes: readonly CatalogNode[],
  parentId: string,
  errors: string[],
): void {
  const seen = new Set<string>();
  for (const node of nodes) {
    if (seen.has(node.name)) {
      errors.push(
        `${parentId === "" ? "El catálogo" : parentId} tiene dos nodos llamados '${node.name}'.`,
      );
    }
    seen.add(node.name);
  }
}

function readNode(
  input: unknown,
  parentId: string,
  location: string,
  errors: string[],
): CatalogNode | null {
  if (!isObject(input)) {
    errors.push(`${location}: cada nodo debe ser un objeto JSON.`);
    return null;
  }

  const name = input.name;
  if (typeof name !== "string" || name.trim() === "") {
    errors.push(`${location}: falta el campo 'name'.`);
    return null;
  }
  if (name.includes("/")) {
    errors.push(
      `${location}: el nombre '${name}' no puede contener '/', porque los nombres identifican a los nodos.`,
    );
    return null;
  }

  const id = parentId === "" ? name : `${parentId}/${name}`;

  if (input.kind === "service") {
    return {
      kind: "service",
      id,
      name,
      children: readChildren(input.children, id, errors),
    };
  }

  if (input.kind === "resource") {
    return { kind: "resource", id, name, request: readRequest(input, id, errors) };
  }

  errors.push(
    `${id}: 'kind' debe ser 'service' o 'resource', no ${asWritten(input.kind)}.`,
  );
  return null;
}

/** Quotes a rejected value so the maintainer sees what they actually wrote. */
function asWritten(value: unknown): string {
  if (value === undefined) return "nada";
  if (typeof value === "string") return `'${value}'`;
  return JSON.stringify(value);
}

/** The fields whose presence makes a Resource defined rather than a stub. */
const REQUEST_FIELDS = ["method", "gateway", "path"] as const;

const GATEWAYS: readonly Gateway[] = ["zuul", "apigee"];

function readRequest(
  input: Record<string, unknown>,
  id: string,
  errors: string[],
): ResourceRequest | null {
  const declared = REQUEST_FIELDS.filter(
    (field) => input[field] !== undefined,
  );

  if (declared.length === 0) {
    if (input.params !== undefined) {
      errors.push(
        `${id}: 'params' solo se admite en un recurso con 'method', 'gateway' y 'path'.`,
      );
    }
    return null;
  }

  const missing = REQUEST_FIELDS.filter((field) => !declared.includes(field));
  if (missing.length > 0) {
    errors.push(
      `${id}: ${missing.length === 1 ? "falta" : "faltan"} ${list(missing)}. Un recurso definido necesita 'method', 'gateway' y 'path'; quítalos todos para dejarlo sin configurar.`,
    );
    return null;
  }

  const { method, gateway, path } = input;

  if (typeof method !== "string" || method.trim() === "") {
    errors.push(`${id}: 'method' debe ser un método HTTP, no ${asWritten(method)}.`);
  }
  if (!GATEWAYS.includes(gateway as Gateway)) {
    errors.push(
      `${id}: 'gateway' debe ser 'zuul' o 'apigee', no ${asWritten(gateway)}.`,
    );
  }
  if (typeof path !== "string" || !path.startsWith("/")) {
    errors.push(`${id}: 'path' debe empezar por '/'.`);
  }

  return {
    method: method as string,
    gateway: gateway as Gateway,
    path: path as string,
    params: readParams(input.params, id, errors),
  };
}

/** Joins field names the way the message reads aloud: "'a', 'b' y 'c'". */
function list(fields: readonly string[]): string {
  const quoted = fields.map((field) => `'${field}'`);
  if (quoted.length === 1) return quoted[0];
  return `${quoted.slice(0, -1).join(", ")} y ${quoted[quoted.length - 1]}`;
}

function readParams(
  input: unknown,
  id: string,
  errors: string[],
): readonly CatalogParam[] {
  if (input === undefined) return [];
  if (!Array.isArray(input)) {
    errors.push(`${id}: 'params' debe ser una lista.`);
    return [];
  }
  return input
    .map((param, index) => readParam(param, `${id}: params[${index}]`, errors))
    .filter((param): param is CatalogParam => param !== null);
}

const PARAM_KINDS: readonly ParamKind[] = ["text", "dropdown"];

function readParam(
  input: unknown,
  location: string,
  errors: string[],
): CatalogParam | null {
  if (!isObject(input)) {
    errors.push(`${location} debe ser un objeto JSON.`);
    return null;
  }

  const { name, kind, options, source, omitWhenEmpty } = input;

  if (typeof name !== "string" || name.trim() === "") {
    errors.push(`${location} necesita un campo 'name'.`);
    return null;
  }

  const at = `${location} ('${name}')`;

  if (!PARAM_KINDS.includes(kind as ParamKind)) {
    errors.push(
      `${at}: 'kind' debe ser 'text' o 'dropdown', no ${asWritten(kind)}.`,
    );
  }

  const choices = readOptions(options, at, errors);
  if (kind === "dropdown" && choices.length === 0) {
    errors.push(
      `${at}: un desplegable necesita 'options' con al menos una opción.`,
    );
  }

  if (source !== undefined && source !== "documentId") {
    errors.push(
      `${at}: 'source' solo admite 'documentId', no ${asWritten(source)}.`,
    );
  }

  if (omitWhenEmpty !== undefined && typeof omitWhenEmpty !== "boolean") {
    errors.push(`${at}: 'omitWhenEmpty' debe ser true o false.`);
  }

  return {
    name,
    kind: kind as ParamKind,
    options: choices,
    source: (source ?? null) as ParamSource | null,
    omitWhenEmpty: (omitWhenEmpty ?? true) as boolean,
  };
}

function readOptions(
  input: unknown,
  at: string,
  errors: string[],
): readonly string[] {
  if (input === undefined) return [];
  if (!Array.isArray(input) || input.some((o) => typeof o !== "string")) {
    errors.push(`${at}: 'options' debe ser una lista de textos.`);
    return [];
  }
  return input;
}
