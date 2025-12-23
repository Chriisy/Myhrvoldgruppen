# FASE 16: Vedlikeholdsavtaler (Backend + UI)

> Les CLAUDE.md først. Fase 1-15 må være fullført.
> Denne fasen tar ~3 timer.

## Mål

Implementer komplett vedlikeholdsavtale-modul for dagligvare og storkjøkken.

---

## Backend: Agreements modul

### modules/agreements/agreements.router.ts

```typescript
import { router, protectedProcedure } from '../../trpc/trpc';
import { z } from 'zod';
import { agreementsService } from './agreements.service';
import { 
  createMaintenanceAgreementInput,
  createStorkjokkenAgreementInput,
  agreementFiltersInput 
} from '@myhrvold/shared/schemas';

export const agreementsRouter = router({
  // Dagligvare-avtaler
  maintenance: router({
    list: protectedProcedure
      .input(agreementFiltersInput)
      .query(({ input }) => agreementsService.listMaintenanceAgreements(input)),
    
    byId: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .query(({ input }) => agreementsService.getMaintenanceAgreement(input.id)),
    
    create: protectedProcedure
      .input(createMaintenanceAgreementInput)
      .mutation(({ ctx, input }) => 
        agreementsService.createMaintenanceAgreement(ctx.user.id, input)
      ),
    
    update: protectedProcedure
      .input(z.object({
        id: z.string().uuid(),
        data: createMaintenanceAgreementInput.partial(),
      }))
      .mutation(({ input }) => 
        agreementsService.updateMaintenanceAgreement(input.id, input.data)
      ),
    
    delete: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(({ ctx, input }) => 
        agreementsService.deleteMaintenanceAgreement(input.id, ctx.user.id)
      ),
  }),

  // Storkjøkken-avtaler
  storkjokken: router({
    list: protectedProcedure
      .input(agreementFiltersInput)
      .query(({ input }) => agreementsService.listStorkjokkenAgreements(input)),
    
    byId: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .query(({ input }) => agreementsService.getStorkjokkenAgreement(input.id)),
    
    create: protectedProcedure
      .input(createStorkjokkenAgreementInput)
      .mutation(({ ctx, input }) => 
        agreementsService.createStorkjokkenAgreement(ctx.user.id, input)
      ),
    
    update: protectedProcedure
      .input(z.object({
        id: z.string().uuid(),
        data: createStorkjokkenAgreementInput.partial(),
      }))
      .mutation(({ input }) => 
        agreementsService.updateStorkjokkenAgreement(input.id, input.data)
      ),
  }),

  // Statistikk
  stats: protectedProcedure
    .query(() => agreementsService.getStats()),
});
```

---

### modules/agreements/agreements.service.ts

```typescript
import { TRPCError } from '@trpc/server';
import { agreementsRepo } from './agreements.repo';

class AgreementsService {
  // Dagligvare
  async listMaintenanceAgreements(filters: AgreementFilters) {
    return agreementsRepo.listMaintenance(filters);
  }

  async getMaintenanceAgreement(id: string) {
    const agreement = await agreementsRepo.findMaintenanceById(id);
    if (!agreement) {
      throw new TRPCError({ code: 'NOT_FOUND' });
    }
    return agreement;
  }

  async createMaintenanceAgreement(userId: string, data: CreateMaintenanceInput) {
    const agreementNumber = await this.generateAgreementNumber('DA');
    return agreementsRepo.createMaintenance({
      ...data,
      agreementNumber,
      createdById: userId,
    });
  }

  async updateMaintenanceAgreement(id: string, data: Partial<CreateMaintenanceInput>) {
    return agreementsRepo.updateMaintenance(id, data);
  }

  async deleteMaintenanceAgreement(id: string, userId: string) {
    return agreementsRepo.softDeleteMaintenance(id, userId);
  }

  // Storkjøkken
  async listStorkjokkenAgreements(filters: AgreementFilters) {
    return agreementsRepo.listStorkjokken(filters);
  }

  async getStorkjokkenAgreement(id: string) {
    const agreement = await agreementsRepo.findStorkjokkenById(id);
    if (!agreement) {
      throw new TRPCError({ code: 'NOT_FOUND' });
    }
    return agreement;
  }

  async createStorkjokkenAgreement(userId: string, data: CreateStorkjokkenInput) {
    const agreementNumber = await this.generateAgreementNumber('SK');
    return agreementsRepo.createStorkjokken({
      ...data,
      agreementNumber,
      createdById: userId,
    });
  }

  async updateStorkjokkenAgreement(id: string, data: Partial<CreateStorkjokkenInput>) {
    return agreementsRepo.updateStorkjokken(id, data);
  }

  // Statistikk
  async getStats() {
    const [maintenance, storkjokken] = await Promise.all([
      agreementsRepo.getMaintenanceStats(),
      agreementsRepo.getStorkjokkenStats(),
    ]);
    
    return {
      totalAgreements: maintenance.total + storkjokken.total,
      activeAgreements: maintenance.active + storkjokken.active,
      expiringThisMonth: maintenance.expiring + storkjokken.expiring,
      totalYearlyValue: maintenance.yearlyValue + storkjokken.yearlyValue,
    };
  }

  private async generateAgreementNumber(prefix: string): Promise<string> {
    const year = new Date().getFullYear().toString().slice(-2);
    const count = await agreementsRepo.getCountForYear(prefix, year);
    return `${prefix}-${year}${(count + 1).toString().padStart(4, '0')}`;
  }
}

export const agreementsService = new AgreementsService();
```

