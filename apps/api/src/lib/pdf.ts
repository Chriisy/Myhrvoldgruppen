import PDFDocument from 'pdfkit';
import { Readable } from 'stream';

interface ServiceReportData {
  visitNumber: string;
  customerName: string;
  customerAddress?: string;
  technicianName: string;
  plannedDate: Date;
  actualStartTime?: Date;
  actualEndTime?: Date;
  workPerformed?: string;
  findings?: string;
  recommendations?: string;
  laborHours?: string;
  laborCost?: string;
  partsCost?: string;
  travelCost?: string;
  totalCost?: string;
  customerSignature?: string;
  customerSignedBy?: string;
  customerSignedAt?: Date;
}

interface ClaimReportData {
  claimNumber: string;
  customerName: string;
  supplierName: string;
  productName: string;
  serialNumber?: string;
  purchaseDate?: Date;
  issueDescription: string;
  status: string;
  resolution?: string;
  totalCost?: string;
  createdAt: Date;
}

export function generateServiceReportPdf(data: ServiceReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header
    doc.fontSize(20).font('Helvetica-Bold').text('SERVICERAPPORT', { align: 'center' });
    doc.moveDown();

    // Company info
    doc.fontSize(12).font('Helvetica-Bold').text('Myhrvoldgruppen AS');
    doc.fontSize(10).font('Helvetica').text('Serviceavdelingen');
    doc.moveDown();

    // Report number and date
    doc.fontSize(10);
    doc.text(`Rapportnr: ${data.visitNumber}`, { continued: true });
    doc.text(`  Dato: ${formatDate(data.plannedDate)}`, { align: 'right' });
    doc.moveDown();

    // Separator line
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown();

    // Customer information
    doc.fontSize(12).font('Helvetica-Bold').text('Kundeinformasjon');
    doc.fontSize(10).font('Helvetica');
    doc.text(`Kunde: ${data.customerName}`);
    if (data.customerAddress) {
      doc.text(`Adresse: ${data.customerAddress}`);
    }
    doc.moveDown();

    // Service details
    doc.fontSize(12).font('Helvetica-Bold').text('Servicedetaljer');
    doc.fontSize(10).font('Helvetica');
    doc.text(`Tekniker: ${data.technicianName}`);
    if (data.actualStartTime) {
      doc.text(`Starttid: ${formatDateTime(data.actualStartTime)}`);
    }
    if (data.actualEndTime) {
      doc.text(`Sluttid: ${formatDateTime(data.actualEndTime)}`);
    }
    if (data.laborHours) {
      doc.text(`Arbeidstimer: ${data.laborHours} timer`);
    }
    doc.moveDown();

    // Work performed
    if (data.workPerformed) {
      doc.fontSize(12).font('Helvetica-Bold').text('Utfort arbeid');
      doc.fontSize(10).font('Helvetica').text(data.workPerformed);
      doc.moveDown();
    }

    // Findings
    if (data.findings) {
      doc.fontSize(12).font('Helvetica-Bold').text('Funn');
      doc.fontSize(10).font('Helvetica').text(data.findings);
      doc.moveDown();
    }

    // Recommendations
    if (data.recommendations) {
      doc.fontSize(12).font('Helvetica-Bold').text('Anbefalinger');
      doc.fontSize(10).font('Helvetica').text(data.recommendations);
      doc.moveDown();
    }

    // Costs
    doc.fontSize(12).font('Helvetica-Bold').text('Kostnader');
    doc.fontSize(10).font('Helvetica');

    const costs = [
      ['Arbeidskostnad:', data.laborCost ? `${data.laborCost} kr` : '-'],
      ['Deler:', data.partsCost ? `${data.partsCost} kr` : '-'],
      ['Reise:', data.travelCost ? `${data.travelCost} kr` : '-'],
    ];

    costs.forEach(([label, value]) => {
      doc.text(label, { continued: true, width: 200 });
      doc.text(value, { align: 'right' });
    });

    doc.moveDown(0.5);
    doc.moveTo(350, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.5);

    doc.font('Helvetica-Bold');
    doc.text('Total:', { continued: true, width: 200 });
    doc.text(data.totalCost ? `${data.totalCost} kr` : '-', { align: 'right' });
    doc.font('Helvetica');
    doc.moveDown(2);

    // Signature section
    doc.fontSize(12).font('Helvetica-Bold').text('Signatur');
    doc.moveDown();

    if (data.customerSignature) {
      // If we have a base64 signature, we could embed it as an image
      doc.fontSize(10).font('Helvetica');
      doc.text(`Signert av: ${data.customerSignedBy || 'Kunde'}`);
      if (data.customerSignedAt) {
        doc.text(`Dato: ${formatDateTime(data.customerSignedAt)}`);
      }
      // Note: To embed actual signature image, we'd need to decode base64 and use doc.image()
    } else {
      doc.fontSize(10).font('Helvetica');
      doc.text('Kundens signatur: _______________________________');
      doc.moveDown();
      doc.text('Dato: _______________________________');
    }

    // Footer
    doc.moveDown(3);
    doc.fontSize(8).font('Helvetica').fillColor('gray');
    doc.text('Myhrvoldgruppen AS - Profesjonelle kjokken- og kjoletjenester', { align: 'center' });
    doc.text('www.myhrvold.no | post@myhrvold.no | +47 XX XX XX XX', { align: 'center' });

    doc.end();
  });
}

