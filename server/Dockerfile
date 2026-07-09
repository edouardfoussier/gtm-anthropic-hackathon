# AutoDeck video-engine API.
#
# IMPORTANT: build with the REPO ROOT as the context (the server reuses the
# engine source and the root package.json / lockfile):
#
#   docker build -f server/Dockerfile -t autodeck-server .
#   docker run --rm -p 8787:8787 --env-file .env.local autodeck-server
FROM node:22-slim

# ffmpeg is required by the assembly step; it is not bundled with node.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ENV PORT=8787
EXPOSE 8787

CMD ["npx", "tsx", "server/index.ts"]
