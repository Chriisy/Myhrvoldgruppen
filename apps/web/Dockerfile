# Build stage - Expo Web export
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY apps/mobile/package.json apps/mobile/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps/mobile apps/mobile
COPY packages/db packages/db
COPY packages/shared packages/shared
COPY tsconfig.json ./

# Copy PWA assets
COPY apps/web/public apps/mobile/public

# Build web version
WORKDIR /app/apps/mobile
RUN pnpm exec expo export --platform web

# Production stage - Serve static files
FROM nginx:alpine AS runner

# Copy nginx config for static serving
RUN rm /etc/nginx/conf.d/default.conf

# Copy built static files
COPY --from=builder /app/apps/mobile/dist /usr/share/nginx/html

# Copy PWA files
COPY apps/web/public/manifest.json /usr/share/nginx/html/
COPY apps/web/public/sw.js /usr/share/nginx/html/

# Nginx config for SPA routing
RUN echo 'server { \
    listen 3000; \
    root /usr/share/nginx/html; \
    index index.html; \
    \
    # Gzip \
    gzip on; \
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml; \
    \
    # Cache static assets \
    location /_expo/ { \
        expires 1y; \
        add_header Cache-Control "public, immutable"; \
    } \
    \
    location /assets/ { \
        expires 1y; \
        add_header Cache-Control "public, immutable"; \
    } \
    \
    # Service worker - no cache \
    location /sw.js { \
        expires -1; \
        add_header Cache-Control "no-cache, no-store, must-revalidate"; \
    } \
    \
    # SPA fallback \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
