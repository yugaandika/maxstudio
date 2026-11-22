FROM node:20-slim
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && if [ "$(uname -m)" = "aarch64" ]; then BIN=yt-dlp_linux_aarch64; else BIN=yt-dlp_linux; fi \
 && curl -L "https://github.com/yt-dlp/yt-dlp/releases/latest/download/$BIN" -o /usr/local/bin/yt-dlp \
 && chmod +x /usr/local/bin/yt-dlp
WORKDIR /app
COPY package.json server.js ./
ENV PORT=10000
EXPOSE 10000
CMD ["node", "server.js"]
