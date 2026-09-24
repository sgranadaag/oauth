export interface InteractionDetails {
  clientName: string;
  scope: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResult {
  redirectTo: string;
}

export type SignInOutcome =
  | { ok: true; redirectTo: string }
  | { ok: false; reason: string };
