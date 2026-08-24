import { describe, expect, it } from "vitest";
import type { HttpRequest, HttpResponse, Transport } from "./http";
import { sendHttp, transportFailureFrom } from "./http";

function fakeTransport(scripted: HttpResponse): {
  transport: Transport;
  requests: HttpRequest[];
} {
  const requests: HttpRequest[] = [];
  const transport: Transport = async (request) => {
    requests.push(request);
    return scripted;
  };
  return { transport, requests };
}

describe("sendHttp", () => {
  it("sends the request through the injected transport and returns the response unchanged", async () => {
    const scripted: HttpResponse = {
      status: 200,
      headers: { "content-type": "application/json" },
      body: '{"ok":true}',
      durationMs: 42,
    };
    const { transport, requests } = fakeTransport(scripted);

    const response = await sendHttp(transport, {
      method: "GET",
      url: "https://gateway.example:9061/ping",
      headers: { accept: "application/json" },
      skipTlsVerification: true,
    });

    expect(requests).toEqual([
      {
        method: "GET",
        url: "https://gateway.example:9061/ping",
        headers: { accept: "application/json" },
        skipTlsVerification: true,
      },
    ]);
    expect(response).toEqual(scripted);
  });

  it("defaults to no headers and TLS verification enabled when not specified", async () => {
    const { transport, requests } = fakeTransport({
      status: 204,
      headers: {},
      body: "",
      durationMs: 5,
    });

    await sendHttp(transport, {
      method: "GET",
      url: "https://api.example/ping",
    });

    expect(requests[0]?.headers).toEqual({});
    expect(requests[0]?.skipTlsVerification).toBe(false);
  });
});

describe("transportFailureFrom", () => {
  it("takes the message and both verdicts from what the Rust command reports", () => {
    const failure = transportFailureFrom({
      message:
        "error sending request for url (https://api.example/token): operation timed out",
      timedOut: true,
      failedToConnect: false,
    });

    expect(failure.message).toBe(
      "error sending request for url (https://api.example/token): operation timed out",
    );
    expect(failure.timedOut).toBe(true);
    expect(failure.failedToConnect).toBe(false);
  });

  // A failure that never reached the HTTP client at all — the command missing,
  // or arguments it could not read — arrives as a bare string.
  it("keeps a rejection that is only a string, claiming no verdict", () => {
    const failure = transportFailureFrom("comando http_send no encontrado");

    expect(failure.message).toBe("comando http_send no encontrado");
    expect(failure.timedOut).toBe(false);
    expect(failure.failedToConnect).toBe(false);
  });
});
