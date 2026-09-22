FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY src ./src
COPY schemas ./schemas
COPY docs ./docs
COPY tests ./tests
COPY README.md ./
COPY .env.example ./

ENV NODE_ENV=production

ENTRYPOINT ["node"]
CMD ["src/cli/health.js"]