---

## packages/shared/schemas/agreements.schema.ts

```typescript
import { z } from 'zod';

export const agreementFiltersInput = z.object({
  status: z.enum(['draft', 'active', 'expired', 'cancelled']).optional(),
  search: z.string().optional(),
  customerId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  expiringBefore: z.string().datetime().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
});

export const createMaintenanceAgreementInput = z.object({
  customerId: z.string().uuid().optional(),
  customerName: z.string().min(1),
  customerNumber: z.string().optional(),
  departmentId: z.string().uuid().optional(),
  
  deliveryAddress: z.string().optional(),
  deliveryPostcode: z.string().optional(),
  deliveryCity: z.string().optional(),
  
  contactPerson: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email().optional(),
  
  visitsPerYear: z.number().min(1).default(1),
  pricePerYear: z.number().min(0),
  hourlyRate: z.number().optional(),
  
  validFrom: z.string().datetime(),
  validTo: z.string().datetime(),
  
  notes: z.string().optional(),
});

export const createStorkjokkenAgreementInput = createMaintenanceAgreementInput.extend({
  // Faktura-adresse
  invoiceCustomerNumber: z.string().optional(),
  invoiceCustomerName: z.string().optional(),
  invoiceAddress: z.string().optional(),
  invoicePostcode: z.string().optional(),
  invoiceCity: z.string().optional(),
  
  // Ekstra kontakt
  kitchenManagerName: z.string().optional(),
  kitchenManagerPhone: z.string().optional(),
  
  // Ekstra priser
  hourlyRateCooling: z.number().optional(),
  zone1Rate: z.number().optional(),
  zone2Rate: z.number().optional(),
  callOutFee: z.number().optional(),
  
  // Signatur
  signedBy: z.string().optional(),
  signedAt: z.string().datetime().optional(),
});
```

---

## Frontend: Agreements screens

### app/(dashboard)/agreements/index.tsx

```tsx
import { View, Text, FlatList, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, Button, Loading, StatCard } from '@myhrvold/ui';
import { trpc } from '../../../lib/api';
import { Plus, FileText, Calendar, DollarSign } from 'lucide-react-native';

export default function AgreementsScreen() {
  const router = useRouter();
  const { data: stats } = trpc.agreements.stats.useQuery();
  
  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-gradient-to-r from-primary to-primary/80 p-6">
        <Text className="text-white text-2xl font-bold">
          Vedlikeholdsavtaler
        </Text>
      </View>

      {/* Stats */}
      <View className="flex-row flex-wrap p-4 -mt-4">
        <StatCard
          title="Totalt"
          value={stats?.totalAgreements || 0}
          icon={FileText}
          className="w-1/2 pr-2"
        />
        <StatCard
          title="Aktive"
          value={stats?.activeAgreements || 0}
          icon={Calendar}
          color="green"
          className="w-1/2 pl-2"
        />
        <StatCard
          title="Utløper snart"
          value={stats?.expiringThisMonth || 0}
          icon={Calendar}
          color="orange"
          className="w-1/2 pr-2 mt-2"
        />
        <StatCard
          title="Årsverdi"
          value={`${(stats?.totalYearlyValue || 0).toLocaleString()} kr`}
          icon={DollarSign}
          color="teal"
          className="w-1/2 pl-2 mt-2"
        />
      </View>

      {/* Tabs */}
      <View className="flex-row px-4 mb-4">
        <Button
          variant="primary"
          onPress={() => router.push('/agreements/dagligvare')}
          className="flex-1 mr-2"
        >
          Dagligvare
        </Button>
        <Button
          variant="outline"
          onPress={() => router.push('/agreements/storkjokken')}
          className="flex-1"
        >
          Storkjøkken
        </Button>
      </View>
    </View>
  );
}
```

---

### app/(dashboard)/agreements/dagligvare/index.tsx

