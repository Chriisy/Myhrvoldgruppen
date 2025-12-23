# FASE 16: Offline-støtte (SQLite + Sync)

> Fase 1-15 må være fullført.
> Estimert tid: ~90 minutter.

## Mål

Implementer offline-first arkitektur med lokal SQLite-database og synkronisering.

---

## Arkitektur

```
┌─────────────────────────────────────────────────────────────────┐
│  OFFLINE-FIRST STRATEGI                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐     │
│  │   App UI     │────▶│  Local DB    │────▶│  Sync Queue  │     │
│  │              │     │  (SQLite)    │     │              │     │
│  └──────────────┘     └──────────────┘     └──────────────┘     │
│                              │                     │             │
│                              │     ┌───────────────┘             │
│                              ▼     ▼                             │
│                       ┌──────────────┐                          │
│                       │   Server     │                          │
│                       │  (PostgreSQL)│                          │
│                       └──────────────┘                          │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│  SYNKRONISERING                                                  │
│  ├── Push: Lokale endringer → Server                            │
│  ├── Pull: Server-endringer → Lokal                             │
│  └── Konfliktløsning: Last-write-wins med timestamp             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Mappestruktur

```
apps/mobile/src/
├── lib/
│   ├── offline/
│   │   ├── database.ts        # SQLite setup
│   │   ├── schema.ts          # Lokal schema
│   │   ├── sync.ts            # Sync engine
│   │   ├── queue.ts           # Sync queue
│   │   └── hooks.ts           # React hooks
│   └── network.ts             # Network status
├── stores/
│   └── offline.store.ts
```

---

## Install Dependencies

```bash
npx expo install expo-sqlite @react-native-community/netinfo
```

---

## SQLite Database Setup

### src/lib/offline/database.ts

```typescript
import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

const DB_NAME = 'myhrvold_offline.db';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  
  if (Platform.OS === 'web') {
    // Web bruker ikke SQLite
    throw new Error('SQLite not supported on web');
  }
  
  db = await SQLite.openDatabaseAsync(DB_NAME);
  await initializeSchema(db);
  
  return db;
}

async function initializeSchema(database: SQLite.SQLiteDatabase) {
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    
    -- Sync metadata
    CREATE TABLE IF NOT EXISTS sync_meta (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT
    );
    
    -- Sync queue for pending changes
    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      data TEXT,
      created_at TEXT NOT NULL,
      attempts INTEGER DEFAULT 0,
      last_attempt TEXT,
      error TEXT
    );
    
    -- Cached claims
    CREATE TABLE IF NOT EXISTS claims (
      id TEXT PRIMARY KEY,
      claim_number TEXT,
      status TEXT,
      supplier_id TEXT,
      supplier_name TEXT,
      product_name TEXT,
      serial_number TEXT,
      customer_company_name TEXT,
      problem_description TEXT,
      category TEXT,
      priority TEXT,
      created_at TEXT,
      updated_at TEXT,
      synced_at TEXT,
      is_local INTEGER DEFAULT 0
    );
    
    -- Cached suppliers (for offline selection)
    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      name TEXT,
      short_code TEXT,
      warranty_months INTEGER,
      synced_at TEXT
    );
    
    -- Cached customers
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT,
      visma_customer_number TEXT,
      address TEXT,
      city TEXT,
      synced_at TEXT
    );
    
    -- Cached photos (for upload queue)
    CREATE TABLE IF NOT EXISTS photos (
      id TEXT PRIMARY KEY,
      claim_id TEXT,
      local_uri TEXT,
      uploaded INTEGER DEFAULT 0,
      upload_url TEXT,
      created_at TEXT
    );
    
    CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);
    CREATE INDEX IF NOT EXISTS idx_claims_synced ON claims(synced_at);
    CREATE INDEX IF NOT EXISTS idx_sync_queue_entity ON sync_queue(entity_type, entity_id);
  `);
  
  // Sett initial sync timestamp
  const result = await database.getFirstAsync<{ value: string }>(
    "SELECT value FROM sync_meta WHERE key = 'last_sync'"
  );
  
  if (!result) {
    await database.runAsync(
      "INSERT INTO sync_meta (key, value, updated_at) VALUES ('last_sync', '1970-01-01T00:00:00Z', ?)",
      [new Date().toISOString()]
    );
  }
}

export async function closeDatabase() {
  if (db) {
    await db.closeAsync();
    db = null;
  }
}
```

