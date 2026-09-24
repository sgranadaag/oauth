import type { ReactElement } from "react";

import {
  SESSION_EXPIRED,
  SIGN_IN_FAILED,
  STATE_MISMATCH,
} from "@constants/session.constants";

const FAILURE_MESSAGES: Record<string, string> = {
  [STATE_MISMATCH]: "That sign-in could not be verified. Please start again.",
  [SIGN_IN_FAILED]: "The provider did not complete the sign-in. Please try again.",
  [SESSION_EXPIRED]: "Your session ended. Please sign in again.",
};

interface SignInCardProps {
  error?: string;
  onSignIn: () => void;
}

export const SignInCard = ({ error, onSignIn }: SignInCardProps): ReactElement => (
  <section className="card">
    <h1 className="card__title">Client app</h1>
    <p className="card__description">
      This app never asks for your password. Signing in sends you to the provider, and you come
      back with a one-time code this app exchanges for tokens.
    </p>

    <button className="form__submit form__submit--wide" type="button" onClick={onSignIn}>
      Sign in with the provider
    </button>

    {error && (
      <p className="message message--error">
        {FAILURE_MESSAGES[error] ?? `The provider refused the request: ${error}`}
      </p>
    )}
  </section>
);