```tsx
import { useState } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, Button, Input, Loading } from '@myhrvold/ui';
import { trpc } from '../../../../lib/api';
import { Plus, Search, Edit2 } from 'lucide-react-native';
import { AgreementCard } from '../../../../features/agreements/components/AgreementCard';
import { AgreementEditModal } from '../../../../features/agreements/components/AgreementEditModal';

export default function DagligvareAgreementsScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data, isLoading, refetch } = trpc.agreements.maintenance.list.useQuery({
    search,
    status: 'active',
  });

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-gradient-to-r from-primary to-primary/80 p-6">
        <Text className="text-white text-2xl font-bold">
          Dagligvare-avtaler
        </Text>
        <View className="flex-row mt-4">
          <View className="flex-1 flex-row items-center bg-white/10 rounded-lg px-3 mr-2">
            <Search size={20} color="white" />
            <Input
              value={search}
              onChangeText={setSearch}
              placeholder="Søk avtale..."
              placeholderTextColor="rgba(255,255,255,0.6)"
              className="flex-1 border-0 text-white"
            />
          </View>
          <Button onPress={() => router.push('/agreements/dagligvare/new')}>
            <Plus size={20} />
          </Button>
        </View>
      </View>

      {isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          contentContainerClassName="p-4"
          renderItem={({ item }) => (
            <AgreementCard
              agreement={item}
              onEdit={() => setEditingId(item.id)}
              onPress={() => router.push(`/agreements/dagligvare/${item.id}`)}
            />
          )}
          ListEmptyComponent={
            <Text className="text-gray-400 text-center py-8">
              Ingen avtaler funnet
            </Text>
          }
        />
      )}

      {/* Edit Modal */}
      <AgreementEditModal
        visible={!!editingId}
        agreementId={editingId}
        type="maintenance"
        onClose={() => {
          setEditingId(null);
          refetch();
        }}
      />
    </View>
  );
}
```

---

### features/agreements/components/AgreementCard.tsx

```tsx
import { View, Text, Pressable } from 'react-native';
import { Card } from '@myhrvold/ui';
import { Calendar, MapPin, Clock, Edit2 } from 'lucide-react-native';

interface AgreementCardProps {
  agreement: {
    id: string;
    agreementNumber: string;
    customerName: string;
    status: string;
    validFrom: string;
    validTo: string;
    visitsPerYear: number;
    pricePerYear: number;
  };
  onEdit: () => void;
  onPress: () => void;
}

export function AgreementCard({ agreement, onEdit, onPress }: AgreementCardProps) {
  const isExpiring = new Date(agreement.validTo) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  
  return (
    <Pressable onPress={onPress}>
      <Card className="mb-3">
        <View className="flex-row justify-between items-start mb-2">
          <View>
            <Text className="text-teal-600 font-mono text-sm">
              {agreement.agreementNumber}
            </Text>
            <Text className="font-semibold text-primary text-lg">
              {agreement.customerName}
            </Text>
          </View>
          <View className="flex-row items-center">
            <View className={`px-2 py-1 rounded ${
              isExpiring ? 'bg-orange-100' : 'bg-green-100'
            }`}>
              <Text className={`text-xs font-medium ${
                isExpiring ? 'text-orange-700' : 'text-green-700'
              }`}>
                {isExpiring ? 'Forfalt' : 'Aktiv'}
              </Text>
            </View>
            <Pressable onPress={onEdit} className="ml-2 p-2">
              <Edit2 size={16} color="#0d9488" />
            </Pressable>
          </View>
        </View>
        
        <View className="flex-row mt-2">
          <View className="flex-row items-center mr-4">
            <Calendar size={14} color="#666" />
            <Text className="text-gray-500 text-sm ml-1">
              {new Date(agreement.validTo).toLocaleDateString('nb-NO')}
            </Text>
          </View>
          <View className="flex-row items-center mr-4">
            <Clock size={14} color="#666" />
            <Text className="text-gray-500 text-sm ml-1">
              {agreement.visitsPerYear} besøk/år
            </Text>
          </View>
        </View>
        
        <View className="flex-row justify-between mt-3 pt-3 border-t border-gray-100">
          <Text className="text-gray-500">Årspris</Text>
          <Text className="font-semibold text-primary">
            {agreement.pricePerYear.toLocaleString()} kr
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}
```

---

### features/agreements/components/AgreementEditModal.tsx

```tsx
import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Modal, Pressable } from 'react-native';
import { Input, Button, Card } from '@myhrvold/ui';
import { trpc } from '../../../lib/api';
import { X } from 'lucide-react-native';

// ... (full modal implementation med alle felt)
// Se bilde 4 i skjermbildene for layout
```

---

## Sjekkliste

- [ ] agreements.router.ts med maintenance og storkjokken sub-routers
- [ ] agreements.service.ts med CRUD og stats
- [ ] agreements.repo.ts med database-queries
- [ ] agreements.schema.ts med Zod validering
- [ ] Agreements hovedskjerm med stats
- [ ] Dagligvare liste med søk
- [ ] Storkjøkken liste med søk
- [ ] AgreementCard komponent
- [ ] AgreementEditModal komponent (som i skjermbildet)
- [ ] Opprett ny avtale skjerm
- [ ] Avtale-detaljer skjerm
