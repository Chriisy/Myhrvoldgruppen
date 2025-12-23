import { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { trpc } from '../../../src/lib/api';
import { LoadingScreen } from '../../../src/components/LoadingScreen';
import {
  ArrowLeft, Package, User, Calendar, FileText, CheckCircle
} from 'lucide-react-native';

export default function NewLoanScreen() {
  const router = useRouter();
  const [selectedEquipment, setSelectedEquipment] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [claimNumber, setClaimNumber] = useState('');

  const { data: equipment, isLoading: loadingEquipment } = trpc.loans.availableEquipment.useQuery();
  const { data: customers, isLoading: loadingCustomers } = trpc.customers.list.useQuery({ limit: 100 });

  const createLoan = trpc.loans.createLoan.useMutation({
    onSuccess: (data) => {
      Alert.alert('Utlån registrert', `Lånenummer: ${data.loanNumber}`, [
        { text: 'OK', onPress: () => router.back() }
      ]);
    },
    onError: (err) => {
      Alert.alert('Feil', err.message);
    },
  });

  if (loadingEquipment || loadingCustomers) return <LoadingScreen />;

  const handleSubmit = () => {
    if (!selectedEquipment) {
      Alert.alert('Mangler utstyr', 'Velg utstyr som skal lånes ut');
      return;
    }
    if (!selectedCustomer) {
      Alert.alert('Mangler kunde', 'Velg kunde for utlånet');
      return;
    }

    createLoan.mutate({
      equipmentId: selectedEquipment,
      customerId: selectedCustomer,
      notes: notes || undefined,
      claimNumber: claimNumber || undefined,
    });
  };

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-primary pt-12 pb-6 px-4">
        <View className="flex-row items-center">
          <Pressable onPress={() => router.back()} className="mr-4">
            <ArrowLeft size={24} color="white" />
          </Pressable>
          <Text className="text-white text-xl font-bold">Nytt utlån</Text>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
        <View className="bg-white rounded-xl p-4 mb-4">
          <View className="flex-row items-center mb-3">
            <Package size={20} color="#003366" />
            <Text className="ml-2 text-lg font-semibold text-gray-900">Velg utstyr *</Text>
          </View>

          {equipment && equipment.length > 0 ? (
            <View className="gap-2">
              {equipment.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => setSelectedEquipment(item.id)}
                  className={`flex-row items-center p-3 rounded-lg border-2 ${
                    selectedEquipment === item.id
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-200'
                  }`}
                >
                  {selectedEquipment === item.id && (
                    <CheckCircle size={20} color="#003366" className="mr-2" />
                  )}
                  <View className="flex-1">
                    <Text className="text-gray-900 font-medium">{item.name}</Text>
                    <Text className="text-gray-500 text-sm">
                      {item.equipmentNumber} • {item.brand} {item.model}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : (
            <View className="items-center py-6">
              <Text className="text-gray-500">Ingen tilgjengelig utstyr</Text>
            </View>
          )}
        </View>

        <View className="bg-white rounded-xl p-4 mb-4">
          <View className="flex-row items-center mb-3">
            <User size={20} color="#003366" />
            <Text className="ml-2 text-lg font-semibold text-gray-900">Velg kunde *</Text>
          </View>

          {customers && customers.length > 0 ? (
            <View className="gap-2 max-h-60">
              <ScrollView nestedScrollEnabled>
                {customers.map((customer) => (
                  <Pressable
                    key={customer.id}
                    onPress={() => setSelectedCustomer(customer.id)}
                    className={`flex-row items-center p-3 rounded-lg border-2 mb-2 ${
                      selectedCustomer === customer.id
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-200'
                    }`}
                  >
                    {selectedCustomer === customer.id && (
                      <CheckCircle size={20} color="#003366" className="mr-2" />
                    )}
                    <View className="flex-1">
                      <Text className="text-gray-900 font-medium">{customer.name}</Text>
                      {customer.city && (
                        <Text className="text-gray-500 text-sm">{customer.city}</Text>
                      )}
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : (
            <View className="items-center py-6">
              <Text className="text-gray-500">Ingen kunder funnet</Text>
            </View>
          )}
        </View>

        <View className="bg-white rounded-xl p-4 mb-4">
          <View className="flex-row items-center mb-3">
            <FileText size={20} color="#003366" />
            <Text className="ml-2 text-lg font-semibold text-gray-900">Tilleggsinformasjon</Text>
          </View>

          <Text className="text-gray-600 text-sm mb-1">Reklamasjonsnummer (valgfritt)</Text>
          <TextInput
            value={claimNumber}
            onChangeText={setClaimNumber}
            placeholder="RK2024-0001"
            className="bg-gray-50 rounded-lg px-4 py-3 text-gray-900 mb-3"
            placeholderTextColor="#9ca3af"
          />

          <Text className="text-gray-600 text-sm mb-1">Notater</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Eventuelle merknader..."
            multiline
            numberOfLines={3}
            className="bg-gray-50 rounded-lg px-4 py-3 text-gray-900 min-h-[80px]"
            placeholderTextColor="#9ca3af"
            textAlignVertical="top"
          />
        </View>

        <Pressable
          onPress={handleSubmit}
          disabled={!selectedEquipment || !selectedCustomer || createLoan.isPending}
          className={`rounded-xl py-4 mb-8 ${
            selectedEquipment && selectedCustomer && !createLoan.isPending
              ? 'bg-accent'
              : 'bg-gray-300'
          }`}
        >
          <Text className="text-white font-semibold text-center text-lg">
            {createLoan.isPending ? 'Registrerer...' : 'Registrer utlån'}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
