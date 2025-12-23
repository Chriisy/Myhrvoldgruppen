# 🏗️ Myhrvoldgruppen - Komplett Implementeringsplan (v2)

## Arkitektur: Modular Monolith

```
┌─────────────────────────────────────────────────────────────────┐
│                    TECH STACK                                    │
├─────────────────────────────────────────────────────────────────┤
│  FRONTEND                                                        │
│  ├── Expo SDK 54 + Expo Router v4                               │
│  ├── NativeWind (Tailwind for React Native)                     │
│  ├── TanStack Query v5 + tRPC React                             │
│  ├── Zustand (state) + React Hook Form (forms)                  │
│  └── Web + iOS + Android fra samme kodebase                     │
├─────────────────────────────────────────────────────────────────┤
│  BACKEND                                                         │
│  ├── Fastify 5 + tRPC v11                                       │
│  ├── Drizzle ORM + PostgreSQL 16                                │
│  ├── Pino logging med correlation IDs                           │
│  └── Router → Service → Repo → Policy pattern                   │
├─────────────────────────────────────────────────────────────────┤
│  MONOREPO                                                        │
│  ├── apps/api         → Backend                                 │
│  ├── apps/mobile      → Expo (web/ios/android)                  │
│  ├── packages/db      → Drizzle schemas                         │
│  ├── packages/shared  → Types, Zod schemas, constants           │
│  └── packages/ui      → Delte komponenter                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📅 Faseplan

| Fase | Innhold | Filer | Est. tid |
|------|---------|-------|----------|
| **1** | Database Foundation | common.ts, auth/, organization/ | 15 min |
| **2** | CRM | suppliers, products, customers | 30 min |
| **3** | Claims | claims, parts, attachments, timeline | 45 min |
| **4** | Service Core | maintenance, storkjokken, partners | 45 min |
| **5** | Service Visits | planned_visits, service_visits | 30 min |
| **6** | Installations | installations, transport_damages | 30 min |
| **7** | Communication | discussion_issues | 20 min |
| **8** | API Setup | Fastify + tRPC + plugins | 45 min |
| **9** | Claims API | Router/Service/Repo/Policy | 45 min |
| **10** | Expo Setup | App + NativeWind + i18n | 45 min |
| **11** | Auth Flow | Login/logout + sessions | 30 min |
| **12** | Claims UI | Liste + detaljer | 60 min |

**Total: ~7-8 timer**

---

## Tabelloversikt

### Database (Fase 1-7)

```
┌─────────────────────────────────────────────────────────────────┐
│  auth/                                                           │
│  ├── users.ts            26 felt, UUID, soft delete             │
│  ├── sessions.ts         Token-basert auth                      │
│  └── departments.ts      Hierarkisk org-struktur                │
├─────────────────────────────────────────────────────────────────┤
│  crm/                                                            │
│  ├── suppliers.ts        24 felt, garanti-info                  │
│  ├── products.ts         21 felt, specs                         │
│  └── customers.ts        20 felt, Visma-import                  │
├─────────────────────────────────────────────────────────────────┤
│  claims/                                                         │
│  ├── enums.ts            Status, priority, category             │
│  ├── claims.ts           56 felt, hovedtabell                   │
│  ├── claim-parts.ts      15 felt                                │
│  ├── claim-attachments.ts                                       │
│  └── claim-timeline.ts   Hendelseslogg                          │
├─────────────────────────────────────────────────────────────────┤
│  service/                                                        │
│  ├── maintenance-agreements.ts    Dagligvare                    │
│  ├── storkjokken-agreements.ts    40+ felt                      │
│  ├── service-partners.ts          18 felt, geo                  │
│  ├── planned-visits.ts            Planlegging                   │
│  └── service-visits.ts            Rapporter, signatur           │
├─────────────────────────────────────────────────────────────────┤
│  installations/                                                  │
│  ├── installations.ts    35+ felt, prosjekter                   │
│  └── transport-damages.ts 28 felt                               │
├─────────────────────────────────────────────────────────────────┤
│  communication/                                                  │
│  └── discussion-issues.ts 28 felt, Outlook-integrasjon          │
└─────────────────────────────────────────────────────────────────┘

TOTALT: 15+ tabeller, alle med soft delete
```

---

## Regler

```
┌─────────────────────────────────────────────────────────────────┐
│  📌 ARKITEKTUR-REGLER                                           │
├─────────────────────────────────────────────────────────────────┤
│  Database:                                                       │
│  ├── Maks 100 linjer per schema-fil                             │
│  ├── Alle tabeller har ...baseFields (timestamps + softDelete)  │
│  ├── UUID for primary keys                                      │
│  ├── snake_case i DB, camelCase i TypeScript                    │
│  └── Indekser på: status, FK-er, unike felt                     │
├─────────────────────────────────────────────────────────────────┤
│  Backend (Router → Service → Repo → Policy):                    │
│  ├── router.ts:  ~80 linjer, tRPC endpoints                     │
│  ├── service.ts: ~120 linjer, business logic                    │
│  ├── repo.ts:    ~100 linjer, database queries                  │
│  └── policy.ts:  ~40 linjer, RBAC authorization                 │
├─────────────────────────────────────────────────────────────────┤
│  Frontend:                                                       │
│  ├── Maks 200 linjer per komponent                              │
│  ├── Feature-basert organisering                                │
│  ├── Norsk UI (i18n)                                            │
│  └── Myhrvold farger: primary=#003366, accent=#0d9488           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Filstruktur

