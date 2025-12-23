# FASE 18-20: Service Reports, Partners Map, Rental Machines

> **Stack**: Expo SDK 54, Expo Router v6, React Native, TypeScript

---

# FASE 18: Servicerapporter (~45 min)

## Mål

Bygg UI for teknikere til å fylle ut servicerapporter med signatur og bilder.

## Komponenter

```
features/service-reports/
├── components/
│   ├── ReportHeader.tsx
│   ├── EquipmentChecklist.tsx
│   ├── PartsUsed.tsx
│   ├── SignaturePad.tsx
│   ├── PhotoCapture.tsx
│   └── ReportSummary.tsx
├── screens/
│   └── ServiceReportScreen.tsx
└── hooks/
    └── useServiceReport.ts
```

## Del 1: Signature Pad

**Fil**: `features/service-reports/components/SignaturePad.tsx`

```typescript
import { View, Text, Pressable } from 'react-native';
import { useRef, useState } from 'react';
import SignatureCanvas from 'react-native-signature-canvas';
import { Trash2 } from 'lucide-react-native';

interface Props {
  label: string;
  value?: string;
  onChange: (signature: string) => void;
}

export function SignaturePad({ label, value, onChange }: Props) {
  const signatureRef = useRef<any>(null);
  const [hasSignature, setHasSignature] = useState(!!value);
  
  const handleClear = () => {
    signatureRef.current?.clearSignature();
    setHasSignature(false);
    onChange('');
  };
  
  const handleEnd = () => {
    signatureRef.current?.readSignature();
  };
  
  const handleOK = (signature: string) => {
    setHasSignature(true);
    onChange(signature);
  };
  
  return (
    <View className="mb-6">
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-sm font-medium text-gray-700">{label}</Text>
        {hasSignature && (
          <Pressable onPress={handleClear} className="flex-row items-center gap-1">
            <Trash2 size={14} color="#ef4444" />
            <Text className="text-sm text-red-500">Slett</Text>
          </Pressable>
        )}
      </View>
      
      <View className="h-40 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 overflow-hidden">
        <SignatureCanvas
          ref={signatureRef}
          onEnd={handleEnd}
          onOK={handleOK}
          webStyle={`
            .m-signature-pad { box-shadow: none; border: none; }
            .m-signature-pad--body { border: none; }
          `}
          autoClear={false}
          descriptionText=""
        />
      </View>
      
      {!hasSignature && (
        <Text className="text-xs text-gray-400 mt-1 text-center">
          Tegn signatur over
        </Text>
      )}
    </View>
  );
}
```

## Del 2: Equipment Checklist

**Fil**: `features/service-reports/components/EquipmentChecklist.tsx`

```typescript
import { View, Text, Pressable, TextInput } from 'react-native';
import { Check, AlertCircle, Wrench } from 'lucide-react-native';

interface Equipment {
  id: string;
  name: string;
  serialNumber?: string;
  status: 'ok' | 'needs_repair' | 'replaced';
  notes?: string;
}

interface Props {
  equipment: Equipment[];
  onChange: (equipment: Equipment[]) => void;
}

const STATUS_OPTIONS = [
  { value: 'ok', label: 'OK', icon: Check, color: 'bg-green-500' },
  { value: 'needs_repair', label: 'Trenger rep.', icon: AlertCircle, color: 'bg-amber-500' },
  { value: 'replaced', label: 'Byttet', icon: Wrench, color: 'bg-blue-500' },
];

export function EquipmentChecklist({ equipment, onChange }: Props) {
  const updateEquipment = (index: number, updates: Partial<Equipment>) => {
    const newEquipment = [...equipment];
    newEquipment[index] = { ...newEquipment[index], ...updates };
    onChange(newEquipment);
  };
  
  return (
    <View className="mb-6">
      <Text className="text-sm font-medium text-gray-700 mb-3">Utstyr sjekket</Text>
      
      {equipment.map((item, index) => (
        <View key={item.id} className="bg-gray-50 rounded-xl p-4 mb-3">
          <View className="flex-row items-center justify-between mb-3">
            <View>
              <Text className="font-medium text-gray-900">{item.name}</Text>
              {item.serialNumber && (
                <Text className="text-xs text-gray-500">S/N: {item.serialNumber}</Text>
              )}
            </View>
          </View>
          
          {/* Status buttons */}
          <View className="flex-row gap-2 mb-3">
            {STATUS_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const isSelected = item.status === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => updateEquipment(index, { status: opt.value as any })}
                  className={`flex-1 py-2 rounded-lg flex-row items-center justify-center gap-1 ${
                    isSelected ? opt.color : 'bg-gray-200'
                  }`}
                >
                  <Icon size={14} color={isSelected ? 'white' : '#6b7280'} />
                  <Text className={`text-xs font-medium ${
                    isSelected ? 'text-white' : 'text-gray-600'
                  }`}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>
          
          {/* Notes */}
          <TextInput
            value={item.notes || ''}
            onChangeText={(text) => updateEquipment(index, { notes: text })}
            placeholder="Notater..."
            className="h-10 px-3 bg-white rounded-lg text-sm"
          />
        </View>
      ))}
    </View>
  );
}
```

