# FASE 14: Leverandørportal (QR-kode & Svar)

> Fase 1-13 må være fullført.
> Estimert tid: ~60 minutter.

## Mål

Bygg leverandørportal der leverandører kan svare på reklamasjoner via QR-kode.

---

## Konsept

```
┌─────────────────────────────────────────────────────────────────┐
│  FLYT                                                            │
├─────────────────────────────────────────────────────────────────┤
│  1. Reklamasjon opprettes → genererer unik portal-token         │
│  2. QR-kode genereres med URL: portal.myhrvold.no/c/{token}     │
│  3. QR-kode inkluderes i PDF og e-post til leverandør           │
│  4. Leverandør skanner QR → åpner portal (ingen innlogging)     │
│  5. Leverandør ser reklamasjonsdetaljer                         │
│  6. Leverandør svarer med godkjenning/avslag + kommentar        │
│  7. Svar lagres og tidslinje oppdateres                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database: Portal Tokens

### packages/db/src/schema/claims/portal-tokens.ts

```typescript
import { pgTable, uuid, varchar, timestamp, boolean, text, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { baseFields } from '../common';
import { claims } from './claims';

export const claimPortalTokens = pgTable('claim_portal_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  claimId: uuid('claim_id').notNull().references(() => claims.id),
  token: varchar('token', { length: 64 }).notNull().unique(),
  
  // Tilgang
  expiresAt: timestamp('expires_at'),
  maxViews: integer('max_views'),
  viewCount: integer('view_count').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  
  // Sporing
  lastViewedAt: timestamp('last_viewed_at'),
  lastViewedIp: varchar('last_viewed_ip', { length: 45 }),
  
  ...baseFields,
}, (table) => ({
  tokenIdx: index('portal_token_idx').on(table.token),
  claimIdx: index('portal_claim_idx').on(table.claimId),
}));

export const claimPortalTokensRelations = relations(claimPortalTokens, ({ one }) => ({
  claim: one(claims, {
    fields: [claimPortalTokens.claimId],
    references: [claims.id],
  }),
}));

// Leverandørsvar
export const claimPortalResponses = pgTable('claim_portal_responses', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  claimId: uuid('claim_id').notNull().references(() => claims.id),
  tokenId: uuid('token_id').notNull().references(() => claimPortalTokens.id),
  
  // Svar
  decision: varchar('decision', { length: 20 }).notNull(), // approved, rejected, partial, more_info
  responderName: varchar('responder_name', { length: 100 }),
  responderEmail: varchar('responder_email', { length: 100 }),
  comment: text('comment'),
  
  // Godkjenningsdetaljer
  approvedAmount: numeric('approved_amount', { precision: 12, scale: 2 }),
  approvedParts: boolean('approved_parts').default(false),
  approvedLabor: boolean('approved_labor').default(false),
  approvedTransport: boolean('approved_transport').default(false),
  
  // Avslags-årsak
  rejectionReason: varchar('rejection_reason', { length: 50 }),
  
  // Metadata
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  
  ...baseFields,
}, (table) => ({
  claimIdx: index('portal_response_claim_idx').on(table.claimId),
}));

import { integer, numeric } from 'drizzle-orm/pg-core';
```

---

## Backend: Portal Router

### apps/api/src/modules/portal/portal.router.ts

```typescript
import { z } from 'zod';
import { router, publicProcedure } from '../../trpc/trpc';
import { PortalService } from './portal.service';

