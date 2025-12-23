# 🏗️ Myhrvoldgruppen - Komplett Implementeringsplan (Fase 1-30)

## Statusoversikt

```
┌─────────────────────────────────────────────────────────────────┐
│  PROSJEKTSTATUS                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Fase 1-12:  Database + API + Auth + Claims UI       ✅ Ferdig  │
│  Fase 13-20: Claims Wizard → Utlånsmaskiner         ⏳ Neste    │
│  Fase 21-30: Installasjoner → Native Apps           📋 Planlagt │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📅 Komplett Faseplan

### Fase 1-12: Fundament (Ferdig)
| Fase | Innhold | Status |
|------|---------|--------|
| 1 | Database Foundation + packages/ui | ✅ |
| 2 | CRM (suppliers, products, customers) | ✅ |
| 3 | Claims (56 felt + parts, timeline) | ✅ |
| 4 | Service Core (avtaler, partnere) | ✅ |
| 5 | Service Visits (planlagte, utførte) | ✅ |
| 6 | Installations + Transport Damages | ✅ |
| 7 | Communication (discussion issues) | ✅ |
| 8 | API Setup (Fastify + tRPC) | ✅ |
| 9 | Auth modul (router/service/repo/policy) | ✅ |
| 10 | Claims modul backend | ✅ |
| 11 | Expo Setup + UI integration | ✅ |
| 12 | Claims UI (liste + detaljer) | ✅ |

---

### Fase 13-20: Hovedfunksjonalitet

| Fase | Modul | Beskrivelse | Est. tid |
|------|-------|-------------|----------|
| **13** | Claims Wizard | 5-trinns opprettelse av reklamasjon | 2-3t |
| **14** | Leverandørportal | QR-kode + responsskjema for leverandører | 2t |
| **15** | PDF-generering | Puppeteer for reklamasjonsrapporter | 2t |
| **16** | Vedlikeholdsavtaler | Backend + UI for dagligvare & storkjøkken | 3t |
| **17** | Planlagte besøk | Kalendervisning + tildeling | 2t |
| **18** | Servicerapporter | Utfylling + signatur (tekniker + kunde) | 3t |
| **19** | Partnerkart | react-native-maps med filtrering | 2t |
| **20** | Utlånsmaskiner | CRUD + utlån-/returfunksjonalitet | 2t |

---

### Fase 21-25: Avanserte moduler

| Fase | Modul | Beskrivelse | Est. tid |
|------|-------|-------------|----------|
| **21** | Installasjoner | Montasjeprosjekter + team-tildeling | 3t |
| **22** | HMS/SJA | Sikkerhet- og risikovurderinger | 2t |
| **23** | Stinkers | Analyse av problemprodukter | 1.5t |
| **24** | CRM/Salg | Salgsmuligheter + pipeline | 3t |
| **25** | Transportskader | Rapportering + oppfølging | 2t |

---

### Fase 26-28: Kommunikasjon & AI

| Fase | Modul | Beskrivelse | Est. tid |
|------|-------|-------------|----------|
| **26** | Team Chat | Slack-lignende chat med kanaler | 4t |
| **27** | Team Forum | Diskusjonsgrupper (som i skjermbildet) | 2t |
| **28** | AI Dokumentsøk | RAG over 100GB teknisk dokumentasjon | 6t |

---

### Fase 29-30: Plattform & Deployment

| Fase | Modul | Beskrivelse | Est. tid |
|------|-------|-------------|----------|
| **29** | PWA + Offline | Service Worker, IndexedDB sync | 4t |
| **30** | Native Apps | iOS (App Store) + Android (Play Store) | 4t |

---

## 📊 Detaljert beskrivelse per fase

### FASE 13: Claims Wizard
```
┌─────────────────────────────────────────────────────────────────┐
│  5-TRINNS REKLAMASJONS-WIZARD                                   │
├─────────────────────────────────────────────────────────────────┤
│  Trinn 1: Leverandør                                            │
│  ├── Søk/velg leverandør                                        │
│  └── Viser garanti-info og SLA                                  │
│                                                                 │
│  Trinn 2: Produkt                                               │
│  ├── Søk/velg produkt eller skriv manuelt                       │
│  ├── Serienummer                                                │
│  └── Kjøpsdato, installeringsdato                               │
│                                                                 │
│  Trinn 3: Kunde                                                 │
│  ├── Søk/velg kunde                                             │
│  ├── Kontaktperson, telefon, e-post                             │
│  └── Installasjonsadresse                                       │
│                                                                 │
│  Trinn 4: Feilbeskrivelse                                       │
│  ├── Feilkategori (dropdown)                                    │
│  ├── Beskrivelse (tekst)                                        │
│  ├── Bilder (kamera + galleri)                                  │
│  └── Deler som trengs (legge til flere)                         │
│                                                                 │
│  Trinn 5: Oppsummering                                          │
│  ├── Vis all info                                               │
│  ├── Rediger enkelttrinn                                        │
│  └── Send / Lagre som utkast                                    │
└─────────────────────────────────────────────────────────────────┘
```

### FASE 14: Leverandørportal
```
Flyt:
1. Generer QR-kode med unik verifikasjonskode
2. Leverandør scanner → åpner responsside
3. Leverandør fyller ut:
   - Godkjent / Avvist / Trenger mer info
   - Kompensasjonstilbud
   - Frakt-instruksjoner
   - Vedlegg