## Del 3: Service Report Screen

**Fil**: `features/service-reports/screens/ServiceReportScreen.tsx`

```typescript
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Send, Camera } from 'lucide-react-native';
import { trpc } from '../../../lib/api';
import { SignaturePad } from '../components/SignaturePad';
import { EquipmentChecklist } from '../components/EquipmentChecklist';
import { PhotoCapture } from '../components/PhotoCapture';

export function ServiceReportScreen() {
  const { visitId } = useLocalSearchParams<{ visitId: string }>();
  const router = useRouter();
  
  const [technicianSignature, setTechnicianSignature] = useState('');
  const [customerSignature, setCustomerSignature] = useState('');
  const [customerSignedBy, setCustomerSignedBy] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [equipment, setEquipment] = useState([
    { id: '1', name: 'Oppvaskmaskin', serialNumber: 'SN123', status: 'ok' as const },
    { id: '2', name: 'Kjøleskap', serialNumber: 'SN456', status: 'ok' as const },
  ]);
  const [workDescription, setWorkDescription] = useState('');
  
  const submitReport = trpc.serviceReports.submit.useMutation({
    onSuccess: () => {
      Alert.alert('Sendt!', 'Servicerapporten er lagret.');
      router.back();
    },
  });
  
  const handleSubmit = () => {
    if (!technicianSignature) {
      Alert.alert('Mangler signatur', 'Tekniker må signere.');
      return;
    }
    
    submitReport.mutate({
      plannedVisitId: visitId!,
      technicianSignature,
      customerSignature,
      customerSignedBy,
      photos,
      equipmentChecked: equipment,
      workDescription,
    });
  };
  
  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-accent-600 px-4 pt-12 pb-6">
        <View className="flex-row items-center gap-4">
          <Pressable onPress={() => router.back()}>
            <ArrowLeft size={24} color="white" />
          </Pressable>
          <View>
            <Text className="text-accent-100 text-sm">Servicerapport</Text>
            <Text className="text-white text-xl font-bold">BES-12345</Text>
          </View>
        </View>
      </View>
      
      <ScrollView className="flex-1 px-4 py-6">
        {/* Equipment */}
        <EquipmentChecklist equipment={equipment} onChange={setEquipment} />
        
        {/* Work description */}
        <View className="mb-6">
          <Text className="text-sm font-medium text-gray-700 mb-2">Utført arbeid</Text>
          <TextInput
            value={workDescription}
            onChangeText={setWorkDescription}
            placeholder="Beskriv utført arbeid..."
            multiline
            numberOfLines={4}
            className="h-28 px-4 py-3 bg-white rounded-xl text-base"
            textAlignVertical="top"
          />
        </View>
        
        {/* Photos */}
        <PhotoCapture photos={photos} onChange={setPhotos} />
        
        {/* Signatures */}
        <SignaturePad
          label="Tekniker signatur"
          value={technicianSignature}
          onChange={setTechnicianSignature}
        />
        
        <SignaturePad
          label="Kunde signatur"
          value={customerSignature}
          onChange={setCustomerSignature}
        />
        
        {customerSignature && (
          <View className="mb-6">
            <Text className="text-sm font-medium text-gray-700 mb-2">Signert av</Text>
            <TextInput
              value={customerSignedBy}
              onChangeText={setCustomerSignedBy}
              placeholder="Kundens navn"
              className="h-12 px-4 bg-white rounded-xl"
            />
          </View>
        )}
      </ScrollView>
      
      {/* Submit button */}
      <View className="px-4 py-4 bg-white border-t border-gray-100">
        <Pressable
          onPress={handleSubmit}
          disabled={submitReport.isPending}
          className="h-12 bg-accent-600 rounded-xl flex-row items-center justify-center gap-2"
        >
          <Send size={18} color="white" />
          <Text className="text-white font-semibold">
            {submitReport.isPending ? 'Sender...' : 'Fullfør og send'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
```

