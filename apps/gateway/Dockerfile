FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN apk add --no-cache libc6-compat && \
    corepack enable && \
    corepack prepare pnpm@10.14.0 --activate && \
    pnpm add -g turbo@^2

FROM base AS prune
WORKDIR /app
COPY . .
RUN --mount=type=cache,target=/root/.cache/turbo \
    turbo prune @sitehaus-ecom/gateway --docker

FROM base AS installer
WORKDIR /app
COPY --from=prune /app/out/json/ .
COPY --from=prune /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=prune /app/out/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=prune /app/out/full/ ./
COPY turbo.json turbo.json
RUN --mount=type=cache,target=/pnpm/store pnpm install --frozen-lockfile

FROM base AS build
WORKDIR /app
COPY --from=installer /app ./
RUN --mount=type=cache,target=/root/.cache/turbo \
    turbo run build --filter=@sitehaus-ecom/gateway...

FROM node:22-alpine AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs
COPY --from=build --chown=nestjs:nodejs /app ./
# Migration files aren't compiled — copy them explicitly so runMigrations() can find them at runtime
COPY --chown=nestjs:nodejs packages/database/drizzle/ ./packages/database/drizzle/
USER nestjs
CMD ["node", "apps/gateway/dist/main.js"]