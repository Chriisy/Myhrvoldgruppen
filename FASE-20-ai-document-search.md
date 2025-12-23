# FASE 20: AI Dokumentsøk

> Fase 1-19 må være fullført.
> Estimert tid: ~120 minutter.

## Mål

Implementer AI-drevet søk i teknisk dokumentasjon (~100GB) slik at teknikere kan spørre om feilkoder, løsninger og prosedyrer på naturlig språk.

---

## Arkitektur

```
┌─────────────────────────────────────────────────────────────────┐
│  AI DOCUMENT SEARCH SYSTEM                                       │
├─────────────────────────────────────────────────────────────────┤
│  Dokumentprosessering:                                          │
│  ├── PDF/Word/Excel parsing                                     │
│  ├── Chunking (500-1000 tokens per chunk)                       │
│  ├── Embedding generering (OpenAI/Anthropic)                    │
│  └── Vector storage (pgvector)                                  │
├─────────────────────────────────────────────────────────────────┤
│  Søk & Retrieval:                                               │
│  ├── Semantic search med embeddings                             │
│  ├── Hybrid search (vector + keyword)                           │
│  ├── Reranking av resultater                                    │
│  └── Context window management                                  │
├─────────────────────────────────────────────────────────────────┤
│  AI Response:                                                    │
│  ├── RAG (Retrieval Augmented Generation)                       │
│  ├── Claude API for svar                                        │
│  ├── Kildehenvisninger                                          │
│  └── Norsk språkstøtte                                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database: Document Tables

### packages/db/src/schema/documents/documents.ts

```typescript
import { pgTable, uuid, text, integer, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { suppliers } from '../crm/suppliers';
import { products } from '../crm/products';
import { baseFields } from '../common';

export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Metadata
  title: text('title').notNull(),
  fileName: text('file_name').notNull(),
  fileType: text('file_type').notNull(), // 'pdf', 'docx', 'xlsx'
  filePath: text('file_path').notNull(),
  fileSize: integer('file_size'),
  
  // Kategorisering
  category: text('category').notNull(), // 'manual', 'service_guide', 'parts_list', 'error_codes'
  language: text('language').default('no'), // 'no', 'en', 'de'
  
  // Relasjoner
  supplierId: uuid('supplier_id').references(() => suppliers.id),
  productId: uuid('product_id').references(() => products.id),
  
  // Prosessering
  status: text('status').default('pending'), // 'pending', 'processing', 'completed', 'failed'
  processedAt: timestamp('processed_at'),
  chunkCount: integer('chunk_count').default(0),
  
  // Ekstra metadata
  metadata: jsonb('metadata'), // { version, author, publishDate, etc. }
  
  ...baseFields,
}, (table) => ({
  supplierIdx: index('idx_documents_supplier').on(table.supplierId),
  categoryIdx: index('idx_documents_category').on(table.category),
  statusIdx: index('idx_documents_status').on(table.status),
}));
```

---

### packages/db/src/schema/documents/document-chunks.ts

```typescript
import { pgTable, uuid, text, integer, vector, index } from 'drizzle-orm/pg-core';
import { documents } from './documents';
import { baseFields } from '../common';