---

# FASE 19: Servicepartnere med kart (~60 min)

## Mål

Bygg kartvisning av servicepartnere med søk og filtrering.

## Dependencies

```bash
npx expo install react-native-maps
```

## Del 1: Partners Map Screen

**Fil**: `features/partners/screens/PartnersMapScreen.tsx`

```typescript
import { View, Text, Pressable, TextInput, FlatList } from 'react-native';
import { useState, useMemo } from 'react';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Search, List, Map, MapPin, Phone } from 'lucide-react-native';
import { trpc } from '../../../lib/api';

export function PartnersMapScreen() {
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [search, setSearch] = useState('');
  const [selectedPartner, setSelectedPartner] = useState<string | null>(null);
  
  const { data: partners } = trpc.partners.list.useQuery({});
  
  const filteredPartners = useMemo(() => {
    if (!search) return partners || [];
    const lower = search.toLowerCase();
    return (partners || []).filter(p => 
      p.companyName.toLowerCase().includes(lower) ||
      p.city?.toLowerCase().includes(lower)
    );
  }, [partners, search]);
  
  // Initial region (Norway)
  const initialRegion = {
    latitude: 59.9139,
    longitude: 10.7522,
    latitudeDelta: 5,
    longitudeDelta: 5,
  };
  
  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-primary-800 px-4 pt-12 pb-4">
        <Text className="text-white text-2xl font-bold mb-4">Servicepartnere</Text>
        
        {/* Search */}
        <View className="flex-row items-center bg-primary-700 rounded-xl px-4 h-11">
          <Search size={18} color="#94a3b8" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Søk partner eller by..."
            placeholderTextColor="#94a3b8"
            className="flex-1 ml-3 text-white"
          />
        </View>
        
        {/* View toggle */}
        <View className="flex-row mt-3 bg-primary-700 rounded-lg p-1">
          <Pressable
            onPress={() => setViewMode('map')}
            className={`flex-1 py-2 rounded-md flex-row items-center justify-center gap-2 ${
              viewMode === 'map' ? 'bg-white' : ''
            }`}
          >
            <Map size={16} color={viewMode === 'map' ? '#003366' : '#94a3b8'} />
            <Text className={viewMode === 'map' ? 'text-primary-800 font-medium' : 'text-gray-400'}>
              Kart
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setViewMode('list')}
            className={`flex-1 py-2 rounded-md flex-row items-center justify-center gap-2 ${
              viewMode === 'list' ? 'bg-white' : ''
            }`}
          >
            <List size={16} color={viewMode === 'list' ? '#003366' : '#94a3b8'} />
            <Text className={viewMode === 'list' ? 'text-primary-800 font-medium' : 'text-gray-400'}>
              Liste
            </Text>
          </Pressable>
        </View>
      </View>
      
      {viewMode === 'map' ? (
        <View className="flex-1">
          <MapView
            provider={PROVIDER_GOOGLE}
            style={{ flex: 1 }}
            initialRegion={initialRegion}
          >
            {filteredPartners.map((partner) => (
              partner.latitude && partner.longitude && (
                <Marker
                  key={partner.id}
                  coordinate={{
                    latitude: parseFloat(partner.latitude),
                    longitude: parseFloat(partner.longitude),
                  }}
                  onPress={() => setSelectedPartner(partner.id)}
                >
                  <View className={`w-8 h-8 rounded-full items-center justify-center ${
                    selectedPartner === partner.id ? 'bg-accent-500' : 'bg-primary-700'
                  }`}>
                    <MapPin size={16} color="white" />
                  </View>
                </Marker>
              )
            ))}
          </MapView>
          
          {/* Selected partner card */}
          {selectedPartner && (
            <View className="absolute bottom-4 left-4 right-4">
              <PartnerCard 
                partner={filteredPartners.find(p => p.id === selectedPartner)!}
                onClose={() => setSelectedPartner(null)}
              />
            </View>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredPartners}
          keyExtractor={(item) => item.id}
          contentContainerClassName="p-4"
          renderItem={({ item }) => (
            <PartnerCard partner={item} />
          )}
        />
      )}
    </View>
  );
}

function PartnerCard({ partner, onClose }: { partner: any; onClose?: () => void }) {
  return (
    <View className="bg-white rounded-xl p-4 shadow-lg">
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <Text className="font-semibold text-gray-900">{partner.companyName}</Text>
          <Text className="text-sm text-gray-500">{partner.city}</Text>
        </View>
        <View className={`px-2 py-1 rounded-full ${
          partner.status === 'active' ? 'bg-green-100' : 'bg-gray-100'
        }`}>
          <Text className={`text-xs font-medium ${
            partner.status === 'active' ? 'text-green-700' : 'text-gray-600'
          }`}>
            {partner.status === 'active' ? 'Aktiv' : 'Inaktiv'}
          </Text>
        </View>
      </View>
      
      <View className="flex-row items-center gap-4 mt-3">
        {partner.phone && (
          <View className="flex-row items-center gap-1">
            <Phone size={14} color="#6b7280" />
            <Text className="text-sm text-gray-600">{partner.phone}</Text>
          </View>
        )}
        {partner.tradeArea && (
          <Text className="text-sm text-gray-600 capitalize">{partner.tradeArea}</Text>
        )}
      </View>
    </View>
  );
}
```

