# FASE 18: Servicebesøk UI (Tekniker-app)

> Fase 1-17 må være fullført.
> Estimert tid: ~90 minutter.

## Mål

Bygg komplett tekniker-grensesnitt for servicebesøk med sjekklister, signatur og rapportering.

---

## Funksjonsoversikt

```
┌─────────────────────────────────────────────────────────────────┐
│  TEKNIKER-FLYT                                                   │
├─────────────────────────────────────────────────────────────────┤
│  1. Se dagens oppdrag (liste)                                   │
│  2. Åpne oppdrag → Se detaljer + historikk                      │
│  3. Start besøk → Timer starter                                 │
│  4. Utfør sjekkliste                                            │
│  5. Registrer deler brukt                                       │
│  6. Ta bilder                                                   │
│  7. Hent kundesignatur                                          │
│  8. Fullfør → Generer rapport                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Mappestruktur

```
apps/mobile/src/features/service/
├── components/
│   ├── VisitCard.tsx
│   ├── VisitTimer.tsx
│   ├── ChecklistItem.tsx
│   ├── PartsUsed.tsx
│   ├── SignatureCapture.tsx
│   └── VisitSummary.tsx
├── screens/
│   ├── TodayVisitsScreen.tsx
│   ├── VisitDetailScreen.tsx
│   ├── ActiveVisitScreen.tsx
│   └── VisitCompleteScreen.tsx
└── hooks/
    └── useActiveVisit.ts
```

---

## Backend: Service Visits Router

### apps/api/src/modules/service-visits/visits.router.ts

```typescript
import { z } from 'zod';
import { router, protectedProcedure } from '../../trpc/trpc';
import { VisitsService } from './visits.service';

