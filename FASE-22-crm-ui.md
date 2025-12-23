# FASE 22: CRM UI (Leverandør, Produkt, Kunde Admin)

> Fase 1-21 må være fullført.
> Estimert tid: ~90 minutter.

## Mål

Bygg admin-grensesnitt for CRM med liste, detaljer, og CRUD-operasjoner.

---

## Mappestruktur

```
apps/mobile/
├── app/(dashboard)/
│   ├── admin/
│   │   ├── _layout.tsx
│   │   ├── index.tsx
│   │   ├── suppliers/
│   │   │   ├── index.tsx
│   │   │   ├── [id].tsx
│   │   │   └── new.tsx
│   │   ├── products/
│   │   │   ├── index.tsx
│   │   │   ├── [id].tsx
│   │   │   └── new.tsx
│   │   └── customers/
│   │       ├── index.tsx
│   │       ├── [id].tsx
│   │       └── new.tsx
└── src/features/
    ├── suppliers/
    │   ├── components/
    │   │   ├── SupplierCard.tsx
    │   │   └── SupplierForm.tsx
    │   └── screens/
    │       ├── SuppliersListScreen.tsx
    │       └── SupplierDetailScreen.tsx
    ├── products/
    │   └── ...
    └── customers/
        └── ...
```

---

## Admin Layout

### app/(dashboard)/admin/_layout.tsx

```tsx
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function AdminLayout() {
  const { t } = useTranslation();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#003366' },
        headerTintColor: 'white',
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <Stack.Screen 
        name="index" 
        options={{ title: 'Admin' }} 
      />
      <Stack.Screen 
        name="suppliers/index" 
        options={{ title: 'Leverandører' }} 
      />
      <Stack.Screen 
        name="suppliers/[id]" 
        options={{ title: 'Leverandør' }} 
      />
      <Stack.Screen 
        name="suppliers/new" 
        options={{ title: 'Ny leverandør' }} 
      />
      <Stack.Screen 
        name="products/index" 
        options={{ title: 'Produkter' }} 
      />
      <Stack.Screen 
        name="products/[id]" 
        options={{ title: 'Produkt' }} 
      />
      <Stack.Screen 
        name="products/new" 
        options={{ title: 'Nytt produkt' }} 
      />
      <Stack.Screen 
        name="customers/index" 
        options={{ title: 'Kunder' }} 
      />
      <Stack.Screen 
        name="customers/[id]" 
        options={{ title: 'Kunde' }} 
      />
      <Stack.Screen 
        name="customers/new" 
        options={{ title: 'Ny kunde' }} 
      />
    </Stack>
  );
}
```

---

### app/(dashboard)/admin/index.tsx

```tsx
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { 
  Building2, 
  Package, 
  Users, 
  ChevronRight,
  Shield,
  Settings,
} from 'lucide-react-native';

const adminSections = [
  {
    title: 'CRM',
    items: [
      { 
        label: 'Leverandører', 
        icon: Building2, 
        href: '/admin/suppliers',
        description: 'Administrer leverandører og garantiinfo',
      },
      { 
        label: 'Produkter', 
        icon: Package, 
        href: '/admin/products',
        description: 'Produktkatalog og spesifikasjoner',
      },
      { 
        label: 'Kunder', 
        icon: Users, 
        href: '/admin/customers',
        description: 'Kunderegisteret',
      },
    ],
  },
  {
    title: 'System',
    items: [
      { 
        label: 'Brukere', 
        icon: Shield, 
        href: '/admin/users',
        description: 'Brukeradministrasjon og roller',
      },
      { 
        label: 'Innstillinger', 
        icon: Settings, 
        href: '/admin/settings',
        description: 'Systemkonfigurasjon',
      },
    ],
  },
];

export default function AdminIndexScreen() {
  const router = useRouter();

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="p-4">
        {adminSections.map((section) => (
          <View key={section.title} className="mb-6">
            <Text className="text-lg font-bold text-gray-900 mb-3">
              {section.title}
            </Text>
            <View className="bg-white rounded-xl overflow-hidden">
              {section.items.map((item, index) => (
                <Pressable
                  key={item.label}
                  onPress={() => router.push(item.href as any)}
                  className={`flex-row items-center p-4 active:bg-gray-50 ${
                    index < section.items.length - 1 ? 'border-b border-gray-100' : ''
                  }`}
                >
                  <View className="w-10 h-10 bg-primary/10 rounded-lg items-center justify-center">
                    <item.icon size={20} color="#003366" />
                  </View>
                  <View className="flex-1 ml-3">
                    <Text className="text-gray-900 font-medium">{item.label}</Text>
                    <Text className="text-gray-500 text-sm">{item.description}</Text>
                  </View>
                  <ChevronRight size={20} color="#9ca3af" />
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
```