export const documentChunks = pgTable('document_chunks', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Parent document
  documentId: uuid('document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  
  // Chunk content
  content: text('content').notNull(),
  chunkIndex: integer('chunk_index').notNull(),
  
  // Position i original dokument
  pageNumber: integer('page_number'),
  sectionTitle: text('section_title'),
  
  // Vector embedding (1536 dimensjoner for OpenAI, 1024 for Anthropic)
  embedding: vector('embedding', { dimensions: 1536 }),
  
  // Token count for context management
  tokenCount: integer('token_count'),
  
  ...baseFields,
}, (table) => ({
  documentIdx: index('idx_chunks_document').on(table.documentId),
  // Vector similarity index (krever pgvector extension)
  // CREATE INDEX idx_chunks_embedding ON document_chunks USING ivfflat (embedding vector_cosine_ops);
}));
```

---

### packages/db/src/schema/documents/search-history.ts

```typescript
import { pgTable, uuid, text, integer, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { users } from '../auth/users';
import { baseFields } from '../common';

export const searchHistory = pgTable('search_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Bruker
  userId: uuid('user_id').notNull().references(() => users.id),
  
  // Søk
  query: text('query').notNull(),
  queryEmbedding: text('query_embedding'), // Lagret som JSON string
  
  // Resultater
  resultCount: integer('result_count'),
  topResults: jsonb('top_results'), // Array av chunk IDs + scores
  
  // AI-svar
  aiResponse: text('ai_response'),
  responseTime: integer('response_time'), // ms
  
  // Feedback
  helpful: text('helpful'), // 'yes', 'no', 'partial'
  feedback: text('feedback'),
  
  ...baseFields,
});
```

---

## Backend: Document Processing

### apps/api/src/lib/embeddings.ts

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { OpenAI } from 'openai';
import { env } from './env';

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export async function generateEmbedding(text: string): Promise<number[]> {
  // Bruk OpenAI for embeddings (bedre for søk)
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });

  return response.data[0].embedding;
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: texts,
  });

  return response.data.map(d => d.embedding);
}

export async function generateAIResponse(
  query: string,
  context: string[],
  language: 'no' | 'en' = 'no'
): Promise<string> {
  const systemPrompt = language === 'no'
    ? `Du er en teknisk assistent for Myhrvoldgruppen som hjelper serviceteknikere med feilsøking og reparasjoner av kommersielt kjøkkenutstyr.

Svar alltid på norsk. Vær presis og praktisk. Henvis til relevante sider/seksjoner fra dokumentasjonen når det er mulig.

Hvis du ikke finner svaret i konteksten, si det ærlig og foreslå alternative tilnærminger.`
    : `You are a technical assistant for Myhrvoldgruppen helping service technicians with troubleshooting and repairs of commercial kitchen equipment.

Be precise and practical. Reference relevant pages/sections from the documentation when possible.

If you cannot find the answer in the context, say so honestly and suggest alternative approaches.`;

  const contextText = context.map((c, i) => `[Kilde ${i + 1}]\n${c}`).join('\n\n---\n\n');

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Kontekst fra teknisk dokumentasjon:\n\n${contextText}\n\n---\n\nSpørsmål: ${query}`,
      },
    ],
  });

  return (message.content[0] as any).text;
}
```

---

### apps/api/src/lib/document-processor.ts

```typescript
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { readFile } from 'fs/promises';
import type { Logger } from 'pino';

interface ProcessedDocument {
  text: string;
  pages: Array<{
    pageNumber: number;
    content: string;
  }>;
  metadata: Record<string, any>;
}

export async function processDocument(
  filePath: string,
  fileType: string,
  log: Logger
): Promise<ProcessedDocument> {
  switch (fileType) {
    case 'pdf':
      return processPdf(filePath, log);
    case 'docx':
      return processDocx(filePath, log);
    case 'xlsx':
      return processXlsx(filePath, log);
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
}

async function processPdf(filePath: string, log: Logger): Promise<ProcessedDocument> {
  const buffer = await readFile(filePath);
  const data = await pdf(buffer);

  return {
    text: data.text,
    pages: [], // PDF-parse gir ikke per-side data enkelt
    metadata: {
      pageCount: data.numpages,
      info: data.info,
    },
  };
}

async function processDocx(filePath: string, log: Logger): Promise<ProcessedDocument> {
  const buffer = await readFile(filePath);
  const result = await mammoth.extractRawText({ buffer });

  return {
    text: result.value,
    pages: [],
    metadata: {},
  };
}

async function processXlsx(filePath: string, log: Logger): Promise<ProcessedDocument> {
  const buffer = await readFile(filePath);
  const workbook = XLSX.read(buffer);
  
  let fullText = '';
  const sheets: any[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const text = XLSX.utils.sheet_to_txt(sheet);
    fullText += `\n\n--- ${sheetName} ---\n\n${text}`;
    sheets.push({ name: sheetName, content: text });
  }

  return {
    text: fullText,
    pages: [],
    metadata: { sheets },
  };
}

// Chunk tekst i passende størrelser
export function chunkText(
  text: string,
  maxTokens: number = 500,
  overlap: number = 50
): Array<{ content: string; index: number }> {
  const chunks: Array<{ content: string; index: number }> = [];
  
  // Enkel tokenisering (ca. 4 tegn per token)
  const approxCharsPerToken = 4;
  const maxChars = maxTokens * approxCharsPerToken;
  const overlapChars = overlap * approxCharsPerToken;

  // Split på avsnitt først
  const paragraphs = text.split(/\n\n+/);
  let currentChunk = '';
  let chunkIndex = 0;

  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length > maxChars) {
      if (currentChunk) {
        chunks.push({ content: currentChunk.trim(), index: chunkIndex++ });
      }
      // Start ny chunk med overlap
      const overlapStart = currentChunk.slice(-overlapChars);
      currentChunk = overlapStart + paragraph;
    } else {
      currentChunk += '\n\n' + paragraph;
    }
  }

  if (currentChunk.trim()) {
    chunks.push({ content: currentChunk.trim(), index: chunkIndex });
  }

  return chunks;
}
```

---

### apps/api/src/modules/documents/documents.service.ts

```typescript
import { eq, and, sql, desc, isNull } from 'drizzle-orm';
import type { Database } from '../../lib/db';
import type { Logger } from 'pino';
import { documents, documentChunks, searchHistory } from '@myhrvold/db/schema';
import { processDocument, chunkText } from '../../lib/document-processor';
import { generateEmbedding, generateEmbeddings, generateAIResponse } from '../../lib/embeddings';

