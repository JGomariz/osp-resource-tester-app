import { describe, expect, it } from "vitest";
import { parseCatalog } from "./catalog";
import type { DefinedResource } from "./catalogTree";
import type { HeaderPanelState } from "./headerPanel";
import { createHeaderPanelState, editUrl, setDocumentId } from "./headerPanel";
import type { HttpRequest, HttpResponse, Transport } from "./http";
import { TransportFailure } from "./http";
import { lastTokenAfter, sendResource, statusClass } from "./sendFlow";

/** CRMB2B → Lines as the bundled Catalog defines it, built via the parser. */
function lines(): DefinedResource {
  const result = parseCatalog({
    nodes: [
      {
        kind: "resource",
        name: "Lines",
        method: "GET",
        gateway: "apigee",
        path: "/crbproductinventory/v1/lines",
        params: [{ name: "docId", kind: "text", source: "documentId" }],
      },
    ],
  });
  if (!result.ok) throw new Error(result.errors.join(" "));
  const node = result.catalog.nodes[0];
  if (node === undefined || node.kind !== "resource") {
    throw new Error("el fixture debe ser un recurso");
  }
  const { request } = node;
  if (request === null) throw new Error("el fixture debe estar definido");
  return { ...node, request };
}

/** Replies with the scripted responses in order, recording what it was sent. */
function fakeTransport(...scripted: readonly HttpResponse[]): {
  transport: Transport;
  requests: HttpRequest[];
} {
  const requests: HttpRequest[] = [];
  let next = 0;
  const transport: Transport = async (request) => {
    requests.push(request);
    const response = scripted[next++];
    if (response === undefined) {
      throw new Error(`no hay respuesta preparada para ${request.url}`);
    }
    return response;
  };
  return { transport, requests };
}

function ok(body: string, status = 200): HttpResponse {
  return { status, headers: {}, body, durationMs: 12 };
}

function readyToSend(): HeaderPanelState {
  return setDocumentId(createHeaderPanelState(lines()), "12345678Z");
}

const LINES_URL =
  "https://api-ent1-openapi.cloudready-nonprod.cloud.si.orange.es/jwt/crbproductinventory/v1/lines?docId=12345678Z";

describe("sendResource on an Apigee URL", () => {
  it("generates a Token first, with exactly the nine specified headers", async () => {
    const { transport, requests } = fakeTransport(
      ok('{"Token-JWT":"abc.def.ghi"}'),
      ok('{"lines":[]}'),
    );

    await sendResource(transport, readyToSend());

    expect(requests[0]).toEqual({
      method: "GET",
      url: "https://api-ent1-openapi.cloudready-nonprod.cloud.si.orange.es/jwtgenerator/v1/token",
      headers: {
        "x-forwarded-server": "areaclientes.si.orange.es",
        service: "PAE",
        accept: "application/json",
        "Content-Type": "application/json",
        "z-document": "12345678Z",
        "z-logintype": "DOCID",
        "z-login": "12345678Z",
        "z-brand": "orange",
        "x-wassup-lra": "MassMarketMobileUser,MassMarketFixUser",
      },
      skipTlsVerification: false,
    });
  });

  it("then calls the Resource with the Token-JWT verbatim as Authorization", async () => {
    const { transport, requests } = fakeTransport(
      ok('{"Token-JWT":"Bearer-looking.but.verbatim"}'),
      ok('{"lines":[]}'),
    );

    await sendResource(transport, readyToSend());

    expect(requests).toHaveLength(2);
    expect(requests[1]).toEqual({
      method: "GET",
      url: LINES_URL,
      headers: { Authorization: "Bearer-looking.but.verbatim" },
      skipTlsVerification: false,
    });
  });

  it("reports the Resource's status, duration and body", async () => {
    const { transport } = fakeTransport(ok('{"Token-JWT":"t"}'), {
      status: 200,
      headers: {},
      body: '{"lines":[{"id":1}]}',
      durationMs: 137,
    });

    expect(await sendResource(transport, readyToSend())).toEqual({
      kind: "response",
      status: 200,
      durationMs: 137,
      body: '{"lines":[{"id":1}]}',
      token: "t",
    });
  });

  it("reports a non-2xx Resource answer as a response, not as a failure", async () => {
    const { transport } = fakeTransport(
      ok('{"Token-JWT":"t"}'),
      ok('{"error":"no such customer"}', 404),
    );

    expect(await sendResource(transport, readyToSend())).toEqual({
      kind: "response",
      status: 404,
      durationMs: 12,
      body: '{"error":"no such customer"}',
      token: "t",
    });
  });
});

