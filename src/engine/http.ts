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
