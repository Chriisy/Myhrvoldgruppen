# FASE 29: CI/CD + Deployment

> Fase 1-28 må være fullført.
> Estimert tid: ~60 minutter.

## Mål

Sett opp GitHub Actions for CI/CD, Docker for backend, og EAS for mobile apps.

---

## GitHub Actions: CI Pipeline

### .github/workflows/ci.yml

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

env:
  NODE_VERSION: '20'
  PNPM_VERSION: '9'

jobs:
  lint:
    name: Lint & Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v2
        with:
          version: ${{ env.PNPM_VERSION }}
          
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'
          
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
        
      - name: TypeScript check
        run: pnpm typecheck
        
      - name: ESLint
        run: pnpm lint

  test-api:
    name: API Tests
    runs-on: ubuntu-latest
    needs: lint
    
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: myhrvold_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v2
        with:
          version: ${{ env.PNPM_VERSION }}
          
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'
          
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
        
      - name: Run migrations
        run: pnpm --filter @myhrvold/db db:push
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/myhrvold_test
          
      - name: Run tests
        run: pnpm --filter @myhrvold/api test:coverage
        env:
          TEST_DATABASE_URL: postgresql://postgres:postgres@localhost:5432/myhrvold_test
          
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./apps/api/coverage/lcov.info
          flags: api

  test-mobile:
    name: Mobile Tests
    runs-on: ubuntu-latest
    needs: lint
    
    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v2
        with:
          version: ${{ env.PNPM_VERSION }}
          
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'
          
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
        
      - name: Run tests
        run: pnpm --filter @myhrvold/mobile test:coverage
        
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./apps/mobile/coverage/lcov.info
          flags: mobile

  build-api:
    name: Build API
    runs-on: ubuntu-latest
    needs: [test-api]
    
    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v2
        with:
          version: ${{ env.PNPM_VERSION }}
          
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'
          
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
        
      - name: Build
        run: pnpm --filter @myhrvold/api build
        
      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: api-dist
          path: apps/api/dist
```

---

## GitHub Actions: Deploy Pipeline

### .github/workflows/deploy.yml

```yaml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to deploy'
        required: true
        default: 'staging'
        type: choice
        options:
          - staging
          - production

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}/api

jobs:
  build-and-push:
    name: Build & Push Docker Image
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
      
    outputs:
      image-tag: ${{ steps.meta.outputs.tags }}
      
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
        
      - name: Login to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
          
      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=sha,prefix=
            type=ref,event=branch
            type=raw,value=latest,enable=${{ github.ref == 'refs/heads/main' }}
            
      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./apps/api/Dockerfile
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy-staging:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    needs: build-and-push
    if: github.ref == 'refs/heads/main' || github.event.inputs.environment == 'staging'
    environment: staging
    
    steps:
      - name: Deploy to Staging
        run: |
          echo "Deploying to staging..."
          # Add deployment commands here (e.g., kubectl, fly.io, railway)
          
  deploy-production:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: [build-and-push, deploy-staging]
    if: github.event.inputs.environment == 'production'
    environment: production
    
    steps:
      - name: Deploy to Production
        run: |
          echo "Deploying to production..."
          # Add production deployment commands

  deploy-mobile:
    name: Build & Deploy Mobile
    runs-on: ubuntu-latest
    needs: build-and-push
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v2
        with:
          version: 9
          
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
          
      - name: Setup Expo
        uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}
          
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
        
      - name: Build Preview
        working-directory: apps/mobile
        run: eas build --platform all --profile preview --non-interactive
```

---

## Docker Configuration

### apps/api/Dockerfile

```dockerfile
# Build stage
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Copy workspace files
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY package.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY apps/api ./apps/api
COPY packages/db ./packages/db
COPY packages/shared ./packages/shared
COPY tsconfig.json ./

# Build
RUN pnpm --filter @myhrvold/api build

# Production stage
FROM node:20-alpine AS runner

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

ENV NODE_ENV=production

# Copy built files
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 fastify
USER fastify

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]
```

---

### docker-compose.yml

```yaml
version: '3.8'

services:
  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - JWT_SECRET=${JWT_SECRET}
      - CORS_ORIGIN=${CORS_ORIGIN}
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_USER=${POSTGRES_USER:-postgres}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-postgres}
      - POSTGRES_DB=${POSTGRES_DB:-myhrvold}
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

