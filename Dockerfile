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
ENV PORT=8080

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

ENTRYPOINT ["node"]
CMD ["src/api/server.js"]
