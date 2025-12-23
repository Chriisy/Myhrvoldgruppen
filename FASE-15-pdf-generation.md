# FASE 15: PDF-generering (Puppeteer)

> Les CLAUDE.md først. Fase 1-14 må være fullført.
> Denne fasen tar ~2 timer.

## Mål

Generer profesjonelle PDF-rapporter for reklamasjoner med Myhrvold-branding.

---

## PDF Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  [LOGO]                              Reklamasjonsrapport        │
│  T. Myhrvold AS                      Dato: 23.12.2024           │
│  Etablert 1909                       Sak: ELE-2412-0001         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  LEVERANDØR                          KUNDE                      │
│  ┌───────────────────┐               ┌───────────────────┐      │
│  │ Electrolux AS     │               │ Meny Stavern      │      │
│  │ Kontakt: ...      │               │ Kontakt: Hans     │      │
│  └───────────────────┘               │ Tlf: 900 00 000   │      │
│                                      └───────────────────┘      │
│                                                                 │
│  PRODUKTINFORMASJON                                             │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Produkt: Winterhalter UC-M Excellence                   │    │
│  │ Serienr: WH123456789                                    │    │
│  │ Kjøpsdato: 15.06.2024                                   │    │
│  │ Garanti: ✓ Innenfor garanti (utløper 15.06.2026)       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  FEILBESKRIVELSE                                                │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Kategori: Funksjonsfeil                                 │    │
│  │                                                         │    │
│  │ Oppvaskmaskin starter ikke. Display viser feilkode E7.  │    │
│  │ Problemet oppsto etter strømbrudd.                      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  BILDER                                                         │
│  ┌──────┐ ┌──────┐ ┌──────┐                                    │
│  │      │ │      │ │      │                                    │
│  │ Img1 │ │ Img2 │ │ Img3 │                                    │
│  │      │ │      │ │      │                                    │
│  └──────┘ └──────┘ └──────┘                                    │
│                                                                 │
│  DELER                                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Del           │ Antall │ Enhetspris │ Sum              │    │
│  │ Hovedkort     │ 1      │ 2.500 kr   │ 2.500 kr         │    │
│  │ Relé          │ 2      │ 350 kr     │ 700 kr           │    │
│  │───────────────────────────────────────────────────────│    │
│  │ Totalt deler                        │ 3.200 kr         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ [QR-KODE]  Scan for å svare på reklamasjonen           │    │
│  │            portal.myhrvold.no/ABC123                    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  T. Myhrvold AS │ Org.nr: 123456789 │ www.myhrvold.no          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Backend: PDF modul

### modules/pdf/pdf.router.ts

```typescript
import { router, protectedProcedure } from '../../trpc/trpc';
import { z } from 'zod';
import { pdfService } from './pdf.service';

export const pdfRouter = router({
  // Generer reklamasjons-PDF
  generateClaimPdf: protectedProcedure
    .input(z.object({ claimId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const pdfUrl = await pdfService.generateClaimReport(input.claimId);
      return { url: pdfUrl };
    }),

  // Generer servicerapport-PDF
  generateServiceReportPdf: protectedProcedure
    .input(z.object({ visitId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const pdfUrl = await pdfService.generateServiceReport(input.visitId);
      return { url: pdfUrl };
    }),
});
```

---

### modules/pdf/pdf.service.ts

```typescript
import puppeteer from 'puppeteer';
import { claimsRepo } from '../claims/claims.repo';
import { TRPCError } from '@trpc/server';
import { uploadFile } from '../../lib/storage';
import { claimReportTemplate } from './templates/claim-report';

class PdfService {
  private browser: puppeteer.Browser | null = null;

  private async getBrowser() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }
    return this.browser;
  }

  async generateClaimReport(claimId: string): Promise<string> {
    // Hent claim med alle relasjoner
    const claim = await claimsRepo.findById(claimId);
    if (!claim) {
      throw new TRPCError({ code: 'NOT_FOUND' });
    }

    // Generer HTML
    const html = claimReportTemplate(claim);

    // Konverter til PDF
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm',
      },
    });

    await page.close();

    // Last opp til storage
    const fileName = `claim-${claim.claimNumber}-${Date.now()}.pdf`;
    const url = await uploadFile(pdfBuffer, fileName, 'application/pdf');

    return url;
  }

  async generateServiceReport(visitId: string): Promise<string> {
    // Implementer lignende for servicerapport
    throw new Error('Not implemented');
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

export const pdfService = new PdfService();
```

