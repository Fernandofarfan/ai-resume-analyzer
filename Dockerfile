FROM node:26-alpine AS build-env
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:26-alpine AS runtime
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=build-env /app/build/client /app/build/client
COPY --from=build-env /app/server/index.mjs /app/server/index.mjs
COPY --from=build-env /app/server/config.mjs /app/server/config.mjs
COPY --from=build-env /app/server/ai.mjs /app/server/ai.mjs
COPY --from=build-env /app/server/lib.mjs /app/server/lib.mjs
COPY --from=build-env /app/shared /app/shared
USER app
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1
CMD ["node", "server/index.mjs"]
