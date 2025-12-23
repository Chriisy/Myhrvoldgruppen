import { useState } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { trpc } from '../../../src/lib/api';
import { LoadingScreen } from '../../../src/components/LoadingScreen';
import { ErrorView } from '../../../src/components/ErrorView';
import {
  ArrowLeft, Search, Box, CheckCircle, Clock, Wrench, ChevronRight, Plus
} from 'lucide-react-native';

export default function EquipmentListScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();

  const { data: equipment, isLoading, error, refetch, isRefetching } = trpc.loans.equipmentList.useQuery({
    search: search || undefined,
    status: statusFilter as any,
  });

  const { data: categories } = trpc.loans.categories.useQuery();

  if (isLoading) return <LoadingScreen />;
  if (error) return <ErrorView error={error} onRetry={refetch} />;

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'available':
        return { bg: 'bg-green-100', text: 'text-green-700', label: 'Tilgjengelig', Icon: CheckCircle };
      case 'on_loan':
        return { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Utlånt', Icon: Clock };
      case 'maintenance':
        return { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Vedlikehold', Icon: Wrench };
      default:
        return { bg: 'bg-gray-100', text: 'text-gray-700', label: status, Icon: Box };
    }
  };

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-primary pt-12 pb-4 px-4">
        <View className="flex-row items-center mb-4">
          <Pressable onPress={() => router.back()} className="mr-4">
            <ArrowLeft size={24} color="white" />
          </Pressable>
          <Text className="text-white text-xl font-bold flex-1">Utstyrsoversikt</Text>
          <Pressable className="bg-accent px-3 py-2 rounded-lg flex-row items-center">
            <Plus size={16} color="white" />
            <Text className="text-white font-medium ml-1">Nytt</Text>
          </Pressable>
        </View>

        <View className="flex-row bg-white rounded-lg px-3 py-2 items-center">
          <Search size={18} color="#9ca3af" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Søk utstyr..."
            className="flex-1 ml-2 text-gray-900"
            placeholderTextColor="#9ca3af"
          />
        </View>
      </View>

      <View className="px-4 py-2">
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[
            { id: undefined, label: 'Alle' },
            { id: 'available', label: 'Tilgjengelig' },
            { id: 'on_loan', label: 'Utlånt' },
            { id: 'maintenance', label: 'Vedlikehold' },
          ]}
          keyExtractor={(item) => item.id || 'all'}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setStatusFilter(item.id)}
              className={`px-4 py-2 mr-2 rounded-full ${
                statusFilter === item.id ? 'bg-primary' : 'bg-gray-200'
              }`}
            >
              <Text className={statusFilter === item.id ? 'text-white' : 'text-gray-700'}>
                {item.label}
              </Text>
            </Pressable>
          )}
        />
      </View>

      <FlatList
        data={equipment}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#003366" />
        }
        renderItem={({ item }) => {
          const statusConfig = getStatusConfig(item.status);
          const StatusIcon = statusConfig.Icon;

          return (
            <Pressable
              onPress={() => router.push(`/loans/equipment/${item.id}`)}
              className="bg-white p-4 rounded-xl shadow-sm mb-3 border border-gray-100"
            >
              <View className="flex-row items-start justify-between">
                <View className="flex-1">
                  <View className="flex-row items-center gap-2 mb-1">
                    <Text className="text-primary font-bold">{item.equipmentNumber}</Text>
                    <View className={`flex-row items-center px-2 py-0.5 rounded-full ${statusConfig.bg}`}>
                      <StatusIcon size={10} color={statusConfig.text.replace('text-', '')} />
                      <Text className={`text-xs font-medium ml-1 ${statusConfig.text}`}>
                        {statusConfig.label}
                      </Text>
                    </View>
                  </View>

                  <Text className="text-gray-900 font-medium">{item.name}</Text>

                  {item.brand && (
                    <Text className="text-gray-500 text-sm">
                      {item.brand} {item.model ? `- ${item.model}` : ''}
                    </Text>
                  )}

                  {item.category && (
                    <View className="flex-row items-center mt-2">
                      <Box size={12} color="#9ca3af" />
                      <Text className="text-gray-500 text-xs ml-1">
                        {categories?.find(c => c.id === item.category)?.name || item.category}
                      </Text>
                    </View>
                  )}

                  {item.dailyRate && (
                    <Text className="text-gray-600 text-sm mt-1">
                      {parseFloat(item.dailyRate).toLocaleString('nb-NO')} kr/dag
                    </Text>
                  )}
                </View>
                <ChevronRight size={20} color="#9ca3af" />
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View className="items-center py-12">
            <Box size={48} color="#9ca3af" />
            <Text className="text-gray-500 mt-4">Ingen utstyr funnet</Text>
          </View>
        }
      />
    </View>
  );
}
