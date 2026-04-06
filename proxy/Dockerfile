FROM node:22-slim

RUN corepack enable

WORKDIR /app

# Copy workspace root files needed for pnpm install
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY proxy/package.json ./proxy/

# Install only proxy workspace dependencies
RUN pnpm install --frozen-lockfile --filter facet-ai-proxy

# Copy proxy source
COPY proxy/ ./proxy/

WORKDIR /app/proxy
EXPOSE 9001
CMD ["node", "bootstrap.js"]
