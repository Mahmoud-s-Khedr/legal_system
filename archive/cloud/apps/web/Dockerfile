FROM node:22-alpine AS builder
WORKDIR /workspace
RUN corepack enable
ARG VITE_API_BASE_URL=/api
ARG VITE_SENTRY_DSN=
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_SENTRY_DSN=${VITE_SENTRY_DSN}

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/desktop/package.json apps/desktop/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/backend/package.json packages/backend/package.json
COPY packages/frontend/package.json packages/frontend/package.json
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter @elms/frontend build

FROM nginx:1.27-alpine
COPY apps/web/nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /workspace/packages/frontend/dist /usr/share/nginx/html
