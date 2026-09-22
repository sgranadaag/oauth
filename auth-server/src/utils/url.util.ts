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