---

## Suppliers Module

### src/features/suppliers/components/SupplierCard.tsx

```tsx
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Building2, Mail, Phone, ChevronRight } from 'lucide-react-native';

interface Supplier {
  id: string;
  name: string;
  shortCode: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  warrantyMonths?: number | null;
  isActive: boolean;
}

interface SupplierCardProps {
  supplier: Supplier;
}

export function SupplierCard({ supplier }: SupplierCardProps) {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push(`/admin/suppliers/${supplier.id}`)}
      className="bg-white p-4 rounded-xl mb-3 border border-gray-100 active:bg-gray-50"
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-row items-center flex-1">
          <View className="w-12 h-12 bg-primary/10 rounded-lg items-center justify-center">
            <Building2 size={24} color="#003366" />
          </View>
          <View className="ml-3 flex-1">
            <View className="flex-row items-center">
              <Text className="text-gray-900 font-semibold text-base">
                {supplier.name}
              </Text>
              <View className={`ml-2 px-2 py-0.5 rounded ${
                supplier.isActive ? 'bg-green-100' : 'bg-gray-100'
              }`}>
                <Text className={`text-xs ${
                  supplier.isActive ? 'text-green-700' : 'text-gray-500'
                }`}>
                  {supplier.isActive ? 'Aktiv' : 'Inaktiv'}
                </Text>
              </View>
            </View>
            <Text className="text-gray-500 text-sm">
              {supplier.shortCode}
              {supplier.warrantyMonths && ` • ${supplier.warrantyMonths} mnd garanti`}
            </Text>
            <View className="flex-row items-center mt-1 gap-3">
              {supplier.contactEmail && (
                <View className="flex-row items-center">
                  <Mail size={12} color="#9ca3af" />
                  <Text className="text-gray-400 text-xs ml-1" numberOfLines={1}>
                    {supplier.contactEmail}
                  </Text>
                </View>
              )}
              {supplier.contactPhone && (
                <View className="flex-row items-center">
                  <Phone size={12} color="#9ca3af" />
                  <Text className="text-gray-400 text-xs ml-1">
                    {supplier.contactPhone}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
        <ChevronRight size={20} color="#9ca3af" className="ml-2" />
      </View>
    </Pressable>
  );
}
```

---

### src/features/suppliers/components/SupplierForm.tsx

