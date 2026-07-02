FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/
RUN npm ci

FROM deps AS build
COPY client ./client
COPY shared ./shared
COPY server ./server
RUN npm run build --workspace=client

FROM node:20-slim AS production
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/
RUN npm ci --omit=dev

COPY --from=build /app/client/dist ./client/dist
COPY server ./server
COPY shared ./shared
COPY docker/entrypoint.sh ./docker/entrypoint.sh
RUN chmod +x docker/entrypoint.sh

EXPOSE 3001
ENTRYPOINT ["./docker/entrypoint.sh"]
