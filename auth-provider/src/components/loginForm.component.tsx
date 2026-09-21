"use client";

import { useState, type FormEvent, type ReactElement } from "react";

import { login } from "@api/login.api";
import type { Session } from "@shared/auth.types";

const SECONDS_PER_MINUTE = 60;

export const LoginForm = (): ReactElement => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      setSession(await login({ email, password }));
    } catch {
      setSession(null);
      setError("Could not sign in. Check the credentials and that the auth server is running.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="card">
      <h1 className="card__title">Sign in</h1>
      <p className="card__description">
        The form posts to this app&apos;s own route handler, which holds the client credentials and
        exchanges them with the auth server. The browser never sees the client secret.
      </p>

      <form className="form" onSubmit={onSubmit}>
        <label className="form__label" htmlFor="email">
          Email
        </label>
        <input
          className="form__input"
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />

        <label className="form__label" htmlFor="password">
          Password
        </label>
        <input
          className="form__input"
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        <button className="form__submit" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Signing in..." : "Sign in"}
        </button>
      </form>

      {error && <p className="message message--error">{error}</p>}

      {session && (
        <dl className="session">
          <dt className="session__title">Signed in</dt>
          <dd className="session__item">Scope: {session.scope}</dd>
          <dd className="session__item">
            Expires in: {Math.round(session.expiresIn / SECONDS_PER_MINUTE)} min
          </dd>
          <dd className="session__item session__item--token">
            Access token: {session.accessToken}
          </dd>
        </dl>
      )}
    </section>
  );
};
