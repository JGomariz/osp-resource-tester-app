import { describe, expect, it } from "vitest";
import { classifyNetworkError } from "./networkError";

/** A rejection shaped like the one the Rust transport produces. */
function rejection(detail: string, timedOut = false) {
  return { timedOut, detail };
}

describe("a request that timed out", () => {
  it("is recognised from the transport's own timeout flag", () => {
    const error = classifyNetworkError(
      rejection("error sending request for url (https://api-ent1…/token)", true),
    );

    expect(error.kind).toBe("timeout");
    expect(error.message).toContain("30 segundos");
  });

  it("is recognised from the text when no flag comes with it", () => {
    expect(
      classifyNetworkError(rejection("error sending request: operation timed out"))
        .kind,
    ).toBe("timeout");
  });
});

describe("a host that cannot be reached", () => {
  const details = [
    "error sending request: dns error: failed to lookup address information: nodename nor servname provided, or not known",
    "failed to lookup address information: Name or service not known",
    "No such host is known. (os error 11001)",
    "tcp connect error: No route to host (os error 65)",
    "tcp connect error: Network is unreachable (os error 51)",
  ];

  it.each(details)("is classified as unreachable: %s", (detail) => {
    expect(classifyNetworkError(rejection(detail)).kind).toBe("unreachable");
  });

  it("points the user at the VPN", () => {
    const error = classifyNetworkError(rejection("dns error: no such host"));

    expect(error.hint).toContain("VPN");
  });
});

describe("a host that refuses the connection", () => {
  const details = [
    "tcp connect error: Connection refused (os error 61)",
    "No connection could be made because the target machine actively refused it. (os error 10061)",
  ];

  it.each(details)("is classified as refused: %s", (detail) => {
    expect(classifyNetworkError(rejection(detail)).kind).toBe("refused");
  });

  it("does not blame the VPN, since the host answered", () => {
    const error = classifyNetworkError(
      rejection("tcp connect error: Connection refused (os error 61)"),
    );

    expect(error.hint ?? "").not.toContain("VPN");
  });
});

describe("a certificate that cannot be verified", () => {
  const details = [
    "error sending request: invalid peer certificate: UnknownIssuer",
    "invalid peer certificate: Expired",
    "certificate verify failed: self signed certificate in certificate chain",
    "unable to get local issuer certificate",
    "the handshake failed: sslv3 alert handshake failure",
  ];

  it.each(details)("is classified as a TLS failure: %s", (detail) => {
    expect(classifyNetworkError(rejection(detail)).kind).toBe("tls");
  });

  it("points the user at the skip-TLS toggle, by the name the UI gives it", () => {
    const error = classifyNetworkError(
      rejection("invalid peer certificate: UnknownIssuer"),
    );

    expect(error.hint).toContain("Omitir verificación TLS");
  });
});

describe("a failure that matches nothing known", () => {
  it("is reported as unknown, without inventing a cause", () => {
    const error = classifyNetworkError(rejection("builder error: unsupported"));

    expect(error).toEqual({
      kind: "unknown",
      message: "No se pudo completar la petición.",
      hint: null,
      detail: "builder error: unsupported",
    });
  });
});

describe("the transport's own words", () => {
  it("are kept on every classification, so nothing is hidden", () => {
    const detail = "tcp connect error: Connection refused (os error 61)";

    expect(classifyNetworkError(rejection(detail)).detail).toBe(detail);
  });

  it("survive a rejection that is a plain Error", () => {
    const error = classifyNetworkError(new Error("dns error: no such host"));

    expect(error.kind).toBe("unreachable");
    expect(error.detail).toBe("dns error: no such host");
  });

  it("survive a rejection that is a bare string", () => {
    expect(classifyNetworkError("operation timed out").kind).toBe("timeout");
  });

  it("survive a rejection that is nothing recognisable at all", () => {
    const error = classifyNetworkError(undefined);

    expect(error.kind).toBe("unknown");
    expect(error.detail).toBe("undefined");
  });
});

describe("classification of the host name itself", () => {
  // The detail carries the URL, so a host with "ssl" or "tls" in its name must
  // not be mistaken for a certificate failure.
  it("ignores TLS-looking words inside the URL", () => {
    const error = classifyNetworkError(
      rejection(
        "error sending request for url (https://ssl-tls-gateway.int.si.orange.es:9061/lines): tcp connect error: Connection refused (os error 61)",
      ),
    );

    expect(error.kind).toBe("refused");
  });
});

describe("every classification", () => {
  it("speaks Spanish and ends its message as a sentence", () => {
    const details = [
      "operation timed out",
      "dns error: no such host",
      "Connection refused (os error 61)",
      "invalid peer certificate: UnknownIssuer",
      "something else entirely",
    ];

    for (const detail of details) {
      const { message } = classifyNetworkError(rejection(detail));
      expect(message).not.toBe("");
      expect(message.endsWith(".")).toBe(true);
    }
  });
});