```tsx
import { View, Text, TextInput, Pressable, ScrollView, Switch } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Save } from 'lucide-react-native';

const supplierSchema = z.object({
  name: z.string().min(1, 'Navn er påkrevd'),
  shortCode: z.string().min(2, 'Kortkode må være minst 2 tegn').max(10),
  contactEmail: z.string().email('Ugyldig e-post').optional().or(z.literal('')),
  contactPhone: z.string().optional(),
  contactPerson: z.string().optional(),
  address: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  warrantyMonths: z.coerce.number().int().min(0).optional(),
  warrantyTerms: z.string().optional(),
  claimEmailPrimary: z.string().email().optional().or(z.literal('')),
  claimEmailCc: z.string().optional(),
  portalUrl: z.string().url().optional().or(z.literal('')),
  notes: z.string().optional(),
  isActive: z.boolean().default(true),
});

type SupplierFormData = z.infer<typeof supplierSchema>;

interface SupplierFormProps {
  defaultValues?: Partial<SupplierFormData>;
  onSubmit: (data: SupplierFormData) => void;
  isLoading?: boolean;
}

export function SupplierForm({ defaultValues, onSubmit, isLoading }: SupplierFormProps) {
  const { control, handleSubmit, formState: { errors } } = useForm<SupplierFormData>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      isActive: true,
      ...defaultValues,
    },
  });

  const FormField = ({ 
    name, 
    label, 
    placeholder,
    keyboardType,
    multiline,
  }: { 
    name: keyof SupplierFormData; 
    label: string;
    placeholder?: string;
    keyboardType?: 'default' | 'email-address' | 'numeric' | 'url';
    multiline?: boolean;
  }) => (
    <View className="mb-4">
      <Text className="text-sm font-medium text-gray-700 mb-1">{label}</Text>
      <Controller
        control={control}
        name={name}
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            className={`border border-gray-300 rounded-lg px-3 py-3 text-gray-900 ${
              multiline ? 'h-24 text-top' : ''
            }`}
            placeholder={placeholder}
            placeholderTextColor="#9ca3af"
            keyboardType={keyboardType}
            multiline={multiline}
            textAlignVertical={multiline ? 'top' : 'center'}
            onBlur={onBlur}
            onChangeText={onChange}
            value={value?.toString() ?? ''}
          />
        )}
      />
      {errors[name] && (
        <Text className="text-red-500 text-sm mt-1">{errors[name]?.message}</Text>
      )}
    </View>
  );

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="p-4">
        {/* Grunnleggende info */}
        <View className="bg-white rounded-xl p-4 mb-4">
          <Text className="text-lg font-semibold text-gray-900 mb-4">
            Grunnleggende info
          </Text>
          <FormField name="name" label="Navn *" placeholder="Leverandørnavn" />
          <FormField name="shortCode" label="Kortkode *" placeholder="F.eks. BSH, ELE" />
          
          <View className="flex-row items-center justify-between py-2">
            <Text className="text-sm font-medium text-gray-700">Aktiv</Text>
            <Controller
              control={control}
              name="isActive"
              render={({ field: { onChange, value } }) => (
                <Switch
                  value={value}
                  onValueChange={onChange}
                  trackColor={{ true: '#0d9488' }}
                />
              )}
            />
          </View>
        </View>

        {/* Kontaktinfo */}
        <View className="bg-white rounded-xl p-4 mb-4">
          <Text className="text-lg font-semibold text-gray-900 mb-4">
            Kontaktinfo
          </Text>
          <FormField name="contactPerson" label="Kontaktperson" />
          <FormField 
            name="contactEmail" 
            label="E-post" 
            keyboardType="email-address" 
          />
          <FormField name="contactPhone" label="Telefon" />
        </View>

        {/* Adresse */}
        <View className="bg-white rounded-xl p-4 mb-4">
          <Text className="text-lg font-semibold text-gray-900 mb-4">
            Adresse
          </Text>
          <FormField name="address" label="Gateadresse" />
          <View className="flex-row gap-2">
            <View className="flex-1">
              <FormField name="postalCode" label="Postnr" />
            </View>
            <View className="flex-[2]">
              <FormField name="city" label="Sted" />
            </View>
          </View>
        </View>

        {/* Garanti */}
        <View className="bg-white rounded-xl p-4 mb-4">
          <Text className="text-lg font-semibold text-gray-900 mb-4">
            Garanti & Reklamasjon
          </Text>
          <FormField 
            name="warrantyMonths" 
            label="Garantitid (måneder)" 
            keyboardType="numeric"
          />
          <FormField 
            name="warrantyTerms" 
            label="Garantivilkår" 
            multiline
          />
          <FormField 
            name="claimEmailPrimary" 
            label="Reklamasjons-epost" 
            keyboardType="email-address"
          />
          <FormField 
            name="claimEmailCc" 
            label="Reklamasjon CC" 
          />
          <FormField 
            name="portalUrl" 
            label="Portal URL" 
            keyboardType="url"
          />
        </View>

        {/* Notater */}
        <View className="bg-white rounded-xl p-4 mb-4">
          <Text className="text-lg font-semibold text-gray-900 mb-4">
            Notater
          </Text>
          <FormField 
            name="notes" 
            label="Interne notater" 
            multiline
          />
        </View>

        {/* Submit */}
        <Pressable
          onPress={handleSubmit(onSubmit)}
          disabled={isLoading}
          className={`flex-row items-center justify-center py-4 rounded-xl mb-8 ${
            isLoading ? 'bg-primary/50' : 'bg-primary'
          }`}
        >
          <Save size={20} color="white" />
          <Text className="ml-2 text-white font-semibold text-lg">
            {isLoading ? 'Lagrer...' : 'Lagre'}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
```

