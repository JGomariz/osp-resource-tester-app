/**
 * What the app remembers for as long as it stays open: the diagnostics switch
 * that loosens TLS, and the last Token a send obtained.
 *
 * None of it is written anywhere, so {@link createSession} is both the initial
 * state and what a relaunch restores — the TLS switch cannot be found already
 * on, which is the point of it being session-scoped.
 *
 * It is deliberately not part of the header panel: that state is rebuilt for
 * every Resource, and switching Resource must not silently re-enable TLS
 * verification or forget the Token the user was about to copy.
 */

export interface SessionState {
  readonly skipTlsVerification: boolean;
  /** The last Token obtained this session, or null before any Apigee send. */
  readonly lastToken: string | null;
}

export function createSession(): SessionState {
  return { skipTlsVerification: false, lastToken: null };
}

export function setSkipTlsVerification(
  session: SessionState,
  skipTlsVerification: boolean,
): SessionState {
  return { ...session, skipTlsVerification };
}

/**
 * Records the Token a send obtained. A send that obtained none — a Zuul send,
 * or one whose Token generation failed — passes null and leaves the previous
 * Token on show, rather than blanking the inspector.
 */
export function rememberToken(
  session: SessionState,
  token: string | null,
): SessionState {
  return token === null ? session : { ...session, lastToken: token };
}
