# Task 24: the web tier - builds the React app and serves it with Caddy, which
# also forwards /api to the backend (so the site and the API share one origin: no
# CORS, one address to give out) and gets/renews the HTTPS certificate by itself.

# ---- build ----
# Debian-based (not alpine): the "canvas" dependency downloads a prebuilt native
# binary, available for glibc on both x86 and ARM (e.g. Oracle's free ARM VMs).
FROM node:24-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite bakes VITE_* values into the public JavaScript at build time, so they are
# build arguments here (docker-compose passes them). None of them is a secret:
# Cloudinary's "unsigned upload preset" is designed to be public.
ARG VITE_CLOUDINARY_CLOUD_NAME
ARG VITE_CLOUDINARY_UPLOAD_PRESET
ARG VITE_BG_REMOVER_MODE=browser
ARG VITE_API_URL
# Task 98: "Sign in with Google" (empty = no Google button).
ARG VITE_GOOGLE_CLIENT_ID
# Task 97: ads for free accounts (empty = off). See frontend/.env.example.
ARG VITE_AD_PROVIDER
ARG VITE_ADSENSE_CLIENT
ARG VITE_ADSENSE_SLOT
ARG VITE_ADSTERRA_SCRIPT_URL
ARG VITE_ADSTERRA_KEY
ARG VITE_ADSTERRA_WIDTH
ARG VITE_ADSTERRA_HEIGHT
ENV VITE_CLOUDINARY_CLOUD_NAME=$VITE_CLOUDINARY_CLOUD_NAME \
    VITE_CLOUDINARY_UPLOAD_PRESET=$VITE_CLOUDINARY_UPLOAD_PRESET \
    VITE_BG_REMOVER_MODE=$VITE_BG_REMOVER_MODE \
    VITE_API_URL=$VITE_API_URL \
    VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID \
    VITE_AD_PROVIDER=$VITE_AD_PROVIDER \
    VITE_ADSENSE_CLIENT=$VITE_ADSENSE_CLIENT \
    VITE_ADSENSE_SLOT=$VITE_ADSENSE_SLOT \
    VITE_ADSTERRA_SCRIPT_URL=$VITE_ADSTERRA_SCRIPT_URL \
    VITE_ADSTERRA_KEY=$VITE_ADSTERRA_KEY \
    VITE_ADSTERRA_WIDTH=$VITE_ADSTERRA_WIDTH \
    VITE_ADSTERRA_HEIGHT=$VITE_ADSTERRA_HEIGHT

RUN npm run build

# ---- serve ----
FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv

EXPOSE 80 443
