import { useState } from 'react';
import { View, Text, TextInput, FlatList, Pressable } from 'react-native';
import { trpc } from '../../../../lib/api';
import { useWizardStore } from '../useWizardStore';
import { Search, Building, Check, Clock } from 'lucide-react-native';

export function Step1Supplier() {
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
                {item.warrantyMonths && (
                  <View className="flex-row items-center mt-2">
                    <Clock size={12} color="#6b7280" />
                    <Text className="text-xs text-gray-500 ml-1">
                      {item.warrantyMonths} mnd garanti
                    </Text>
                  </View>
                )}
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