```
myhrvold-service/
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── app.ts
│   │   │   ├── lib/
│   │   │   │   ├── db.ts
│   │   │   │   ├── env.ts
│   │   │   │   └── logger.ts
│   │   │   ├── plugins/
│   │   │   │   └── correlation-id.ts
│   │   │   ├── trpc/
│   │   │   │   ├── trpc.ts
│   │   │   │   ├── context.ts
│   │   │   │   └── index.ts
│   │   │   └── modules/
│   │   │       ├── health/
│   │   │       ├── auth/
│   │   │       └── claims/
│   │   └── package.json
│   │
│   └── mobile/
│       ├── app/
│       │   ├── _layout.tsx
│       │   ├── (auth)/
│       │   └── (dashboard)/
│       ├── src/
│       │   ├── components/
│       │   ├── features/
│       │   ├── lib/
│       │   └── stores/
│       ├── locales/
│       └── package.json
│
├── packages/
│   ├── db/
│   │   └── src/schema/
│   │       ├── common.ts
│   │       ├── auth/
│   │       ├── crm/
│   │       ├── claims/
│   │       ├── service/
│   │       ├── installations/
│   │       └── communication/
│   │
│   ├── shared/
│   │   └── src/schemas/
│   │       ├── common.schema.ts
│   │       ├── auth.schema.ts
│   │       ├── crm.schema.ts
│   │       ├── claims.schema.ts
│   │       └── ...
│   │
│   └── ui/
│       └── src/components/
│
├── turbo.json
└── package.json
```

---

## Arbeidsflyt

```bash
# For hver fase:

1. Les fase-filen (FASE-XX.md)
2. Gi prompten til Claude Code
3. Test: pnpm db:generate (for DB-faser)
4. Test: pnpm dev (for API/frontend-faser)
5. Commit: git add . && git commit -m "Fase X: [beskrivelse]"
6. Neste fase
```

---

## Alle faser (1-20)

| Fase | Innhold | Prioritet | Est. tid |
|------|---------|-----------|----------|
| **1** | Database Foundation | ✅ Ferdig | 15 min |
| **2** | CRM | ✅ Ferdig | 30 min |
| **3** | Claims | ✅ Ferdig | 45 min |
| **4** | Service Core | ✅ Ferdig | 45 min |
| **5** | Service Visits | ✅ Ferdig | 30 min |
| **6** | Installations | ✅ Ferdig | 30 min |
| **7** | Communication | ✅ Ferdig | 20 min |
| **8** | API Setup | ✅ Ferdig | 45 min |
| **9** | Claims API | ✅ Ferdig | 45 min |
| **10** | Expo Setup | ✅ Ferdig | 45 min |
| **11** | Auth Flow | ✅ Ferdig | 30 min |
| **12** | Claims UI | ✅ Ferdig | 60 min |
| **13** | Claims Wizard (5-trinns) | 🔴 Kritisk | 90 min |
| **14** | Leverandørportal + QR | 🔴 Kritisk | 90 min |
| **15** | PDF-rapporter | 🔴 Kritisk | 60 min |
| **16** | Offline-støtte (SQLite) | 🟡 Viktig | 90 min |
| **17** | Vedlikeholdsavtaler UI | 🟡 Viktig | 90 min |
| **18** | Servicebesøk UI | 🟡 Viktig | 90 min |
| **19** | Push-varsler | 🟢 Ekstra | 90 min |
| **20** | AI Dokumentsøk | 🟢 Ekstra | 120 min |

**Total estimert tid: ~18 timer**

---

## Filer i dette prosjektet

```
MASTER-PLAN.md                    # Denne filen
FASE-01-foundation.md             # Database foundation
FASE-02-crm.md                    # CRM tabeller
FASE-03-claims.md                 # Claims tabeller
FASE-04-service-core.md           # Service avtaler + partnere
FASE-05-service-visits.md         # Planlagte + utførte besøk
FASE-06-installations.md          # Installasjoner + transportskader
FASE-07-communication.md          # Discussion issues
FASE-08-api-setup.md              # Fastify + tRPC setup
FASE-09-claims-api.md             # Claims router/service/repo
FASE-10-expo-setup.md             # Expo + NativeWind
FASE-11-auth-flow.md              # Login/logout
FASE-12-claims-ui.md              # Claims liste + detaljer
FASE-13-claims-wizard.md          # 5-trinns wizard
FASE-14-supplier-portal.md        # Leverandørportal + QR
FASE-15-pdf-reports.md            # PDF-rapporter
FASE-16-offline-support.md        # Offline med SQLite
FASE-17-agreements-ui.md          # Vedlikeholdsavtaler
FASE-18-service-visits-ui.md      # Servicebesøk
FASE-19-push-notifications.md     # Push-varsler
FASE-20-ai-document-search.md     # AI dokumentsøk
```
