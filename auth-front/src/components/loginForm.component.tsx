"use client";

import { useState, type FormEvent, type ReactElement } from "react";

import {
  INTERACTION_EXPIRED,
  INVALID_CREDENTIALS,
  SESSION_REQUIRED,
} from "@constants/interaction.constants";
import { acceptInteraction, login } from "@services/interaction.service";
import type { InteractionDetails } from "@shared/interaction.types";

const FAILURE_MESSAGES: Record<string, string> = {
  [INVALID_CREDENTIALS]: "Wrong email or password.",
  [INTERACTION_EXPIRED]:
    "This sign-in link has expired. Go back to the application and start again.",
  [SESSION_REQUIRED]: "Your session ended before the request was accepted. Sign in again.",
};
const UNAVAILABLE_MESSAGE = "The provider is not available right now. Try again in a moment.";

interface LoginFormProps extends InteractionDetails {
  interactionId: string;
}

export const LoginForm = ({
  interactionId,
  clientId,
  clientName,
  scope,
}: LoginFormProps): ReactElement => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const loginOutcome = await login(clientId, { email, password });

    if (!loginOutcome.ok) {
      setError(FAILURE_MESSAGES[loginOutcome.reason] ?? UNAVAILABLE_MESSAGE);
      setIsSubmitting(false);
      return;
    }

    const acceptOutcome = await acceptInteraction(interactionId);

    if (!acceptOutcome.ok) {
      setError(FAILURE_MESSAGES[acceptOutcome.reason] ?? UNAVAILABLE_MESSAGE);
      setIsSubmitting(false);
      return;
    }

    window.location.assign(acceptOutcome.redirectTo);
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
