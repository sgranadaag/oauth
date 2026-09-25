export interface InteractionDetails {
  clientId: string;
  clientName: string;
  scope: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AcceptResult {
  redirectTo: string;
}

export type LoginOutcome = { ok: true } | { ok: false; reason: string };

export type AcceptOutcome =
  | { ok: true; redirectTo: string }
  | { ok: false; reason: string };