export class DocumentsService {
  constructor(
    private db: Database,
    private log: Logger
  ) {}

  // Prosesser nytt dokument
  async processDocument(documentId: string) {
    const doc = await this.db.query.documents.findFirst({
      where: eq(documents.id, documentId),
    });

    if (!doc) throw new Error('Document not found');

    // Oppdater status
    await this.db
      .update(documents)
      .set({ status: 'processing' })
      .where(eq(documents.id, documentId));

    try {
      // Prosesser fil
      const processed = await processDocument(doc.filePath, doc.fileType, this.log);

      // Chunk tekst
      const chunks = chunkText(processed.text, 500, 50);

      // Generer embeddings i batches
      const batchSize = 100;
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        const embeddings = await generateEmbeddings(batch.map(c => c.content));

        // Lagre chunks
        await this.db.insert(documentChunks).values(
          batch.map((chunk, idx) => ({
            documentId,
            content: chunk.content,
            chunkIndex: chunk.index,
            embedding: embeddings[idx],
            tokenCount: Math.ceil(chunk.content.length / 4),
          }))
        );
      }

      // Oppdater dokument
      await this.db
        .update(documents)
        .set({ 
          status: 'completed',
          processedAt: new Date(),
          chunkCount: chunks.length,
          metadata: processed.metadata,
        })
        .where(eq(documents.id, documentId));

      this.log.info({ documentId, chunkCount: chunks.length }, 'Document processed');
    } catch (error) {
      this.log.error({ documentId, error }, 'Failed to process document');
      
      await this.db
        .update(documents)
        .set({ status: 'failed' })
        .where(eq(documents.id, documentId));

      throw error;
    }
  }

  // Semantisk søk
  async search(
    query: string,
    userId: string,
    options: {
      limit?: number;
      supplierId?: string;
      category?: string;
    } = {}
  ) {
    const { limit = 10, supplierId, category } = options;
    const startTime = Date.now();

    // Generer query embedding
    const queryEmbedding = await generateEmbedding(query);

    // Vector similarity search
    const results = await this.db.execute(sql`
      SELECT 
        dc.id,
        dc.content,
        dc.chunk_index,
        dc.page_number,
        dc.section_title,
        d.id as document_id,
        d.title as document_title,
        d.file_name,
        d.category,
        1 - (dc.embedding <=> ${JSON.stringify(queryEmbedding)}::vector) as similarity
      FROM document_chunks dc
      JOIN documents d ON d.id = dc.document_id
      WHERE d.deleted_at IS NULL
        AND d.status = 'completed'
        ${supplierId ? sql`AND d.supplier_id = ${supplierId}` : sql``}
        ${category ? sql`AND d.category = ${category}` : sql``}
      ORDER BY dc.embedding <=> ${JSON.stringify(queryEmbedding)}::vector
      LIMIT ${limit}
    `);

    // Generer AI-svar
    const contexts = (results.rows as any[]).map(r => r.content);
    const aiResponse = await generateAIResponse(query, contexts, 'no');

    const responseTime = Date.now() - startTime;

    // Lagre søkehistorikk
    await this.db.insert(searchHistory).values({
      userId,
      query,
      resultCount: results.rows.length,
      topResults: (results.rows as any[]).slice(0, 5).map(r => ({
        chunkId: r.id,
        score: r.similarity,
      })),
      aiResponse,
      responseTime,
    });

    return {
      query,
      answer: aiResponse,
      sources: (results.rows as any[]).map(r => ({
        id: r.id,
        documentId: r.document_id,
        documentTitle: r.document_title,
        fileName: r.file_name,
        content: r.content,
        similarity: r.similarity,
        pageNumber: r.page_number,
        sectionTitle: r.section_title,
      })),
      responseTime,
    };
  }

  // Hent dokumenter
  async listDocuments(options: {
    supplierId?: string;
    category?: string;
    status?: string;
    page?: number;
    limit?: number;
  } = {}) {
    const { page = 1, limit = 20, ...filters } = options;
    const offset = (page - 1) * limit;

    return this.db.query.documents.findMany({
      where: and(
        isNull(documents.deletedAt),
        filters.supplierId ? eq(documents.supplierId, filters.supplierId) : undefined,
        filters.category ? eq(documents.category, filters.category) : undefined,
        filters.status ? eq(documents.status, filters.status) : undefined,
      ),
      orderBy: [desc(documents.createdAt)],
      limit,
      offset,
      with: {
        supplier: true,
      },
    });
  }
}
```

---

### apps/api/src/modules/documents/documents.router.ts

```typescript
import { z } from 'zod';
import { router, protectedProcedure } from '../../trpc/trpc';
import { DocumentsService } from './documents.service';

