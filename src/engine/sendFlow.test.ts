import { describe, expect, it } from "vitest";
import { parseCatalog } from "./catalog";
import type { DefinedResource } from "./catalogTree";
import type { HeaderPanelState } from "./headerPanel";
import { createHeaderPanelState, editUrl, setDocumentId } from "./headerPanel";
import type { HttpRequest, HttpResponse, Transport } from "./http";
import type { NetworkError } from "./networkError";
import type { SessionState } from "./session";
import { createSession, setSkipTlsVerification } from "./session";
import type { SendOutcome } from "./sendFlow";
import { sendResource, statusClass } from "./sendFlow";

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

/** A send under a freshly launched session, which is the common case. */
function send(
  transport: Transport,
  state: HeaderPanelState,
  session: SessionState = createSession(),
) {
  return sendResource(transport, state, session);
}

const LINES_URL =
  "https://api-ent1-openapi.cloudready-nonprod.cloud.si.orange.es/jwt/crbproductinventory/v1/lines?docId=12345678Z";

const ZUUL_URL =
  "https://zuul-uat.int.si.orange.es:9061/crbproductinventory/v1/lines";

/** Narrows an outcome to the failure it must be, so tests can read into it. */
function networkErrorOf(outcome: SendOutcome): NetworkError {
  if (outcome.kind !== "network-error") {
    throw new Error(`se esperaba un fallo de red, no ${outcome.kind}`);
  }
  return outcome.error;
}

describe("sendResource on an Apigee URL", () => {
  it("generates a Token first, with exactly the nine specified headers", async () => {
    const { transport, requests } = fakeTransport(
      ok('{"Token-JWT":"abc.def.ghi"}'),
      ok('{"lines":[]}'),
    );

    await send(transport, readyToSend());

    expect(requests[0]).toEqual({
      method: "GET",
      url: "https://api-ent1-openapi.cloudready-nonprod.cloud.si.orange.es/token",
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

    await send(transport, readyToSend());

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

    expect((await send(transport, readyToSend())).outcome).toEqual({
      kind: "response",
      status: 200,
      durationMs: 137,
      body: '{"lines":[{"id":1}]}',
    });
  });

  it("reports a non-2xx Resource answer as a response, not as a failure", async () => {
    const { transport } = fakeTransport(
      ok('{"Token-JWT":"t"}'),
      ok('{"error":"no such customer"}', 404),
    );

    expect((await send(transport, readyToSend())).outcome).toEqual({
      kind: "response",
      status: 404,
      durationMs: 12,
      body: '{"error":"no such customer"}',
    });
  });

  it("reports a 5xx Resource answer as a response too", async () => {
    const { transport } = fakeTransport(
      ok('{"Token-JWT":"t"}'),
      ok("Internal Server Error", 500),
    );

    expect((await send(transport, readyToSend())).outcome).toEqual({
      kind: "response",
      status: 500,
      durationMs: 12,
      body: "Internal Server Error",
    });
  });
});

describe("a Token that cannot be generated", () => {
  it("aborts before the Resource is called and hands back the token endpoint's answer", async () => {
    const { transport, requests } = fakeTransport(
      ok('{"error":"unauthorized"}', 401),
    );

    const { outcome } = await send(transport, readyToSend());

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

    const { outcome } = await send(transport, readyToSend());

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

    const { outcome } = await send(transport, readyToSend());

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

    const { outcome } = await send(transport, readyToSend());

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
    const handEdited = editUrl(readyToSend(), ZUUL_URL);

    const { outcome } = await send(transport, handEdited);

    expect(requests).toEqual([
      {
        method: "GET",
        url: ZUUL_URL,
        headers: {},
        skipTlsVerification: false,
      },
    ]);
    expect(outcome).toEqual({
      kind: "response",
      status: 200,
      durationMs: 12,
      body: "<lines/>",
    });
  });
});

describe("the Token a send obtained", () => {
  it("comes back with the outcome, so the inspector can show it", async () => {
    const { transport } = fakeTransport(
      ok('{"Token-JWT":"abc.def.ghi"}'),
      ok('{"lines":[]}'),
    );

    expect((await send(transport, readyToSend())).token).toBe("abc.def.ghi");
  });

  it("is none for a Zuul send, which never generates one", async () => {
    const { transport } = fakeTransport(ok("<lines/>"));

    const result = await send(transport, editUrl(readyToSend(), ZUUL_URL));

    expect(result.token).toBeNull();
  });

  it("is none when the token endpoint refused to give one", async () => {
    const { transport } = fakeTransport(ok('{"error":"unauthorized"}', 401));

    expect((await send(transport, readyToSend())).token).toBeNull();
  });

  it("survives a Resource call that then failed, since it was still obtained", async () => {
    const transport: Transport = async (request) => {
      if (request.url.includes("/token")) return ok('{"Token-JWT":"abc.def"}');
      throw new Error("tcp connect error: Connection refused (os error 61)");
    };

    const result = await send(transport, readyToSend());

    expect(result.token).toBe("abc.def");
    expect(result.outcome.kind).toBe("network-error");
  });
});

describe("the session's skip-TLS switch", () => {
  it("is off for a freshly launched session, so certificates are verified", async () => {
    const { transport, requests } = fakeTransport(
      ok('{"Token-JWT":"t"}'),
      ok('{"lines":[]}'),
    );

    await sendResource(transport, readyToSend(), createSession());

    expect(requests.map((request) => request.skipTlsVerification)).toEqual([
      false,
      false,
    ]);
  });

  it("reaches the Token request and the Resource request alike when on", async () => {
    const { transport, requests } = fakeTransport(
      ok('{"Token-JWT":"t"}'),
      ok('{"lines":[]}'),
    );
    const session = setSkipTlsVerification(createSession(), true);

    await sendResource(transport, readyToSend(), session);

    expect(requests.map((request) => request.skipTlsVerification)).toEqual([
      true,
      true,
    ]);
  });
});

describe("a transport that fails outright", () => {
  const failing = (error: unknown): Transport => async () => {
    throw error;
  };

  // The wording of each class is networkError.test.ts's business; what
  // matters here is that a rejection becomes a classified outcome at all,
  // carrying the transport's words through untouched.
  it("reports a classified failure instead of rejecting", async () => {
    const detail = "error sending request for url (https://api-ent1…/token)";

    const { outcome } = await send(
      failing({ timedOut: true, detail }),
      readyToSend(),
    );

    const error = networkErrorOf(outcome);
    expect(error.kind).toBe("timeout");
    expect(error.detail).toBe(detail);
  });

  it("classifies a failure of the Resource call the same way", async () => {
    const transport: Transport = async (request) => {
      if (request.url.includes("/token")) return ok('{"Token-JWT":"t"}');
      throw { timedOut: false, detail: "invalid peer certificate: UnknownIssuer" };
    };

    const { outcome } = await send(transport, readyToSend());

    const error = networkErrorOf(outcome);
    expect(error.kind).toBe("tls");
    expect(error.hint).toContain("Omitir verificación TLS");
  });

  it("still classifies a rejection that is a plain Error", async () => {
    const { outcome } = await send(
      failing(new Error("dns error: failed to lookup address information")),
      readyToSend(),
    );

    const error = networkErrorOf(outcome);
    expect(error.kind).toBe("unreachable");
    expect(error.hint).toContain("VPN");
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
