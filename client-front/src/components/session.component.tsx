import type { ReactElement } from "react";

import type { Session } from "@shared/auth.types";

const SECONDS_PER_MINUTE = 60;

interface SessionCardProps {
  session: Session;
}

export const SessionCard = ({ session }: SessionCardProps): ReactElement => (
  <section className="card">
    <h1 className="card__title">Signed in</h1>
    <p className="card__description">As {session.email}, from the provider&apos;s ID token.</p>

    <dl className="session">
      <dd className="session__item">Scope: {session.scope}</dd>
      <dd className="session__item">
        Expires in: {Math.round(session.expiresIn / SECONDS_PER_MINUTE)} min
      </dd>
      <dd className="session__item session__item--token">Access token: {session.accessToken}</dd>
    </dl>

    <form action="/api/auth/logout" method="post">
      <button className="form__submit form__submit--secondary" type="submit">
        Sign out
      </button>
    </form>
  </section>
);
