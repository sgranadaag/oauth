# Build: every dependency, then `next build` with the standalone output.
FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Run: Next's standalone server and only the modules it traced. Server-side
# variables (both API keys among them) are read at run time from the
# environment, never at build time — no .env is baked into the image.
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3003
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
EXPOSE 3003
CMD ["node", "server.js"]
