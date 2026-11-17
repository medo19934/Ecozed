# Latif Kids API — build from the repo root: docker build -f apps/api/Dockerfile .
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --filter @latif/api... --ignore-scripts \
 && pnpm --filter @latif/shared build \
 && pnpm --filter @latif/api exec prisma generate \
 && pnpm --filter @latif/api exec nest build \
 && pnpm deploy --filter @latif/api --prod --legacy /out \
 && cp -r apps/api/dist apps/api/prisma apps/api/prisma.config.ts /out/

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out ./
EXPOSE 4000
# Apply pending migrations, then start (prisma CLI is a production dependency).
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/main.js"]
