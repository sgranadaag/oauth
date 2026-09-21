import type { LoginCredentials, Session } from "@shared/auth.types";

/**
 * The browser's only call: this app's own route handler, same origin.
 *
 * It never reaches the auth server directly — that would mean shipping the
 * client secret to the browser.
 */
export const login = async (credentials: LoginCredentials): Promise<Session> => {
  const response = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    throw new Error("login failed");
  }

  return (await response.json()) as Session;
};
