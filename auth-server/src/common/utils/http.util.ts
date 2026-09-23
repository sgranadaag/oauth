const BASIC_PREFIX = 'Basic ';

/** The two halves of a Basic `Authorization` header. */
export interface BasicCredentials {
  /** The username half — the `client_id` in OAuth client authentication. */
  id: string;
  /** Everything after the first colon, colons included. */
  secret: string;
}

/**
 * Builds a URL by adding query parameters to a base, skipping the ones with
 * no value.
 *
 * Every redirect this server sends is built here: back to a client with a
 * `code` and its `state`, back to a client with an `error`, or on to the
 * login page with an `interaction` id. Skipping `undefined` is what lets a
 * caller pass an optional parameter without deciding first — a sign-in with
 * no `state` simply comes back without one, rather than with `state=undefined`.
 * Values are encoded by `URLSearchParams`, so nothing a caller passes can add
 * a parameter of its own.
 *
 * @param baseUrl - Absolute URL to build on. Any query it already carries is kept.
 * @param params - Parameters to add; an entry whose value is `undefined` is left out.
 * @returns The resulting absolute URL.
 * @throws {TypeError} When `baseUrl` is not a valid absolute URL.
 */
export function buildUrl(
  baseUrl: string,
  params: Record<string, string | undefined>,
): string {
  const url = new URL(baseUrl);

  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(name, value);
  }

  return url.toString();
}

/**
 * Reads an `Authorization: Basic …` header into its two halves.
 *
 * RFC 7617 base64-encodes `id:secret`; RFC 6749 §2.3.1 is what puts the
 * `client_id` and `client_secret` in those places. Only the **first** colon
 * separates them, so a secret containing colons survives the split.
 *
 * Nothing is decided here. Whether the credentials are any good is the
 * caller's to answer, against a stored secret and in constant time.
 *
 * @param header - The raw header value, or `undefined` when there is none.
 * @returns The decoded halves, or `null` when the header is absent, is not the
 *   Basic scheme, or carries no colon. Callers answer all three the same way:
 *   which one it was tells the sender nothing they did not already know.
 */
export function decodeBasicAuth(header?: string): BasicCredentials | null {
  if (!header?.startsWith(BASIC_PREFIX)) return null;

  const decoded = Buffer.from(
    header.slice(BASIC_PREFIX.length),
    'base64',
  ).toString('utf8');
  const separatorIndex = decoded.indexOf(':');

  if (separatorIndex === -1) return null;

  return {
    id: decoded.slice(0, separatorIndex),
    secret: decoded.slice(separatorIndex + 1),
  };
}
