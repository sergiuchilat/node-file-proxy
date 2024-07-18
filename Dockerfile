################## Optimized ##################

ARG NODE_VERSION="node:18-alpine"

FROM $NODE_VERSION as deps
WORKDIR /app
COPY . .
RUN npm install --frozen-lockfile

FROM $NODE_VERSION as builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN rm -rf node_modules
RUN npm install --production --frozen-lockfile --ignore-scripts --prefer-offline

FROM $NODE_VERSION as runner
ENV NODE_ENV production
RUN addgroup -g 1001 -S app
RUN adduser -S app -u 1001
WORKDIR /app
COPY --from=builder --chown=app:app /app/package.json /app/package-lock.json ./
COPY --from=builder --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/src ./src

USER app
EXPOSE 7777

CMD ["node", "src/app"]
