import { ADMIN_KEY_SECURITY } from '@core/config/swagger.config';

export const MANAGER_SWAGGER = {
  API_TAG: 'Manager',

  CLEAR_ALL: {
    operation: {
      summary: 'Delete every request, code, session and token',
      description:
        'Empties the four collections that hold the transient state of the ' +
        'flow, whatever their expiry: `authorization_requests`, ' +
        '`authorization_codes`, `sessions` and `tokens`.\n\n' +
        'A development reset, not housekeeping — nothing here looks at ' +
        '`expiresAt`. Every refresh token stops working, every sign-in ' +
        'halfway through the flow breaks, and every browser holding a ' +
        'session cookie is signed out.\n\n' +
        'Clients and accounts are left alone: this clears what the flow ' +
        'produced, not what it runs on.',
    },
    security: ADMIN_KEY_SECURITY,
    responses: {
      200: {
        description: 'How many rows each collection lost.',
        schema: {
          type: 'object' as const,
          properties: {
            requests: { type: 'integer' as const, example: 4 },
            codes: { type: 'integer' as const, example: 2 },
            sessions: { type: 'integer' as const, example: 3 },
            tokens: { type: 'integer' as const, example: 7 },
          },
        },
      },
      403: { description: 'Missing or wrong admin key.' },
    },
  },
} as const;
