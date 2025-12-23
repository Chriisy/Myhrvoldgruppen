# FASE 15: PDF-rapporter (Puppeteer)

> Fase 1-14 må være fullført.
> Estimert tid: ~60 minutter.

## Mål

Generer profesjonelle PDF-rapporter for reklamasjoner med Myhrvold-branding.

---

## PDF-typer

```
┌─────────────────────────────────────────────────────────────────┐
│  RAPPORTTYPER                                                    │
├─────────────────────────────────────────────────────────────────┤
│  1. Reklamasjonsrapport (til leverandør)                        │
│     - Komplett oversikt med bilder                              │
│     - QR-kode for portal                                        │
│     - Kundeinfo, produktinfo, problembeskrivelse                │
├─────────────────────────────────────────────────────────────────┤
│  2. Intern rapport                                               │
│     - Inkluderer kostnadsberegninger                            │
│     - Tidslinje med alle hendelser                              │
│     - Kommentarer og notater                                    │
├─────────────────────────────────────────────────────────────────┤
│  3. Servicebesøk-rapport                                         │
│     - Tekniker-info                                             │
│     - Utført arbeid                                             │
│     - Deler brukt                                               │
│     - Signaturer                                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Mappestruktur

```
apps/api/src/modules/reports/
├── reports.router.ts
├── reports.service.ts
├── templates/
│   ├── base.html
│   ├── claim-report.html
│   ├── internal-report.html
│   └── service-report.html
└── styles/
    └── pdf.css
```

---

## Install Puppeteer

```bash
pnpm --filter @myhrvold/api add puppeteer
```

---

## PDF Service

### apps/api/src/modules/reports/reports.service.ts

```typescript
import puppeteer from 'puppeteer';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { Database } from '../../lib/db';
import type { Logger } from 'pino';
import { QRService } from '../portal/qr.service';

interface ClaimReportData {
  claimNumber: string;
  createdAt: Date;
  status: string;
  supplier: { name: string; shortCode?: string };
  product: {
    name: string;
    serialNumber?: string;
    purchaseDate?: Date;
    invoiceNumber?: string;
  };
  customer: {
    companyName: string;
    contactName?: string;
    address?: string;
    city?: string;
    phone?: string;
    email?: string;
  };
  problem: {
    category: string;
    priority: string;
    description: string;
  };
  parts: Array<{
    partNumber: string;
    partName: string;
    quantity: number;
    unitPrice?: number;
  }>;
  photos: Array<{ url: string; description?: string }>;
  portalQrCode?: string;
  portalUrl?: string;
}

export class ReportsService {
  private browser: puppeteer.Browser | null = null;
  private qrService: QRService;

  constructor(
    private db: Database,
    private log: Logger
  ) {
    this.qrService = new QRService();
  }