describe("the last Token obtained", () => {
  it("is reported by a send that generated one", async () => {
    const { transport } = fakeTransport(
      ok('{"Token-JWT":"abc.def.ghi"}'),
      ok("{}"),
    );

    const outcome = await sendResource(transport, readyToSend());

    expect(outcome.kind === "response" && outcome.token).toBe("abc.def.ghi");
  });

  it("is empty after a Zuul send, which carries no Token", async () => {
    const { transport } = fakeTransport(ok("<lines/>"));
    const zuul = editUrl(
      readyToSend(),
      "https://zuul-uat.int.si.orange.es:9061/x",
    );

    const outcome = await sendResource(transport, zuul);

    expect(outcome.kind === "response" && outcome.token).toBeNull();
  });

  // The Token was generated; it is the Resource call that fell over. That is
  // exactly when the user wants to see the Token.
  it("is still reported when the Resource call never completed", async () => {
    const transport: Transport = async (request) => {
      if (request.url.includes("/token")) return ok('{"Token-JWT":"abc.def"}');
      throw new TransportFailure("client error (Connect): record overflow", {
        timedOut: false,
        failedToConnect: true,
      });
    };

    const outcome = await sendResource(transport, readyToSend());

    expect(outcome.kind === "network-error" && outcome.token).toBe("abc.def");
  });

  describe("lastTokenAfter", () => {
    it("has nothing to show before anything is sent", () => {
      expect(lastTokenAfter(null, null)).toBeNull();
    });

    it("takes the Token of the send that just finished", () => {
      expect(
        lastTokenAfter(
          {
            kind: "response",
            status: 200,
            durationMs: 1,
            body: "{}",
            token: "fresh",
          },
          "stale",
        ),
      ).toBe("fresh");
    });

    it("keeps the Token of the session when a Zuul send obtained none", () => {
      expect(
        lastTokenAfter(
          {
            kind: "response",
            status: 200,
            durationMs: 1,
            body: "{}",
            token: null,
          },
          "earlier",
        ),
      ).toBe("earlier");
    });

    it("keeps the Token of the session when a Token could not be generated", () => {
      expect(
        lastTokenAfter(
          { kind: "token-failure", status: 401, durationMs: 1, body: "{}" },
          "earlier",
        ),
      ).toBe("earlier");
    });
  });
});

describe("the skip-TLS toggle", () => {
  it("is off unless a send asks for it", async () => {
    const { transport, requests } = fakeTransport(
      ok('{"Token-JWT":"t"}'),
      ok("{}"),
    );

    await sendResource(transport, readyToSend());

    expect(requests.map((request) => request.skipTlsVerification)).toEqual([
      false,
      false,
    ]);
  });

  // A broken certificate on the token endpoint would block the send before the
  // Resource is ever reached, so the toggle has to cover both requests.
  it("covers the Token request as well as the Resource request", async () => {
    const { transport, requests } = fakeTransport(
      ok('{"Token-JWT":"t"}'),
      ok("{}"),
    );

    await sendResource(transport, readyToSend(), {
      skipTlsVerification: true,
    });

    expect(requests.map((request) => request.skipTlsVerification)).toEqual([
      true,
      true,
    ]);
  });
});