export const documentsRouter = router({
  // Søk i dokumenter
  search: protectedProcedure
    .input(z.object({
      query: z.string().min(3, 'Søket må være minst 3 tegn'),
      supplierId: z.string().uuid().optional(),
      category: z.string().optional(),
      limit: z.number().min(1).max(20).default(10),
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new DocumentsService(ctx.db, ctx.log);
      return service.search(input.query, ctx.user.id, {
        limit: input.limit,
        supplierId: input.supplierId,
        category: input.category,
      });
    }),

  // List dokumenter
  list: protectedProcedure
    .input(z.object({
      supplierId: z.string().uuid().optional(),
      category: z.string().optional(),
      status: z.string().optional(),
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(50).default(20),
    }).optional())
    .query(async ({ ctx, input }) => {
      const service = new DocumentsService(ctx.db, ctx.log);
      return service.listDocuments(input);
    }),

  // Last opp dokument (returnerer upload URL)
  getUploadUrl: protectedProcedure
    .input(z.object({
      fileName: z.string(),
      fileType: z.enum(['pdf', 'docx', 'xlsx']),
      category: z.string(),
      supplierId: z.string().uuid().optional(),
      productId: z.string().uuid().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // TODO: Generer signed upload URL (GCS/S3)
      return {
        uploadUrl: 'https://storage.example.com/upload/...',
        documentId: 'new-doc-id',
      };
    }),

  // Start prosessering
  process: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const service = new DocumentsService(ctx.db, ctx.log);
      await service.processDocument(input.id);
      return { success: true };
    }),

  // Søkehistorikk
  searchHistory: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(20) }).optional())
    .query(async ({ ctx, input }) => {
      // TODO: Implementer
      return [];
    }),

  // Gi feedback på søk
  feedback: protectedProcedure
    .input(z.object({
      searchId: z.string().uuid(),
      helpful: z.enum(['yes', 'no', 'partial']),
      feedback: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // TODO: Implementer
      return { success: true };
    }),
});

export type DocumentsRouter = typeof documentsRouter;
```

---

## Frontend: AI Search Screen

### apps/mobile/src/features/ai-search/AISearchScreen.tsx

```tsx
import { useState, useRef } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  ScrollView, 
  Pressable, 
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { trpc } from '../../lib/api';
import { 
  Search, 
  Send, 
  FileText, 
  ThumbsUp, 
  ThumbsDown,
  ExternalLink,
  Sparkles,
} from 'lucide-react-native';
import Markdown from 'react-native-markdown-display';

