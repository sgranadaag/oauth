import { RANDOM_BYTES } from "@constants/auth.constants";

/**
 * base64url encoding — the form every value in this flow travels in.
 *
 * Plain base64 uses `+`, `/` and `=`, which a URL would percent-encode; OAuth
 * values end up in query strings, so they use the URL-safe alphabet instead.
 */
export const toBase64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

/**
 * Decodes base64url back to bytes, restoring the padding `atob` expects.
 *
 * The return type is `Uint8Array<ArrayBuffer>`, not a bare `Uint8Array`.
 * Since TypeScript 5.7 that type is generic over its buffer and defaults to
 * `ArrayBufferLike`, which `SharedArrayBuffer` also satisfies — and Web Crypto
 * refuses shared memory, so `BufferSource` accepts only the narrow form.
 * Without this annotation `crypto.subtle.verify` rejects the signature bytes.
 */
export const fromBase64Url = (value: string): Uint8Array<ArrayBuffer> => {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));

  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

/**
 * An unguessable `state`.
 *
 * `crypto.getRandomValues` is the browser's CSPRNG. `Math.random` is not one
 * and must never stand in for it: with no PKCE, `state` is the only thing
 * tying a callback to the request this browser started.
 */
export const randomValue = (): string =>
  toBase64Url(crypto.getRandomValues(new Uint8Array(RANDOM_BYTES)));

/** Reads one base64url JWT segment as JSON. Decoding is not verifying. */
export const decodeJwtSegment = <T,>(segment: string): T =>
  JSON.parse(new TextDecoder().decode(fromBase64Url(segment))) as T;

/**
 * Imports a PEM public key for signature verification.
 *
 * Web Crypto takes **SPKI** (`-----BEGIN PUBLIC KEY-----`), never PKCS#1
 * (`-----BEGIN RSA PUBLIC KEY-----`) and never the PEM text itself: the
 * armour has to be stripped and the base64 body decoded to DER first. A
 * PKCS#1 file imports as garbage rather than failing cleanly, so the format
 * matters more than it looks.
 */
export const importPublicKey = async (pem: string): Promise<CryptoKey> => {
  const body = pem
    .replace(/-----BEGIN PUBLIC KEY-----/, "")
    .replace(/-----END PUBLIC KEY-----/, "")
    .replace(/\s+/g, "");

  return crypto.subtle.importKey(
    "spki",
    fromBase64Url(body.replace(/\+/g, "-").replace(/\//g, "_")),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
};
