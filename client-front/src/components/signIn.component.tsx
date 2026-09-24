import type { ReactElement } from "react";

const ERROR_MESSAGES: Record<string, string> = {
  state_mismatch: "That sign-in could not be verified. Please start again.",
  sign_in_failed: "The provider did not complete the sign-in. Please try again.",
  session_expired: "Your session ended. Please sign in again.",
  refresh_failed: "The provider could not be reached to renew your session.",
};

interface SignInProps {
  error?: string;
  onSignIn: () => void;
}

export const SignIn = ({ error, onSignIn }: SignInProps): ReactElement => (
  <section className="card">
    <h1 className="card__title">Client app</h1>
    <p className="card__description">
      This app never asks for your password. Signing in sends you to the provider, and you come
      back with a one-time code this app exchanges for tokens.
    </p>

    {/* The flow still leaves this page entirely: the person has to reach the
        provider's own origin to type a password. */}
    <button className="form__submit form__submit--wide" type="button" onClick={onSignIn}>
      Sign in with the provider
    </button>

    {error && (
      <p className="message message--error">
        {ERROR_MESSAGES[error] ?? `The provider refused the request: ${error}`}
      </p>
    )}
  </section>
);
