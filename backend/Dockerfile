FROM node:20.18.1-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
ENV PORT=8080
EXPOSE 8080
CMD ["npx", "tsx", "src/server.ts"]
