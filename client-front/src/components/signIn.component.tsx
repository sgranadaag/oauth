import type { ReactElement } from "react";

const ERROR_MESSAGES: Record<string, string> = {
  state_mismatch: "That sign-in could not be verified. Please start again.",
  sign_in_failed: "The provider did not complete the sign-in. Please try again.",
};

interface SignInProps {
  error?: string;
}

export const SignIn = ({ error }: SignInProps): ReactElement => (
  <section className="card">
    <h1 className="card__title">Client app</h1>
    <p className="card__description">
      This app never asks for your password. Signing in sends you to the provider, and you come
      back with a one-time code this app exchanges for tokens.
    </p>

    {/* A plain link, not a fetch: the flow starts with a full navigation. */}
    <a className="form__submit form__submit--link" href="/api/auth/login">
      Sign in with the provider
    </a>

    {error && (
      <p className="message message--error">
        {ERROR_MESSAGES[error] ?? `The provider refused the request: ${error}`}
      </p>
    )}
  </section>
);