---

### src/features/suppliers/screens/SuppliersListScreen.tsx

```tsx
import { View, Text, FlatList, RefreshControl, TextInput, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { trpc } from '../../../lib/api';
import { SupplierCard } from '../components/SupplierCard';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { ErrorView } from '../../../components/ErrorView';
import { Search, Plus, Filter } from 'lucide-react-native';

export function SuppliersListScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  const { 
    data, 
    isLoading, 
    error, 
    refetch,
    isRefetching,
  } = trpc.suppliers.list.useQuery({ 
    page: 1, 
    limit: 100,
    search: search || undefined,
    isActive: showInactive ? undefined : true,
  });

  if (isLoading) return <LoadingScreen />;
  if (error) return <ErrorView error={error} onRetry={refetch} />;

  return (
    <View className="flex-1 bg-gray-50">
      {/* Search & Filter Bar */}
      <View className="bg-white px-4 py-3 border-b border-gray-100">
        <View className="flex-row items-center bg-gray-100 rounded-lg px-3 py-2 mb-2">
          <Search size={20} color="#9ca3af" />
          <TextInput
            className="flex-1 ml-2 text-gray-900"
            placeholder="Søk leverandører..."
            placeholderTextColor="#9ca3af"
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <View className="flex-row items-center justify-between">
          <Pressable 
            onPress={() => setShowInactive(!showInactive)}
            className="flex-row items-center"
          >
            <View className={`w-5 h-5 rounded border mr-2 items-center justify-center ${
              showInactive ? 'bg-primary border-primary' : 'border-gray-300'
            }`}>
              {showInactive && <Text className="text-white text-xs">✓</Text>}
            </View>
            <Text className="text-gray-600 text-sm">Vis inaktive</Text>
          </Pressable>
          <Text className="text-gray-500 text-sm">
            {data?.total ?? 0} leverandører
          </Text>
        </View>
      </View>

      {/* Add Button */}
      <Pressable
        onPress={() => router.push('/admin/suppliers/new')}
        className="absolute bottom-6 right-6 bg-accent w-14 h-14 rounded-full items-center justify-center shadow-lg z-10"
      >
        <Plus size={28} color="white" />
      </Pressable>

      {/* List */}
      <FlatList
        data={data?.items ?? []}
        renderItem={({ item }) => <SupplierCard supplier={item} />}
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
            <Text className="text-gray-500">Ingen leverandører funnet</Text>
          </View>
        }
      />
    </View>
  );
}
```

---

### src/features/suppliers/screens/SupplierDetailScreen.tsx

