/**
 * Send pipeline: turns the header panel's inputs into the one or two HTTP
 * requests a send actually makes, and into the outcome the response panel
 * shows. The transport is injected, so this file never touches Tauri.
 */

import type { Environment, HeaderPanelState } from "./headerPanel";
import { gatewayIndicator } from "./headerPanel";
import type { Transport } from "./http";

export type SendOutcome =
  | {
      readonly kind: "response";
      readonly status: number;
      readonly durationMs: number;
      readonly body: string;
    }
  | {
      readonly kind: "token-failure";
      readonly status: number;
      readonly durationMs: number;
      readonly body: string;
    }
  /** The request never completed. Ticket 06 turns this into plain Spanish. */
  | { readonly kind: "network-error"; readonly message: string };

/** How the response panel colours a status code. */
export type StatusClass = "success" | "client-error" | "server-error" | "other";

export function statusClass(status: number): StatusClass {
  if (status >= 200 && status < 300) return "success";
  if (status >= 400 && status < 500) return "client-error";
  if (status >= 500 && status < 600) return "server-error";
  return "other";
}

function tokenUrl(environment: Environment): string {
  return `https://api-${environment}-openapi.cloudready-nonprod.cloud.si.orange.es/token`;
}

/**
 * Headers the Apigee token endpoint requires — exactly these, no more. The
 * Document ID identifies the customer in both `z-document` and `z-login`.
 */
function tokenHeaders(documentId: string): Record<string, string> {
  return {
    "x-forwarded-server": "areaclientes.si.orange.es",
    service: "PAE",
    accept: "application/json",
    "Content-Type": "application/json",
    "z-document": documentId,
    "z-logintype": "DOCID",
    "z-login": documentId,
    "z-brand": "orange",
    "x-wassup-lra": "MassMarketMobileUser,MassMarketFixUser",
  };
}

/** The `Token-JWT` field of the token endpoint's response, or null if absent. */
function tokenJwt(body: string): string | null {
  try {
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed !== "object" || parsed === null) return null;
    const jwt = (parsed as Record<string, unknown>)["Token-JWT"];
    return typeof jwt === "string" && jwt !== "" ? jwt : null;
  } catch {
    return null;
  }
}

/**
 * Sends the Resource. An Apigee-prefixed URL gets a freshly generated Token
 * first — never cached — carried verbatim in `Authorization`. The Gateway is
 * read off the URL with the same derivation the indicator uses, so what the
 * user sees and what the app does cannot disagree.
 */
export async function sendResource(
  transport: Transport,
  state: HeaderPanelState,
): Promise<SendOutcome> {
  try {
    return await runSend(transport, state);
  } catch (error) {
    return { kind: "network-error", message: messageOf(error) };
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function runSend(
  transport: Transport,
  state: HeaderPanelState,
): Promise<SendOutcome> {
  const { method } = state.resource.request;
  const headers: Record<string, string> = {};

  if (gatewayIndicator(state.url) === "apigee") {
    const token = await transport({
      method: "GET",
      url: tokenUrl(state.environment),
      headers: tokenHeaders(state.documentId),
      skipTlsVerification: false,
    });

    const jwt =
      statusClass(token.status) === "success" ? tokenJwt(token.body) : null;
    // No usable Token means no Resource call: the token endpoint's own answer
    // is what the user needs to see, so an auth failure never reads as a
    // Resource failure.
    if (jwt === null) {
      return {
        kind: "token-failure",
        status: token.status,
        durationMs: token.durationMs,
        body: token.body,
      };
    }
    headers.Authorization = jwt;
  }

  const response = await transport({
    method,
    url: state.url,
    headers,
    skipTlsVerification: false,
  });

  return {
    kind: "response",
    status: response.status,
    durationMs: response.durationMs,
    body: response.body,
  };
}
