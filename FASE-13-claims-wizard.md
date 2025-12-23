# FASE 13: Claims Wizard (5-trinns opprettelse)

> Fase 1-12 må være fullført.
> Estimert tid: ~90 minutter.

## Mål

Bygg 5-trinns wizard for reklamasjonsopprettelse med validering per steg.

---

## Wizard-oversikt

```
┌─────────────────────────────────────────────────────────────────┐
│  STEG 1: Leverandør                                              │
│  ├── Søk/velg leverandør                                        │
│  └── Vis leverandørens garantibetingelser                       │
├─────────────────────────────────────────────────────────────────┤
│  STEG 2: Produkt                                                 │
│  ├── Søk i produktkatalog ELLER                                 │
│  └── Fritekst produktnavn + serienummer                         │
├─────────────────────────────────────────────────────────────────┤
│  STEG 3: Kunde                                                   │
│  ├── Søk eksisterende kunde ELLER                               │
│  └── Manuell input (firma, kontakt, adresse)                    │
├─────────────────────────────────────────────────────────────────┤
│  STEG 4: Problem                                                 │
│  ├── Kategori (elektrisk, mekanisk, osv)                        │
│  ├── Prioritet                                                  │
│  ├── Beskrivelse (tekst)                                        │
│  └── Bilder (kamera/galleri)                                    │
├─────────────────────────────────────────────────────────────────┤
│  STEG 5: Oppsummering                                            │
│  ├── Vis all info                                               │
│  ├── Rediger-knapper per seksjon                                │
│  └── Send inn                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Mappestruktur

```
apps/mobile/src/features/claims/
├── wizard/
│   ├── ClaimsWizard.tsx           # Hovedcontainer
│   ├── WizardProgress.tsx         # Progress indicator
│   ├── steps/
│   │   ├── Step1Supplier.tsx
│   │   ├── Step2Product.tsx
│   │   ├── Step3Customer.tsx
│   │   ├── Step4Problem.tsx
│   │   └── Step5Summary.tsx
│   └── hooks/
│       └── useWizardForm.ts
```

---

## Wizard State (Zustand)

### src/features/claims/wizard/hooks/useWizardForm.ts

```typescript
import { create } from 'zustand';

export interface WizardFormData {
  // Steg 1: Leverandør
  supplierId: string | null;
  supplierName: string;
  
  // Steg 2: Produkt
  productId: string | null;
  productNameText: string;
  serialNumber: string;
  purchaseDate: Date | null;
  invoiceNumber: string;
  
  // Steg 3: Kunde
  customerId: string | null;
  customerCompanyName: string;
  customerContactName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  customerPostalCode: string;
  customerCity: string;
  
  // Steg 4: Problem
  category: string;
  priority: string;
  problemDescription: string;
  photos: Array<{ uri: string; base64?: string }>;
}

interface WizardState {
  currentStep: number;
  formData: WizardFormData;
  completedSteps: Set<number>;
  
  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  updateFormData: (data: Partial<WizardFormData>) => void;
  markStepComplete: (step: number) => void;
  reset: () => void;
  canProceed: (step: number) => boolean;
}

const initialFormData: WizardFormData = {
  supplierId: null,
  supplierName: '',
  productId: null,
  productNameText: '',
  serialNumber: '',
  purchaseDate: null,
  invoiceNumber: '',
  customerId: null,
  customerCompanyName: '',
  customerContactName: '',
  customerEmail: '',
  customerPhone: '',
  customerAddress: '',
  customerPostalCode: '',
  customerCity: '',
  category: '',
  priority: 'medium',
  problemDescription: '',
  photos: [],
};

