import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

interface EmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    const config: EmailConfig = {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
      },
    };

    transporter = nodemailer.createTransport(config);
  }

  return transporter;
}

export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  // In development, just log the email
  if (process.env.NODE_ENV === 'development' || !process.env.SMTP_HOST) {
    console.log('Email would be sent:', {
      to: options.to,
      subject: options.subject,
      attachments: options.attachments?.map(a => a.filename),
    });
    return { success: true, messageId: 'dev-' + Date.now() };
  }

  try {
    const transport = getTransporter();

    const result = await transport.sendMail({
      from: process.env.SMTP_FROM || 'noreply@myhrvold.no',
      to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      attachments: options.attachments,
    });

    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Email sending failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function sendServiceReportEmail(
  recipients: string[],
  reportData: {
    visitNumber: string;
    customerName: string;
    technicianName: string;
    completedDate: Date;
  },
  pdfBuffer: Buffer,
  customMessage?: string
): Promise<{ success: boolean; error?: string }> {
  const subject = `Servicerapport ${reportData.visitNumber} - ${reportData.customerName}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #003366;">Servicerapport</h2>

      <p>Hei,</p>

      <p>Vedlagt finner du servicerapport for utfort arbeid.</p>

      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Rapportnummer:</strong></td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${reportData.visitNumber}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Kunde:</strong></td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${reportData.customerName}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Tekniker:</strong></td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${reportData.technicianName}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Fullfort:</strong></td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${reportData.completedDate.toLocaleDateString('nb-NO')}</td>
        </tr>
      </table>

      ${customMessage ? `<p style="background: #f5f5f5; padding: 15px; border-radius: 5px;">${customMessage}</p>` : ''}

      <p style="color: #666; font-size: 12px; margin-top: 30px;">
        Med vennlig hilsen,<br>
        Myhrvoldgruppen AS<br>
        Serviceavdelingen
      </p>
    </div>
  `;

  const text = `
Servicerapport ${reportData.visitNumber}

Rapportnummer: ${reportData.visitNumber}
Kunde: ${reportData.customerName}
Tekniker: ${reportData.technicianName}
Fullfort: ${reportData.completedDate.toLocaleDateString('nb-NO')}

${customMessage || ''}

Med vennlig hilsen,
Myhrvoldgruppen AS
Serviceavdelingen
  `;

  const result = await sendEmail({
    to: recipients,
    subject,
    html,
    text,
    attachments: [
      {
        filename: `servicerapport-${reportData.visitNumber}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  });

  return result;
}

export async function sendClaimNotificationEmail(
  recipients: string[],
  claimData: {
    claimNumber: string;
    customerName: string;
    productName: string;
    status: string;
    statusLabel: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const subject = `Reklamasjon ${claimData.claimNumber} - Status oppdatert`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #003366;">Reklamasjonsoppdatering</h2>

      <p>Status for reklamasjon er oppdatert.</p>

      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Saksnummer:</strong></td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${claimData.claimNumber}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Kunde:</strong></td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${claimData.customerName}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Produkt:</strong></td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${claimData.productName}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Ny status:</strong></td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">
            <span style="background: #003366; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px;">
              ${claimData.statusLabel}
            </span>
          </td>
        </tr>
      </table>

      <p style="color: #666; font-size: 12px; margin-top: 30px;">
        Med vennlig hilsen,<br>
        Myhrvoldgruppen AS<br>
        Reklamasjonsavdelingen
      </p>
    </div>
  `;

  return sendEmail({
    to: recipients,
    subject,
    html,
  });
}