---

## Sync Queue

### src/lib/offline/queue.ts

```typescript
import { getDatabase } from './database';
import { v4 as uuid } from 'uuid';

export type SyncAction = 'create' | 'update' | 'delete';
export type EntityType = 'claim' | 'attachment' | 'response';

interface QueueItem {
  id: string;
  entityType: EntityType;
  entityId: string;
  action: SyncAction;
  data: any;
  createdAt: string;
  attempts: number;
  lastAttempt: string | null;
  error: string | null;
}

export async function addToQueue(
  entityType: EntityType,
  entityId: string,
  action: SyncAction,
  data: any
): Promise<string> {
  const db = await getDatabase();
  const id = uuid();
  
  await db.runAsync(
    `INSERT INTO sync_queue (id, entity_type, entity_id, action, data, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, entityType, entityId, action, JSON.stringify(data), new Date().toISOString()]
  );
  
  return id;
}

export async function getQueueItems(limit = 50): Promise<QueueItem[]> {
  const db = await getDatabase();
  
  const items = await db.getAllAsync<any>(
    `SELECT * FROM sync_queue 
     WHERE attempts < 5 
     ORDER BY created_at ASC 
     LIMIT ?`,
    [limit]
  );
  
  return items.map(item => ({
    id: item.id,
    entityType: item.entity_type,
    entityId: item.entity_id,
    action: item.action,
    data: JSON.parse(item.data || '{}'),
    createdAt: item.created_at,
    attempts: item.attempts,
    lastAttempt: item.last_attempt,
    error: item.error,
  }));
}

export async function markItemProcessed(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM sync_queue WHERE id = ?', [id]);
}

