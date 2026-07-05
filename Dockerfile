# Build stage
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/engine/package.json packages/engine/
COPY packages/protocol/package.json packages/protocol/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/
RUN npm ci
COPY . .
RUN npm run build

# Runtime stage — the server bundle is self-contained (engine + ws inlined)
FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/packages/server/dist ./packages/server/dist
COPY --from=build /app/packages/client/dist ./packages/client/dist
ENV PORT=3000 DATA_DIR=/data HOST=0.0.0.0
VOLUME /data
EXPOSE 3000
CMD ["node", "packages/server/dist/index.cjs"]