```tsx
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { trpc } from '../../../lib/api';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { ErrorView } from '../../../components/ErrorView';
import { 
  Building2, 
  Mail, 
  Phone, 
  MapPin, 
  Shield, 
  Globe,
  Edit,
  Trash2,
  Package,
} from 'lucide-react-native';

export function SupplierDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const utils = trpc.useUtils();

  const { data: supplier, isLoading, error, refetch } = trpc.suppliers.byId.useQuery(
    { id: id! },
    { enabled: !!id }
  );

  const deleteMutation = trpc.suppliers.delete.useMutation({
    onSuccess: () => {
      utils.suppliers.list.invalidate();
      router.back();
    },
  });

  const handleDelete = () => {
    Alert.alert(
      'Slett leverandør',
      'Er du sikker på at du vil slette denne leverandøren?',
      [
        { text: 'Avbryt', style: 'cancel' },
        { 
          text: 'Slett', 
          style: 'destructive',
          onPress: () => deleteMutation.mutate({ id: id! }),
        },
      ]
    );
  };

  if (isLoading) return <LoadingScreen />;
  if (error) return <ErrorView error={error} onRetry={refetch} />;
  if (!supplier) return <ErrorView error={new Error('Ikke funnet')} />;

  const InfoRow = ({ icon: Icon, label, value }: { 
    icon: any; 
    label: string; 
    value?: string | null;
  }) => {
    if (!value) return null;
    return (
      <View className="flex-row items-start py-2">
        <Icon size={18} color="#6b7280" />
        <View className="ml-3 flex-1">
          <Text className="text-gray-500 text-xs">{label}</Text>
          <Text className="text-gray-900">{value}</Text>
        </View>
      </View>
    );
  };

  return (
    <ScrollView className="flex-1 bg-gray-50">
      {/* Header Card */}
      <View className="bg-white p-4 mb-4">
        <View className="flex-row items-center">
          <View className="w-16 h-16 bg-primary/10 rounded-xl items-center justify-center">
            <Building2 size={32} color="#003366" />
          </View>
          <View className="ml-4 flex-1">
            <Text className="text-xl font-bold text-gray-900">{supplier.name}</Text>
            <Text className="text-gray-500">{supplier.shortCode}</Text>
            <View className={`self-start mt-1 px-2 py-0.5 rounded ${
              supplier.isActive ? 'bg-green-100' : 'bg-gray-100'
            }`}>
              <Text className={`text-xs ${
                supplier.isActive ? 'text-green-700' : 'text-gray-500'
              }`}>
                {supplier.isActive ? 'Aktiv' : 'Inaktiv'}
              </Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View className="flex-row gap-2 mt-4">
          <Pressable
            onPress={() => router.push(`/admin/suppliers/${id}/edit` as any)}
            className="flex-1 flex-row items-center justify-center bg-primary py-3 rounded-lg"
          >
            <Edit size={18} color="white" />
            <Text className="ml-2 text-white font-medium">Rediger</Text>
          </Pressable>
          <Pressable
            onPress={handleDelete}
            className="px-4 py-3 border border-red-300 rounded-lg"
          >
            <Trash2 size={18} color="#ef4444" />
          </Pressable>
        </View>
      </View>

      {/* Contact Info */}
      <View className="bg-white rounded-xl mx-4 p-4 mb-4">
        <Text className="text-lg font-semibold text-gray-900 mb-2">Kontakt</Text>
        <InfoRow icon={Mail} label="E-post" value={supplier.contactEmail} />
        <InfoRow icon={Phone} label="Telefon" value={supplier.contactPhone} />
        <InfoRow icon={MapPin} label="Adresse" value={
          [supplier.address, supplier.postalCode, supplier.city]
            .filter(Boolean)
            .join(', ')
        } />
      </View>

      {/* Warranty Info */}
      <View className="bg-white rounded-xl mx-4 p-4 mb-4">
        <Text className="text-lg font-semibold text-gray-900 mb-2">Garanti</Text>
        <InfoRow 
          icon={Shield} 
          label="Garantitid" 
          value={supplier.warrantyMonths ? `${supplier.warrantyMonths} måneder` : undefined} 
        />
        <InfoRow icon={Mail} label="Reklamasjons-epost" value={supplier.claimEmailPrimary} />
        <InfoRow icon={Globe} label="Portal" value={supplier.portalUrl} />
        {supplier.warrantyTerms && (
          <View className="mt-2 p-3 bg-gray-50 rounded-lg">
            <Text className="text-gray-500 text-xs mb-1">Garantivilkår</Text>
            <Text className="text-gray-700 text-sm">{supplier.warrantyTerms}</Text>
          </View>
        )}
      </View>

      {/* Products */}
      {supplier.products && supplier.products.length > 0 && (
        <View className="bg-white rounded-xl mx-4 p-4 mb-4">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-lg font-semibold text-gray-900">
              Produkter ({supplier.products.length})
            </Text>
            <Pressable onPress={() => router.push('/admin/products')}>
              <Text className="text-primary text-sm">Se alle</Text>
            </Pressable>
          </View>
          {supplier.products.slice(0, 5).map((product) => (
            <Pressable
              key={product.id}
              onPress={() => router.push(`/admin/products/${product.id}` as any)}
              className="flex-row items-center py-2 border-b border-gray-100"
            >
              <Package size={16} color="#9ca3af" />
              <Text className="ml-2 text-gray-900 flex-1">{product.name}</Text>
              <Text className="text-gray-500 text-sm">{product.articleNumber}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Notes */}
      {supplier.notes && (
        <View className="bg-white rounded-xl mx-4 p-4 mb-8">
          <Text className="text-lg font-semibold text-gray-900 mb-2">Notater</Text>
          <Text className="text-gray-700">{supplier.notes}</Text>
        </View>
      )}
    </ScrollView>
  );
}
```

