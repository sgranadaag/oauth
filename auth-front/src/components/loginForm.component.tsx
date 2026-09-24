"use client";

import { useState, type FormEvent, type ReactElement } from "react";

import {
  INTERACTION_EXPIRED,
  INVALID_CREDENTIALS,
} from "@constants/interaction.constants";
import { signIn } from "@services/interaction.service";
import type { InteractionDetails } from "@shared/interaction.types";

const FAILURE_MESSAGES: Record<string, string> = {
  [INVALID_CREDENTIALS]: "Wrong email or password.",
  [INTERACTION_EXPIRED]:
    "This sign-in link has expired. Go back to the application and start again.",
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

    const outcome = await signIn(interactionId, { email, password });

    if (!outcome.ok) {
      setError(FAILURE_MESSAGES[outcome.reason] ?? UNAVAILABLE_MESSAGE);
      setIsSubmitting(false);
      return;
    }

    window.location.assign(outcome.redirectTo);
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