describe("a Token that cannot be generated", () => {
  it("aborts before the Resource is called and hands back the token endpoint's answer", async () => {
    const { transport, requests } = fakeTransport(
      ok('{"error":"unauthorized"}', 401),
    );

    const outcome = await sendResource(transport, readyToSend());

    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toContain("/token");
    expect(outcome).toEqual({
      kind: "token-failure",
      status: 401,
      durationMs: 12,
      body: '{"error":"unauthorized"}',
    });
  });

  it("treats a 200 with no Token-JWT field as a failure", async () => {
    const { transport, requests } = fakeTransport(ok('{"other":"field"}'));

    const outcome = await sendResource(transport, readyToSend());

    expect(requests).toHaveLength(1);
    expect(outcome).toEqual({
      kind: "token-failure",
      status: 200,
      durationMs: 12,
      body: '{"other":"field"}',
    });
  });

  it("treats a non-2xx token answer as a failure even if it carries a JWT", async () => {
    const { transport, requests } = fakeTransport(
      ok('{"Token-JWT":"stale.token"}', 403),
    );

    const outcome = await sendResource(transport, readyToSend());

    expect(requests).toHaveLength(1);
    expect(outcome).toEqual({
      kind: "token-failure",
      status: 403,
      durationMs: 12,
      body: '{"Token-JWT":"stale.token"}',
    });
  });

  it("treats a body that is not JSON as a failure", async () => {
    const { transport, requests } = fakeTransport(
      ok("<html>Gateway Timeout</html>"),
    );

    const outcome = await sendResource(transport, readyToSend());

    expect(requests).toHaveLength(1);
    expect(outcome).toEqual({
      kind: "token-failure",
      status: 200,
      durationMs: 12,
      body: "<html>Gateway Timeout</html>",
    });
  });
});

describe("sendResource on a Zuul URL", () => {
  it("sends the Resource alone, with no Token and no extra headers", async () => {
    const { transport, requests } = fakeTransport(ok("<lines/>"));
    const handEdited = editUrl(
      readyToSend(),
      "https://zuul-uat.int.si.orange.es:9061/crbproductinventory/v1/lines",
    );

    const outcome = await sendResource(transport, handEdited);

    expect(requests).toEqual([
      {
        method: "GET",
        url: "https://zuul-uat.int.si.orange.es:9061/crbproductinventory/v1/lines",
        headers: {},
        skipTlsVerification: false,
      },
    ]);
    expect(outcome).toEqual({
      kind: "response",
      status: 200,
      durationMs: 12,
      body: "<lines/>",
      token: null,
    });
  });
});

describe("a request that never completed", () => {
  const TIMED_OUT = new TransportFailure(
    "error sending request for url (https://api-ent1-openapi.cloudready-nonprod.cloud.si.orange.es/jwtgenerator/v1/token): operation timed out",
    { timedOut: true, failedToConnect: false },
  );

  const REFUSED = new TransportFailure(
    "error sending request for url (https://api-ent1-openapi.cloudready-nonprod.cloud.si.orange.es/jwt/x): client error (Connect): tcp connect error: Connection refused (os error 61)",
    { timedOut: false, failedToConnect: true },
  );

  const failing = (failure: unknown): Transport => async () => {
    throw failure;
  };

  it("reports a diagnosis instead of rejecting, whichever request hit it", async () => {
    const outcome = await sendResource(failing(TIMED_OUT), readyToSend());

    expect(outcome).toEqual({
      kind: "network-error",
      failure: {
        kind: "timeout",
        message: expect.stringContaining("30 segundos"),
        detail: TIMED_OUT.message,
      },
      token: null,
    });
  });

  it("diagnoses a failure of the Resource call the same way", async () => {
    const transport: Transport = async (request) => {
      if (request.url.includes("/token")) return ok('{"Token-JWT":"t"}');
      throw REFUSED;
    };

    expect(await sendResource(transport, readyToSend())).toEqual({
      kind: "network-error",
      failure: {
        kind: "connection-refused",
        message: expect.any(String),
        detail: REFUSED.message,
      },
      token: "t",
    });
  });

  // Nothing in the app throws a bare Error, but a transport that does must not
  // take the send down with it.
  it("survives a failure that carries no verdict at all", async () => {
    const outcome = await sendResource(
      failing(new Error("algo salió mal")),
      readyToSend(),
    );

    expect(outcome).toEqual({
      kind: "network-error",
      failure: {
        kind: "unknown",
        message: expect.any(String),
        detail: "algo salió mal",
      },
      token: null,
    });
  });
});

describe("statusClass", () => {
  it("groups a status by the class the response panel colours it with", () => {
    expect(statusClass(200)).toBe("success");
    expect(statusClass(204)).toBe("success");
    expect(statusClass(404)).toBe("client-error");
    expect(statusClass(500)).toBe("server-error");
    expect(statusClass(302)).toBe("other");
  });
});