---

# FASE 20: Utlånsmaskiner (~45 min)

## Mål

Bygg UI for å administrere utlånsmaskiner med status og utlånshistorikk.

## Del 1: Rental Machines Screen

**Fil**: `features/rentals/screens/RentalMachinesScreen.tsx`

```typescript
import { View, Text, FlatList, Pressable, RefreshControl } from 'react-native';
import { useState } from 'react';
import { Plus, Package } from 'lucide-react-native';
import { trpc } from '../../../lib/api';
import { RentalMachineCard } from '../components/RentalMachineCard';
import { RentalFilters } from '../components/RentalFilters';

type StatusFilter = 'all' | 'available' | 'rented' | 'service';

export function RentalMachinesScreen() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  
  const { data: machines, isLoading, refetch } = trpc.rentals.list.useQuery({
    status: statusFilter === 'all' ? undefined : statusFilter,
  });
  
  const stats = {
    total: machines?.length || 0,
    available: machines?.filter(m => m.status === 'available').length || 0,
    rented: machines?.filter(m => m.status === 'rented').length || 0,
    service: machines?.filter(m => m.status === 'service').length || 0,
  };
  
  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-primary-800 px-4 pt-12 pb-6">
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <Text className="text-primary-200 text-sm">Service</Text>
            <Text className="text-white text-2xl font-bold">Utlånsmaskiner</Text>
          </View>
          <Pressable className="bg-accent-500 w-10 h-10 rounded-full items-center justify-center">
            <Plus size={24} color="white" />
          </Pressable>
        </View>
        
        {/* Stats */}
        <View className="flex-row gap-3">
          <StatBadge label="Totalt" value={stats.total} />
          <StatBadge label="Tilgjengelig" value={stats.available} color="bg-green-500" />
          <StatBadge label="Utlånt" value={stats.rented} color="bg-blue-500" />
          <StatBadge label="Service" value={stats.service} color="bg-amber-500" />
        </View>
      </View>
      
      {/* Filters */}
      <RentalFilters selected={statusFilter} onChange={setStatusFilter} />
      
      {/* List */}
      <FlatList
        data={machines || []}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperClassName="gap-3 px-4"
        contentContainerClassName="pb-20 pt-4"
        renderItem={({ item }) => (
          <RentalMachineCard machine={item} />
        )}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} />
        }
        ListEmptyComponent={
          <View className="items-center py-12">
            <Package size={48} color="#d1d5db" />
            <Text className="text-gray-400 mt-4">Ingen maskiner funnet</Text>
          </View>
        }
      />
    </View>
  );
}

function StatBadge({ label, value, color = 'bg-primary-600' }: { 
  label: string; 
  value: number; 
  color?: string;
}) {
  return (
    <View className={`${color} px-3 py-2 rounded-lg`}>
      <Text className="text-white/70 text-xs">{label}</Text>
      <Text className="text-white text-lg font-bold">{value}</Text>
    </View>
  );
}
```

