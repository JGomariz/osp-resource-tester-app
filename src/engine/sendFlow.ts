/**
 * Send pipeline: turns the header panel's inputs into the one or two HTTP
 * requests a send actually makes, and into the outcome the response panel
 * shows. The transport is injected, so this file never touches Tauri.
 */

import type { NetworkFailure } from "./diagnostics";
import { classifyNetworkFailure } from "./diagnostics";
import type { Environment, HeaderPanelState } from "./headerPanel";
import { gatewayIndicator } from "./headerPanel";
import type { Transport } from "./http";

export type SendOutcome =
  | {
      readonly kind: "response";
      readonly status: number;
      readonly durationMs: number;
      readonly body: string;
      /** The Token this send generated, or null for a Zuul send. */
      readonly token: string | null;
    }
  | {
      readonly kind: "token-failure";
      readonly status: number;
      readonly durationMs: number;
      readonly body: string;
    }
  /** The request never completed: no status, no body, only a diagnosis. */
  | {
      readonly kind: "network-error";
      readonly failure: NetworkFailure;
      /**
       * The Token this send generated before the failure, if it got that far.
       * A Token obtained is a Token worth showing, even when the Resource call
       * that followed it never completed.
       */
      readonly token: string | null;
    };

/**
 * Choices that belong to the session rather than to any one Resource, so they
 * are passed in per send instead of living in the header panel's state.
 */
export interface SendOptions {
  /**
   * Accept certificates the system does not trust. Off unless the user turns
   * it on, and never remembered between launches.
   */
  readonly skipTlsVerification: boolean;
}

const DEFAULT_OPTIONS: SendOptions = { skipTlsVerification: false };

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
  options: SendOptions = DEFAULT_OPTIONS,
): Promise<SendOutcome> {
  const { method } = state.resource.request;
  const { skipTlsVerification } = options;
  let token: string | null = null;

  try {
    if (gatewayIndicator(state.url) === "apigee") {
      const answer = await transport({
        method: "GET",
        url: tokenUrl(state.environment),
        headers: tokenHeaders(state.documentId),
        skipTlsVerification,
      });

      const jwt =
        statusClass(answer.status) === "success" ? tokenJwt(answer.body) : null;
      // No usable Token means no Resource call: the token endpoint's own answer
      // is what the user needs to see, so an auth failure never reads as a
      // Resource failure.
      if (jwt === null) {
        return {
          kind: "token-failure",
          status: answer.status,
          durationMs: answer.durationMs,
          body: answer.body,
        };
      }
      token = jwt;
    }

    const response = await transport({
      method,
      url: state.url,
      headers: token === null ? {} : { Authorization: token },
      skipTlsVerification,
    });

    return {
      kind: "response",
      status: response.status,
      durationMs: response.durationMs,
      body: response.body,
      token,
    };
  } catch (error) {
    // Both requests of a send share a scheme — the token endpoint is https,
    // like the Apigee URL that asks for it — so the URL field answers the only
    // question the diagnosis asks of it, whichever of the two failed.
    return {
      kind: "network-error",
      failure: classifyNetworkFailure(error, state.url),
      token,
    };
  }
}

/**
 * The Token the inspector shows after this outcome: the one this send
 * generated, or the one still standing from an earlier send when this one
 * generated none. Session-scoped — it outlives the Resource selection, so
 * switching Resource does not lose it.
 */
export function lastTokenAfter(
  outcome: SendOutcome | null,
  current: string | null,
): string | null {
  if (outcome === null || outcome.kind === "token-failure") return current;
  return outcome.token ?? current;
}
