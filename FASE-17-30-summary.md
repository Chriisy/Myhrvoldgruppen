# FASE 17-30: Sammendrag

## FASE 17: Planlagte besøk (Kalender)
**Tid:** ~2 timer

**Backend:**
- modules/visits/visits.router.ts
- modules/visits/visits.service.ts
- Endpoints: list, byId, create, assign, complete, cancel

**Frontend:**
- Kalendervisning (uke/måned)
- Drag & drop tildeling av tekniker
- Filter per tekniker/avdeling
- Statusfarger (planlagt, bekreftet, utført)

**Komponenter:**
- VisitCalendar.tsx
- VisitCard.tsx
- AssignTechnicianModal.tsx

---

## FASE 18: Servicerapporter (Signatur)
**Tid:** ~3 timer

**Backend:**
- modules/reports/reports.router.ts
- Endpoints: create, submit, approve, getPdf

**Frontend:**
- Utfyllingsskjema for tekniker
- Utstyrsliste (JSON array)
- Bilder før/etter
- Signatur-canvas (tekniker + kunde)
- Godkjenning av leder

**Komponenter:**
- ServiceReportForm.tsx
- EquipmentChecklist.tsx
- SignaturePad.tsx (react-native-signature-canvas)
- ReportApprovalCard.tsx

---

## FASE 19: Partnerkart
**Tid:** ~2 timer

**Frontend:**
- react-native-maps eller Leaflet (web)
- Partnere som markører på kart
- Filter: type, fagområde, status, fylke
- "Finn nærmeste" basert på postnummer
- Klikkbar info-popup
- Liste-visning ved siden av kart

**Komponenter:**
- PartnerMap.tsx
- PartnerMarker.tsx
- PartnerFilterPanel.tsx
- FindNearestForm.tsx

---

## FASE 20: Utlånsmaskiner
**Tid:** ~2 timer

**Backend:**
- modules/rentals/rentals.router.ts
- Endpoints: listMachines, loanOut, return, getHistory

**Frontend:**
- Maskinregister med kort-visning
- "Lån ut" modal (velg kunde, dato)
- "Returner" med tilstandsrapport
- Historikk per maskin
- QR-kode på hver maskin

**Komponenter:**
- RentalMachineCard.tsx
- LoanOutModal.tsx
- ReturnModal.tsx
- MachineHistoryTimeline.tsx

---

## FASE 21: Installasjoner
**Tid:** ~3 timer

**Backend:**
- modules/installations/installations.router.ts
- Endpoints: list, byId, create, assignTeam, complete

**Frontend:**
- Prosjektliste med statusfilter
- Opprett prosjekt-wizard
- Team-tildeling (flere teknikere)
- Tidslinje med milestones
- Dokumenter/tegninger
- Signatur ved ferdigstillelse

---

## FASE 22: HMS/SJA
**Tid:** ~2 timer

**Backend:**
- modules/hms/hms.router.ts
- Mal-system for skjemaer

**Frontend:**
- Mal-baserte sikkerhetsskjemaer
- Risikomatrise (lav/middels/høy)
- Tiltak med ansvarlig
- Digital signering
- PDF-eksport

---

## FASE 23: Stinkers (Problemprodukter)
**Tid:** ~1.5 timer

**Backend:**
- modules/stinkers/stinkers.router.ts
- Automatisk analyse av claims-data

**Frontend:**
- Topp 10 produkter med flest reklamasjoner
- Topp 10 leverandører
- Kostnadsoversikt per produkt
- Trendgraf over tid
- Eksport til Excel/PDF

---

## FASE 24: CRM/Salg
**Tid:** ~3 timer

**Backend:**
- modules/crm/crm.router.ts
- Leads, opportunities, activities

**Frontend:**
- Lead-registrering
- Kanban pipeline (mulighet → tilbud → vunnet/tapt)
- Aktivitetslogg
- Tilbud-generator
- Rapporter

---

## FASE 25: Transportskader
**Tid:** ~2 timer

**Backend:**
- modules/transport/transport.router.ts

**Frontend:**
- Skaderapportering med bilder
- Transportør-info
- Fraktbrev-referanse
- Forsikringssak-tracking
- Kobling til installasjon

---

## FASE 26: Team Chat
**Tid:** ~4 timer

**Backend:**
- modules/chat/chat.router.ts
- WebSocket for real-time
- Channels, direct messages

**Frontend:**
- Slack-lignende UI
- Kanaler (#general, #support)
- Direktemeldinger
- Fil-deling
- @mentions
- Push-varsler

---

## FASE 27: Team Forum
**Tid:** ~2 timer

**Backend:**
- modules/forum/forum.router.ts
- Categories, threads, replies

**Frontend:**
- Kategorier (Generelt, Kjøling, Nyheter)
- Tråder med svar
- Pins/sticky posts
- Bilder og vedlegg
- Moderator-rolle

---

## FASE 28: AI Dokumentsøk
**Tid:** ~6 timer

**Backend:**
- modules/ai/ai.router.ts
- Vector database (Pinecone/Qdrant)
- Embedding av PDF/docs
- RAG query endpoint

**Frontend:**
- Søkefelt for naturlig språk
- Svar med kilde-referanser
- Feilkode-oppslag
- Produktmanual-søk

---

## FASE 29: PWA + Offline
**Tid:** ~4 timer

**Implementasjon:**
- Service Worker (Workbox)
- Web App Manifest
- IndexedDB for offline data
- Background sync queue
- Web Push notifications
- "Installer app" prompt

---

## FASE 30: Native Apps (iOS/Android)
**Tid:** ~4 timer

**Implementasjon:**
- EAS Build konfigurasjon
- iOS provisioning profiles
- Android signing keys
- TestFlight beta-distribusjon
- App Store Connect oppsett
- Google Play Console oppsett
- OTA (Over-The-Air) updates

---

## Total estimert tid: Fase 17-30

| Faser | Timer |
|-------|-------|
| 17-20 | 9 |
| 21-25 | 11.5 |
| 26-28 | 12 |
| 29-30 | 8 |
| **Totalt** | **~40 timer** |

---

## Prioritert rekkefølge

For raskest mulig MVP:

1. **Fase 17-18**: Planlagte besøk + Servicerapporter (kritisk for teknikere)
2. **Fase 19-20**: Partnerkart + Utlån (høy bruksfrekvens)
3. **Fase 29**: PWA (installasjon uten App Store)
4. **Fase 21-22**: Installasjoner + HMS
5. **Fase 23-25**: Stinkers + CRM + Transport
6. **Fase 26-27**: Chat + Forum
7. **Fase 28**: AI Dokumentsøk
8. **Fase 30**: Native apps (etter PWA er i bruk)