---

### modules/pdf/templates/claim-report.ts

```typescript
import type { ClaimWithRelations } from '@myhrvold/shared/schemas';

export function claimReportTemplate(claim: ClaimWithRelations): string {
  const formatDate = (date?: Date | string) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('nb-NO');
  };

  const formatCurrency = (amount?: number) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('nb-NO', {
      style: 'currency',
      currency: 'NOK',
    }).format(amount);
  };

  const getWarrantyStatus = () => {
    if (claim.warrantyStatus === 'in_warranty') {
      return '<span style="color: #22c55e;">✓ Innenfor garanti</span>';
    }
    if (claim.warrantyStatus === 'out_of_warranty') {
      return '<span style="color: #ef4444;">✗ Utenfor garanti</span>';
    }
    return '<span style="color: #f59e0b;">? Ukjent</span>';
  };

  const totalPartsCost = claim.parts?.reduce(
    (sum, part) => sum + (part.totalPrice || 0), 
    0
  ) || 0;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 11pt;
      line-height: 1.5;
      color: #333;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 3px solid #003366;
      padding-bottom: 15px;
      margin-bottom: 20px;
    }
    
    .logo-section {
      display: flex;
      align-items: center;
    }
    
    .logo {
      width: 60px;
      height: 60px;
      background: #003366;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: 14pt;
      margin-right: 15px;
    }
    
    .company-info h1 {
      color: #003366;
      font-size: 18pt;
      margin-bottom: 2px;
    }
    
    .company-info p {
      color: #666;
      font-size: 9pt;
    }
    
    .report-info {
      text-align: right;
    }
    
    .report-info h2 {
      color: #003366;
      font-size: 16pt;
      margin-bottom: 5px;
    }
    
    .claim-number {
      background: #003366;
      color: white;
      padding: 5px 15px;
      border-radius: 4px;
      font-weight: bold;
      display: inline-block;
      margin-top: 5px;
    }
    
    .two-column {
      display: flex;
      gap: 20px;
      margin-bottom: 20px;
    }
    
    .column {
      flex: 1;
    }
    
    .section {
      margin-bottom: 20px;
    }
    
    .section-title {
      background: #f0f4f8;
      padding: 8px 12px;
      font-weight: bold;
      color: #003366;
      border-left: 4px solid #0d9488;
      margin-bottom: 10px;
    }
    
    .info-box {
      background: #fafafa;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      padding: 12px;
    }
    
    .info-row {
      display: flex;
      margin-bottom: 6px;
    }
    
    .info-label {
      width: 120px;
      color: #666;
      font-size: 10pt;
    }
    
    .info-value {
      flex: 1;
      font-weight: 500;
    }
    
    .description-box {
      background: #fafafa;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      padding: 15px;
      min-height: 80px;
    }
    
    .images-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 10px;
    }
    
    .image-thumb {
      width: 100px;
      height: 100px;
      object-fit: cover;
      border-radius: 4px;
      border: 1px solid #e5e7eb;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    
    th {
      background: #003366;
      color: white;
      padding: 10px;
      text-align: left;
      font-size: 10pt;
    }
    
    td {
      padding: 10px;
      border-bottom: 1px solid #e5e7eb;
    }
    
    tr:nth-child(even) {
      background: #f9fafb;
    }
    
    .total-row td {
      font-weight: bold;
      background: #f0f4f8;
      border-top: 2px solid #003366;
    }
    
    .qr-section {
      display: flex;
      align-items: center;
      background: #f0f4f8;
      padding: 15px;
      border-radius: 8px;
      margin-top: 20px;
    }
    
    .qr-code {
      width: 80px;
      height: 80px;
      background: white;
      border: 1px solid #ccc;
      margin-right: 15px;
    }
    
    .qr-text h4 {
      color: #003366;
      margin-bottom: 5px;
    }
    
    .qr-text p {
      font-size: 10pt;
      color: #666;
    }
    
    .footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: #003366;
      color: white;
      padding: 10px 15mm;
      font-size: 9pt;
      display: flex;
      justify-content: space-between;
    }
    
    .warranty-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 10pt;
      font-weight: 500;
    }
    
    .warranty-in {
      background: #dcfce7;
      color: #166534;
    }
    
    .warranty-out {
      background: #fee2e2;
      color: #991b1b;
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="header">
    <div class="logo-section">
      <div class="logo">TM</div>
      <div class="company-info">
        <h1>T. Myhrvold AS</h1>
        <p>Storhusholdningsutstyr siden 1909</p>
      </div>
    </div>
    <div class="report-info">
      <h2>Reklamasjonsrapport</h2>
      <p>Dato: ${formatDate(new Date())}</p>
      <div class="claim-number">${claim.claimNumber}</div>
    </div>
  </div>

  <!-- Leverandør & Kunde -->
  <div class="two-column">
    <div class="column">
      <div class="section-title">Leverandør</div>
      <div class="info-box">
        <div class="info-row">
          <span class="info-label">Navn:</span>
          <span class="info-value">${claim.supplier?.name || '-'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">E-post:</span>
          <span class="info-value">${claim.supplier?.email || '-'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Telefon:</span>
          <span class="info-value">${claim.supplier?.phone || '-'}</span>
        </div>
      </div>
    </div>
    <div class="column">
      <div class="section-title">Kunde</div>
      <div class="info-box">
        <div class="info-row">
          <span class="info-label">Navn:</span>
          <span class="info-value">${claim.customer?.name || claim.customerCompanyName || '-'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Kontakt:</span>
          <span class="info-value">${claim.customerContactName || '-'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Telefon:</span>
          <span class="info-value">${claim.customerContactPhone || '-'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Adresse:</span>
          <span class="info-value">${claim.installationAddress || '-'}</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Produktinfo -->
  <div class="section">
    <div class="section-title">Produktinformasjon</div>
    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Produkt:</span>
        <span class="info-value">${claim.productNameText || '-'}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Produktkode:</span>
        <span class="info-value">${claim.productCode || '-'}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Serienummer:</span>
        <span class="info-value">${claim.serialNumber || '-'}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Kjøpsdato:</span>
        <span class="info-value">${formatDate(claim.purchaseDate)}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Garanti:</span>
        <span class="info-value">${getWarrantyStatus()}</span>
      </div>
    </div>
  </div>

  <!-- Feilbeskrivelse -->
  <div class="section">
    <div class="section-title">Feilbeskrivelse</div>
    <div class="description-box">
      <p><strong>Kategori:</strong> ${claim.defectCategory || '-'}</p>
      <p style="margin-top: 10px;">${claim.problemDescription || '-'}</p>
    </div>
    
    ${claim.attachments && claim.attachments.length > 0 ? `
    <div class="images-grid">
      ${claim.attachments.map(att => `
        <img src="${att.fileUrl}" class="image-thumb" />
      `).join('')}
    </div>
    ` : ''}
  </div>

  <!-- Deler -->
  ${claim.parts && claim.parts.length > 0 ? `
  <div class="section">
    <div class="section-title">Deler</div>
    <table>
      <thead>
        <tr>
          <th>Del</th>
          <th>Delnummer</th>
          <th style="text-align: center;">Antall</th>
          <th style="text-align: right;">Enhetspris</th>
          <th style="text-align: right;">Sum</th>
        </tr>
      </thead>
      <tbody>
        ${claim.parts.map(part => `
        <tr>
          <td>${part.partName}</td>
          <td>${part.partNumber || '-'}</td>
          <td style="text-align: center;">${part.quantity}</td>
          <td style="text-align: right;">${formatCurrency(part.unitPrice)}</td>
          <td style="text-align: right;">${formatCurrency(part.totalPrice)}</td>
        </tr>
        `).join('')}
        <tr class="total-row">
          <td colspan="4">Totalt deler</td>
          <td style="text-align: right;">${formatCurrency(totalPartsCost)}</td>
        </tr>
      </tbody>
    </table>
  </div>
  ` : ''}

  <!-- QR-kode -->
  ${claim.supplierVerificationCode ? `
  <div class="qr-section">
    <img src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(`https://myhrvold.no/portal/${claim.supplierVerificationCode}`)}" class="qr-code" />
    <div class="qr-text">
      <h4>Leverandørportal</h4>
      <p>Scan QR-koden eller bruk kode: <strong>${claim.supplierVerificationCode}</strong></p>
      <p>for å svare på denne reklamasjonen.</p>
    </div>
  </div>
  ` : ''}

  <!-- Footer -->
  <div class="footer">
    <span>T. Myhrvold AS | Org.nr: 912 345 678</span>
    <span>www.myhrvold.no | post@myhrvold.no</span>
  </div>
</body>
</html>
  `;
}
```

---

### lib/storage.ts

```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { env } from './env';