export const portalRouter = router({
  // Hent reklamasjon via token (offentlig)
  getClaim: publicProcedure
    .input(z.object({ token: z.string().length(64) }))
    .query(async ({ ctx, input }) => {
      const service = new PortalService(ctx.db, ctx.log);
      return service.getClaimByToken(input.token, {
        ipAddress: ctx.req.ip,
      });
    }),

  // Send svar (offentlig)
  submitResponse: publicProcedure
    .input(z.object({
      token: z.string().length(64),
      decision: z.enum(['approved', 'rejected', 'partial', 'more_info']),
      responderName: z.string().min(2).optional(),
      responderEmail: z.string().email().optional(),
      comment: z.string().optional(),
      approvedAmount: z.number().optional(),
      approvedParts: z.boolean().optional(),
      approvedLabor: z.boolean().optional(),
      approvedTransport: z.boolean().optional(),
      rejectionReason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new PortalService(ctx.db, ctx.log);
      return service.submitResponse(input, {
        ipAddress: ctx.req.ip,
        userAgent: ctx.req.headers['user-agent'],
      });
    }),
});

export type PortalRouter = typeof portalRouter;
```

---

### apps/api/src/modules/portal/portal.service.ts

```typescript
import { TRPCError } from '@trpc/server';
import { eq, and, gt, isNull } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import type { Database } from '../../lib/db';
import type { Logger } from 'pino';
import { 
  claims, 
  claimPortalTokens, 
  claimPortalResponses,
  claimTimeline 
} from '@myhrvold/db/schema';

interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

export class PortalService {
  constructor(
    private db: Database,
    private log: Logger
  ) {}

  // Generer ny portal-token
  async generateToken(claimId: string, expiresInDays = 30) {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

    const [portalToken] = await this.db
      .insert(claimPortalTokens)
      .values({
        claimId,
        token,
        expiresAt,
      })
      .returning();

    this.log.info({ claimId, token: token.slice(0, 8) }, 'Portal token generated');
    
    return portalToken;
  }

  // Hent reklamasjon via token
  async getClaimByToken(token: string, meta: RequestMeta) {
    // Finn token
    const portalToken = await this.db.query.claimPortalTokens.findFirst({
      where: and(
        eq(claimPortalTokens.token, token),
        eq(claimPortalTokens.isActive, true),
        isNull(claimPortalTokens.deletedAt)
      ),
    });

    if (!portalToken) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Ugyldig eller utløpt lenke',
      });
    }

    // Sjekk utløpsdato
    if (portalToken.expiresAt && portalToken.expiresAt < new Date()) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Lenken har utløpt. Kontakt Myhrvoldgruppen for ny lenke.',
      });
    }

    // Sjekk max views
    if (portalToken.maxViews && portalToken.viewCount >= portalToken.maxViews) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Maksimalt antall visninger nådd.',
      });
    }

    // Oppdater view count
    await this.db
      .update(claimPortalTokens)
      .set({
        viewCount: portalToken.viewCount + 1,
        lastViewedAt: new Date(),
        lastViewedIp: meta.ipAddress,
      })
      .where(eq(claimPortalTokens.id, portalToken.id));

    // Hent reklamasjon med begrenset info
    const claim = await this.db.query.claims.findFirst({
      where: eq(claims.id, portalToken.claimId),
      columns: {
        id: true,
        claimNumber: true,
        status: true,
        productNameText: true,
        serialNumber: true,
        purchaseDate: true,
        invoiceNumber: true,
        customerCompanyName: true,
        problemDescription: true,
        category: true,
        priority: true,
        createdAt: true,
      },
      with: {
        attachments: {
          where: isNull(claimAttachments.deletedAt),
          columns: {
            id: true,
            fileName: true,
            fileType: true,
            fileUrl: true,
          },
        },
        parts: {
          where: isNull(claimParts.deletedAt),
          columns: {
            partNumber: true,
            partName: true,
            quantity: true,
            unitPrice: true,
          },
        },
      },
    });

    if (!claim) {
      throw new TRPCError({ code: 'NOT_FOUND' });
    }

    // Sjekk om det allerede er svart
    const existingResponse = await this.db.query.claimPortalResponses.findFirst({
      where: eq(claimPortalResponses.tokenId, portalToken.id),
    });

    return {
      claim,
      hasResponded: !!existingResponse,
      existingResponse: existingResponse ? {
        decision: existingResponse.decision,
        comment: existingResponse.comment,
        createdAt: existingResponse.createdAt,
      } : null,
    };
  }

  // Send svar
  async submitResponse(
    input: {
      token: string;
      decision: string;
      responderName?: string;
      responderEmail?: string;
      comment?: string;
      approvedAmount?: number;
      approvedParts?: boolean;
      approvedLabor?: boolean;
      approvedTransport?: boolean;
      rejectionReason?: string;
    },
    meta: RequestMeta
  ) {
    // Finn token
    const portalToken = await this.db.query.claimPortalTokens.findFirst({
      where: and(
        eq(claimPortalTokens.token, input.token),
        eq(claimPortalTokens.isActive, true)
      ),
    });

    if (!portalToken) {
      throw new TRPCError({ code: 'NOT_FOUND' });
    }

    // Sjekk om allerede svart
    const existing = await this.db.query.claimPortalResponses.findFirst({
      where: eq(claimPortalResponses.tokenId, portalToken.id),
    });

    if (existing) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Det er allerede sendt inn et svar på denne reklamasjonen.',
      });
    }

    // Opprett svar
    const [response] = await this.db
      .insert(claimPortalResponses)
      .values({
        claimId: portalToken.claimId,
        tokenId: portalToken.id,
        decision: input.decision,
        responderName: input.responderName,
        responderEmail: input.responderEmail,
        comment: input.comment,
        approvedAmount: input.approvedAmount?.toString(),
        approvedParts: input.approvedParts,
        approvedLabor: input.approvedLabor,
        approvedTransport: input.approvedTransport,
        rejectionReason: input.rejectionReason,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      })
      .returning();

    // Oppdater claim status basert på svar
    const newStatus = this.getNewStatus(input.decision);
    await this.db
      .update(claims)
      .set({ 
        status: newStatus,
        supplierResponse: input.comment,
        supplierRespondedAt: new Date(),
      })
      .where(eq(claims.id, portalToken.claimId));

    // Logg til timeline
    await this.db.insert(claimTimeline).values({
      claimId: portalToken.claimId,
      eventType: 'supplier_response',
      description: this.getDecisionDescription(input.decision, input.responderName),
    });

    // Deaktiver token
    await this.db
      .update(claimPortalTokens)
      .set({ isActive: false })
      .where(eq(claimPortalTokens.id, portalToken.id));

    this.log.info({ 
      claimId: portalToken.claimId, 
      decision: input.decision 
    }, 'Portal response submitted');

    return { success: true };
  }

  private getNewStatus(decision: string): string {
    switch (decision) {
      case 'approved':
        return 'approved_by_supplier';
      case 'rejected':
        return 'rejected_by_supplier';
      case 'partial':
        return 'partially_approved';
      case 'more_info':
        return 'pending_more_info';
      default:
        return 'pending_supplier';
    }
  }

  private getDecisionDescription(decision: string, name?: string): string {
    const who = name || 'Leverandør';
    switch (decision) {
      case 'approved':
        return `${who} godkjente reklamasjonen`;
      case 'rejected':
        return `${who} avslo reklamasjonen`;
      case 'partial':
        return `${who} delvis godkjente reklamasjonen`;
      case 'more_info':
        return `${who} ba om mer informasjon`;
      default:
        return `${who} svarte på reklamasjonen`;
    }
  }
}

