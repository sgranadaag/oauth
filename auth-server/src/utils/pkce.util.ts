import { createHash } from 'node:crypto';

/**
 * Derives the PKCE `code_challenge` for a `code_verifier`, method `S256`.
 *
 * RFC 7636 §4.2: `BASE64URL(SHA256(ASCII(code_verifier)))`. The client sends
 * the challenge when the flow starts and the verifier only when it exchanges
 * the code, so a code intercepted on its way back through the browser is
 * useless without the secret that never left the client. `plain` is not
 * supported: it would send the secret itself on the front channel.
 *
 * @param codeVerifier - The high-entropy value the client generated and kept.
 * @returns The challenge to compare against the one stored with the code.
 */
export function computeCodeChallenge(codeVerifier: string): string {
  return createHash('sha256').update(codeVerifier, 'ascii').digest('base64url');
}