export const useWizardStore = create<WizardState>((set, get) => ({
  currentStep: 1,
  formData: initialFormData,
  completedSteps: new Set(),

  setStep: (step) => set({ currentStep: step }),
  
  nextStep: () => set((state) => ({ 
    currentStep: Math.min(state.currentStep + 1, 5) 
  })),
  
  prevStep: () => set((state) => ({ 
    currentStep: Math.max(state.currentStep - 1, 1) 
  })),

  updateFormData: (data) => set((state) => ({
    formData: { ...state.formData, ...data },
  })),

  markStepComplete: (step) => set((state) => ({
    completedSteps: new Set([...state.completedSteps, step]),
  })),

  reset: () => set({
    currentStep: 1,
    formData: initialFormData,
    completedSteps: new Set(),
  }),

  canProceed: (step) => {
    const { formData } = get();
    switch (step) {
      case 1:
        return !!formData.supplierId;
      case 2:
        return !!formData.productNameText;
      case 3:
        return !!formData.customerCompanyName;
      case 4:
        return !!formData.problemDescription && !!formData.category;
      default:
        return true;
    }
  },
}));
```

---

## Progress Indicator

### src/features/claims/wizard/WizardProgress.tsx

```tsx
import { View, Text, Pressable } from 'react-native';
import { Check } from 'lucide-react-native';

interface WizardProgressProps {
  currentStep: number;
  completedSteps: Set<number>;
  onStepPress: (step: number) => void;
}

const STEPS = [
  { number: 1, label: 'Leverandør' },
  { number: 2, label: 'Produkt' },
  { number: 3, label: 'Kunde' },
  { number: 4, label: 'Problem' },
  { number: 5, label: 'Oppsummering' },
];

