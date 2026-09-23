# Build: every dependency, compiled into one bundle by the Nest CLI (rspack).
# Also the image `signing-keys` in the root compose runs, to write the key
# pair when it is missing.
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Run: production dependencies and the bundle only. Configuration arrives as
# environment variables and the signing keys as a mounted `src/core/secrets/` —
# neither is ever baked into the image.
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/main"]