## Del 2: Rental Machine Card

**Fil**: `features/rentals/components/RentalMachineCard.tsx`

```typescript
import { View, Text, Pressable, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { MapPin, Calendar } from 'lucide-react-native';

interface Props {
  machine: {
    id: string;
    name: string;
    model?: string;
    imageUrl?: string;
    status: string;
    condition: string;
    location?: string;
    currentRental?: {
      customerName: string;
      startDate: Date;
      expectedReturnDate: Date;
    };
  };
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  available: { bg: 'bg-green-100', text: 'text-green-700', label: 'Tilgjengelig' },
  rented: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Utlånt' },
  service: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Service' },
  damaged: { bg: 'bg-red-100', text: 'text-red-700', label: 'Skadet' },
};

export function RentalMachineCard({ machine }: Props) {
  const router = useRouter();
  const status = STATUS_STYLES[machine.status] || STATUS_STYLES.available;
  
  return (
    <Pressable
      onPress={() => router.push(`/rentals/${machine.id}`)}
      className="flex-1 bg-white rounded-xl shadow-sm overflow-hidden mb-3"
    >
      {/* Image */}
      {machine.imageUrl ? (
        <Image source={{ uri: machine.imageUrl }} className="h-32 w-full" />
      ) : (
        <View className="h-32 w-full bg-gray-100 items-center justify-center">
          <Text className="text-4xl">🔧</Text>
        </View>
      )}
      
      <View className="p-3">
        {/* Status */}
        <View className={`self-start px-2 py-0.5 rounded-full mb-2 ${status.bg}`}>
          <Text className={`text-xs font-medium ${status.text}`}>{status.label}</Text>
        </View>
        
        {/* Name */}
        <Text className="font-semibold text-gray-900" numberOfLines={1}>
          {machine.name}
        </Text>
        {machine.model && (
          <Text className="text-xs text-gray-500">{machine.model}</Text>
        )}
        
        {/* Location or rental info */}
        {machine.status === 'rented' && machine.currentRental ? (
          <View className="mt-2">
            <Text className="text-xs text-gray-600" numberOfLines={1}>
              {machine.currentRental.customerName}
            </Text>
          </View>
        ) : machine.location ? (
          <View className="flex-row items-center gap-1 mt-2">
            <MapPin size={12} color="#6b7280" />
            <Text className="text-xs text-gray-500">{machine.location}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}
```

---

## Alle routes

```typescript
// app/(dashboard)/service-reports/[visitId].tsx
import { ServiceReportScreen } from '../../../features/service-reports/screens/ServiceReportScreen';
export default function ServiceReportPage() {
  return <ServiceReportScreen />;
}

// app/(dashboard)/partners/index.tsx
import { PartnersMapScreen } from '../../../features/partners/screens/PartnersMapScreen';
export default function PartnersPage() {
  return <PartnersMapScreen />;
}

// app/(dashboard)/rentals/index.tsx
import { RentalMachinesScreen } from '../../../features/rentals/screens/RentalMachinesScreen';
export default function RentalsPage() {
  return <RentalMachinesScreen />;
}
```

---

## Sjekkliste for alle tre faser

### FASE 18
- [ ] SignaturePad med react-native-signature-canvas
- [ ] EquipmentChecklist
- [ ] PhotoCapture
- [ ] ServiceReportScreen
- [ ] API endpoint for submit

### FASE 19
- [ ] react-native-maps installert
- [ ] PartnersMapScreen med MapView
- [ ] Markers for partnere
- [ ] Partner card ved klikk
- [ ] Liste-visning alternativ

### FASE 20
- [ ] RentalMachinesScreen
- [ ] Stats (tilgjengelig/utlånt/service)
- [ ] RentalMachineCard
- [ ] Filters
- [ ] Detalj-side
