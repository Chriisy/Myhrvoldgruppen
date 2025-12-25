# Myhrvold Gruppen - Servicehåndteringssystem

Komplett system for håndtering av reklamasjoner, serviceavtaler, kundeoppfølging og feltarbeid for Myhrvold Gruppen AS.

## Teknologi

| Komponent | Teknologi |
|-----------|-----------|
| **Backend** | Node.js, Fastify, tRPC |
| **Database** | PostgreSQL, Drizzle ORM |
| **Mobil** | React Native, Expo |
| **Validering** | Zod |
| **Auth** | JWT, bcrypt |
| **Caching** | Redis |

## Prosjektstruktur

```
├── apps/
│   ├── api/          # Backend API (tRPC + Fastify)
│   ├── mobile/       # React Native app (Expo)
│   └── web/          # Admin web panel
├── packages/
│   ├── db/           # Database schema (Drizzle)
│   └── shared/       # Delte typer og schemas
```

## Kom i gang

### Forutsetninger

- Node.js >= 20
- pnpm >= 9
- PostgreSQL
- Redis (valgfritt, for caching)

### Installasjon

```bash
# Installer avhengigheter
pnpm install

# Kopier miljøvariabler
cp .env.example .env

# Rediger .env med dine verdier
```

### Database

```bash
# Generer migrations
pnpm db:generate

# Kjør migrations
pnpm db:push

# Åpne database studio
pnpm db:studio
```

### Kjør lokalt

```bash
# Start API
pnpm dev

# Start mobil-app
pnpm dev:mobile

# Start web
pnpm dev:web
```

## Miljøvariabler

| Variabel | Beskrivelse | Påkrevd |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Ja |
| `JWT_SECRET` | Hemmelig nøkkel for JWT tokens | Ja |
| `REDIS_URL` | Redis connection string | Nei |
| `CORS_ORIGIN` | Tillatte origins | Nei |
| `SENTRY_DSN` | Sentry feilsporing | Nei |

## API Endepunkter

API bruker tRPC. Alle endepunkter er under `/trpc`.

### Offentlige
- `health.check` - Helsesjekk
- `auth.login` - Innlogging
- `portal.getByCode` - Leverandørportal

### Beskyttede (krever innlogging)
- `claims.*` - Reklamasjoner
- `customers.*` - Kunder
- `agreements.*` - Serviceavtaler
- `visits.*` - Servicebesøk
- `installations.*` - Installasjoner
- `chat.*` - Intern chat
- `forum.*` - Diskusjonsforum

### Admin (krever admin/manager rolle)
- `reports.*` - Rapporter
- `suppliers.*` - Leverandører

## Sikkerhet (Guardrails)

| Tiltak | Beskrivelse |
|--------|-------------|
| **CORS** | Konfigurerbar origin-whitelist |
| **JWT Auth** | Token-basert autentisering |
| **Rolle-basert tilgang** | admin, manager, technician, sales |
| **Rate Limiting** | Begrenser antall forespørsler per IP |
| **Input Validering** | Zod schemas på alle inputs |
| **SQL Injection** | Beskyttet via Drizzle ORM |
| **Error Tracking** | Sentry integrasjon |
| **Logging** | Strukturert logging med Pino |

## Testing

```bash
# Kjør alle tester
pnpm test

# Med coverage
cd apps/api && pnpm test:coverage
```

## Deployment

### Railway (Anbefalt)

1. Opprett prosjekt på [railway.app](https://railway.app)
2. Koble til GitHub repo
3. Legg til PostgreSQL database
4. Sett miljøvariabler
5. Deploy automatisk

### Docker

```bash
docker-compose up -d
```

## Mobil-app (iOS/Android)

```bash
cd apps/mobile

# Bygg for iOS
npx eas build --platform ios

# Bygg for Android
npx eas build --platform android
```

Krever:
- Apple Developer konto ($99/år) for iOS
- Google Play Console ($25) for Android

## Moduler

- **Reklamasjoner** - Full workflow med leverandørportal
- **Serviceavtaler** - Vedlikeholdsavtaler med planlagte besøk
- **Kundebase** - CRM med kontaktpersoner
- **Installasjoner** - Utstyrsoversikt per kunde
- **Utlånsutstyr** - Sporing av utlånt utstyr
- **HMS** - Avviksregistrering
- **Transportskader** - Skaderapportering
- **Diskusjonssaker** - Intern problemløsning
- **Chat** - Sanntids intern kommunikasjon
- **Push-varsler** - Mobilnotifikasjoner

## Lisens

Proprietær - Myhrvold Gruppen AS