---

## Route Files

### app/(dashboard)/admin/suppliers/index.tsx

```tsx
import { SuppliersListScreen } from '../../../../src/features/suppliers/screens/SuppliersListScreen';

export default function SuppliersPage() {
  return <SuppliersListScreen />;
}
```

### app/(dashboard)/admin/suppliers/[id].tsx

```tsx
import { SupplierDetailScreen } from '../../../../src/features/suppliers/screens/SupplierDetailScreen';

export default function SupplierDetailPage() {
  return <SupplierDetailScreen />;
}
```

### app/(dashboard)/admin/suppliers/new.tsx

```tsx
import { useRouter } from 'expo-router';
import { trpc } from '../../../../src/lib/api';
import { SupplierForm } from '../../../../src/features/suppliers/components/SupplierForm';

export default function NewSupplierPage() {
  const router = useRouter();
  const utils = trpc.useUtils();

  const createMutation = trpc.suppliers.create.useMutation({
    onSuccess: (data) => {
      utils.suppliers.list.invalidate();
      router.replace(`/admin/suppliers/${data.id}` as any);
    },
  });

  return (
    <SupplierForm
      onSubmit={(data) => createMutation.mutate(data)}
      isLoading={createMutation.isPending}
    />
  );
}
```

---

## Customers Module (Kort versjon)

### src/features/customers/components/CustomerCard.tsx

```tsx
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Building, MapPin, ChevronRight } from 'lucide-react-native';

interface Customer {
  id: string;
  name: string;
  customerNumber?: string | null;
  chain?: string | null;
  city?: string | null;
  isActive: boolean;
}

export function CustomerCard({ customer }: { customer: Customer }) {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push(`/admin/customers/${customer.id}`)}
      className="bg-white p-4 rounded-xl mb-3 border border-gray-100 active:bg-gray-50"
    >
      <View className="flex-row items-center">
        <View className="w-10 h-10 bg-blue-50 rounded-lg items-center justify-center">
          <Building size={20} color="#3b82f6" />
        </View>
        <View className="ml-3 flex-1">
          <Text className="text-gray-900 font-medium">{customer.name}</Text>
          <View className="flex-row items-center">
            {customer.customerNumber && (
              <Text className="text-gray-500 text-sm">#{customer.customerNumber}</Text>
            )}
            {customer.chain && (
              <View className="ml-2 px-2 py-0.5 bg-purple-100 rounded">
                <Text className="text-purple-700 text-xs">{customer.chain}</Text>
              </View>
            )}
          </View>
          {customer.city && (
            <View className="flex-row items-center mt-1">
              <MapPin size={12} color="#9ca3af" />
              <Text className="text-gray-400 text-xs ml-1">{customer.city}</Text>
            </View>
          )}
        </View>
        <ChevronRight size={20} color="#9ca3af" />
      </View>
    </Pressable>
  );
}
```

---

## i18n oppdatering

### locales/nb.json (tillegg)

```json
{
  "admin": {
    "title": "Admin",
    "suppliers": {
      "title": "Leverandører",
      "new": "Ny leverandør",
      "edit": "Rediger leverandør",
      "fields": {
        "name": "Navn",
        "shortCode": "Kortkode",
        "contactEmail": "E-post",
        "contactPhone": "Telefon",
        "warrantyMonths": "Garantitid (måneder)",
        "claimEmail": "Reklamasjons-epost"
      }
    },
    "products": {
      "title": "Produkter",
      "new": "Nytt produkt"
    },
    "customers": {
      "title": "Kunder",
      "new": "Ny kunde"
    }
  }
}
```

---

## Sjekkliste

- [ ] Admin layout med Stack navigation
- [ ] Admin index med seksjoner
- [ ] SupplierCard komponent
- [ ] SupplierForm med validering
- [ ] SuppliersListScreen med søk/filter
- [ ] SupplierDetailScreen med all info
- [ ] Create/Edit suppliers fungerer
- [ ] Delete med bekreftelse
- [ ] CustomerCard komponent
- [ ] ProductCard komponent
- [ ] Tilsvarende screens for Products og Customers

---

## Neste fase

Gå til **FASE 23: Installations API + UI**.
