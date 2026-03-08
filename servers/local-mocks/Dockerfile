FROM node:22-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY server.js edge-config.json redis-seed.json ./

EXPOSE 8079 8078

CMD ["node", "server.js"]