export const visitsRouter = router({
  // Dagens besøk for tekniker
  today: protectedProcedure
    .input(z.object({
      technicianId: z.string().uuid().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const service = new VisitsService(ctx.db, ctx.log);
      const techId = input.technicianId || ctx.user?.id;
      return service.getTodayVisits(techId!);
    }),

  // Hent besøk med detaljer
  byId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const service = new VisitsService(ctx.db, ctx.log);
      return service.getById(input.id);
    }),

  // Start besøk
  start: protectedProcedure
    .input(z.object({ 
      visitId: z.string().uuid(),
      location: z.object({
        latitude: z.number(),
        longitude: z.number(),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new VisitsService(ctx.db, ctx.log);
      return service.startVisit(input.visitId, ctx.user!.id, input.location);
    }),

  // Oppdater sjekkliste
  updateChecklist: protectedProcedure
    .input(z.object({
      visitId: z.string().uuid(),
      itemId: z.string(),
      checked: z.boolean(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new VisitsService(ctx.db, ctx.log);
      return service.updateChecklistItem(input);
    }),

  // Legg til deler
  addPart: protectedProcedure
    .input(z.object({
      visitId: z.string().uuid(),
      partNumber: z.string(),
      partName: z.string(),
      quantity: z.number().min(1),
      unitPrice: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new VisitsService(ctx.db, ctx.log);
      return service.addPartUsed(input);
    }),

  // Fullfør besøk
  complete: protectedProcedure
    .input(z.object({
      visitId: z.string().uuid(),
      workDescription: z.string(),
      customerSignature: z.string(), // base64
      technicianNotes: z.string().optional(),
      nextServiceRecommendation: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const service = new VisitsService(ctx.db, ctx.log);
      return service.completeVisit(input, ctx.user!.id);
    }),

  // Historikk for lokasjon
  historyByLocation: protectedProcedure
    .input(z.object({
      customerId: z.string().uuid(),
      limit: z.number().default(10),
    }))
    .query(async ({ ctx, input }) => {
      const service = new VisitsService(ctx.db, ctx.log);
      return service.getLocationHistory(input.customerId, input.limit);
    }),
});

export type VisitsRouter = typeof visitsRouter;
```

---

## Active Visit Hook

### src/features/service/hooks/useActiveVisit.ts

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ActiveVisitState {
  visitId: string | null;
  startTime: Date | null;
  elapsedSeconds: number;
  isRunning: boolean;
  checklist: Record<string, boolean>;
  partsUsed: Array<{
    partNumber: string;
    partName: string;
    quantity: number;
  }>;
  photos: string[];

  // Actions
  startVisit: (visitId: string) => void;
  stopVisit: () => void;
  updateElapsed: (seconds: number) => void;
  toggleChecklistItem: (itemId: string) => void;
  addPart: (part: { partNumber: string; partName: string; quantity: number }) => void;
  removePart: (index: number) => void;
  addPhoto: (uri: string) => void;
  removePhoto: (index: number) => void;
  reset: () => void;
}

export const useActiveVisitStore = create<ActiveVisitState>()(
  persist(
    (set, get) => ({
      visitId: null,
      startTime: null,
      elapsedSeconds: 0,
      isRunning: false,
      checklist: {},
      partsUsed: [],
      photos: [],

      startVisit: (visitId) => set({
        visitId,
        startTime: new Date(),
        elapsedSeconds: 0,
        isRunning: true,
        checklist: {},
        partsUsed: [],
        photos: [],
      }),

      stopVisit: () => set({ isRunning: false }),

      updateElapsed: (seconds) => set({ elapsedSeconds: seconds }),

      toggleChecklistItem: (itemId) => set((state) => ({
        checklist: {
          ...state.checklist,
          [itemId]: !state.checklist[itemId],
        },
      })),

      addPart: (part) => set((state) => ({
        partsUsed: [...state.partsUsed, part],
      })),

      removePart: (index) => set((state) => ({
        partsUsed: state.partsUsed.filter((_, i) => i !== index),
      })),

      addPhoto: (uri) => set((state) => ({
        photos: [...state.photos, uri],
      })),

      removePhoto: (index) => set((state) => ({
        photos: state.photos.filter((_, i) => i !== index),
      })),

      reset: () => set({
        visitId: null,
        startTime: null,
        elapsedSeconds: 0,
        isRunning: false,
        checklist: {},
        partsUsed: [],
        photos: [],
      }),
    }),
    {
      name: 'active-visit',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
```

---

## Components

### src/features/service/components/VisitTimer.tsx

```tsx
import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Clock } from 'lucide-react-native';
import { useActiveVisitStore } from '../hooks/useActiveVisit';

export function VisitTimer() {
  const { startTime, isRunning, elapsedSeconds, updateElapsed } = useActiveVisitStore();
  const [displayTime, setDisplayTime] = useState('00:00:00');

  useEffect(() => {
    if (!isRunning || !startTime) return;

    const interval = setInterval(() => {
      const now = new Date();
      const start = new Date(startTime);
      const elapsed = Math.floor((now.getTime() - start.getTime()) / 1000);
      updateElapsed(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, startTime]);

  useEffect(() => {
    const hours = Math.floor(elapsedSeconds / 3600);
    const minutes = Math.floor((elapsedSeconds % 3600) / 60);
    const seconds = elapsedSeconds % 60;
    
    setDisplayTime(
      `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    );
  }, [elapsedSeconds]);

  return (
    <View className="bg-primary rounded-xl p-4 flex-row items-center justify-center">
      <Clock size={24} color="white" />
      <Text className="text-white text-3xl font-mono font-bold ml-3">
        {displayTime}
      </Text>
    </View>
  );
}
```

---

### src/features/service/components/ChecklistItem.tsx

```tsx
import { View, Text, Pressable, TextInput } from 'react-native';
import { useState } from 'react';
import { Check, Square, ChevronDown, ChevronUp } from 'lucide-react-native';

interface ChecklistItemProps {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onToggle: () => void;
  onAddNote?: (note: string) => void;
}

export function ChecklistItem({ 
  id, 
  label, 
  description, 
  checked, 
  onToggle,
  onAddNote 
}: ChecklistItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState('');

  return (
    <View className="bg-white rounded-lg border border-gray-100 mb-2 overflow-hidden">
      <Pressable
        onPress={onToggle}
        className="flex-row items-center p-4"
      >
        <View className={`w-6 h-6 rounded items-center justify-center ${
          checked ? 'bg-green-500' : 'border-2 border-gray-300'
        }`}>
          {checked && <Check size={16} color="white" />}
        </View>
        
        <View className="flex-1 ml-3">
          <Text className={`font-medium ${checked ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
            {label}
          </Text>
          {description && (
            <Text className="text-gray-500 text-sm mt-0.5">{description}</Text>
          )}
        </View>

        <Pressable onPress={() => setExpanded(!expanded)} className="p-2">
          {expanded ? (
            <ChevronUp size={20} color="#6b7280" />
          ) : (
            <ChevronDown size={20} color="#6b7280" />
          )}
        </Pressable>
      </Pressable>

      {expanded && (
        <View className="px-4 pb-4 border-t border-gray-100 pt-3">
          <Text className="text-sm text-gray-500 mb-2">Notat</Text>
          <TextInput
            className="bg-gray-50 rounded-lg p-3 text-gray-900"
            placeholder="Legg til notat..."
            value={note}
            onChangeText={setNote}
            onBlur={() => onAddNote?.(note)}
            multiline
          />
        </View>
      )}
    </View>
  );
}
```

---

### src/features/service/components/SignatureCapture.tsx

```tsx
import { useRef, useState } from 'react';
import { View, Text, Pressable, Modal } from 'react-native';
import SignatureScreen, { SignatureViewRef } from 'react-native-signature-canvas';
import { Pen, X, Check, RotateCcw } from 'lucide-react-native';

interface SignatureCaptureProps {
  onCapture: (signature: string) => void;
  customerName?: string;
}

export function SignatureCapture({ onCapture, customerName }: SignatureCaptureProps) {
  const [visible, setVisible] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const signatureRef = useRef<SignatureViewRef>(null);

  const handleOK = (sig: string) => {
    setSignature(sig);
  };

  const handleClear = () => {
    signatureRef.current?.clearSignature();
  };

  const handleConfirm = () => {
    if (signature) {
      onCapture(signature);
      setVisible(false);
    }
  };

  return (
    <>
      <Pressable
        onPress={() => setVisible(true)}
        className="bg-white border-2 border-dashed border-gray-300 rounded-xl p-6 items-center"
      >
        {signature ? (
          <View className="items-center">
            <Check size={32} color="#22c55e" />
            <Text className="text-green-600 font-medium mt-2">Signatur hentet</Text>
          </View>
        ) : (
          <View className="items-center">
            <Pen size={32} color="#6b7280" />
            <Text className="text-gray-500 mt-2">Trykk for å hente signatur</Text>
          </View>
        )}
      </Pressable>

      <Modal visible={visible} animationType="slide">
        <View className="flex-1 bg-white">
          {/* Header */}
          <View className="bg-primary pt-12 pb-4 px-4 flex-row items-center justify-between">
            <Pressable onPress={() => setVisible(false)}>
              <X size={24} color="white" />
            </Pressable>
            <Text className="text-white text-lg font-semibold">Kundesignatur</Text>
            <View style={{ width: 24 }} />
          </View>

          {/* Instructions */}
          <View className="p-4 bg-blue-50">
            <Text className="text-blue-700 text-center">
              {customerName ? `${customerName}, vennligst signer under` : 'Vennligst signer under'}
            </Text>
          </View>

          {/* Signature area */}
          <View className="flex-1 m-4 border-2 border-gray-200 rounded-xl overflow-hidden">
            <SignatureScreen
              ref={signatureRef}
              onOK={handleOK}
              onEmpty={() => setSignature(null)}
              autoClear={false}
              descriptionText=""
              webStyle={`
                .m-signature-pad { box-shadow: none; border: none; }
                .m-signature-pad--body { border: none; }
                .m-signature-pad--footer { display: none; }
              `}
            />
          </View>

          {/* Actions */}
          <View className="flex-row gap-3 p-4">
            <Pressable
              onPress={handleClear}
              className="flex-1 flex-row items-center justify-center py-4 rounded-xl border border-gray-200"
            >
              <RotateCcw size={20} color="#374151" />
              <Text className="ml-2 font-semibold text-gray-700">Nullstill</Text>
            </Pressable>
            <Pressable
              onPress={handleConfirm}
              disabled={!signature}
              className={`flex-1 flex-row items-center justify-center py-4 rounded-xl ${
                signature ? 'bg-accent' : 'bg-gray-200'
              }`}
            >
              <Check size={20} color={signature ? 'white' : '#9ca3af'} />
              <Text className={`ml-2 font-semibold ${signature ? 'text-white' : 'text-gray-400'}`}>
                Bekreft
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}
```

---

## Screens

### src/features/service/screens/TodayVisitsScreen.tsx

```tsx
import { View, Text, FlatList, RefreshControl, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { trpc } from '../../../lib/api';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { ErrorView } from '../../../components/ErrorView';
import { VisitCard } from '../components/VisitCard';
import { useActiveVisitStore } from '../hooks/useActiveVisit';
import { Calendar, Clock, MapPin, AlertCircle } from 'lucide-react-native';

export function TodayVisitsScreen() {
  const router = useRouter();
  const { visitId: activeVisitId } = useActiveVisitStore();

  const { data: visits, isLoading, error, refetch, isRefetching } = 
    trpc.visits.today.useQuery({});

  if (isLoading) return <LoadingScreen />;
  if (error) return <ErrorView error={error} onRetry={refetch} />;

  const today = new Date().toLocaleDateString('nb-NO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const completedCount = visits?.filter(v => v.status === 'completed').length || 0;
  const totalCount = visits?.length || 0;

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-primary pt-12 pb-6 px-4">
        <Text className="text-white/70 text-sm">I dag</Text>
        <Text className="text-white text-2xl font-bold capitalize">{today}</Text>
        
        {/* Progress */}
        <View className="mt-4 bg-white/10 rounded-lg p-3 flex-row items-center">
          <View className="flex-1">
            <Text className="text-white/70 text-sm">Oppdrag</Text>
            <Text className="text-white text-xl font-bold">
              {completedCount} / {totalCount}
            </Text>
          </View>
          <View className="w-24 h-2 bg-white/20 rounded-full overflow-hidden">
            <View 
              className="h-full bg-accent rounded-full"
              style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
            />
          </View>
        </View>
      </View>

      {/* Active visit banner */}
      {activeVisitId && (
        <Pressable
          onPress={() => router.push(`/service/active`)}
          className="mx-4 mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex-row items-center"
        >
          <Clock size={20} color="#f59e0b" />
          <Text className="ml-2 text-yellow-700 flex-1 font-medium">
            Du har et aktivt besøk
          </Text>
          <Text className="text-yellow-600 text-sm">Fortsett →</Text>
        </Pressable>
      )}

      {/* Visit list */}
      <FlatList
        data={visits}
        renderItem={({ item }) => (
          <VisitCard 
            visit={item} 
            isActive={item.id === activeVisitId}
            onPress={() => router.push(`/service/${item.id}`)}
          />
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor="#003366"
          />
        }
        ListEmptyComponent={
          <View className="items-center py-12">
            <Calendar size={48} color="#9ca3af" />
            <Text className="text-gray-500 mt-4 text-center">
              Ingen besøk planlagt i dag
            </Text>
          </View>
        }
      />
    </View>
  );
}
```

---

### src/features/service/screens/ActiveVisitScreen.tsx

```tsx
import { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { trpc } from '../../../lib/api';
import { useActiveVisitStore } from '../hooks/useActiveVisit';
import { VisitTimer } from '../components/VisitTimer';
import { ChecklistItem } from '../components/ChecklistItem';
import { SignatureCapture } from '../components/SignatureCapture';
import { LoadingScreen } from '../../../components/LoadingScreen';
import * as ImagePicker from 'expo-image-picker';
import { 
  ArrowLeft, CheckSquare, Package, Camera, Image, 
  Pen, Send, X, Plus 
} from 'lucide-react-native';

export function ActiveVisitScreen() {
  const router = useRouter();
  const { 
    visitId, checklist, partsUsed, photos,
    toggleChecklistItem, addPart, removePart, addPhoto, removePhoto, reset 
  } = useActiveVisitStore();

  const [workDescription, setWorkDescription] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const [showAddPart, setShowAddPart] = useState(false);

  const { data: visit, isLoading } = trpc.visits.byId.useQuery(
    { id: visitId! },
    { enabled: !!visitId }
  );

  const completeMutation = trpc.visits.complete.useMutation({
    onSuccess: () => {
      reset();
      Alert.alert('Fullført', 'Besøket er registrert', [
        { text: 'OK', onPress: () => router.replace('/service') }
      ]);
    },
    onError: (err) => {
      Alert.alert('Feil', err.message);
    },
  });

  if (isLoading) return <LoadingScreen />;
  if (!visit) return null;

  const handleTakePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    
    if (!result.canceled) {
      addPhoto(result.assets[0].uri);
    }
  };

  const handleComplete = () => {
    if (!workDescription.trim()) {
      Alert.alert('Mangler beskrivelse', 'Du må beskrive utført arbeid');
      return;
    }
    if (!signature) {
      Alert.alert('Mangler signatur', 'Du må hente kundesignatur');
      return;
    }

    completeMutation.mutate({
      visitId: visitId!,
      workDescription,
      customerSignature: signature,
    });
  };

  const defaultChecklist = [
    { id: '1', label: 'Visuell inspeksjon', description: 'Sjekk for synlige skader' },
    { id: '2', label: 'Rengjøring', description: 'Rengjør filter og komponenter' },
    { id: '3', label: 'Funksjonstest', description: 'Verifiser normal drift' },
    { id: '4', label: 'Temperaturmåling', description: 'Kontroller temperaturer' },
    { id: '5', label: 'Sikkerhetskontroll', description: 'Sjekk sikkerhetssystemer' },
  ];

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-primary pt-12 pb-4 px-4">
        <View className="flex-row items-center justify-between mb-4">
          <Pressable onPress={() => router.back()}>
            <ArrowLeft size={24} color="white" />
          </Pressable>
          <Text className="text-white text-lg font-semibold">
            {visit.customer?.name}
          </Text>
          <View style={{ width: 24 }} />
        </View>
        <VisitTimer />
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
        {/* Checklist */}
        <View className="mb-6">
          <View className="flex-row items-center mb-3">
            <CheckSquare size={20} color="#003366" />
            <Text className="ml-2 text-lg font-semibold text-gray-900">Sjekkliste</Text>
          </View>
          {defaultChecklist.map((item) => (
            <ChecklistItem
              key={item.id}
              {...item}
              checked={checklist[item.id] || false}
              onToggle={() => toggleChecklistItem(item.id)}
            />
          ))}
        </View>

        {/* Parts used */}
        <View className="mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center">
              <Package size={20} color="#003366" />
              <Text className="ml-2 text-lg font-semibold text-gray-900">Deler brukt</Text>
            </View>
            <Pressable 
              onPress={() => setShowAddPart(true)}
              className="bg-primary/10 px-3 py-1 rounded-lg"
            >
              <Text className="text-primary font-medium">+ Legg til</Text>
            </Pressable>
          </View>
          
          {partsUsed.length === 0 ? (
            <View className="bg-gray-100 rounded-lg p-4 items-center">
              <Text className="text-gray-500">Ingen deler registrert</Text>
            </View>
          ) : (
            partsUsed.map((part, index) => (
              <View 
                key={index}
                className="bg-white rounded-lg p-3 mb-2 flex-row items-center"
              >
                <View className="flex-1">
                  <Text className="font-medium">{part.partName}</Text>
                  <Text className="text-gray-500 text-sm">{part.partNumber}</Text>
                </View>
                <Text className="text-gray-700 mr-3">x{part.quantity}</Text>
                <Pressable onPress={() => removePart(index)}>
                  <X size={18} color="#ef4444" />
                </Pressable>
              </View>
            ))
          )}
        </View>

        {/* Photos */}
        <View className="mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center">
              <Camera size={20} color="#003366" />
              <Text className="ml-2 text-lg font-semibold text-gray-900">
                Bilder ({photos.length})
              </Text>
            </View>
            <Pressable 
              onPress={handleTakePhoto}
              className="bg-primary px-4 py-2 rounded-lg flex-row items-center"
            >
              <Camera size={16} color="white" />
              <Text className="text-white font-medium ml-1">Ta bilde</Text>
            </Pressable>
          </View>
          
          {photos.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-2">
                {photos.map((uri, index) => (
                  <View key={index} className="relative">
                    <Image source={{ uri }} className="w-20 h-20 rounded-lg" />
                    <Pressable
                      onPress={() => removePhoto(index)}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full items-center justify-center"
                    >
                      <X size={12} color="white" />
                    </Pressable>
                  </View>
                ))}
              </View>
            </ScrollView>
          )}
        </View>

        {/* Work description */}
        <View className="mb-6">
          <View className="flex-row items-center mb-3">
            <Pen size={20} color="#003366" />
            <Text className="ml-2 text-lg font-semibold text-gray-900">
              Utført arbeid
            </Text>
          </View>
          <TextInput
            className="bg-white border border-gray-200 rounded-xl p-4 min-h-[120px] text-gray-900"
            placeholder="Beskriv utført arbeid..."
            value={workDescription}
            onChangeText={setWorkDescription}
            multiline
            textAlignVertical="top"
          />
        </View>

        {/* Signature */}
        <View className="mb-6">
          <View className="flex-row items-center mb-3">
            <Pen size={20} color="#003366" />
            <Text className="ml-2 text-lg font-semibold text-gray-900">
              Kundesignatur
            </Text>
          </View>
          <SignatureCapture 
            onCapture={setSignature}
            customerName={visit.customer?.contactName}
          />
        </View>
      </ScrollView>

      {/* Complete button */}
      <View className="p-4 bg-white border-t border-gray-100">
        <Pressable
          onPress={handleComplete}
          disabled={completeMutation.isPending}
          className={`flex-row items-center justify-center py-4 rounded-xl ${
            completeMutation.isPending ? 'bg-gray-200' : 'bg-accent'
          }`}
        >
          <Send size={20} color={completeMutation.isPending ? '#9ca3af' : 'white'} />
          <Text className={`ml-2 font-semibold text-lg ${
            completeMutation.isPending ? 'text-gray-400' : 'text-white'
          }`}>
            {completeMutation.isPending ? 'Fullfører...' : 'Fullfør besøk'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
```

---

## Install Dependencies

```bash
npx expo install react-native-signature-canvas
pnpm --filter @myhrvold/mobile add @react-native-async-storage/async-storage
```

---

## Route Files

### apps/mobile/app/(dashboard)/service/index.tsx

```tsx
import { TodayVisitsScreen } from '../../../src/features/service/screens/TodayVisitsScreen';

export default function ServicePage() {
  return <TodayVisitsScreen />;
}
```

### apps/mobile/app/(dashboard)/service/active.tsx

```tsx
import { ActiveVisitScreen } from '../../../src/features/service/screens/ActiveVisitScreen';

export default function ActiveVisitPage() {
  return <ActiveVisitScreen />;
}
```

---

## Sjekkliste

- [ ] visits.router.ts med start/complete
- [ ] useActiveVisit hook med persist
- [ ] VisitTimer komponent
- [ ] ChecklistItem komponent
- [ ] SignatureCapture med modal
- [ ] TodayVisitsScreen
- [ ] ActiveVisitScreen med full flow
- [ ] Bilder og deler registrering
- [ ] Kundesignatur
- [ ] Fullfør-flyt

---

## Neste fase

Gå til **FASE 19: Push-varsler** for notifikasjoner.
