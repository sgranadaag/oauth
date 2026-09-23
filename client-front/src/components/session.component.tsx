import type { ReactElement } from "react";

import type { Session } from "@shared/auth.types";

const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;

interface SessionCardProps {
  session: Session;
  // A renewal that failed while the session is still usable — the provider
  // was unreachable, say. A dead session shows its error on the sign-in card.
  error?: string;
}

// How long this access token has left, as of this render. Renewing re-renders
// the page, so the figure jumps back up — which is the point of showing it.
const describeRemaining = (expiresAt: number): string => {
  const remainingSeconds = Math.round((expiresAt - Date.now()) / MILLISECONDS_PER_SECOND);
  if (remainingSeconds <= 0) {
    return "expired — renew it";
  }

  const minutes = Math.floor(remainingSeconds / SECONDS_PER_MINUTE);
  const seconds = remainingSeconds % SECONDS_PER_MINUTE;

  return `${minutes} min ${seconds} s left`;
};

export const SessionCard = ({ session, error }: SessionCardProps): ReactElement => (
  <section className="card">
    <h1 className="card__title">Signed in</h1>
    <p className="card__description">As {session.email}, from the provider&apos;s ID token.</p>

    <dl className="session">
      <dd className="session__item">Scope: {session.scope}</dd>
      <dd className="session__item">
        Access token expires at{" "}
        {new Date(session.expiresAt).toLocaleTimeString("en-GB")} —{" "}
        {describeRemaining(session.expiresAt)}
      </dd>
      <dd className="session__item">Access token</dd>
      <dd className="session__item session__item--token">{session.accessToken}</dd>
      <dd className="session__item">Refresh token</dd>
      <dd className="session__item session__item--token">{session.refreshToken}</dd>
    </dl>

    {/* Renewing never involves the person: the exchange happens server side,
        with this app's secret. The provider rotates the refresh token, so the
        one shown above changes too. */}
    <form action="/api/auth/refresh" method="post">
      <button className="form__submit form__submit--wide" type="submit">
        Renew token
      </button>
    </form>

    {error && (
      <p className="message message--error">
        The session could not be renewed: {error}
      </p>
    )}

    <form action="/api/auth/logout" method="post">
      <button className="form__submit form__submit--secondary" type="submit">
        Sign out
      </button>
    </form>
  </section>
);
