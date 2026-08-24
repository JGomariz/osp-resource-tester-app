import { describe, expect, it } from "vitest";
import { classifyNetworkFailure } from "./diagnostics";
import { TransportFailure } from "./http";

/**
 * Error chains as reqwest really reports them, captured by provoking each
 * failure against a local server. The engine classifies these strings, so
 * inventing them would test nothing.
 */
const CHAINS = {
  timeout:
    "error sending request for url (https://api-ent1-openapi.cloudready-nonprod.cloud.si.orange.es/jwtgenerator/v1/token): operation timed out",
  dns: "error sending request for url (https://zuul-uat.int.si.orange.es:9061/x): client error (Connect): dns error: failed to lookup address information: nodename nor servname provided, or not known",
  refused:
    "error sending request for url (https://zuul-uat.int.si.orange.es:9061/x): client error (Connect): tcp connect error: Connection refused (os error 61)",
  tlsProtocol:
    "error sending request for url (https://zuul-uat.int.si.orange.es:9061/x): client error (Connect): record overflow",
  selfSignedCertificate:
    "error sending request for url (https://self-signed.badssl.com/): client error (Connect): The certificate was not trusted.",
  expiredCertificate:
    "error sending request for url (https://expired.badssl.com/): client error (Connect): An expired certificate was detected.",
  /**
   * Not captured: assembled from the platform's own errno wording, for a
   * connect failure with no cause this file recognises.
   */
  reset:
    "error sending request for url (http://zuul-uat.int.si.orange.es:9061/x): client error (Connect): Connection reset by peer (os error 54)",
} as const;

const HTTPS_URL = "https://zuul-uat.int.si.orange.es:9061/x";
const HTTP_URL = "http://zuul-uat.int.si.orange.es:9061/x";

function failedToConnect(message: string): TransportFailure {
  return new TransportFailure(message, {
    timedOut: false,
    failedToConnect: true,
  });
}

describe("a request that timed out", () => {
  it("is reported as a timeout naming the 30-second limit", () => {
    const failure = classifyNetworkFailure(
      new TransportFailure(CHAINS.timeout, {
        timedOut: true,
        failedToConnect: false,
      }),
      HTTPS_URL,
    );

    expect(failure.kind).toBe("timeout");
    expect(failure.message).toContain("30 segundos");
  });
});

describe("a host that cannot be resolved", () => {
  it("is reported as unreachable, pointing at the VPN", () => {
    const failure = classifyNetworkFailure(
      failedToConnect(CHAINS.dns),
      HTTPS_URL,
    );

    expect(failure.kind).toBe("unreachable");
    expect(failure.message).toContain("VPN");
  });
});

describe("a connection the host refuses", () => {
  it("is reported as refused, without blaming the VPN", () => {
    const failure = classifyNetworkFailure(
      failedToConnect(CHAINS.refused),
      HTTPS_URL,
    );

    expect(failure.kind).toBe("connection-refused");
    expect(failure.message).not.toContain("VPN");
  });
});

describe("a certificate the system does not trust", () => {
  it("is reported as TLS, pointing at the skip-TLS toggle", () => {
    const failure = classifyNetworkFailure(
      failedToConnect(CHAINS.selfSignedCertificate),
      HTTPS_URL,
    );

    expect(failure.kind).toBe("tls");
    expect(failure.message).toContain("Omitir verificación TLS");
  });

  it("reports an expired certificate the same way", () => {
    expect(
      classifyNetworkFailure(
        failedToConnect(CHAINS.expiredCertificate),
        HTTPS_URL,
      ).kind,
    ).toBe("tls");
  });

  // Some TLS failures never say "TLS": `record overflow` is a real handshake
  // alert. On an https URL a connection that never opened, for no cause named
  // above, is the secure channel failing.
  it("reports a handshake failure that never names TLS the same way", () => {
    expect(
      classifyNetworkFailure(failedToConnect(CHAINS.tlsProtocol), HTTPS_URL)
        .kind,
    ).toBe("tls");
  });
});

describe("a failure with no recognisable cause", () => {
  it("does not blame TLS when the URL is not https", () => {
    expect(
      classifyNetworkFailure(failedToConnect(CHAINS.reset), HTTP_URL).kind,
    ).toBe("unknown");
  });

  // A reset connection has a cause of its own — a firewall or proxy in the
  // way — and turning certificate checks off would not help, so the https
  // inference must not claim it.
  it("does not blame TLS for a reset connection, even over https", () => {
    expect(
      classifyNetworkFailure(failedToConnect(CHAINS.reset), HTTPS_URL).kind,
    ).toBe("unknown");
  });

  // The transport that rejects with a verdict is ours; another one need not,
  // and a timeout that says so in words is still a timeout.
  it("still reads a timeout that comes with no verdict attached", () => {
    const failure = classifyNetworkFailure(
      new TransportFailure(CHAINS.timeout, {
        timedOut: false,
        failedToConnect: false,
      }),
      HTTPS_URL,
    );

    expect(failure.kind).toBe("timeout");
    expect(failure.message).toContain("30 segundos");
  });

  it("keeps the transport's own words as the detail", () => {
    const failure = classifyNetworkFailure(
      new Error("something else entirely"),
      HTTPS_URL,
    );

    expect(failure.kind).toBe("unknown");
    expect(failure.detail).toBe("something else entirely");
  });
});
