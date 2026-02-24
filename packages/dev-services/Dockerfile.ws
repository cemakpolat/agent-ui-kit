FROM node:20-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY packages/core ./packages/core
COPY packages/ui ./packages/ui
COPY packages/dev-services ./packages/dev-services
COPY pnpm-workspace.yaml tsconfig.json ./
COPY .npmrc* .

RUN npm install -g pnpm && pnpm install --frozen-lockfile

WORKDIR /app/packages/dev-services

RUN pnpm build

EXPOSE 3001

HEALTHCHECK --interval=5s --timeout=3s --retries=5 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

CMD ["node", "dist/ws-server.js"]