const s3 = new S3Client({
  region: 'auto',
  endpoint: env.R2_ENDPOINT,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});

export async function uploadFile(
  buffer: Buffer,
  fileName: string,
  contentType: string
): Promise<string> {
  const key = `pdfs/${fileName}`;
  
  await s3.send(new PutObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));

  return `${env.R2_PUBLIC_URL}/${key}`;
}
```

---

## Frontend: PDF-knapp

### features/claims/components/ClaimPdfButton.tsx

```tsx
import { useState } from 'react';
import { Linking } from 'react-native';
import { Button } from '@myhrvold/ui';
import { trpc } from '../../../lib/api';
import { FileText, Download } from 'lucide-react-native';

interface ClaimPdfButtonProps {
  claimId: string;
}

export function ClaimPdfButton({ claimId }: ClaimPdfButtonProps) {
  const generateMutation = trpc.pdf.generateClaimPdf.useMutation({
    onSuccess: (data) => {
      // Åpne PDF i nettleser
      Linking.openURL(data.url);
    },
  });

  return (
    <Button
      variant="outline"
      onPress={() => generateMutation.mutate({ claimId })}
      loading={generateMutation.isPending}
    >
      <FileText size={16} className="mr-2" />
      Last ned PDF
    </Button>
  );
}
```

---

## Oppdater tRPC index

```typescript
import { pdfRouter } from '../modules/pdf/pdf.router';

export const appRouter = router({
  // ... eksisterende
  pdf: pdfRouter,
});
```

---

## Dependencies

```bash
pnpm --filter @myhrvold/api add puppeteer @aws-sdk/client-s3
```

---

## Environment variables

```env
# R2/S3 Storage
R2_ENDPOINT=https://xxx.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET_NAME=myhrvold-files
R2_PUBLIC_URL=https://files.myhrvold.no
```

---

## Sjekkliste

- [ ] pdf.router.ts med generateClaimPdf endpoint
- [ ] pdf.service.ts med Puppeteer PDF-generering
- [ ] claim-report.ts HTML-template med Myhrvold-branding
- [ ] storage.ts for fil-opplasting (R2/S3)
- [ ] ClaimPdfButton.tsx i frontend
- [ ] PDF viser alle claim-felter
- [ ] QR-kode inkludert i PDF
- [ ] Bilder vises i PDF
- [ ] Deler-tabell med sum
- [ ] Myhrvold farger (#003366, #0d9488)
