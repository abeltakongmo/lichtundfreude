FROM node:22-alpine

ENV NODE_ENV=production
ENV PORT=3005

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=node:node . .

USER node

EXPOSE 3005

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('node:http').get('http://127.0.0.1:3005/health', (response) => { response.resume(); process.exit(response.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

CMD ["node", "server.js"]