export async function markItemFailed(id: string, error: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE sync_queue 
     SET attempts = attempts + 1, last_attempt = ?, error = ?
     WHERE id = ?`,
    [new Date().toISOString(), error, id]
  );
}

export async function getQueueCount(): Promise<number> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM sync_queue WHERE attempts < 5'
  );
  return result?.count || 0;
}

export async function clearQueue(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM sync_queue');
}
```

---

## Sync Engine

### src/lib/offline/sync.ts

```typescript
import { getDatabase } from './database';
import { getQueueItems, markItemProcessed, markItemFailed } from './queue';
import { trpcClient } from '../api';
import NetInfo from '@react-native-community/netinfo';

interface SyncResult {
  pushed: number;
  pulled: number;
  errors: number;
}

export class SyncEngine {
  private isSyncing = false;
  private listeners: Set<(status: SyncStatus) => void> = new Set();

  async sync(): Promise<SyncResult> {
    if (this.isSyncing) {
      return { pushed: 0, pulled: 0, errors: 0 };
    }

    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      return { pushed: 0, pulled: 0, errors: 0 };
    }

    this.isSyncing = true;
    this.notifyListeners({ syncing: true, lastSync: null });

    const result: SyncResult = { pushed: 0, pulled: 0, errors: 0 };

    try {
      // 1. Push lokale endringer
      const pushResult = await this.pushChanges();
      result.pushed = pushResult.success;
      result.errors = pushResult.errors;

      // 2. Pull server-endringer
      const pullResult = await this.pullChanges();
      result.pulled = pullResult;

      // 3. Oppdater last sync timestamp
      const db = await getDatabase();
      await db.runAsync(
        "UPDATE sync_meta SET value = ?, updated_at = ? WHERE key = 'last_sync'",
        [new Date().toISOString(), new Date().toISOString()]
      );

    } catch (error) {
      console.error('Sync failed:', error);
      result.errors++;
    } finally {
      this.isSyncing = false;
      this.notifyListeners({ 
        syncing: false, 
        lastSync: new Date().toISOString() 
      });
    }

    return result;
  }

  private async pushChanges(): Promise<{ success: number; errors: number }> {
    const items = await getQueueItems();
    let success = 0;
    let errors = 0;

    for (const item of items) {
      try {
        switch (item.entityType) {
          case 'claim':
            await this.pushClaim(item);
            break;
          case 'attachment':
            await this.pushAttachment(item);
            break;
        }
        await markItemProcessed(item.id);
        success++;
      } catch (error: any) {
        await markItemFailed(item.id, error.message);
        errors++;
      }
    }

    return { success, errors };
  }

  private async pushClaim(item: any) {
    switch (item.action) {
      case 'create':
        const created = await trpcClient.claims.create.mutate(item.data);
        // Oppdater lokal ID med server ID
        const db = await getDatabase();
        await db.runAsync(
          'UPDATE claims SET id = ?, is_local = 0, synced_at = ? WHERE id = ?',
          [created.id, new Date().toISOString(), item.entityId]
        );
        break;
        
      case 'update':
        await trpcClient.claims.update.mutate({ id: item.entityId, ...item.data });
        break;
        
      case 'delete':
        await trpcClient.claims.delete.mutate({ id: item.entityId });
        break;
    }
  }

  private async pushAttachment(item: any) {
    // TODO: Implementer fil-opplasting
  }

  private async pullChanges(): Promise<number> {
    const db = await getDatabase();
    
    // Hent last sync timestamp
    const meta = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM sync_meta WHERE key = 'last_sync'"
    );
    const lastSync = meta?.value || '1970-01-01T00:00:00Z';

    // Hent endringer fra server
    const claims = await trpcClient.claims.list.query({
      updatedAfter: lastSync,
      limit: 100,
    });

    // Oppdater lokal database
    for (const claim of claims) {
      await db.runAsync(
        `INSERT OR REPLACE INTO claims 
         (id, claim_number, status, supplier_id, supplier_name, product_name, 
          serial_number, customer_company_name, problem_description, category, 
          priority, created_at, updated_at, synced_at, is_local)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [
          claim.id,
          claim.claimNumber,
          claim.status,
          claim.supplierId,
          claim.supplier?.name,
          claim.productNameText,
          claim.serialNumber,
          claim.customerCompanyName,
          claim.problemDescription,
          claim.category,
          claim.priority,
          claim.createdAt,
          claim.updatedAt,
          new Date().toISOString(),
        ]
      );
    }

    return claims.length;
  }

  // Subscribers
  subscribe(listener: (status: SyncStatus) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(status: SyncStatus) {
    this.listeners.forEach(listener => listener(status));
  }
}

interface SyncStatus {
  syncing: boolean;
  lastSync: string | null;
}

export const syncEngine = new SyncEngine();
```

---

## Offline Hooks

### src/lib/offline/hooks.ts

```typescript
import { useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { getDatabase } from './database';
import { addToQueue, getQueueCount } from './queue';
import { syncEngine } from './sync';

// Network status hook
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [isWifi, setIsWifi] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected ?? true);
      setIsWifi(state.type === 'wifi');
    });

    return () => unsubscribe();
  }, []);

  return { isOnline, isWifi };
}

// Sync status hook
export function useSyncStatus() {
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const unsubscribe = syncEngine.subscribe(status => {
      setSyncing(status.syncing);
      setLastSync(status.lastSync);
    });

    // Initial queue count
    getQueueCount().then(setPendingCount);

    return () => unsubscribe();
  }, []);

  const triggerSync = useCallback(async () => {
    await syncEngine.sync();
    const count = await getQueueCount();
    setPendingCount(count);
  }, []);

  return { syncing, lastSync, pendingCount, triggerSync };
}

