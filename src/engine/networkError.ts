/**
 * Classification of the failures that stop a request from ever getting an
 * answer. The transport reports what it observed; deciding what that means and
 * what to tell the user happens here, so the wording is tested like any other
 * engine output.
 *
 * A failure classified here is not an HTTP outcome: a 404 or a 500 is a
 * perfectly good answer and never reaches this module.
 */

import { SKIP_TLS_LABEL } from "./session";

export type NetworkErrorKind =
  | "timeout"
  | "unreachable"
  | "refused"
  | "tls"
  | "unknown";

export interface NetworkError {
  readonly kind: NetworkErrorKind;
  /** What went wrong, in plain Spanish. */
  readonly message: string;
  /** What the user can do about it, or null when there is nothing to suggest. */
  readonly hint: string | null;
  /** The transport's own words, kept verbatim for when the rest is not enough. */
  readonly detail: string;
}

/**
 * What the Rust transport rejects with: the timeout verdict only it can give,
 * and its error chain flattened into one string. Rejections of any other shape
 * are still read for whatever text they carry.
 */
export interface TransportFailure {
  readonly timedOut: boolean;
  readonly detail: string;
}

const EXPLANATIONS: Readonly<
  Record<NetworkErrorKind, { readonly message: string; readonly hint: string | null }>
> = {
  timeout: {
    message: "La petición ha superado el tiempo de espera de 30 segundos.",
    hint: "El recurso puede estar caído o tardar más de lo normal en responder.",
  },
  unreachable: {
    message: "No se ha podido alcanzar el host: no responde o su nombre no se resuelve.",
    hint: "Comprueba que estás conectado a la VPN corporativa.",
  },
  refused: {
    message: "El host ha rechazado la conexión.",
    // Not "el servicio": in this app a Service is a node in the tree, and the
    // user would read that as their selection being at fault.
    hint: "Puede que no haya nada escuchando en ese puerto.",
  },
  tls: {
    message: "Ha fallado la verificación del certificado TLS.",
    hint: `Si el entorno tiene un certificado no válido, activa «${SKIP_TLS_LABEL}» y vuelve a enviar.`,
  },
  unknown: {
    message: "No se pudo completar la petición.",
    hint: null,
  },
};

/**
 * Substrings that name each cause, matched case-insensitively against the
 * flattened error chain, first match winning.
 *
 * The chain includes the URL, so a marker has to be a phrase no host name
 * would contain: bare `tls` or `ssl` would classify a request to a host called
 * `ssl-gateway` as a certificate failure.
 */
const MARKERS: readonly (readonly [
  Exclude<NetworkErrorKind, "unknown">,
  readonly string[],
])[] = [
  ["timeout", ["timed out"]],
  [
    "tls",
    [
      "certificate",
      "tls handshake",
      "handshake failure",
      "handshake failed",
      "ssl routines",
      "wrong version number",
    ],
  ],
  ["refused", ["connection refused", "actively refused"]],
  [
    "unreachable",
    [
      "dns error",
      "failed to lookup address",
      "name or service not known",
      "temporary failure in name resolution",
      "no such host",
      "no route to host",
      "network is unreachable",
      "unreachable network",
      "host is unreachable",
    ],
  ],
];

export function classifyNetworkError(error: unknown): NetworkError {
  const failure = readFailure(error);
  const kind = kindOf(failure);
  const { message, hint } = EXPLANATIONS[kind];
  return { kind, message, hint, detail: failure.detail };
}

function kindOf(failure: TransportFailure): NetworkErrorKind {
  if (failure.timedOut) return "timeout";

  const detail = failure.detail.toLowerCase();
  for (const [kind, markers] of MARKERS) {
    if (markers.some((marker) => detail.includes(marker))) return kind;
  }
  return "unknown";
}

/** Reads a rejection of any shape for the two things classification needs. */
function readFailure(error: unknown): TransportFailure {
  if (isTransportFailure(error)) {
    return { timedOut: error.timedOut === true, detail: error.detail };
  }
  if (error instanceof Error) return { timedOut: false, detail: error.message };
  if (typeof error === "string") return { timedOut: false, detail: error };
  return { timedOut: false, detail: String(error) };
}

function isTransportFailure(
  error: unknown,
): error is { timedOut?: unknown; detail: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    typeof (error as { detail?: unknown }).detail === "string"
  );
}
