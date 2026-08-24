/**
 * Diagnosis of requests that never completed. A failure that reaches here has
 * no status and no body: all the user gets is what the transport says went
 * wrong, so this file turns that into one plain-Spanish sentence naming the
 * likely cause and, where there is one, the way out.
 */

import { TransportFailure } from "./http";

export type NetworkFailureKind =
  | "timeout"
  | "unreachable"
  | "connection-refused"
  | "tls"
  | "unknown";

export interface NetworkFailure {
  readonly kind: NetworkFailureKind;
  /** Plain Spanish: what the response panel tells the user. */
  readonly message: string;
  /** The transport's own words, kept for the details line. */
  readonly detail: string;
}

/** The timeout is set by the Rust command; this text must agree with it. */
const MESSAGES: Readonly<Record<NetworkFailureKind, string>> = {
  timeout:
    "La petición superó el tiempo límite de 30 segundos sin recibir respuesta. El servicio puede estar caído o ir muy lento.",
  unreachable:
    "No se pudo localizar el servidor. Comprueba que estás conectado a la VPN corporativa y que la URL es correcta.",
  "connection-refused":
    "El servidor rechazó la conexión. Puede que el servicio no esté levantado o que el puerto no sea el correcto.",
  tls: "No se pudo establecer la conexión segura (TLS) con el servidor. Si el certificado del entorno no es válido, activa «Omitir verificación TLS» y vuelve a enviar.",
  unknown: "No se pudo completar la petición.",
};

export function classifyNetworkFailure(
  error: unknown,
  url: string,
): NetworkFailure {
  const detail = detailOf(error);
  const kind = kindOf(error, detail, url);
  return { kind, message: MESSAGES[kind], detail };
}

function detailOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Said by the transport itself, and by the OS when a connect attempt ages out. */
const TIMED_OUT = /operation timed out|timed out/;

/** The host actively said no. Second wording is Windows'. */
const REFUSED = /connection refused|actively refused/;

/**
 * Something in the path — a firewall, a proxy — cut the connection. It is a
 * cause of its own, and one the skip-TLS toggle cannot help with, so it is
 * named here to keep the TLS inference below off it.
 */
const RESET = /connection reset|reset by peer|broken pipe/;

/**
 * The host was never found or never reachable — the shape of "you are not on
 * the VPN". Wordings differ per platform: macOS and Linux resolvers, Windows'
 * `No such host is known`, and the routing failures of a half-open tunnel.
 */
const UNREACHABLE =
  /dns error|failed to lookup address|name or service not known|nodename nor servname|no such host|network is unreachable|no route to host|unreachable host/;

/** Said outright by rustls, OpenSSL, Windows schannel and macOS in turn. */
const TLS = /certificate|tls|ssl|handshake|self.signed|untrusted/;

function kindOf(
  error: unknown,
  detail: string,
  url: string,
): NetworkFailureKind {
  if (error instanceof TransportFailure && error.timedOut) return "timeout";

  const text = matchableText(detail);
  if (TIMED_OUT.test(text)) return "timeout";
  if (REFUSED.test(text)) return "connection-refused";
  if (UNREACHABLE.test(text)) return "unreachable";
  if (TLS.test(text)) return "tls";
  if (RESET.test(text)) return "unknown";

  // Not every TLS failure says so: `record overflow` is a handshake alert with
  // no telling word in it. Over https, a connection that never opened and has
  // none of the causes above is the secure channel failing — the one case the
  // skip-TLS toggle answers, so it is worth naming rather than shrugging at.
  if (
    error instanceof TransportFailure &&
    error.failedToConnect &&
    url.startsWith("https://")
  ) {
    return "tls";
  }

  return "unknown";
}

/**
 * The part of the detail worth matching on, lowercased. The URL is dropped
 * first: it is the user's own text, and a host or path containing `ssl` or
 * `no-route-to-host` would otherwise diagnose the failure for us.
 */
function matchableText(detail: string): string {
  return detail.replace(/for url \([^)]*\)/gi, "").toLowerCase();
}