import { claimAttachments, claimParts } from '@myhrvold/db/schema';
```

---

## QR Code Generation

### apps/api/src/modules/portal/qr.service.ts

```typescript
import QRCode from 'qrcode';

export class QRService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.PORTAL_BASE_URL || 'https://portal.myhrvold.no';
  }

  async generateQRCode(token: string): Promise<string> {
    const url = `${this.baseUrl}/c/${token}`;
    
    // Returner base64-encoded PNG
    return QRCode.toDataURL(url, {
      width: 200,
      margin: 2,
      color: {
        dark: '#003366',
        light: '#ffffff',
      },
    });
  }

  getPortalUrl(token: string): string {
    return `${this.baseUrl}/c/${token}`;
  }
}
```

---

## Frontend: Portal Page

### apps/mobile/app/portal/[token].tsx

```tsx
import { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Alert } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { trpc } from '../../src/lib/api';
import { LoadingScreen } from '../../src/components/LoadingScreen';
import { ErrorView } from '../../src/components/ErrorView';
import { 
  Package, Building, Calendar, FileText, CheckCircle, 
  XCircle, HelpCircle, Send, AlertTriangle 
} from 'lucide-react-native';

const DECISIONS = [
  { 
    value: 'approved', 
    label: 'Godkjent', 
    icon: CheckCircle, 
    color: '#22c55e',
    bg: 'bg-green-50 border-green-200',
  },
  { 
    value: 'partial', 
    label: 'Delvis godkjent', 
    icon: AlertTriangle, 
    color: '#f59e0b',
    bg: 'bg-yellow-50 border-yellow-200',
  },
  { 
    value: 'rejected', 
    label: 'Avslått', 
    icon: XCircle, 
    color: '#ef4444',
    bg: 'bg-red-50 border-red-200',
  },
  { 
    value: 'more_info', 
    label: 'Trenger mer info', 
    icon: HelpCircle, 
    color: '#3b82f6',
    bg: 'bg-blue-50 border-blue-200',
  },
];

