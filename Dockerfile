# ============================================================
# Planejador Previdenciário MFAA — Docker multi-stage build
# Contexto: raiz do monorepo
# ============================================================

# ---- Base ----
FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ---- Dependências ----
FROM base AS deps
# Copiar apenas package.json de cada workspace para cache de deps
COPY package.json ./
COPY packages/prev-engine/package.json packages/prev-engine/
COPY packages/doc-gen/package.json packages/doc-gen/
COPY apps/web/package.json apps/web/
RUN npm install --ignore-scripts
# Rodar postinstall do web (copia worker pdfjs)
RUN cd apps/web && node -e "require('fs').cpSync(require.resolve('pdfjs-dist/build/pdf.worker.min.mjs'), 'public/pdf.worker.min.mjs')"

# ---- Build ----
FROM deps AS builder
# Copiar código-fonte
COPY packages/ packages/
COPY apps/web/src/ apps/web/src/
COPY apps/web/prisma/ apps/web/prisma/
COPY apps/web/public/ apps/web/public/
COPY apps/web/next.config.ts apps/web/
COPY apps/web/tsconfig.json apps/web/
COPY apps/web/scripts/ apps/web/scripts/

# Build motor + doc-gen
RUN cd packages/prev-engine && npx tsc
RUN cd packages/doc-gen && npx tsc 2>/dev/null || true

# Gerar Prisma Client
RUN cd apps/web && npx prisma generate

# Build Next.js (precisa do .env mínimo para build)
RUN echo 'DATABASE_URL="file:./dev.db"\nJWT_SECRET="build-only"' > apps/web/.env
RUN cd apps/web && npx next build
RUN rm apps/web/.env

# ---- Produção ----
FROM base AS runner
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Copiar artefatos do build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/packages/prev-engine/dist ./packages/prev-engine/dist
COPY --from=builder /app/packages/prev-engine/package.json ./packages/prev-engine/package.json
COPY --from=builder /app/packages/doc-gen/dist ./packages/doc-gen/dist
COPY --from=builder /app/packages/doc-gen/package.json ./packages/doc-gen/package.json
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/package.json ./apps/web/package.json
COPY --from=builder /app/apps/web/prisma ./apps/web/prisma
COPY --from=builder /app/apps/web/next.config.ts ./apps/web/next.config.ts

# Diretórios de dados (montados como volumes)
RUN mkdir -p /data /app/apps/web/storage \
 && chown -R nextjs:nodejs /data /app/apps/web/storage

WORKDIR /app/apps/web
USER nextjs

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && npx next start -p 3000"]
