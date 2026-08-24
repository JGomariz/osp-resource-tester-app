/**
 * HTTP seam of the engine. The transport is injected: production wires the
 * Tauri `http_send` command, tests wire a fake. The engine never imports
 * framework or Tauri code.
 */

export interface HttpRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  skipTlsVerification: boolean;
}

export interface HttpResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
  durationMs: number;
}

/**
 * Facts about a failure that the transport knows and the message text does not
 * always say. reqwest answers both questions itself, so the engine classifies
 * on its verdict rather than guessing from wording that varies by platform.
 */
export interface TransportVerdict {
  /** The request ran past the timeout without an answer. */
  readonly timedOut: boolean;
  /** The connection was never established, so nothing was ever sent. */
  readonly failedToConnect: boolean;
}

/**
 * What a Transport rejects with when the request never completed. The message
 * is the transport's own words — every frame of the error's cause chain — kept
 * verbatim for the details line of the response panel.
 */
export class TransportFailure extends Error {
  readonly timedOut: boolean;
  readonly failedToConnect: boolean;

  constructor(message: string, verdict: TransportVerdict) {
    super(message);
    this.name = "TransportFailure";
    this.timedOut = verdict.timedOut;
    this.failedToConnect = verdict.failedToConnect;
  }
}

/**
 * Rebuilds the failure from whatever the transport rejected with. The Rust
 * command sends the shape above; a failure that never reached it — the command
 * missing, arguments it could not read — arrives as a bare string, and claims
 * no verdict either way.
 */
export function transportFailureFrom(rejection: unknown): TransportFailure {
  if (typeof rejection === "object" && rejection !== null) {
    const reported = rejection as Partial<
      TransportVerdict & { message: unknown }
    >;
    return new TransportFailure(String(reported.message ?? rejection), {
      timedOut: reported.timedOut === true,
      failedToConnect: reported.failedToConnect === true,
    });
  }
  return new TransportFailure(String(rejection), {
    timedOut: false,
    failedToConnect: false,
  });
}

export type Transport = (request: HttpRequest) => Promise<HttpResponse>;

/** Same shape as {@link HttpRequest}, with the defaultable fields optional. */
export interface HttpRequestInput extends Partial<HttpRequest> {
  method: string;
  url: string;
}

export async function sendHttp(
  transport: Transport,
  input: HttpRequestInput,
): Promise<HttpResponse> {
  return transport({
    method: input.method,
    url: input.url,
    headers: input.headers ?? {},
    skipTlsVerification: input.skipTlsVerification ?? false,
  });
}
