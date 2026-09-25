# syntax=docker/dockerfile:1

# ── deps: install node_modules once, cached on package-lock changes ───────────
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── build: produce the standalone Next.js server ──────────────────────────────
FROM node:20-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ── runtime ───────────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS runner
WORKDIR /app

# ffmpeg: transcodes formats browsers can't decode (ALAC, AIFF) for browser playback.
# VLC (optional): only needed for server/"Jukebox" playback through the host's
# speakers. Build with --build-arg INSTALL_VLC=false for a smaller browser-only image.
ARG INSTALL_VLC=true
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
 && if [ "$INSTALL_VLC" = "true" ]; then \
      apt-get install -y --no-install-recommends vlc-bin vlc-plugin-base procps; \
    fi \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static

# Settings, library index, playlists, play counts and queue live here — mount a volume.
RUN mkdir -p /app/data && chown node:node /app/data
VOLUME ["/app/data"]

# VLC refuses to run as root; the node user (uid 1000) is also in the audio group
# so it can open /dev/snd when the host's sound device is passed through.
RUN usermod -aG audio node
USER node

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:3000/api/playback').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server.js"]
