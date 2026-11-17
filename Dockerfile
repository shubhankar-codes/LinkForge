FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY public ./public
COPY scripts ./scripts
COPY migrations ./migrations
COPY schema.sql ./
ENV NODE_ENV=production
USER node
EXPOSE 3000
CMD ["/bin/sh", "-c", "node scripts/migrate.js && exec node src/app.js"]
