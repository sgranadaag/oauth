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
# below it, and changing an address must not reinstall node_modules.
ARG NEXT_PUBLIC_AUTH_SERVER_URL
ENV NEXT_PUBLIC_AUTH_SERVER_URL=$NEXT_PUBLIC_AUTH_SERVER_URL

COPY . .
RUN npm run build

# Run: Next's standalone server and only the modules it traced.
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3003
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
EXPOSE 3003
CMD ["node", "server.js"]
