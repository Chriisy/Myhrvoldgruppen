# 🚀 Myhrvoldgruppen - Del 2: Features & UI

## Oversikt

Dette er del 2 av implementeringsplanen, som bygger videre på grunnmuren fra fase 1-12.

```
┌─────────────────────────────────────────────────────────────────┐
│  DEL 1 (Fase 1-12): Grunnmuren ✅ FERDIG                        │
│  ├── Database: 18+ tabeller                                     │
│  ├── API: Fastify + tRPC                                        │
│  ├── Auth: Login/logout                                         │
│  └── Claims: Grunnleggende liste                                │
├─────────────────────────────────────────────────────────────────┤
│  DEL 2 (Fase 13-16): Features 🔄 NÅ                             │
│  ├── Claims Wizard (5-trinns)                                   │
│  ├── Leverandørportal med QR                                    │
│  ├── PDF-generering                                             │
│  └── Vedlikeholdsavtaler UI                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📅 Del 2 - Faseplan

| Fase | Innhold | Avhengighet | Est. tid |
|------|---------|-------------|----------|
| **13** | Claims Wizard | Fase 1-12 | 60-90 min |
| **14** | Leverandørportal | Fase 13 | 45-60 min |
| **15** | PDF-generering | Fase 13-14 | 45-60 min |
| **16** | Vedlikeholdsavtaler UI | Fase 1-12 | 60-90 min |

**Total: ~4-5 timer fordelt på flere økter**

---

## Fase 13: Claims Wizard 🎯

**Hva bygges:**
- 5-trinns wizard for opprettelse av reklamasjoner
- Steg 1: Velg leverandør (søkbar dropdown)
- Steg 2: Produktinfo (søk eller manuell)
- Steg 3: Feilbeskrivelse (kategori + beskrivelse)
- Steg 4: Kunde (søk eller manuell - valgfritt)
- Steg 5: Vedlegg og oppsummering

**Kritiske funksjoner:**
- Automatisk claim number generering (UBE-2412-0001)
- Verifiseringskode for leverandørportal
- Garantistatus-beregning
- Timeline-logging

**Filer:**
- Backend: `apps/api/src/trpc/routers/claims.ts` (utvides)
- State: `apps/mobile/stores/claim-wizard.store.ts`
- UI: `apps/mobile/features/claims/screens/ClaimWizardScreen.tsx`
- Komponenter: `apps/mobile/features/claims/components/wizard/`

---

## Fase 14: Leverandørportal 🔗

**Hva bygges:**
- Ekstern portal der leverandører svarer uten innlogging
- Kode-inngang: `/portal` → skriv 6-tegns kode
- Reklamasjonsvisning: `/portal/ABC123`
- Svarskjema med tre alternativer:
  - ✅ Godkjent (kreditnota, erstatning, etc.)
  - ❌ Avvist (med begrunnelse)
  - ❓ Trenger mer info

**Kritiske funksjoner:**
- Offentlig API (ingen auth)
- Verifiseringskode-validering
- Hindre dobbelt svar
- QR-kode generering i app

**Filer:**
- Backend: `apps/api/src/trpc/routers/portal.ts`
- UI: `apps/mobile/app/portal/index.tsx`, `[code].tsx`, `success.tsx`
- QR: `apps/mobile/features/claims/components/SupplierQRCode.tsx`

---

## Fase 15: PDF-generering 📄

**Hva bygges:**
- Profesjonell PDF for reklamasjoner
- Myhrvold branding (farger, logo)
- QR-kode inkludert i dokumentet
- Nedlasting på web og deling på mobil

**PDF-innhold:**
```
┌────────────────────────────────────────┐
│  MYHRVOLD LOGO        REKLAMASJON      │
│                       UBE-2412-0001    │
├────────────────────────────────────────┤
│  TIL: Leverandør      FRA: Myhrvold    │
├────────────────────────────────────────┤
│  PRODUKTINFO                           │
│  • Produkt, serienummer, datoer        │
├────────────────────────────────────────┤
│  FEILBESKRIVELSE                       │
│  [Detaljert tekst]                     │
├────────────────────────────────────────┤
│  BILDER [miniatyrer]                   │
├────────────────────────────────────────┤
│  ┌────────┐  SVAR PÅ NETT:            │
│  │QR-KODE │  Kode: ABC123             │
│  └────────┘                            │
└────────────────────────────────────────┘
```

**Filer:**
- Service: `apps/api/src/services/pdf/claim-pdf.service.ts`
- Router: `apps/api/src/trpc/routers/pdf.ts`
- UI: `apps/mobile/features/claims/components/ClaimPdfButton.tsx`

**Dependencies:**
```bash
cd apps/api && pnpm add puppeteer qrcode
cd apps/mobile && npx expo install expo-file-system expo-sharing
```

---

## Fase 16: Vedlikeholdsavtaler UI 📋

**Hva bygges:**
- Liste over dagligvare-avtaler
- Statistikk-kort (totalt, aktive, forfalt)
- Service-kalender per måned
- Filter-knapper (alle/aktive/forfalt/etc.)
- Redigerings-modal

**Fra screenshots (bilde 4 og 13):**
- Teal gradient header
- 4 statistikk-kort øverst
- Kalender med månedlig oversikt
- Avtale-kort med status-badge

**Filer:**
- Backend: `apps/api/src/trpc/routers/agreements.ts`
- UI: `apps/mobile/features/agreements/screens/AgreementsListScreen.tsx`
- Komponenter:
  - `AgreementCard.tsx`
  - `StatsCards.tsx`
  - `ServiceCalendar.tsx`
  - `EditAgreementModal.tsx`

---

## Arbeidsflyt for Claude Code

For hver fase, gi denne prompten:

```
Les FASE-XX-[navn].md og utfør oppgavene.

