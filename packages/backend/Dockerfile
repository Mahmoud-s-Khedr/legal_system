# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: Build
# Installs dependencies and compiles the backend + shared packages.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /workspace
RUN corepack enable

# Install system packages needed at build time
RUN apk add --no-cache python3 make g++

# Copy workspace manifests first (layer-cache friendly)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/backend/package.json packages/backend/package.json

# Install only backend + shared dependencies
RUN pnpm install --frozen-lockfile --filter @elms/backend --filter @elms/shared

# Copy source
COPY packages/shared/ packages/shared/
COPY packages/backend/ packages/backend/

# Generate Prisma client + compile cloud build (output: packages/backend/dist/cloud/)
RUN pnpm --filter @elms/backend exec prisma generate --schema packages/backend/prisma/schema.prisma && \
    pnpm --filter @elms/backend build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: Production image
# Minimal runtime with only what the server actually needs.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS production
WORKDIR /workspace
RUN corepack enable

# OCR (Tesseract) + DOCX preview (LibreOffice) + runtime utilities
RUN apk add --no-cache \
    tesseract-ocr \
    tesseract-ocr-data-ara \
    tesseract-ocr-data-eng \
    tesseract-ocr-data-fra \
    libreoffice \
    python3 \
    wget

# Copy compiled output from builder
COPY --from=builder /workspace/packages/backend/dist/ packages/backend/dist/
COPY --from=builder /workspace/packages/backend/prisma/ packages/backend/prisma/
COPY --from=builder /workspace/packages/backend/node_modules/ packages/backend/node_modules/
COPY --from=builder /workspace/node_modules/ node_modules/

# Tesseract language data (bundled in the repo root of packages/backend)
COPY packages/backend/ara.traineddata packages/backend/
COPY packages/backend/eng.traineddata packages/backend/
COPY packages/backend/fra.traineddata packages/backend/

# Non-root user for security
RUN addgroup -S elms && adduser -S elms -G elms
USER elms

EXPOSE 7854

# Default: run the API server.
# Override CMD in docker-compose to run individual BullMQ workers:
#   command: ["node", "packages/backend/dist/cloud/jobs/extractionWorker.js"]
CMD ["node", "packages/backend/dist/cloud/server.js"]
