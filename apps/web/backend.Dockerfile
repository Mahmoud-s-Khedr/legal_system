FROM node:22-alpine
WORKDIR /workspace
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/desktop/package.json apps/desktop/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/backend/package.json packages/backend/package.json
COPY packages/frontend/package.json packages/frontend/package.json
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm prisma:generate && pnpm --filter @elms/backend build

CMD ["node", "packages/backend/dist/cloud/server.js"]
