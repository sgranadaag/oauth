"use client";

import { useState, type FormEvent, type ReactElement } from "react";

import type { InteractionDetails, LoginResult } from "@shared/interaction.types";

// The route answers each outcome the person must tell apart with its own
// status. Anything else — a 502, a network failure — is "unavailable".
const FAILURE_MESSAGES: Record<number, string> = {
  401: "Wrong email or password.",
  404: "This sign-in link has expired. Go back to the application and start again.",
};
const UNAVAILABLE_MESSAGE = "The provider is not available right now. Try again in a moment.";

interface LoginFormProps extends InteractionDetails {
  interactionId: string;
}

export const LoginForm = ({ interactionId, clientName, scope }: LoginFormProps): ReactElement => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Hand the credentials to this app's own route, same origin. It is
      //    the server side that checks them; this page never judges a password.
      const response = await fetch(`/api/interactions/${encodeURIComponent(interactionId)}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      // 2. Wrong password or dead link: say which, and let the person act on it.
      if (!response.ok) {
        setError(FAILURE_MESSAGES[response.status] ?? UNAVAILABLE_MESSAGE);
        setIsSubmitting(false);
        return;
      }

      // 3. Back to the client, carrying the code. A full navigation, not a
      //    client-side route change: the destination is another application.
      const { redirectTo } = (await response.json()) as LoginResult;
      window.location.assign(redirectTo);
    } catch {
      setError(UNAVAILABLE_MESSAGE);
      setIsSubmitting(false);
    }
  };

  return (
    <section className="card">
      <h1 className="card__title">Sign in</h1>
      <p className="card__description">
        <strong>{clientName}</strong> is asking to access your account with these permissions:
      </p>
      <ul className="scopes">
        {scope.split(" ").map((item) => (
          <li className="scopes__item" key={item}>
            {item}
          </li>
        ))}
      </ul>

      <form className="form" onSubmit={onSubmit}>
        <label className="form__label" htmlFor="email">
          Email
        </label>
        <input
          className="form__input"
          id="email"
          type="email"
          autoComplete="username"
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
          {isSubmitting ? "Signing in..." : "Sign in and allow"}
        </button>
      </form>

      {error && <p className="message message--error">{error}</p>}

      <p className="card__footnote">
        Your password stays with the provider. {clientName} never sees it — it only receives a
        one-time code.
      </p>
    </section>
  );
};
