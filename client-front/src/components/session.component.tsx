import type { ReactElement } from "react";

import { MILLISECONDS_PER_SECOND, SECONDS_PER_MINUTE } from "@constants/auth.constants";
import type { Session } from "@shared/auth.types";

interface SessionCardProps {
  session: Session;
  error?: string;
  onRenew: () => void;
  onSignOut: () => void;
}

const describeTimeLeft = (expiresAt: number): string => {
  const remainingSeconds = Math.round((expiresAt - Date.now()) / MILLISECONDS_PER_SECOND);
  if (remainingSeconds <= 0) {
    return "expired — renew it";
  }

  const minutes = Math.floor(remainingSeconds / SECONDS_PER_MINUTE);
  const seconds = remainingSeconds % SECONDS_PER_MINUTE;

  return `${minutes} min ${seconds} s left`;
};

export const SessionCard = ({
  session,
  error,
  onRenew,
  onSignOut,
}: SessionCardProps): ReactElement => (
  <section className="card">
    <h1 className="card__title">Signed in</h1>
    <p className="card__description">
      Subject {session.subject}, read from the access token after verifying its
      signature.
    </p>

    <dl className="session">
      <dd className="session__item">Scope: {session.scope}</dd>
      <dd className="session__item">
        Access token expires at{" "}
        {new Date(session.expiresAt).toLocaleTimeString("en-GB")} —{" "}
        {describeTimeLeft(session.expiresAt)}
      </dd>
      <dd className="session__item">Access token</dd>
      <dd className="session__item session__item--token">{session.accessToken}</dd>
      <dd className="session__item">Refresh token</dd>
      <dd className="session__item session__item--token">{session.refreshToken}</dd>
    </dl>

    <button className="form__submit form__submit--wide" type="button" onClick={onRenew}>
      Renew token
    </button>

    {error && (
      <p className="message message--error">
        The session could not be renewed: {error}
      </p>
    )}

    <button
      className="form__submit form__submit--secondary"
      type="button"
      onClick={onSignOut}
    >
      Sign out
    </button>
  </section>
);
