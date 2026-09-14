import type { Request, Response } from 'express';
import type { Provider } from 'oidc-provider';
import { OidcController } from '@modules/oidc/oidc.controller';

describe('OidcController', () => {
  function buildController() {
    const callback = jest.fn(() => Promise.resolve());
    const callbackFactory = jest.fn(() => callback);
    const provider = { callback: callbackFactory } as unknown as Provider;
    return {
      controller: new OidcController(provider),
      callback,
      callbackFactory,
    };
  }

  function buildRequest(originalUrl: string): Request {
    return { originalUrl, url: originalUrl } as Request;
  }

  let controller: OidcController;
  let callback: ReturnType<typeof buildController>['callback'];
  let callbackFactory: ReturnType<typeof buildController>['callbackFactory'];
  let res: Response;

  beforeEach(() => {
    ({ controller, callback, callbackFactory } = buildController());
    res = {} as Response;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('builds the provider callback once, at construction', () => {
    expect(callbackFactory).toHaveBeenCalledTimes(1);
  });

  it('strips the /oauth mount prefix on the token endpoint (REQ-3, REQ-4, REQ-5)', async () => {
    const req = buildRequest('/oauth/token');

    await controller.token(req, res);

    expect(req.url).toBe('/token');
    expect(callback).toHaveBeenCalledWith(req, res);
  });

  it('strips the /oauth mount prefix on the jwks endpoint (REQ-9.2)', async () => {
    const req = buildRequest('/oauth/jwks');

    await controller.jwks(req, res);

    expect(req.url).toBe('/jwks');
    expect(callback).toHaveBeenCalledWith(req, res);
  });

  it('preserves the query string when rewriting the url', async () => {
    const req = buildRequest('/oauth/jwks?cache=no');

    await controller.jwks(req, res);

    expect(req.url).toBe('/jwks?cache=no');
  });
});
