import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as jwt from 'jsonwebtoken';
import {
  ACCESS_TOKEN_TYP,
  signAccessToken,
  verifyAccessToken,
} from '@utils/jwt.util';

describe('jwt.util', () => {
  const ISSUER = 'http://localhost:3000';
  const AUDIENCE = 'urn:oauth:default';

  const claims = {
    sub: 'user-1',
    client_id: 'client-1',
    scope: 'read write',
  };
  const signOptions = {
    issuer: ISSUER,
    audience: AUDIENCE,
    expiresInSeconds: 3600,
  };
  const verifyOptions = { issuer: ISSUER, audience: AUDIENCE };

  let privateKeyPem: string;

  function signRaw(
    payload: Record<string, unknown>,
    options: jwt.SignOptions,
  ): string {
    return jwt.sign(payload, privateKeyPem, {
      algorithm: 'RS256',
      ...options,
    });
  }

  beforeAll(() => {
    privateKeyPem = readFileSync(
      join(process.cwd(), 'src', 'secrets', 'private.pem'),
      'utf8',
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('round-trips a signed token back to its claims', () => {
    const token = signAccessToken(claims, signOptions);

    expect(verifyAccessToken(token, verifyOptions)).toMatchObject({
      sub: 'user-1',
      client_id: 'client-1',
      scope: 'read write',
      iss: ISSUER,
      aud: AUDIENCE,
    });
  });

  it('stamps the RFC 9068 typ and RS256 alg on the header', () => {
    const token = signAccessToken(claims, signOptions);
    const decoded = jwt.decode(token, { complete: true });

    expect(decoded?.header.typ).toBe(ACCESS_TOKEN_TYP);
    expect(decoded?.header.alg).toBe('RS256');
  });

  it('rejects a token whose signature was tampered with', () => {
    const token = signAccessToken(claims, signOptions);
    const tampered = `${token.slice(0, token.lastIndexOf('.') + 1)}bogussignature`;

    expect(() => verifyAccessToken(tampered, verifyOptions)).toThrow();
  });

  it('rejects a token issued by someone else', () => {
    const token = signAccessToken(claims, {
      ...signOptions,
      issuer: 'https://evil.example',
    });

    expect(() => verifyAccessToken(token, verifyOptions)).toThrow();
  });

  it('rejects a token minted for a different audience', () => {
    const token = signAccessToken(claims, {
      ...signOptions,
      audience: 'urn:oauth:other',
    });

    expect(() => verifyAccessToken(token, verifyOptions)).toThrow();
  });

  it('rejects an expired token', () => {
    const token = signAccessToken(claims, {
      ...signOptions,
      expiresInSeconds: -10,
    });

    expect(() => verifyAccessToken(token, verifyOptions)).toThrow();
  });

  it('rejects a correctly-signed JWT that is not typed at+jwt', () => {
    const token = signRaw(claims, {
      issuer: ISSUER,
      audience: AUDIENCE,
      expiresIn: 3600,
      header: { alg: 'RS256', typ: 'JWT' },
    });

    expect(() => verifyAccessToken(token, verifyOptions)).toThrow(
      /unexpected token typ/,
    );
  });
});
