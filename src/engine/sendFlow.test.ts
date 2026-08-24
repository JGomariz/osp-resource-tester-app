import { describe, expect, it } from "vitest";
import { parseCatalog } from "./catalog";
import type { DefinedResource } from "./catalogTree";
import type { HeaderPanelState } from "./headerPanel";
import { createHeaderPanelState, editUrl, setDocumentId } from "./headerPanel";
import type { HttpRequest, HttpResponse, Transport } from "./http";
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
    });
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
    });
  });
});

describe("a transport that fails outright", () => {
  const failing = (message: string): Transport => async () => {
    throw new Error(message);
  };

  it("reports the failure instead of rejecting, whichever request hit it", async () => {
    expect(
      await sendResource(failing("error sending request for url"), readyToSend()),
    ).toEqual({
      kind: "network-error",
      message: "error sending request for url",
    });
  });

  it("reports a failure of the Resource call the same way", async () => {
    const transport: Transport = async (request) => {
      if (request.url.includes("/token")) return ok('{"Token-JWT":"t"}');
      throw new Error("connection refused");
    };

    expect(await sendResource(transport, readyToSend())).toEqual({
      kind: "network-error",
      message: "connection refused",
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
