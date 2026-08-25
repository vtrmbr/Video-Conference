FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/config/package.json packages/config/package.json
RUN npm ci

COPY apps/server apps/server
COPY packages/shared packages/shared
COPY packages/config packages/config
RUN npm run build -w @ufmg/shared && npm run build -w @ufmg/config && npm run build -w @ufmg/server
RUN npm prune --omit=dev --workspaces

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/package.json /app/package-lock.json ./
COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/apps/server/package.json ./apps/server/package.json
COPY --from=build --chown=app:app /app/apps/server/dist ./apps/server/dist
COPY --from=build --chown=app:app /app/packages/shared ./packages/shared
COPY --from=build --chown=app:app /app/packages/config ./packages/config
USER app
EXPOSE 3001
CMD ["node", "apps/server/dist/index.js"]
