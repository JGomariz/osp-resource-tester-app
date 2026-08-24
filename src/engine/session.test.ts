import { describe, expect, it } from "vitest";
import {
  createSession,
  rememberToken,
  setSkipTlsVerification,
} from "./session";

describe("a session as the app launches", () => {
  // Nothing here is persisted, so these defaults are also what a relaunch
  // restores: the TLS switch is never found already on.
  it("verifies TLS and has no Token to show yet", () => {
    expect(createSession()).toEqual({
      skipTlsVerification: false,
      lastToken: null,
    });
  });
});

describe("the skip-TLS switch", () => {
  it("turns on", () => {
    expect(
      setSkipTlsVerification(createSession(), true).skipTlsVerification,
    ).toBe(true);
  });

  it("turns off again", () => {
    const on = setSkipTlsVerification(createSession(), true);

    expect(setSkipTlsVerification(on, false).skipTlsVerification).toBe(false);
  });

  it("leaves the remembered Token alone", () => {
    const session = rememberToken(createSession(), "abc.def.ghi");

    expect(setSkipTlsVerification(session, true).lastToken).toBe("abc.def.ghi");
  });
});

describe("the Token a send obtained", () => {
  it("becomes the one the inspector shows", () => {
    expect(rememberToken(createSession(), "abc.def.ghi").lastToken).toBe(
      "abc.def.ghi",
    );
  });

  it("replaces the previous one, since only the last is of interest", () => {
    const first = rememberToken(createSession(), "first.token");

    expect(rememberToken(first, "second.token").lastToken).toBe("second.token");
  });

  it("keeps the previous one when a send obtained none, as a Zuul send does", () => {
    const session = rememberToken(createSession(), "abc.def.ghi");

    expect(rememberToken(session, null).lastToken).toBe("abc.def.ghi");
  });
});

describe("every update", () => {
  it("leaves the session it was given untouched", () => {
    const session = createSession();

    setSkipTlsVerification(session, true);
    rememberToken(session, "abc.def.ghi");

    expect(session).toEqual({ skipTlsVerification: false, lastToken: null });
  });
});
