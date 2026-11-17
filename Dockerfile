FROM oven/bun:1-alpine
RUN apk upgrade --no-cache && apk add --no-cache 'zlib>=1.4-r0'
WORKDIR /app
COPY . .
ENV PORT=3000
EXPOSE 3000
CMD ["bun", "server.js"]
