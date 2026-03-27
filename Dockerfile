FROM node:20-slim

RUN apt-get update && apt-get install -y openssl git && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY prisma ./prisma
RUN npx prisma generate

COPY . .

EXPOSE 3000

CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node src/index.js"]
