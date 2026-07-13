FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/
COPY packages/gamification/package.json ./packages/gamification/
COPY packages/gamification-react/package.json ./packages/gamification-react/
COPY packages/dev-config/package.json ./packages/dev-config/
COPY packages/identity/package.json ./packages/identity/
COPY packages/llm/package.json ./packages/llm/
COPY packages/media/package.json ./packages/media/
COPY packages/react/package.json ./packages/react/
COPY packages/server-kit/package.json ./packages/server-kit/
COPY packages/taxonomy/package.json ./packages/taxonomy/
COPY packages/ui/package.json ./packages/ui/
RUN npm ci

FROM deps AS build
COPY client ./client
COPY shared ./shared
COPY server ./server
COPY packages ./packages
RUN npm run build --workspace=client

FROM node:20-slim AS production
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/
COPY packages/gamification/package.json ./packages/gamification/
COPY packages/gamification-react/package.json ./packages/gamification-react/
COPY packages/dev-config/package.json ./packages/dev-config/
COPY packages/identity/package.json ./packages/identity/
COPY packages/llm/package.json ./packages/llm/
COPY packages/media/package.json ./packages/media/
COPY packages/react/package.json ./packages/react/
COPY packages/server-kit/package.json ./packages/server-kit/
COPY packages/taxonomy/package.json ./packages/taxonomy/
COPY packages/ui/package.json ./packages/ui/
RUN npm ci --omit=dev

COPY --from=build /app/client/dist ./client/dist
COPY server ./server
COPY shared ./shared
COPY packages ./packages
COPY docker/entrypoint.sh ./docker/entrypoint.sh
RUN chmod +x docker/entrypoint.sh

EXPOSE 3001
ENTRYPOINT ["./docker/entrypoint.sh"]