interface SearchResult {
  query: string;
  answer: string;
  sources: Array<{
    id: string;
    documentTitle: string;
    content: string;
    similarity: number;
    pageNumber?: number;
  }>;
  responseTime: number;
}

export function AISearchScreen() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [expandedSource, setExpandedSource] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const searchMutation = trpc.documents.search.useMutation({
    onSuccess: (data) => {
      setResults(prev => [...prev, data]);
      setQuery('');
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    },
  });

  const handleSearch = () => {
    if (query.trim().length < 3) return;
    searchMutation.mutate({ query: query.trim() });
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-gray-50"
    >
      {/* Header */}
      <View className="bg-primary pt-12 pb-4 px-4">
        <View className="flex-row items-center">
          <Sparkles size={24} color="white" />
          <Text className="text-white text-xl font-bold ml-2">
            AI Dokumentsøk
          </Text>
        </View>
        <Text className="text-white/70 text-sm mt-1">
          Spør om feilkoder, prosedyrer og løsninger
        </Text>
      </View>

      {/* Results */}
      <ScrollView 
        ref={scrollRef}
        className="flex-1 p-4"
        keyboardShouldPersistTaps="handled"
      >
        {results.length === 0 && (
          <View className="items-center py-12">
            <Search size={48} color="#9ca3af" />
            <Text className="text-gray-500 text-center mt-4 px-8">
              Still et spørsmål om teknisk dokumentasjon, feilkoder eller reparasjonsprosedyrer
            </Text>
            
            {/* Eksempelspørsmål */}
            <View className="mt-8 w-full">
              <Text className="text-gray-400 text-xs mb-2">Eksempler:</Text>
              {[
                'Hva betyr feilkode E5 på Rational?',
                'Hvordan bytte kompressor på Gram?',
                'Vedlikeholdsintervall for Metos oppvaskmaskin',
              ].map((example) => (
                <Pressable
                  key={example}
                  onPress={() => {
                    setQuery(example);
                    searchMutation.mutate({ query: example });
                  }}
                  className="bg-white p-3 rounded-lg mb-2 border border-gray-100"
                >
                  <Text className="text-gray-700">{example}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {results.map((result, index) => (
          <View key={index} className="mb-6">
            {/* User query */}
            <View className="flex-row justify-end mb-2">
              <View className="bg-primary rounded-2xl rounded-br-sm px-4 py-2 max-w-[85%]">
                <Text className="text-white">{result.query}</Text>
              </View>
            </View>

            {/* AI answer */}
            <View className="bg-white rounded-2xl rounded-tl-sm p-4 shadow-sm">
              <View className="flex-row items-center mb-2">
                <Sparkles size={16} color="#0d9488" />
                <Text className="text-accent font-medium ml-1">AI-svar</Text>
                <Text className="text-gray-400 text-xs ml-auto">
                  {result.responseTime}ms
                </Text>
              </View>
              
              <Markdown style={markdownStyles}>
                {result.answer}
              </Markdown>

              {/* Sources */}
              <View className="mt-4 pt-4 border-t border-gray-100">
                <Text className="text-gray-500 text-xs mb-2">
                  Kilder ({result.sources.length}):
                </Text>
                {result.sources.slice(0, 3).map((source) => (
                  <Pressable
                    key={source.id}
                    onPress={() => setExpandedSource(
                      expandedSource === source.id ? null : source.id
                    )}
                    className="flex-row items-start py-2"
                  >
                    <FileText size={14} color="#6b7280" />
                    <View className="flex-1 ml-2">
                      <Text className="text-gray-700 text-sm font-medium">
                        {source.documentTitle}
                      </Text>
                      {source.pageNumber && (
                        <Text className="text-gray-400 text-xs">
                          Side {source.pageNumber}
                        </Text>
                      )}
                      {expandedSource === source.id && (
                        <Text className="text-gray-600 text-sm mt-2 bg-gray-50 p-2 rounded">
                          {source.content.substring(0, 300)}...
                        </Text>
                      )}
                    </View>
                    <Text className="text-gray-400 text-xs">
                      {Math.round(source.similarity * 100)}%
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Feedback */}
              <View className="flex-row items-center mt-4 pt-4 border-t border-gray-100">
                <Text className="text-gray-400 text-xs">Var dette nyttig?</Text>
                <Pressable className="ml-4 p-2">
                  <ThumbsUp size={18} color="#9ca3af" />
                </Pressable>
                <Pressable className="p-2">
                  <ThumbsDown size={18} color="#9ca3af" />
                </Pressable>
              </View>
            </View>
          </View>
        ))}

        {searchMutation.isPending && (
          <View className="items-center py-8">
            <ActivityIndicator size="large" color="#003366" />
            <Text className="text-gray-500 mt-2">Søker i dokumenter...</Text>
          </View>
        )}
      </ScrollView>

      {/* Input */}
      <View className="p-4 bg-white border-t border-gray-200">
        <View className="flex-row items-center bg-gray-100 rounded-full px-4">
          <TextInput
            className="flex-1 py-3 text-gray-900"
            placeholder="Still et spørsmål..."
            placeholderTextColor="#9ca3af"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            editable={!searchMutation.isPending}
          />
          <Pressable
            onPress={handleSearch}
            disabled={query.trim().length < 3 || searchMutation.isPending}
            className={`p-2 rounded-full ${
              query.trim().length >= 3 ? 'bg-primary' : 'bg-gray-300'
            }`}
          >
            <Send size={20} color="white" />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const markdownStyles = {
  body: {
    color: '#374151',
    fontSize: 15,
    lineHeight: 22,
  },
  heading1: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  heading2: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 6,
  },
  paragraph: {
    marginBottom: 8,
  },
  listItem: {
    marginBottom: 4,
  },
  code_inline: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 4,
    borderRadius: 4,
    fontFamily: 'monospace',
  },
};
```

---

## Route Files

### apps/mobile/app/(dashboard)/ai-search.tsx

```tsx
import { AISearchScreen } from '../../src/features/ai-search/AISearchScreen';

export default function AISearchPage() {
  return <AISearchScreen />;
}
```

---

## Environment Variables

```bash
# .env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

---

## Database Migration: pgvector

```sql
-- Aktiver pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Opprett index for rask similarity search
CREATE INDEX idx_chunks_embedding ON document_chunks 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

---

## Package.json dependencies

```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "^0.30.0",
    "openai": "^4.70.0",
    "pdf-parse": "^1.1.1",
    "mammoth": "^1.8.0",
    "xlsx": "^0.18.5"
  }
}
```

**Frontend:**
```json
{
  "dependencies": {
    "react-native-markdown-display": "^7.0.2"
  }
}
```

---

## Sjekkliste

- [ ] Database: documents, document_chunks, search_history
- [ ] pgvector extension installert
- [ ] Document processor (PDF, DOCX, XLSX)
- [ ] Embedding generering (OpenAI)
- [ ] Vector similarity search
- [ ] AI response generering (Claude)
- [ ] Documents router med alle endpoints
- [ ] AI Search screen
- [ ] Markdown rendering
- [ ] Kilder/referanser visning
- [ ] Feedback-system
- [ ] Søkehistorikk

---

## Fremtidige forbedringer

1. **Hybrid search**: Kombiner vector + full-text search
2. **Reranking**: Bruk cross-encoder for bedre resultater
3. **Caching**: Cache embeddings og vanlige søk
4. **Offline**: Lagre vanlige svar lokalt
5. **Voice**: Stemmesøk for teknikere i felt
6. **Auto-tagging**: Automatisk kategorisering av dokumenter

---

## Prosjekt fullført! 🎉

Du har nå en komplett implementeringsplan for Myhrvoldgruppen-Service:

- **Fase 1-7**: Database med 15+ tabeller
- **Fase 8-9**: API med modular monolith arkitektur
- **Fase 10-12**: Expo app med claims UI
- **Fase 13-15**: Claims wizard, leverandørportal, PDF
- **Fase 16-18**: Offline, avtaler, servicebesøk
- **Fase 19-20**: Push-varsler, AI dokumentsøk

**Lykke til med implementeringen!**