export default function PortalPage() {
  const { token } = useLocalSearchParams<{ token: string }>();
  
  const [decision, setDecision] = useState<string | null>(null);
  const [responderName, setResponderName] = useState('');
  const [responderEmail, setResponderEmail] = useState('');
  const [comment, setComment] = useState('');

  const { data, isLoading, error, refetch } = trpc.portal.getClaim.useQuery(
    { token: token! },
    { enabled: !!token }
  );

  const submitMutation = trpc.portal.submitResponse.useMutation({
    onSuccess: () => {
      Alert.alert(
        'Svar sendt',
        'Takk for ditt svar. Myhrvoldgruppen vil behandle reklamasjonen videre.',
        [{ text: 'OK', onPress: () => refetch() }]
      );
    },
    onError: (err) => {
      Alert.alert('Feil', err.message);
    },
  });

  const handleSubmit = () => {
    if (!decision) {
      Alert.alert('Velg beslutning', 'Du må velge en beslutning før du kan sende.');
      return;
    }

    submitMutation.mutate({
      token: token!,
      decision: decision as any,
      responderName: responderName || undefined,
      responderEmail: responderEmail || undefined,
      comment: comment || undefined,
    });
  };

  if (isLoading) return <LoadingScreen />;
  if (error) return <ErrorView error={error} />;
  if (!data) return <ErrorView error={new Error('Ikke funnet')} />;

  const { claim, hasResponded, existingResponse } = data;

  return (
    <View className="flex-1 bg-gray-50">
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Header */}
      <View className="bg-primary pt-12 pb-6 px-4">
        <View className="items-center mb-2">
          <Text className="text-white/70 text-sm">Myhrvoldgruppen</Text>
          <Text className="text-white text-2xl font-bold">Leverandørportal</Text>
        </View>
        <View className="bg-white/10 rounded-lg p-3 mt-4">
          <Text className="text-white/70 text-sm">Reklamasjonsnummer</Text>
          <Text className="text-white text-xl font-bold">{claim.claimNumber}</Text>
        </View>
      </View>

      <ScrollView className="flex-1 p-4">
        {/* Already responded */}
        {hasResponded && existingResponse && (
          <View className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
            <View className="flex-row items-center mb-2">
              <CheckCircle size={20} color="#22c55e" />
              <Text className="ml-2 text-green-700 font-semibold">
                Svar allerede registrert
              </Text>
            </View>
            <Text className="text-green-600">
              Beslutning: {existingResponse.decision}
            </Text>
            {existingResponse.comment && (
              <Text className="text-green-600 mt-1">
                Kommentar: {existingResponse.comment}
              </Text>
            )}
          </View>
        )}

        {/* Claim details */}
        <View className="bg-white rounded-xl p-4 mb-4">
          <Text className="text-lg font-semibold text-gray-900 mb-4">
            Reklamasjonsdetaljer
          </Text>

          {/* Product */}
          <View className="flex-row items-start mb-3">
            <Package size={18} color="#6b7280" />
            <View className="ml-3 flex-1">
              <Text className="text-gray-500 text-sm">Produkt</Text>
              <Text className="text-gray-900 font-medium">
                {claim.productNameText}
              </Text>
              {claim.serialNumber && (
                <Text className="text-gray-500 text-sm">
                  SN: {claim.serialNumber}
                </Text>
              )}
            </View>
          </View>

          {/* Customer */}
          <View className="flex-row items-start mb-3">
            <Building size={18} color="#6b7280" />
            <View className="ml-3 flex-1">
              <Text className="text-gray-500 text-sm">Kunde</Text>
              <Text className="text-gray-900 font-medium">
                {claim.customerCompanyName}
              </Text>
            </View>
          </View>

          {/* Date */}
          <View className="flex-row items-start mb-3">
            <Calendar size={18} color="#6b7280" />
            <View className="ml-3 flex-1">
              <Text className="text-gray-500 text-sm">Opprettet</Text>
              <Text className="text-gray-900">
                {new Date(claim.createdAt).toLocaleDateString('nb-NO')}
              </Text>
            </View>
          </View>

          {/* Problem */}
          <View className="flex-row items-start">
            <FileText size={18} color="#6b7280" />
            <View className="ml-3 flex-1">
              <Text className="text-gray-500 text-sm">Problem</Text>
              <Text className="text-gray-900">
                {claim.problemDescription}
              </Text>
            </View>
          </View>
        </View>

        {/* Response form */}
        {!hasResponded && (
          <View className="bg-white rounded-xl p-4 mb-4">
            <Text className="text-lg font-semibold text-gray-900 mb-4">
              Ditt svar
            </Text>

            {/* Decision buttons */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-2">
                Beslutning *
              </Text>
              <View className="gap-2">
                {DECISIONS.map((d) => (
                  <Pressable
                    key={d.value}
                    onPress={() => setDecision(d.value)}
                    className={`flex-row items-center p-4 rounded-lg border-2 ${
                      decision === d.value ? d.bg : 'bg-gray-50 border-gray-100'
                    }`}
                  >
                    <d.icon 
                      size={24} 
                      color={decision === d.value ? d.color : '#9ca3af'} 
                    />
                    <Text className={`ml-3 font-medium ${
                      decision === d.value ? 'text-gray-900' : 'text-gray-500'
                    }`}>
                      {d.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Name */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-1">
                Ditt navn
              </Text>
              <TextInput
                className="border border-gray-200 rounded-lg px-3 py-3 bg-gray-50"
                placeholder="Ola Nordmann"
                value={responderName}
                onChangeText={setResponderName}
              />
            </View>

            {/* Email */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-1">
                E-post
              </Text>
              <TextInput
                className="border border-gray-200 rounded-lg px-3 py-3 bg-gray-50"
                placeholder="ola@leverandor.no"
                keyboardType="email-address"
                autoCapitalize="none"
                value={responderEmail}
                onChangeText={setResponderEmail}
              />
            </View>

            {/* Comment */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-1">
                Kommentar
              </Text>
              <TextInput
                className="border border-gray-200 rounded-lg px-3 py-3 bg-gray-50 min-h-[100px]"
                placeholder="Legg til eventuell kommentar..."
                multiline
                textAlignVertical="top"
                value={comment}
                onChangeText={setComment}
              />
            </View>

            {/* Submit */}
            <Pressable
              onPress={handleSubmit}
              disabled={!decision || submitMutation.isPending}
              className={`flex-row items-center justify-center py-4 rounded-xl ${
                decision && !submitMutation.isPending ? 'bg-accent' : 'bg-gray-200'
              }`}
            >
              <Send size={20} color={decision ? 'white' : '#9ca3af'} />
              <Text className={`ml-2 font-semibold ${
                decision ? 'text-white' : 'text-gray-400'
              }`}>
                {submitMutation.isPending ? 'Sender...' : 'Send svar'}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Footer */}
        <View className="items-center py-6">
          <Text className="text-gray-400 text-sm">
            Myhrvoldgruppen AS © {new Date().getFullYear()}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
```

---

## Install QR Package

```bash
pnpm --filter @myhrvold/api add qrcode
pnpm --filter @myhrvold/api add -D @types/qrcode
```

---

## Oppdater App Router

### apps/api/src/trpc/index.ts

```typescript
import { router } from './trpc';
import { healthRouter } from '../modules/health/health.router';
import { authRouter } from '../modules/auth/auth.router';
import { claimsRouter } from '../modules/claims/claims.router';
import { portalRouter } from '../modules/portal/portal.router';  // <-- Legg til

export const appRouter = router({
  health: healthRouter,
  auth: authRouter,
  claims: claimsRouter,
  portal: portalRouter,  // <-- Legg til
});

export type AppRouter = typeof appRouter;
```

---

## Sjekkliste

- [ ] claim_portal_tokens tabell
- [ ] claim_portal_responses tabell
- [ ] portal.router.ts med getClaim og submitResponse
- [ ] portal.service.ts med token-validering og svar-håndtering
- [ ] QR-kode generering
- [ ] Portal-side med beslutningsknapper
- [ ] Svar-form med validering
- [ ] Timeline-oppdatering ved svar
- [ ] Status-oppdatering basert på beslutning

---

## Neste fase

Gå til **FASE 15: PDF-rapporter** for profesjonelle utskrifter.
