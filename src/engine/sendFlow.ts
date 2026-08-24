/**
 * Send pipeline: turns the header panel's inputs into the one or two HTTP
 * requests a send actually makes, and into the outcome the response panel
 * shows. The transport is injected, so this file never touches Tauri.
 */

import type { Environment, HeaderPanelState } from "./headerPanel";
import { gatewayIndicator } from "./headerPanel";
import type { Transport } from "./http";
import type { NetworkError } from "./networkError";
import { classifyNetworkError } from "./networkError";
import type { SessionState } from "./session";

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
  /** The request never completed; the failure has already been classified. */
  | { readonly kind: "network-error"; readonly error: NetworkError };

export interface SendResult {
  readonly outcome: SendOutcome;
  /**
   * The Token this send obtained, or null when it obtained none — a Zuul send,
   * or one whose Token generation failed. Reported separately from the outcome
   * because a Token is worth keeping even when the Resource call that followed
   * it fell over.
   */
  readonly token: string | null;
}

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
 *
 * The session decides whether certificates are verified, and both requests
 * honour it: a Token fetched over a loosened connection is no use if the
 * Resource call then refuses the same certificate.
 */
export async function sendResource(
  transport: Transport,
  state: HeaderPanelState,
  session: SessionState,
): Promise<SendResult> {
  const { method } = state.resource.request;
  const { skipTlsVerification } = session;
  // Declared out here so a Token obtained just before a failing Resource call
  // still reaches the inspector.
  let token: string | null = null;

  try {
    if (gatewayIndicator(state.url) === "apigee") {
      const answer = await transport({
        method: "GET",
        url: tokenUrl(state.environment),
        headers: tokenHeaders(state.documentId),
        skipTlsVerification,
      });

      token =
        statusClass(answer.status) === "success" ? tokenJwt(answer.body) : null;
      // No usable Token means no Resource call: the token endpoint's own
      // answer is what the user needs to see, so an auth failure never reads
      // as a Resource failure.
      if (token === null) {
        return {
          outcome: {
            kind: "token-failure",
            status: answer.status,
            durationMs: answer.durationMs,
            body: answer.body,
          },
          token: null,
        };
      }
    }

    const response = await transport({
      method,
      url: state.url,
      headers: token === null ? {} : { Authorization: token },
      skipTlsVerification,
    });

    return {
      outcome: {
        kind: "response",
        status: response.status,
        durationMs: response.durationMs,
        body: response.body,
      },
      token,
    };
  } catch (error) {
    return {
      outcome: { kind: "network-error", error: classifyNetworkError(error) },
      token,
    };
  }
}
