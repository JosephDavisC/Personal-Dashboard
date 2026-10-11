# Stage 1: Install all dependencies
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@10.28.1 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

# Stage 2: Build the app
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@10.28.1 --activate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm prisma generate
RUN pnpm build

# Stage 3: Production dependencies only
FROM node:20-alpine AS prod-deps
RUN corepack enable && corepack prepare pnpm@10.28.1 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# Stage 4: Production runner
FROM node:20-alpine AS runner
RUN apk add --no-cache ffmpeg poppler-utils
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Create media storage directories
RUN mkdir -p /data/media/thumbs && chown -R nextjs:nodejs /data/media

# Copy standalone build output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy Prisma schema + generated client
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src/generated ./src/generated

# Copy production node_modules for runtime deps (pg, @prisma/adapter-pg)
# that Next.js standalone may not trace
COPY --from=prod-deps /app/node_modules ./node_modules

# Create cache directory writable by nextjs user (only chown cache, not entire .next)
RUN mkdir -p .next/cache && chown -R nextjs:nodejs .next/cache

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