export function generateClaimReportPdf(data: ClaimReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header
    doc.fontSize(20).font('Helvetica-Bold').text('REKLAMASJONSRAPPORT', { align: 'center' });
    doc.moveDown();

    // Company info
    doc.fontSize(12).font('Helvetica-Bold').text('Myhrvoldgruppen AS');
    doc.fontSize(10).font('Helvetica').text('Reklamasjonsavdelingen');
    doc.moveDown();

    // Claim number and date
    doc.fontSize(10);
    doc.text(`Saksnr: ${data.claimNumber}`, { continued: true });
    doc.text(`  Opprettet: ${formatDate(data.createdAt)}`, { align: 'right' });
    doc.moveDown();

    // Status badge
    const statusColors: Record<string, string> = {
      open: '#3B82F6',
      in_progress: '#F59E0B',
      resolved: '#10B981',
      closed: '#6B7280',
      rejected: '#EF4444',
    };

    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown();

    // Status
    doc.fontSize(12).font('Helvetica-Bold').text('Status: ', { continued: true });
    doc.font('Helvetica').text(getStatusLabel(data.status));
    doc.moveDown();

    // Customer information
    doc.fontSize(12).font('Helvetica-Bold').text('Kundeinformasjon');
    doc.fontSize(10).font('Helvetica');
    doc.text(`Kunde: ${data.customerName}`);
    doc.moveDown();

    // Supplier information
    doc.fontSize(12).font('Helvetica-Bold').text('Leverandor');
    doc.fontSize(10).font('Helvetica');
    doc.text(`Leverandor: ${data.supplierName}`);
    doc.moveDown();

    // Product information
    doc.fontSize(12).font('Helvetica-Bold').text('Produktinformasjon');
    doc.fontSize(10).font('Helvetica');
    doc.text(`Produkt: ${data.productName}`);
    if (data.serialNumber) {
      doc.text(`Serienummer: ${data.serialNumber}`);
    }
    if (data.purchaseDate) {
      doc.text(`Kjopsdato: ${formatDate(data.purchaseDate)}`);
    }
    doc.moveDown();

    // Issue description
    doc.fontSize(12).font('Helvetica-Bold').text('Feilbeskrivelse');
    doc.fontSize(10).font('Helvetica').text(data.issueDescription);
    doc.moveDown();

    // Resolution
    if (data.resolution) {
      doc.fontSize(12).font('Helvetica-Bold').text('Losning');
      doc.fontSize(10).font('Helvetica').text(data.resolution);
      doc.moveDown();
    }

    // Cost
    if (data.totalCost) {
      doc.fontSize(12).font('Helvetica-Bold').text('Total kostnad');
      doc.fontSize(10).font('Helvetica').text(`${data.totalCost} kr`);
      doc.moveDown();
    }

    // Footer
    doc.moveDown(3);
    doc.fontSize(8).font('Helvetica').fillColor('gray');
    doc.text('Myhrvoldgruppen AS - Profesjonelle kjokken- og kjoletjenester', { align: 'center' });
    doc.text('www.myhrvold.no | post@myhrvold.no | +47 XX XX XX XX', { align: 'center' });

    doc.end();
  });
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('nb-NO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatDateTime(date: Date): string {
  return new Date(date).toLocaleString('nb-NO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    open: 'Apen',
    in_progress: 'Under behandling',
    waiting_supplier: 'Venter pa leverandor',
    resolved: 'Lost',
    closed: 'Lukket',
    rejected: 'Avvist',
  };
  return labels[status] || status;
}

export type { ServiceReportData, ClaimReportData };