export function WizardProgress({ 
  currentStep, 
  completedSteps, 
  onStepPress 
}: WizardProgressProps) {
  return (
    <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-gray-100">
      {STEPS.map((step, index) => {
        const isActive = step.number === currentStep;
        const isCompleted = completedSteps.has(step.number);
        const canNavigate = isCompleted || step.number <= currentStep;

        return (
          <Pressable
            key={step.number}
            onPress={() => canNavigate && onStepPress(step.number)}
            className="items-center flex-1"
            disabled={!canNavigate}
          >
            {/* Connector line */}
            {index > 0 && (
              <View 
                className={`absolute left-0 right-1/2 top-4 h-0.5 -translate-y-1/2 ${
                  isCompleted || isActive ? 'bg-primary' : 'bg-gray-200'
                }`} 
              />
            )}
            
            {/* Circle */}
            <View
              className={`w-8 h-8 rounded-full items-center justify-center z-10 ${
                isActive
                  ? 'bg-primary'
                  : isCompleted
                  ? 'bg-green-500'
                  : 'bg-gray-200'
              }`}
            >
              {isCompleted ? (
                <Check size={16} color="white" />
              ) : (
                <Text
                  className={`text-sm font-bold ${
                    isActive ? 'text-white' : 'text-gray-500'
                  }`}
                >
                  {step.number}
                </Text>
              )}
            </View>
            
            {/* Label */}
            <Text
              className={`text-xs mt-1 ${
                isActive ? 'text-primary font-medium' : 'text-gray-500'
              }`}
              numberOfLines={1}
            >
              {step.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
```

---

## Step 1: Supplier Selection

### src/features/claims/wizard/steps/Step1Supplier.tsx

```tsx
import { useState } from 'react';
import { View, Text, TextInput, FlatList, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { trpc } from '../../../../lib/api';
import { useWizardStore } from '../hooks/useWizardForm';
import { Search, Building, Check, Clock, FileText } from 'lucide-react-native';

export function Step1Supplier() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const { formData, updateFormData, markStepComplete, nextStep } = useWizardStore();

  const { data: suppliers, isLoading } = trpc.suppliers.list.useQuery({
    search: search || undefined,
    limit: 20,
  });

  const selectSupplier = (supplier: any) => {
    updateFormData({
      supplierId: supplier.id,
      supplierName: supplier.name,
    });
    markStepComplete(1);
  };

  const handleNext = () => {
    if (formData.supplierId) {
      nextStep();
    }
  };

  return (
    <View className="flex-1">
      {/* Search */}
      <View className="px-4 py-3 bg-white border-b border-gray-100">
        <View className="flex-row items-center bg-gray-100 rounded-lg px-3 py-2">
          <Search size={20} color="#6b7280" />
          <TextInput
            className="flex-1 ml-2 text-gray-900"
            placeholder="Søk etter leverandør..."
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      {/* Selected supplier info */}
      {formData.supplierId && (
        <View className="mx-4 mt-4 p-4 bg-green-50 rounded-xl border border-green-200">
          <View className="flex-row items-center">
            <Check size={20} color="#22c55e" />
            <Text className="ml-2 text-green-700 font-medium">
              Valgt: {formData.supplierName}
            </Text>
          </View>
        </View>
      )}

      {/* Supplier list */}
      <FlatList
        data={suppliers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => selectSupplier(item)}
            className={`p-4 mb-3 rounded-xl border ${
              formData.supplierId === item.id
                ? 'bg-primary/5 border-primary'
                : 'bg-white border-gray-100'
            }`}
          >
            <View className="flex-row items-start">
              <View className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center">
                <Building size={20} color="#6b7280" />
              </View>
              <View className="flex-1 ml-3">
                <Text className="text-gray-900 font-semibold">{item.name}</Text>
                {item.shortCode && (
                  <Text className="text-gray-500 text-sm">{item.shortCode}</Text>
                )}
                
                {/* Warranty info */}
                <View className="flex-row mt-2 gap-3">
                  {item.warrantyMonths && (
                    <View className="flex-row items-center">
                      <Clock size={12} color="#6b7280" />
                      <Text className="text-xs text-gray-500 ml-1">
                        {item.warrantyMonths} mnd garanti
                      </Text>
                    </View>
                  )}
                  {item.claimPortalUrl && (
                    <View className="flex-row items-center">
                      <FileText size={12} color="#6b7280" />
                      <Text className="text-xs text-gray-500 ml-1">
                        Har portal
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              
              {formData.supplierId === item.id && (
                <Check size={20} color="#003366" />
              )}
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          <View className="items-center py-8">
            <Text className="text-gray-500">
              {isLoading ? 'Laster...' : 'Ingen leverandører funnet'}
            </Text>
          </View>
        }
      />

      {/* Next button */}
      <View className="p-4 bg-white border-t border-gray-100">
        <Pressable
          onPress={handleNext}
          disabled={!formData.supplierId}
          className={`py-4 rounded-xl items-center ${
            formData.supplierId ? 'bg-primary' : 'bg-gray-200'
          }`}
        >
          <Text className={`font-semibold ${
            formData.supplierId ? 'text-white' : 'text-gray-400'
          }`}>
            Neste: Produkt
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
```

---

## Step 2: Product

### src/features/claims/wizard/steps/Step2Product.tsx

```tsx
import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useWizardStore } from '../hooks/useWizardForm';
import { Package, Hash, Calendar, FileText } from 'lucide-react-native';

export function Step2Product() {
  const { t } = useTranslation();
  const { formData, updateFormData, markStepComplete, nextStep, prevStep } = useWizardStore();
  const [useManual, setUseManual] = useState(true);

  const handleNext = () => {
    if (formData.productNameText) {
      markStepComplete(2);
      nextStep();
    }
  };

  return (
    <View className="flex-1">
      <ScrollView className="flex-1 p-4">
        {/* Toggle */}
        <View className="flex-row bg-gray-100 rounded-lg p-1 mb-6">
          <Pressable
            onPress={() => setUseManual(false)}
            className={`flex-1 py-2 rounded-md ${!useManual ? 'bg-white shadow-sm' : ''}`}
          >
            <Text className={`text-center ${!useManual ? 'text-primary font-medium' : 'text-gray-500'}`}>
              Søk produkt
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setUseManual(true)}
            className={`flex-1 py-2 rounded-md ${useManual ? 'bg-white shadow-sm' : ''}`}
          >
            <Text className={`text-center ${useManual ? 'text-primary font-medium' : 'text-gray-500'}`}>
              Manuell
            </Text>
          </Pressable>
        </View>

        {useManual ? (
          <>
            {/* Product name */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-1">
                Produktnavn *
              </Text>
              <View className="flex-row items-center border border-gray-200 rounded-lg px-3 bg-white">
                <Package size={20} color="#6b7280" />
                <TextInput
                  className="flex-1 py-3 px-2 text-gray-900"
                  placeholder="F.eks. Rational SCC 101"
                  value={formData.productNameText}
                  onChangeText={(text) => updateFormData({ productNameText: text })}
                />
              </View>
            </View>

            {/* Serial number */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-1">
                Serienummer
              </Text>
              <View className="flex-row items-center border border-gray-200 rounded-lg px-3 bg-white">
                <Hash size={20} color="#6b7280" />
                <TextInput
                  className="flex-1 py-3 px-2 text-gray-900"
                  placeholder="SN12345678"
                  value={formData.serialNumber}
                  onChangeText={(text) => updateFormData({ serialNumber: text })}
                />
              </View>
            </View>

            {/* Invoice number */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-1">
                Fakturanummer
              </Text>
              <View className="flex-row items-center border border-gray-200 rounded-lg px-3 bg-white">
                <FileText size={20} color="#6b7280" />
                <TextInput
                  className="flex-1 py-3 px-2 text-gray-900"
                  placeholder="FV-12345"
                  value={formData.invoiceNumber}
                  onChangeText={(text) => updateFormData({ invoiceNumber: text })}
                />
              </View>
            </View>

            {/* Purchase date */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-1">
                Kjøpsdato
              </Text>
              <Pressable className="flex-row items-center border border-gray-200 rounded-lg px-3 py-3 bg-white">
                <Calendar size={20} color="#6b7280" />
                <Text className="flex-1 px-2 text-gray-500">
                  {formData.purchaseDate 
                    ? formData.purchaseDate.toLocaleDateString('nb-NO')
                    : 'Velg dato...'
                  }
                </Text>
              </Pressable>
            </View>
          </>
        ) : (
          <View className="items-center py-12">
            <Text className="text-gray-500">Produktsøk kommer snart...</Text>
          </View>
        )}
      </ScrollView>

      {/* Navigation */}
      <View className="flex-row p-4 bg-white border-t border-gray-100 gap-3">
        <Pressable
          onPress={prevStep}
          className="flex-1 py-4 rounded-xl items-center border border-gray-200"
        >
          <Text className="font-semibold text-gray-700">Tilbake</Text>
        </Pressable>
        <Pressable
          onPress={handleNext}
          disabled={!formData.productNameText}
          className={`flex-1 py-4 rounded-xl items-center ${
            formData.productNameText ? 'bg-primary' : 'bg-gray-200'
          }`}
        >
          <Text className={`font-semibold ${
            formData.productNameText ? 'text-white' : 'text-gray-400'
          }`}>
            Neste: Kunde
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
```

---

## Step 3: Customer

### src/features/claims/wizard/steps/Step3Customer.tsx

```tsx
import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { useWizardStore } from '../hooks/useWizardForm';
import { Building, User, Mail, Phone, MapPin } from 'lucide-react-native';

export function Step3Customer() {
  const { formData, updateFormData, markStepComplete, nextStep, prevStep } = useWizardStore();
  const [useManual, setUseManual] = useState(true);

  const handleNext = () => {
    if (formData.customerCompanyName) {
      markStepComplete(3);
      nextStep();
    }
  };

  const InputField = ({ 
    label, 
    icon: Icon, 
    value, 
    field, 
    placeholder,
    keyboardType = 'default',
  }: any) => (
    <View className="mb-4">
      <Text className="text-sm font-medium text-gray-700 mb-1">{label}</Text>
      <View className="flex-row items-center border border-gray-200 rounded-lg px-3 bg-white">
        <Icon size={20} color="#6b7280" />
        <TextInput
          className="flex-1 py-3 px-2 text-gray-900"
          placeholder={placeholder}
          value={value}
          onChangeText={(text) => updateFormData({ [field]: text })}
          keyboardType={keyboardType}
        />
      </View>
    </View>
  );

  return (
    <View className="flex-1">
      <ScrollView className="flex-1 p-4">
        {/* Toggle */}
        <View className="flex-row bg-gray-100 rounded-lg p-1 mb-6">
          <Pressable
            onPress={() => setUseManual(false)}
            className={`flex-1 py-2 rounded-md ${!useManual ? 'bg-white shadow-sm' : ''}`}
          >
            <Text className={`text-center ${!useManual ? 'text-primary font-medium' : 'text-gray-500'}`}>
              Søk kunde
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setUseManual(true)}
            className={`flex-1 py-2 rounded-md ${useManual ? 'bg-white shadow-sm' : ''}`}
          >
            <Text className={`text-center ${useManual ? 'text-primary font-medium' : 'text-gray-500'}`}>
              Manuell
            </Text>
          </Pressable>
        </View>

        {useManual ? (
          <>
            <InputField 
              label="Firmanavn *" 
              icon={Building} 
              value={formData.customerCompanyName}
              field="customerCompanyName"
              placeholder="Kiwi Storgata"
            />
            <InputField 
              label="Kontaktperson" 
              icon={User} 
              value={formData.customerContactName}
              field="customerContactName"
              placeholder="Ola Nordmann"
            />
            <InputField 
              label="E-post" 
              icon={Mail} 
              value={formData.customerEmail}
              field="customerEmail"
              placeholder="ola@kunde.no"
              keyboardType="email-address"
            />
            <InputField 
              label="Telefon" 
              icon={Phone} 
              value={formData.customerPhone}
              field="customerPhone"
              placeholder="+47 123 45 678"
              keyboardType="phone-pad"
            />
            <InputField 
              label="Adresse" 
              icon={MapPin} 
              value={formData.customerAddress}
              field="customerAddress"
              placeholder="Storgata 1"
            />
            
            <View className="flex-row gap-3">
              <View className="flex-1">
                <InputField 
                  label="Postnr" 
                  icon={MapPin} 
                  value={formData.customerPostalCode}
                  field="customerPostalCode"
                  placeholder="0123"
                  keyboardType="number-pad"
                />
              </View>
              <View className="flex-[2]">
                <InputField 
                  label="Sted" 
                  icon={MapPin} 
                  value={formData.customerCity}
                  field="customerCity"
                  placeholder="Oslo"
                />
              </View>
            </View>
          </>
        ) : (
          <View className="items-center py-12">
            <Text className="text-gray-500">Kundesøk kommer snart...</Text>
          </View>
        )}
      </ScrollView>

      {/* Navigation */}
      <View className="flex-row p-4 bg-white border-t border-gray-100 gap-3">
        <Pressable
          onPress={prevStep}
          className="flex-1 py-4 rounded-xl items-center border border-gray-200"
        >
          <Text className="font-semibold text-gray-700">Tilbake</Text>
        </Pressable>
        <Pressable
          onPress={handleNext}
          disabled={!formData.customerCompanyName}
          className={`flex-1 py-4 rounded-xl items-center ${
            formData.customerCompanyName ? 'bg-primary' : 'bg-gray-200'
          }`}
        >
          <Text className={`font-semibold ${
            formData.customerCompanyName ? 'text-white' : 'text-gray-400'
          }`}>
            Neste: Problem
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
```

---

## Step 4: Problem

### src/features/claims/wizard/steps/Step4Problem.tsx

```tsx
import { View, Text, TextInput, Pressable, ScrollView, Image } from 'react-native';
import { useWizardStore } from '../hooks/useWizardForm';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Image as ImageIcon, X, AlertTriangle } from 'lucide-react-native';

const CATEGORIES = [
  { value: 'electrical', label: 'Elektrisk' },
  { value: 'mechanical', label: 'Mekanisk' },
  { value: 'cosmetic', label: 'Kosmetisk' },
  { value: 'software', label: 'Software' },
  { value: 'transport', label: 'Transportskade' },
  { value: 'other', label: 'Annet' },
];

const PRIORITIES = [
  { value: 'low', label: 'Lav', color: 'bg-gray-100 text-gray-700' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'high', label: 'Høy', color: 'bg-orange-100 text-orange-700' },
  { value: 'urgent', label: 'Haster', color: 'bg-red-100 text-red-700' },
];

export function Step4Problem() {
  const { formData, updateFormData, markStepComplete, nextStep, prevStep } = useWizardStore();

  const pickImage = async (useCamera: boolean) => {
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      base64: true,
    };

    const result = useCamera
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

    if (!result.canceled) {
      const newPhotos = result.assets.map((asset) => ({
        uri: asset.uri,
        base64: asset.base64,
      }));
      updateFormData({ photos: [...formData.photos, ...newPhotos] });
    }
  };

  const removePhoto = (index: number) => {
    const newPhotos = formData.photos.filter((_, i) => i !== index);
    updateFormData({ photos: newPhotos });
  };

  const handleNext = () => {
    if (formData.problemDescription && formData.category) {
      markStepComplete(4);
      nextStep();
    }
  };

  return (
    <View className="flex-1">
      <ScrollView className="flex-1 p-4">
        {/* Category */}
        <View className="mb-6">
          <Text className="text-sm font-medium text-gray-700 mb-2">Kategori *</Text>
          <View className="flex-row flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <Pressable
                key={cat.value}
                onPress={() => updateFormData({ category: cat.value })}
                className={`px-4 py-2 rounded-lg border ${
                  formData.category === cat.value
                    ? 'bg-primary border-primary'
                    : 'bg-white border-gray-200'
                }`}
              >
                <Text className={
                  formData.category === cat.value ? 'text-white' : 'text-gray-700'
                }>
                  {cat.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Priority */}
        <View className="mb-6">
          <Text className="text-sm font-medium text-gray-700 mb-2">Prioritet</Text>
          <View className="flex-row gap-2">
            {PRIORITIES.map((pri) => (
              <Pressable
                key={pri.value}
                onPress={() => updateFormData({ priority: pri.value })}
                className={`flex-1 py-3 rounded-lg items-center border ${
                  formData.priority === pri.value
                    ? 'border-primary bg-primary/10'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <Text className={
                  formData.priority === pri.value 
                    ? 'text-primary font-medium' 
                    : 'text-gray-700'
                }>
                  {pri.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Description */}
        <View className="mb-6">
          <Text className="text-sm font-medium text-gray-700 mb-2">
            Beskrivelse av problemet *
          </Text>
          <View className="border border-gray-200 rounded-lg bg-white">
            <TextInput
              className="p-3 text-gray-900 min-h-[120px]"
              placeholder="Beskriv feilen så detaljert som mulig..."
              value={formData.problemDescription}
              onChangeText={(text) => updateFormData({ problemDescription: text })}
              multiline
              textAlignVertical="top"
            />
          </View>
        </View>

        {/* Photos */}
        <View className="mb-6">
          <Text className="text-sm font-medium text-gray-700 mb-2">
            Bilder ({formData.photos.length})
          </Text>
          
          {/* Photo buttons */}
          <View className="flex-row gap-3 mb-3">
            <Pressable
              onPress={() => pickImage(true)}
              className="flex-1 flex-row items-center justify-center py-3 bg-primary rounded-lg"
            >
              <Camera size={20} color="white" />
              <Text className="text-white font-medium ml-2">Ta bilde</Text>
            </Pressable>
            <Pressable
              onPress={() => pickImage(false)}
              className="flex-1 flex-row items-center justify-center py-3 border border-gray-200 rounded-lg"
            >
              <ImageIcon size={20} color="#374151" />
              <Text className="text-gray-700 font-medium ml-2">Velg fra galleri</Text>
            </Pressable>
          </View>

          {/* Photo preview */}
          {formData.photos.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-2">
                {formData.photos.map((photo, index) => (
                  <View key={index} className="relative">
                    <Image
                      source={{ uri: photo.uri }}
                      className="w-24 h-24 rounded-lg"
                    />
                    <Pressable
                      onPress={() => removePhoto(index)}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full items-center justify-center"
                    >
                      <X size={14} color="white" />
                    </Pressable>
                  </View>
                ))}
              </View>
            </ScrollView>
          )}
        </View>
      </ScrollView>

      {/* Navigation */}
      <View className="flex-row p-4 bg-white border-t border-gray-100 gap-3">
        <Pressable
          onPress={prevStep}
          className="flex-1 py-4 rounded-xl items-center border border-gray-200"
        >
          <Text className="font-semibold text-gray-700">Tilbake</Text>
        </Pressable>
        <Pressable
          onPress={handleNext}
          disabled={!formData.problemDescription || !formData.category}
          className={`flex-1 py-4 rounded-xl items-center ${
            formData.problemDescription && formData.category ? 'bg-primary' : 'bg-gray-200'
          }`}
        >
          <Text className={`font-semibold ${
            formData.problemDescription && formData.category ? 'text-white' : 'text-gray-400'
          }`}>
            Neste: Oppsummering
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
```

---

## Step 5: Summary

### src/features/claims/wizard/steps/Step5Summary.tsx

```tsx
import { View, Text, ScrollView, Pressable, Image, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { trpc } from '../../../../lib/api';
import { useWizardStore } from '../hooks/useWizardForm';
import { 
  Building, Package, User, AlertTriangle, Edit2, Send, CheckCircle 
} from 'lucide-react-native';

export function Step5Summary() {
  const router = useRouter();
  const { formData, setStep, reset, prevStep } = useWizardStore();

  const createMutation = trpc.claims.create.useMutation({
    onSuccess: (claim) => {
      Alert.alert(
        'Reklamasjon opprettet',
        `Saksnummer: ${claim.claimNumber}`,
        [
          {
            text: 'Se reklamasjon',
            onPress: () => {
              reset();
              router.replace(`/claims/${claim.id}`);
            },
          },
          {
            text: 'Ny reklamasjon',
            onPress: () => {
              reset();
            },
          },
        ]
      );
    },
    onError: (error) => {
      Alert.alert('Feil', error.message);
    },
  });

  const handleSubmit = () => {
    createMutation.mutate({
      supplierId: formData.supplierId!,
      productId: formData.productId || undefined,
      productNameText: formData.productNameText,
      serialNumber: formData.serialNumber || undefined,
      purchaseDate: formData.purchaseDate || undefined,
      invoiceNumber: formData.invoiceNumber || undefined,
      customerId: formData.customerId || undefined,
      customerCompanyName: formData.customerCompanyName,
      customerContactName: formData.customerContactName || undefined,
      customerEmail: formData.customerEmail || undefined,
      customerPhone: formData.customerPhone || undefined,
      problemDescription: formData.problemDescription,
      category: formData.category,
      priority: formData.priority,
      // photos sendes separat via attachment-endpoint
    });
  };

  const SummarySection = ({ 
    title, 
    step, 
    icon: Icon, 
    children 
  }: {
    title: string;
    step: number;
    icon: any;
    children: React.ReactNode;
  }) => (
    <View className="bg-white rounded-xl p-4 mb-4">
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center">
          <Icon size={20} color="#003366" />
          <Text className="ml-2 text-lg font-semibold text-gray-900">{title}</Text>
        </View>
        <Pressable 
          onPress={() => setStep(step)}
          className="flex-row items-center"
        >
          <Edit2 size={16} color="#0d9488" />
          <Text className="ml-1 text-accent text-sm">Endre</Text>
        </Pressable>
      </View>
      {children}
    </View>
  );

  return (
    <View className="flex-1">
      <ScrollView className="flex-1 p-4">
        <View className="bg-green-50 p-4 rounded-xl mb-4 flex-row items-center">
          <CheckCircle size={24} color="#22c55e" />
          <View className="ml-3 flex-1">
            <Text className="text-green-700 font-semibold">
              Klar til innsending
            </Text>
            <Text className="text-green-600 text-sm">
              Sjekk at all informasjon er korrekt
            </Text>
          </View>
        </View>

        {/* Supplier */}
        <SummarySection title="Leverandør" step={1} icon={Building}>
          <Text className="text-gray-900 font-medium">{formData.supplierName}</Text>
        </SummarySection>

        {/* Product */}
        <SummarySection title="Produkt" step={2} icon={Package}>
          <Text className="text-gray-900 font-medium">{formData.productNameText}</Text>
          {formData.serialNumber && (
            <Text className="text-gray-500 text-sm">SN: {formData.serialNumber}</Text>
          )}
          {formData.invoiceNumber && (
            <Text className="text-gray-500 text-sm">Faktura: {formData.invoiceNumber}</Text>
          )}
        </SummarySection>

        {/* Customer */}
        <SummarySection title="Kunde" step={3} icon={User}>
          <Text className="text-gray-900 font-medium">{formData.customerCompanyName}</Text>
          {formData.customerContactName && (
            <Text className="text-gray-500 text-sm">{formData.customerContactName}</Text>
          )}
          {formData.customerPhone && (
            <Text className="text-gray-500 text-sm">{formData.customerPhone}</Text>
          )}
        </SummarySection>

        {/* Problem */}
        <SummarySection title="Problem" step={4} icon={AlertTriangle}>
          <View className="flex-row items-center gap-2 mb-2">
            <View className="bg-gray-100 px-2 py-1 rounded">
              <Text className="text-gray-700 text-sm">{formData.category}</Text>
            </View>
            <View className="bg-yellow-100 px-2 py-1 rounded">
              <Text className="text-yellow-700 text-sm">{formData.priority}</Text>
            </View>
          </View>
          <Text className="text-gray-700">{formData.problemDescription}</Text>
          
          {formData.photos.length > 0 && (
            <ScrollView horizontal className="mt-3" showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-2">
                {formData.photos.map((photo, index) => (
                  <Image
                    key={index}
                    source={{ uri: photo.uri }}
                    className="w-16 h-16 rounded-lg"
                  />
                ))}
              </View>
            </ScrollView>
          )}
        </SummarySection>
      </ScrollView>

      {/* Submit */}
      <View className="flex-row p-4 bg-white border-t border-gray-100 gap-3">
        <Pressable
          onPress={prevStep}
          className="flex-1 py-4 rounded-xl items-center border border-gray-200"
        >
          <Text className="font-semibold text-gray-700">Tilbake</Text>
        </Pressable>
        <Pressable
          onPress={handleSubmit}
          disabled={createMutation.isPending}
          className={`flex-1 flex-row items-center justify-center py-4 rounded-xl ${
            createMutation.isPending ? 'bg-primary/50' : 'bg-accent'
          }`}
        >
          <Send size={20} color="white" />
          <Text className="text-white font-semibold ml-2">
            {createMutation.isPending ? 'Sender...' : 'Send inn'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
```

---

## Wizard Container

### src/features/claims/wizard/ClaimsWizard.tsx

```tsx
import { View } from 'react-native';
import { useWizardStore } from './hooks/useWizardForm';
import { WizardProgress } from './WizardProgress';
import { Step1Supplier } from './steps/Step1Supplier';
import { Step2Product } from './steps/Step2Product';
import { Step3Customer } from './steps/Step3Customer';
import { Step4Problem } from './steps/Step4Problem';
import { Step5Summary } from './steps/Step5Summary';

export function ClaimsWizard() {
  const { currentStep, completedSteps, setStep } = useWizardStore();

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <Step1Supplier />;
      case 2:
        return <Step2Product />;
      case 3:
        return <Step3Customer />;
      case 4:
        return <Step4Problem />;
      case 5:
        return <Step5Summary />;
      default:
        return <Step1Supplier />;
    }
  };

  return (
    <View className="flex-1 bg-gray-50">
      <WizardProgress
        currentStep={currentStep}
        completedSteps={completedSteps}
        onStepPress={setStep}
      />
      {renderStep()}
    </View>
  );
}
```

---

## Route File

### apps/mobile/app/(dashboard)/claims/new.tsx

```tsx
import { View, Text, Pressable } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { ClaimsWizard } from '../../../src/features/claims/wizard/ClaimsWizard';
import { useWizardStore } from '../../../src/features/claims/wizard/hooks/useWizardForm';

export default function NewClaimPage() {
  const router = useRouter();
  const { reset } = useWizardStore();

  const handleClose = () => {
    reset();
    router.back();
  };

  return (
    <View className="flex-1">
      {/* Header */}
      <View className="bg-primary pt-12 pb-4 px-4">
        <View className="flex-row items-center">
          <Pressable onPress={handleClose} className="mr-4">
            <ArrowLeft size={24} color="white" />
          </Pressable>
          <Text className="text-white text-xl font-bold">
            Ny reklamasjon
          </Text>
        </View>
      </View>

      <ClaimsWizard />
    </View>
  );
}
```

---

## Sjekkliste

- [ ] Zustand wizard state med 5 steg
- [ ] WizardProgress komponent
- [ ] Step1Supplier med leverandørsøk
- [ ] Step2Product med manuell input
- [ ] Step3Customer med kundeinfo
- [ ] Step4Problem med kategori, prioritet, beskrivelse, bilder
- [ ] Step5Summary med oppsummering og innsending
- [ ] ClaimsWizard container
- [ ] Route file /claims/new
- [ ] Validering per steg
- [ ] Navigation mellom steg

---

## Neste fase

Gå til **FASE 14: Leverandørportal** for QR-kode og svar.