  private async getBrowser() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }
    return this.browser;
  }

  async generateClaimReport(claimId: string, includePortal = true): Promise<Buffer> {
    // Hent data
    const claim = await this.getClaimData(claimId);
    
    // Generer QR-kode hvis ønsket
    let portalQrCode: string | undefined;
    let portalUrl: string | undefined;
    
    if (includePortal) {
      const portalService = new (await import('../portal/portal.service')).PortalService(
        this.db, 
        this.log
      );
      const token = await portalService.generateToken(claimId);
      portalQrCode = await this.qrService.generateQRCode(token.token);
      portalUrl = this.qrService.getPortalUrl(token.token);
    }

    // Generer HTML
    const html = this.renderClaimReportHtml({
      ...claim,
      portalQrCode,
      portalUrl,
    });

    // Konverter til PDF
    return this.htmlToPdf(html);
  }

  private async getClaimData(claimId: string): Promise<ClaimReportData> {
    const claim = await this.db.query.claims.findFirst({
      where: eq(claims.id, claimId),
      with: {
        supplier: true,
        customer: true,
        parts: { where: isNull(claimParts.deletedAt) },
        attachments: { 
          where: and(
            isNull(claimAttachments.deletedAt),
            eq(claimAttachments.fileType, 'image')
          )
        },
      },
    });

    if (!claim) {
      throw new Error('Reklamasjon ikke funnet');
    }

    return {
      claimNumber: claim.claimNumber,
      createdAt: claim.createdAt,
      status: claim.status,
      supplier: {
        name: claim.supplier?.name || claim.supplierName || 'Ukjent',
        shortCode: claim.supplier?.shortCode,
      },
      product: {
        name: claim.productNameText || 'Ukjent produkt',
        serialNumber: claim.serialNumber || undefined,
        purchaseDate: claim.purchaseDate || undefined,
        invoiceNumber: claim.invoiceNumber || undefined,
      },
      customer: {
        companyName: claim.customer?.name || claim.customerCompanyName || 'Ukjent',
        contactName: claim.customerContactName || undefined,
        address: claim.customer?.address || undefined,
        city: claim.customer?.city || undefined,
        phone: claim.customerPhone || undefined,
        email: claim.customerEmail || undefined,
      },
      problem: {
        category: claim.category || 'Ikke angitt',
        priority: claim.priority || 'medium',
        description: claim.problemDescription || '',
      },
      parts: claim.parts?.map(p => ({
        partNumber: p.partNumber || '',
        partName: p.partName || '',
        quantity: p.quantity || 1,
        unitPrice: p.unitPrice ? parseFloat(p.unitPrice) : undefined,
      })) || [],
      photos: claim.attachments?.map(a => ({
        url: a.fileUrl || '',
        description: a.description || undefined,
      })) || [],
    };
  }

  private renderClaimReportHtml(data: ClaimReportData): string {
    const formatDate = (date: Date | undefined) => {
      if (!date) return '-';
      return new Date(date).toLocaleDateString('nb-NO', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
    };

    const formatCurrency = (amount: number | undefined) => {
      if (!amount) return '-';
      return new Intl.NumberFormat('nb-NO', {
        style: 'currency',
        currency: 'NOK',
      }).format(amount);
    };

    const statusLabels: Record<string, string> = {
      new: 'Ny',
      in_progress: 'Under behandling',
      pending_supplier: 'Venter leverandør',
      resolved: 'Løst',
      closed: 'Lukket',
    };

    const priorityLabels: Record<string, string> = {
      low: 'Lav',
      medium: 'Medium',
      high: 'Høy',
      urgent: 'Haster',
    };

    return `
<!DOCTYPE html>
<html lang="nb">
<head>
  <meta charset="UTF-8">
  <title>Reklamasjon ${data.claimNumber}</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.5;
      color: #1f2937;
      padding: 40px;
    }
    
    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 3px solid #003366;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    
    .logo {
      font-size: 24pt;
      font-weight: bold;
      color: #003366;
    }
    
    .logo-sub {
      font-size: 10pt;
      color: #6b7280;
    }
    
    .claim-number {
      text-align: right;
    }
    
    .claim-number h1 {
      font-size: 14pt;
      color: #003366;
    }
    
    .claim-number .date {
      font-size: 10pt;
      color: #6b7280;
    }
    
    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 9pt;
      font-weight: 600;
      background: #e5e7eb;
      color: #374151;
      margin-top: 8px;
    }
    
    /* Sections */
    .section {
      margin-bottom: 25px;
    }
    
    .section-title {
      font-size: 12pt;
      font-weight: 600;
      color: #003366;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 8px;
      margin-bottom: 12px;
    }
    
    /* Grid */
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    
    .field {
      margin-bottom: 8px;
    }
    
    .field-label {
      font-size: 9pt;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .field-value {
      font-size: 11pt;
      color: #1f2937;
    }
    
    /* Description box */
    .description-box {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 15px;
    }
    
    /* Parts table */
    .parts-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10pt;
    }
    
    .parts-table th {
      background: #f3f4f6;
      padding: 8px 12px;
      text-align: left;
      font-weight: 600;
      border-bottom: 2px solid #e5e7eb;
    }
    
    .parts-table td {
      padding: 8px 12px;
      border-bottom: 1px solid #e5e7eb;
    }
    
    .parts-table .number {
      text-align: right;
    }
    
    /* Photos */
    .photos-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }
    
    .photo {
      width: 100%;
      height: 150px;
      object-fit: cover;
      border-radius: 6px;
      border: 1px solid #e5e7eb;
    }
    
    /* QR section */
    .qr-section {
      display: flex;
      align-items: center;
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      border-radius: 8px;
      padding: 20px;
      margin-top: 30px;
    }
    
    .qr-code {
      width: 120px;
      height: 120px;
    }
    
    .qr-text {
      margin-left: 20px;
    }
    
    .qr-text h3 {
      font-size: 12pt;
      color: #003366;
      margin-bottom: 8px;
    }
    
    .qr-text p {
      font-size: 10pt;
      color: #4b5563;
    }
    
    .qr-text .url {
      font-family: monospace;
      font-size: 9pt;
      color: #6b7280;
      margin-top: 8px;
    }
    
    /* Footer */
    .footer {
      position: fixed;
      bottom: 30px;
      left: 40px;
      right: 40px;
      border-top: 1px solid #e5e7eb;
      padding-top: 15px;
      font-size: 9pt;
      color: #6b7280;
      display: flex;
      justify-content: space-between;
    }
    
    @media print {
      body { padding: 20px; }
      .footer { position: absolute; }
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="header">
    <div>
      <div class="logo">Myhrvoldgruppen</div>
      <div class="logo-sub">Profesjonell kjøkkenutstyrsservice siden 1909</div>
    </div>
    <div class="claim-number">
      <h1>${data.claimNumber}</h1>
      <div class="date">${formatDate(data.createdAt)}</div>
      <span class="status-badge">${statusLabels[data.status] || data.status}</span>
    </div>
  </div>

  <!-- Supplier & Customer -->
  <div class="grid">
    <div class="section">
      <h2 class="section-title">Leverandør</h2>
      <div class="field">
        <div class="field-label">Firma</div>
        <div class="field-value">${data.supplier.name}</div>
      </div>
      ${data.supplier.shortCode ? `
      <div class="field">
        <div class="field-label">Kode</div>
        <div class="field-value">${data.supplier.shortCode}</div>
      </div>
      ` : ''}
    </div>
    
    <div class="section">
      <h2 class="section-title">Kunde</h2>
      <div class="field">
        <div class="field-label">Firma</div>
        <div class="field-value">${data.customer.companyName}</div>
      </div>
      ${data.customer.contactName ? `
      <div class="field">
        <div class="field-label">Kontakt</div>
        <div class="field-value">${data.customer.contactName}</div>
      </div>
      ` : ''}
      ${data.customer.phone ? `
      <div class="field">
        <div class="field-label">Telefon</div>
        <div class="field-value">${data.customer.phone}</div>
      </div>
      ` : ''}
    </div>
  </div>

  <!-- Product -->
  <div class="section">
    <h2 class="section-title">Produkt</h2>
    <div class="grid">
      <div class="field">
        <div class="field-label">Produkt</div>
        <div class="field-value">${data.product.name}</div>
      </div>
      <div class="field">
        <div class="field-label">Serienummer</div>
        <div class="field-value">${data.product.serialNumber || '-'}</div>
      </div>
      <div class="field">
        <div class="field-label">Kjøpsdato</div>
        <div class="field-value">${formatDate(data.product.purchaseDate)}</div>
      </div>
      <div class="field">
        <div class="field-label">Fakturanummer</div>
        <div class="field-value">${data.product.invoiceNumber || '-'}</div>
      </div>
    </div>
  </div>

  <!-- Problem -->
  <div class="section">
    <h2 class="section-title">Problem</h2>
    <div class="grid" style="margin-bottom: 15px;">
      <div class="field">
        <div class="field-label">Kategori</div>
        <div class="field-value">${data.problem.category}</div>
      </div>
      <div class="field">
        <div class="field-label">Prioritet</div>
        <div class="field-value">${priorityLabels[data.problem.priority] || data.problem.priority}</div>
      </div>
    </div>
    <div class="description-box">
      ${data.problem.description}
    </div>
  </div>

  ${data.parts.length > 0 ? `
  <!-- Parts -->
  <div class="section">
    <h2 class="section-title">Deler</h2>
    <table class="parts-table">
      <thead>
        <tr>
          <th>Delenummer</th>
          <th>Beskrivelse</th>
          <th class="number">Antall</th>
          <th class="number">Pris</th>
        </tr>
      </thead>
      <tbody>
        ${data.parts.map(part => `
        <tr>
          <td>${part.partNumber}</td>
          <td>${part.partName}</td>
          <td class="number">${part.quantity}</td>
          <td class="number">${formatCurrency(part.unitPrice)}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  ` : ''}

  ${data.photos.length > 0 ? `
  <!-- Photos -->
  <div class="section">
    <h2 class="section-title">Bilder</h2>
    <div class="photos-grid">
      ${data.photos.map(photo => `
      <img src="${photo.url}" alt="${photo.description || 'Bilde'}" class="photo" />
      `).join('')}
    </div>
  </div>
  ` : ''}

  ${data.portalQrCode ? `
  <!-- QR Portal -->
  <div class="qr-section">
    <img src="${data.portalQrCode}" alt="QR-kode" class="qr-code" />
    <div class="qr-text">
      <h3>Svar på reklamasjonen</h3>
      <p>Skann QR-koden eller bruk lenken under for å svare på denne reklamasjonen.</p>
      <div class="url">${data.portalUrl}</div>
    </div>
  </div>
  ` : ''}

  <!-- Footer -->
  <div class="footer">
    <div>
      T. Myhrvold AS | Org.nr: 910 521 066 | myhrvoldgruppen.no
    </div>
    <div>
      Generert: ${new Date().toLocaleString('nb-NO')}
    </div>
  </div>
</body>
</html>
    `;
  }

  private async htmlToPdf(html: string): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '30mm',
        left: '15mm',
      },
    });

    await page.close();

    return Buffer.from(pdf);
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

import { eq, and, isNull } from 'drizzle-orm';
import { claims, claimParts, claimAttachments } from '@myhrvold/db/schema';
```

---

## Reports Router

### apps/api/src/modules/reports/reports.router.ts

```typescript
import { z } from 'zod';
import { router, protectedProcedure } from '../../trpc/trpc';
import { ReportsService } from './reports.service';

export const reportsRouter = router({
  // Generer reklamasjonsrapport
  claimReport: protectedProcedure
    .input(z.object({
      claimId: z.string().uuid(),
      includePortal: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new ReportsService(ctx.db, ctx.log);
      
      const pdf = await service.generateClaimReport(
        input.claimId, 
        input.includePortal
      );

      // Returner som base64
      return {
        data: pdf.toString('base64'),
        filename: `reklamasjon-${input.claimId.slice(0, 8)}.pdf`,
        contentType: 'application/pdf',
      };
    }),
});

export type ReportsRouter = typeof reportsRouter;
```

---

## Oppdater App Router

### apps/api/src/trpc/index.ts

```typescript
import { router } from './trpc';
import { healthRouter } from '../modules/health/health.router';
import { authRouter } from '../modules/auth/auth.router';
import { claimsRouter } from '../modules/claims/claims.router';
import { portalRouter } from '../modules/portal/portal.router';
import { reportsRouter } from '../modules/reports/reports.router';  // <-- Legg til

export const appRouter = router({
  health: healthRouter,
  auth: authRouter,
  claims: claimsRouter,
  portal: portalRouter,
  reports: reportsRouter,  // <-- Legg til
});

export type AppRouter = typeof appRouter;
```

---

## Frontend: PDF Download

### src/features/claims/components/ClaimActions.tsx

```tsx
import { useState } from 'react';
import { View, Pressable, Text, Alert, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { trpc } from '../../../lib/api';
import { FileText, Download, Loader } from 'lucide-react-native';

interface ClaimActionsProps {
  claimId: string;
  claimNumber: string;
}

export function ClaimActions({ claimId, claimNumber }: ClaimActionsProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const generateMutation = trpc.reports.claimReport.useMutation();

  const handleDownloadPdf = async () => {
    setIsGenerating(true);
    
    try {
      const result = await generateMutation.mutateAsync({
        claimId,
        includePortal: true,
      });

      if (Platform.OS === 'web') {
        // Web: Download direkte
        const link = document.createElement('a');
        link.href = `data:application/pdf;base64,${result.data}`;
        link.download = `${claimNumber}.pdf`;
        link.click();
      } else {
        // Native: Lagre og del
        const fileUri = FileSystem.documentDirectory + `${claimNumber}.pdf`;
        await FileSystem.writeAsStringAsync(fileUri, result.data, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Del reklamasjonsrapport',
        });
      }
    } catch (error: any) {
      Alert.alert('Feil', error.message || 'Kunne ikke generere PDF');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <View className="flex-row gap-3">
      <Pressable
        onPress={handleDownloadPdf}
        disabled={isGenerating}
        className={`flex-1 flex-row items-center justify-center py-3 rounded-lg ${
          isGenerating ? 'bg-gray-100' : 'bg-primary'
        }`}
      >
        {isGenerating ? (
          <Loader size={18} color="#6b7280" className="animate-spin" />
        ) : (
          <FileText size={18} color="white" />
        )}
        <Text className={`ml-2 font-medium ${
          isGenerating ? 'text-gray-500' : 'text-white'
        }`}>
          {isGenerating ? 'Genererer...' : 'Last ned PDF'}
        </Text>
      </Pressable>
    </View>
  );
}
```

---

## Install Expo Packages

```bash
npx expo install expo-file-system expo-sharing
```

---

## Sjekkliste

- [ ] Puppeteer installert og konfigurert
- [ ] ReportsService med HTML-til-PDF konvertering
- [ ] Profesjonell HTML-template med Myhrvold-branding
- [ ] QR-kode inkludert i PDF
- [ ] reports.router.ts med claimReport endpoint
- [ ] Frontend ClaimActions komponent
- [ ] PDF-nedlasting fungerer på web
- [ ] PDF-deling fungerer på native

---

## Neste fase

Gå til **FASE 16: Offline-støtte** for lokal datahåndtering.
