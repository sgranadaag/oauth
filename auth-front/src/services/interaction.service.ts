import { AUTH_SERVER_URL } from "@constants/auth.constants";
import {
  INTERACTION_EXPIRED,
  INVALID_CREDENTIALS,
  PROVIDER_UNAVAILABLE,
} from "@constants/interaction.constants";
import type {
  InteractionDetails,
  LoginCredentials,
  LoginResult,
  SignInOutcome,
} from "@shared/interaction.types";

const interactionUrl = (interactionId: string, path = ""): URL =>
  new URL(`/oauth/interactions/${encodeURIComponent(interactionId)}${path}`, AUTH_SERVER_URL);

/**
 * What the login page shows: which client is asking, and for what.
 *
 * @returns The details, or `null` when there is nothing to sign in to — an
 *   unknown id, an expired one, or a provider that did not answer. The page
 *   says the same thing in all three cases, so they are not told apart here.
 */
export const findInteraction = async (
  interactionId: string,
): Promise<InteractionDetails | null> => {
  try {
    const response = await fetch(interactionUrl(interactionId), { cache: "no-store" });

    return response.ok ? ((await response.json()) as InteractionDetails) : null;
  } catch {
    return null;
  }
};

/**
 * Hands the credentials to the auth server, which owns the accounts.
 *
 * This app never judges a password — it only carries it.
 *
 * @returns Where to send the browser next, or the reason it did not work.
 */
export const signIn = async (
  interactionId: string,
  credentials: LoginCredentials,
): Promise<SignInOutcome> => {
  let response: Response;
  try {
    response = await fetch(interactionUrl(interactionId, "/login"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
    });
  } catch {
    return { ok: false, reason: PROVIDER_UNAVAILABLE };
  }

  if (response.status === 401) return { ok: false, reason: INVALID_CREDENTIALS };
  if (response.status === 404) return { ok: false, reason: INTERACTION_EXPIRED };
  if (!response.ok) return { ok: false, reason: PROVIDER_UNAVAILABLE };

  const { redirectTo } = (await response.json()) as LoginResult;

  return { ok: true, redirectTo };
};