---

## EAS Configuration

### apps/mobile/eas.json

```json
{
  "cli": {
    "version": ">= 10.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": {
        "API_URL": "http://localhost:3000"
      }
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": false
      },
      "android": {
        "buildType": "apk"
      },
      "env": {
        "API_URL": "https://staging-api.myhrvold.no"
      }
    },
    "production": {
      "autoIncrement": true,
      "env": {
        "API_URL": "https://api.myhrvold.no"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id@example.com",
        "ascAppId": "your-app-store-connect-app-id"
      },
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json",
        "track": "internal"
      }
    }
  }
}
```

---

### apps/mobile/app.config.ts

```typescript
import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Myhrvold Service',
  slug: 'myhrvold-service',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#003366',
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'no.myhrvold.service',
    buildNumber: '1',
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#003366',
    },
    package: 'no.myhrvold.service',
    versionCode: 1,
  },
  web: {
    bundler: 'metro',
    output: 'single',
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-build-properties',
      {
        android: {
          compileSdkVersion: 34,
          targetSdkVersion: 34,
        },
        ios: {
          deploymentTarget: '15.0',
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    apiUrl: process.env.API_URL ?? 'http://localhost:3000',
    eas: {
      projectId: 'your-eas-project-id',
    },
  },
});
```

---

## Environment Configuration

### .env.example

```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/myhrvold
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/myhrvold_test

# API
PORT=3000
HOST=0.0.0.0
NODE_ENV=development

# Auth
JWT_SECRET=your-super-secret-jwt-key-here
SESSION_EXPIRY_DAYS=30

# CORS
CORS_ORIGIN=http://localhost:8081

# Logging
LOG_LEVEL=info

# File Storage (optional)
STORAGE_TYPE=local
STORAGE_PATH=./uploads

# Email (optional)
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
```

---

## Railway/Fly.io Deployment (Alternative)

### fly.toml

```toml
app = "myhrvold-api"
primary_region = "arn"

[build]
  dockerfile = "apps/api/Dockerfile"

[env]
  NODE_ENV = "production"
  PORT = "3000"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 1

[[services]]
  protocol = "tcp"
  internal_port = 3000

  [[services.ports]]
    port = 80
    handlers = ["http"]

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]

  [[services.http_checks]]
    interval = 10000
    grace_period = "10s"
    method = "get"
    path = "/health"
    protocol = "http"
    timeout = 2000
```

---

## Deployment Commands

```bash
# Build Docker image locally
docker build -t myhrvold-api -f apps/api/Dockerfile .

# Run locally with Docker Compose
docker-compose up -d

# Deploy to Fly.io
fly deploy

# Deploy to Railway
railway up

# Build mobile preview
cd apps/mobile
eas build --platform all --profile preview

# Submit to stores
eas submit --platform all --profile production
```

---

## Sjekkliste

- [ ] GitHub Actions CI workflow
- [ ] GitHub Actions Deploy workflow
- [ ] Dockerfile for API
- [ ] docker-compose.yml
- [ ] EAS configuration
- [ ] app.config.ts for Expo
- [ ] Environment variables dokumentert
- [ ] Health check endpoint
- [ ] Fly.io / Railway config (valgfritt)
- [ ] Mobile build profiles

---

## Deployment Checklist

Before going to production:

1. **Secrets configured**
   - [ ] DATABASE_URL
   - [ ] JWT_SECRET
   - [ ] EXPO_TOKEN
   - [ ] Apple/Google credentials

2. **Database**
   - [ ] Production database provisioned
   - [ ] Migrations run
   - [ ] Backups configured

3. **Monitoring**
   - [ ] Error tracking (Sentry)
   - [ ] Logging configured
   - [ ] Health checks working

4. **Security**
   - [ ] HTTPS enabled
   - [ ] CORS configured
   - [ ] Rate limiting enabled
   - [ ] Environment variables secured

5. **Mobile**
   - [ ] App Store Connect configured
   - [ ] Google Play Console configured
   - [ ] Push notifications configured

---

## 🎉 Gratulerer!

Du har nå fullført alle 29 faser og har en komplett, produksjonsklar applikasjon!
