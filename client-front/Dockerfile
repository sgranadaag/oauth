# Build: every dependency, then `next build` with the standalone output.
#
# `NEXT_PUBLIC_*` variables are inlined into the bundle **here**, not read at
# run time: this app is a pure frontend and the browser has no environment to
# read. Passing them as `environment:` in compose would silently do nothing,
# so they arrive as build args — and `docker compose up` without `--build`
# keeps whatever was baked in last time.
FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm ci

# Declared after `npm ci` on purpose: a build arg invalidates every layer
# below it, so putting these first would reinstall node_modules every time the
# client_id changed.
ARG NEXT_PUBLIC_AUTH_SERVER_URL
ARG NEXT_PUBLIC_OAUTH_ISSUER
ARG NEXT_PUBLIC_OAUTH_CLIENT_ID
ARG NEXT_PUBLIC_OAUTH_REDIRECT_URI
ARG NEXT_PUBLIC_OAUTH_SCOPE
ENV NEXT_PUBLIC_AUTH_SERVER_URL=$NEXT_PUBLIC_AUTH_SERVER_URL \
    NEXT_PUBLIC_OAUTH_ISSUER=$NEXT_PUBLIC_OAUTH_ISSUER \
    NEXT_PUBLIC_OAUTH_CLIENT_ID=$NEXT_PUBLIC_OAUTH_CLIENT_ID \
    NEXT_PUBLIC_OAUTH_REDIRECT_URI=$NEXT_PUBLIC_OAUTH_REDIRECT_URI \
    NEXT_PUBLIC_OAUTH_SCOPE=$NEXT_PUBLIC_OAUTH_SCOPE

COPY . .
RUN npm run build

# Run: Next's standalone server, the static assets, and `public/` — which
# carries the provider's public key this app verifies tokens with.
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3001
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3001
CMD ["node", "server.js"]