Følg alle regler fra CLAUDE.md:
- Maks 200 linjer per schema-fil
- Maks 300 linjer per komponent
- Norsk UI-tekst
- Soft delete på alle tabeller

Test etter implementering:
pnpm db:generate (hvis database-endringer)
pnpm --filter @myhrvold/api dev
pnpm --filter mobile dev -- --web
```

---

## Anbefalt rekkefølge

```
Dag 1: Fase 13 (Claims Wizard)
       └── Dette er HOVEDFUNKSJONEN

Dag 2: Fase 14 (Leverandørportal)
       └── Bygger på fase 13

Dag 3: Fase 15 (PDF)
       └── Bygger på fase 13-14

Dag 4: Fase 16 (Vedlikeholdsavtaler)
       └── Uavhengig av 13-15
```

---

## Etter Del 2 - Hva gjenstår?

```
DEL 3 (Fase 17-20): Flere moduler
├── Planlagte besøk UI (kalender)
├── Servicerapport UI (signatur)
├── Servicepartnere UI (kart)
└── Utlånsmaskiner UI

DEL 4 (Fase 21-24): Avansert
├── Push-varsler
├── Offline sync
├── AI dokumentsøk
└── Rapportering/Analytics
```

---

## Viktige filer å ha tilgjengelig

Før du starter, sørg for at Claude Code har:

1. `CLAUDE.md` - Hovedspesifikasjonen
2. `FASE-13-claims-wizard.md`
3. `FASE-14-supplier-portal.md`
4. `FASE-15-pdf-generation.md`
5. `FASE-16-agreements-ui.md`
6. Screenshots fra prosjektet (for UI-referanse)

---

## Suksesskriterier for Del 2

- [ ] Fase 13: Kan opprette reklamasjon gjennom 5-trinns wizard
- [ ] Fase 14: Leverandør kan svare via QR-kode/URL
- [ ] Fase 15: PDF genereres med riktig branding og QR
- [ ] Fase 16: Vedlikeholdsavtaler vises med statistikk og kalender
- [ ] Alt fungerer på web (primært)
- [ ] Norsk UI gjennomgående
- [ ] Ingen filer over 300 linjer

Lykke til! 🚀