4. Svar lagres → varsling til saksbehandler
```

### FASE 15: PDF-generering
```
PDF inneholder:
├── Myhrvold logo + header (#003366)
├── Reklamasjonsnummer + dato
├── Kundeinfo
├── Produktinfo med serienummer
├── Feilbeskrivelse
├── Bilder (inline)
├── Deler-liste med priser
├── Kostnadsoppsummering
└── QR-kode til leverandørportal
```

### FASE 16: Vedlikeholdsavtaler
```
To typer:
1. Dagligvare (enkel)
   - Kunde, besøk/år, pris/år

2. Storkjøkken (full)
   - Faktura-/leveringsadresse
   - Kontaktpersoner
   - Timepris (kjøl, vanlig)
   - Sonerate
   - Utstyrsliste
   - Kontraktsperiode
   - Signatur
```

### FASE 17: Planlagte besøk
```
Features:
├── Kalendervisning (uke/måned)
├── Drag & drop tildeling
├── Filtrering per tekniker/avdeling
├── Statusfarger (planlagt, bekreftet, utført)
└── Kobling til serviceavtale
```

### FASE 18: Servicerapporter
```
Felt:
├── Utstyr sjekket (JSONB liste)
├── Bilder før/etter
├── Deler brukt
├── Arbeidsbeskrivelse
├── Signatur tekniker (canvas)
├── Signatur kunde (canvas)
└── Godkjenning av leder
```

### FASE 19: Partnerkart
```
Features:
├── Leaflet/MapBox visning
├── Partnere som markører
├── Filter: type, fagområde, status
├── "Finn nærmeste" basert på adresse
├── Klikkbar info-popup
└── Liste-visning ved siden av kart
```

### FASE 20: Utlånsmaskiner
```
Funksjoner:
├── Maskinregister med status
├── Lån ut → velg kunde, dato
├── QR-kode på maskin
├── Returregistrering
├── Tilstandsrapport ved retur
└── Historikk per maskin
```

### FASE 21: Installasjoner
```
Prosjektstyring:
├── Opprett prosjekt
├── Tildel team (flere teknikere)
├── Tidslinje med milestones
├── Dokumenter/tegninger
├── Utstyrsliste
├── Signatur ved ferdigstillelse
└── Kobling til evt. transportskade
```

### FASE 22: HMS/SJA
```
Sikkerhetsvurdering:
├── Mal-baserte skjemaer
├── Risikomatrise
├── Tiltak og ansvarlige
├── Signering av alle involverte
├── Automatisk varsling ved høy risiko
└── PDF-eksport
```

### FASE 23: Stinkers
```
Analyse av problemprodukter:
├── Automatisk identifisering (3+ reklamasjoner)
├── Topp 10 produkter/leverandører
├── Kostnadsoversikt
├── Trendgraf over tid
└── Eksport til leverandørmøter
```

### FASE 24: CRM/Salg
```
Salgsmuligheter:
├── Lead-registrering
├── Pipeline-visning (Kanban)
├── Aktivitetslogg
├── Tilbud-generator
├── Kobling til kunde
└── Rapporter (vunnet/tapt)
```

### FASE 25: Transportskader
```
Rapportering:
├── Skadetype + alvorlighetsgrad
├── Bilder
├── Transportør-info
├── Fraktbrev-referanse
├── Forsikringssak
└── Kobling til installasjon
```

### FASE 26: Team Chat
```
Slack-lignende:
├── Kanaler (#general, #support, #teknikk)
├── Direktemeldinger
├── Fil-deling
├── @mentions
├── Emoji-reaksjoner
├── Søk i historikk
└── Push-varsler
```

### FASE 27: Team Forum
```
Diskusjonsgrupper:
├── Kategorier (Generelt, Kjøling, Nyheter, etc.)
├── Tråder med svar
├── Pins/sticky
├── Bilder og vedlegg
└── Moderator-rolle
```

### FASE 28: AI Dokumentsøk
```
RAG-system:
├── Indeksering av 100GB PDF/docs
├── Vector database (Pinecone/Qdrant)
├── Naturlig språk-spørsmål
├── Kilde-referanser i svar
├── Feilkode-oppslag
└── Produktmanual-søk
```

### FASE 29: PWA + Offline
```
Progressive Web App:
├── Service Worker
├── Web App Manifest
├── IndexedDB for offline data
├── Background sync
├── Push notifications (Web Push)
└── "Installer app" prompt
```

### FASE 30: Native Apps
```
App Store deployment:
├── EAS Build konfigurasjon
├── iOS provisioning profiles
├── Android signing
├── TestFlight beta
├── App Store Connect
├── Google Play Console
└── Automatisk oppdatering
```

---

## 🗓️ Tidsestimat

| Gruppe | Faser | Estimert tid |
|--------|-------|--------------|
| Fundament | 1-12 | ~8 timer ✅ |
| Hovedfunksjonalitet | 13-20 | ~18 timer |
| Avanserte moduler | 21-25 | ~11 timer |
| Kommunikasjon & AI | 26-28 | ~12 timer |
| Platform & Deploy | 29-30 | ~8 timer |
| **TOTALT** | **1-30** | **~57 timer** |

---

## 📁 Fullstendig Mappestruktur (Etter Fase 30)

```
apps/
├── mobile/                      # Expo Router
│   ├── app/
│   │   ├── (auth)/             # Login, forgot password
│   │   └── (dashboard)/        # Alle moduler
│   │       ├── claims/
│   │       ├── agreements/
│   │       ├── visits/
│   │       ├── partners/
│   │       ├── rentals/
│   │       ├── installations/
│   │       ├── hms/
│   │       ├── chat/
│   │       ├── forum/
│   │       └── settings/
│   └── features/               # Feature-moduler
│
└── api/
    └── src/
        └── modules/            # Modular monolith
            ├── auth/
            ├── claims/
            ├── portal/
            ├── pdf/
            ├── agreements/
            ├── visits/
            ├── reports/
            ├── partners/
            ├── rentals/
            ├── installations/
            ├── hms/
            ├── stinkers/
            ├── crm/
            ├── transport/
            ├── chat/
            ├── forum/
            └── ai/

packages/
├── db/                         # 20+ tabeller
├── shared/                     # Schemas + constants
└── ui/                         # 30+ komponenter
```

---

## Neste steg

Fase 13-20 er klar til implementering. Vil du ha detaljerte prompt-filer for hver fase?