// Offline claims hook
export function useOfflineClaims() {
  const [claims, setClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { isOnline } = useNetworkStatus();

  const loadClaims = useCallback(async () => {
    if (Platform.OS === 'web') {
      // Web bruker ikke offline
      return;
    }

    setLoading(true);
    try {
      const db = await getDatabase();
      const result = await db.getAllAsync<any>(
        'SELECT * FROM claims ORDER BY created_at DESC LIMIT 100'
      );
      setClaims(result);
    } catch (error) {
      console.error('Failed to load offline claims:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClaims();
  }, [loadClaims]);

  return { claims, loading, refresh: loadClaims, isOnline };
}

// Create offline claim
export async function createOfflineClaim(data: any): Promise<string> {
  const db = await getDatabase();
  const id = `local_${Date.now()}`;

  await db.runAsync(
    `INSERT INTO claims 
     (id, claim_number, status, supplier_id, supplier_name, product_name,
      serial_number, customer_company_name, problem_description, category,
      priority, created_at, updated_at, is_local)
     VALUES (?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      id,
      `DRAFT-${Date.now()}`,
      data.supplierId,
      data.supplierName,
      data.productNameText,
      data.serialNumber,
      data.customerCompanyName,
      data.problemDescription,
      data.category,
      data.priority,
      new Date().toISOString(),
      new Date().toISOString(),
    ]
  );

  // Legg til i sync queue
  await addToQueue('claim', id, 'create', data);

  return id;
}
```

---

## Offline Store

### src/stores/offline.store.ts

```typescript
import { create } from 'zustand';

interface OfflineState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingChanges: number;
  lastSyncAt: Date | null;
  
  setOnline: (online: boolean) => void;
  setSyncing: (syncing: boolean) => void;
  setPendingChanges: (count: number) => void;
  setLastSync: (date: Date) => void;
}

export const useOfflineStore = create<OfflineState>((set) => ({
  isOnline: true,
  isSyncing: false,
  pendingChanges: 0,
  lastSyncAt: null,

  setOnline: (online) => set({ isOnline: online }),
  setSyncing: (syncing) => set({ isSyncing: syncing }),
  setPendingChanges: (count) => set({ pendingChanges: count }),
  setLastSync: (date) => set({ lastSyncAt: date }),
}));
```

---

## Sync Status Component

### src/components/SyncStatus.tsx

```tsx
import { View, Text, Pressable } from 'react-native';
import { useSyncStatus, useNetworkStatus } from '../lib/offline/hooks';
import { Cloud, CloudOff, RefreshCw, Check } from 'lucide-react-native';

export function SyncStatus() {
  const { isOnline } = useNetworkStatus();
  const { syncing, lastSync, pendingCount, triggerSync } = useSyncStatus();

  const formatLastSync = () => {
    if (!lastSync) return 'Aldri synkronisert';
    const date = new Date(lastSync);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'Nettopp';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min siden`;
    return date.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View className="flex-row items-center justify-between bg-white px-4 py-2 border-b border-gray-100">
      {/* Status */}
      <View className="flex-row items-center">
        {isOnline ? (
          <Cloud size={16} color="#22c55e" />
        ) : (
          <CloudOff size={16} color="#ef4444" />
        )}
        <Text className={`ml-2 text-sm ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
          {isOnline ? 'Online' : 'Offline'}
        </Text>
      </View>

      {/* Pending changes */}
      {pendingCount > 0 && (
        <View className="flex-row items-center bg-yellow-100 px-2 py-1 rounded">
          <Text className="text-yellow-700 text-xs font-medium">
            {pendingCount} ventende
          </Text>
        </View>
      )}

      {/* Sync button */}
      <Pressable
        onPress={triggerSync}
        disabled={syncing || !isOnline}
        className="flex-row items-center"
      >
        {syncing ? (
          <RefreshCw size={16} color="#6b7280" className="animate-spin" />
        ) : pendingCount === 0 && lastSync ? (
          <Check size={16} color="#22c55e" />
        ) : (
          <RefreshCw size={16} color="#003366" />
        )}
        <Text className="ml-1 text-xs text-gray-500">
          {syncing ? 'Synkroniserer...' : formatLastSync()}
        </Text>
      </Pressable>
    </View>
  );
}
```

---

## Sjekkliste

- [ ] expo-sqlite installert
- [ ] Lokal database schema opprettet
- [ ] Sync queue implementert
- [ ] Sync engine med push/pull
- [ ] Network status hook
- [ ] Offline claims hook
- [ ] SyncStatus komponent
- [ ] Automatisk sync ved online-status
- [ ] Konfliktløsning med timestamps

---

## Neste fase

Gå til **FASE 17: Vedlikeholdsavtaler UI** for service-modulen.
