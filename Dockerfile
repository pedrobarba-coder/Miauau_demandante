FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN mkdir -p /app/data && chown -R node:node /app/data
USER node
ENV DB_PATH=/app/data/peludinho.db
EXPOSE 3000
CMD ["node", "server/index.js"]
