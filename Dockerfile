FROM node:20-alpine

WORKDIR /app

COPY package*.json .npmrc ./
RUN npm ci

COPY . .

ENV NODE_ENV=production
EXPOSE 8080

CMD ["npx", "tsx", "src/api/index.ts"]
