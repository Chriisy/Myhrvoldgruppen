import { useState } from 'react';
import { View, Text, FlatList, RefreshControl, TextInput, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { trpc } from '../../../src/lib/api';
import { LoadingScreen } from '../../../src/components/LoadingScreen';
import { ErrorView } from '../../../src/components/ErrorView';
import {
  Search, Plus, FileText, Clock, AlertTriangle, CheckCircle, ChevronRight, Calendar
} from 'lucide-react-native';

export default function AgreementsListScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');

  const { data: agreements, isLoading, error, refetch, isRefetching } = trpc.agreements.list.useQuery({
    page: 1,
    limit: 50,
    search: search || undefined,
  });

  const { data: stats } = trpc.agreements.stats.useQuery();

  if (isLoading) return <LoadingScreen />;
  if (error) return <ErrorView error={error} onRetry={refetch} />;

  const statItems = [
    { label: 'Totalt', value: stats?.total || 0, icon: FileText, color: '#3b82f6' },
    { label: 'Aktive', value: stats?.active || 0, icon: CheckCircle, color: '#22c55e' },
    { label: 'Utløper snart', value: stats?.expiringSoon || 0, icon: AlertTriangle, color: '#f59e0b' },
    { label: 'Utløpt', value: stats?.expired || 0, icon: Clock, color: '#ef4444' },
  ];

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('nb-NO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-primary pt-12 pb-6 px-4">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-white text-2xl font-bold">Vedlikeholdsavtaler</Text>
          <Pressable className="bg-accent px-4 py-2 rounded-lg flex-row items-center">
            <Plus size={18} color="white" />
            <Text className="text-white font-medium ml-1">Ny</Text>
          </Pressable>
        </View>

        <View className="flex-row items-center bg-white/10 rounded-lg px-3 py-2">
          <Search size={20} color="rgba(255,255,255,0.7)" />
          <TextInput
            className="flex-1 ml-2 text-white"
            placeholder="Søk etter avtale..."
            placeholderTextColor="rgba(255,255,255,0.5)"
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      <FlatList
        data={agreements}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        ListHeaderComponent={
          <View className="flex-row flex-wrap gap-2 mb-4">
            {statItems.map((stat) => (
              <View key={stat.label} className="flex-1 min-w-[22%] bg-white p-3 rounded-lg">
                <View className="flex-row items-center gap-1">
                  <stat.icon size={14} color={stat.color} />
                  <Text className="text-lg font-bold" style={{ color: stat.color }}>
                    {stat.value}
                  </Text>
                </View>
                <Text className="text-gray-500 text-xs">{stat.label}</Text>
              </View>
            ))}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/agreements/${item.id}`)}
            className="bg-white p-4 rounded-xl shadow-sm mb-3 border border-gray-100"
          >
            <View className="flex-row items-start justify-between">
              <View className="flex-1">
                <View className="flex-row items-center gap-2 mb-1">
                  <Text className="text-primary font-bold">{item.agreementNumber}</Text>
                  <View className={`px-2 py-0.5 rounded-full ${
                    item.status === 'active' ? 'bg-green-100' : 'bg-gray-100'
                  }`}>
                    <Text className={`text-xs font-medium ${
                      item.status === 'active' ? 'text-green-700' : 'text-gray-600'
                    }`}>
                      {item.status === 'active' ? 'Aktiv' : 'Utløpt'}
                    </Text>
                  </View>
                </View>
                <Text className="text-gray-900 font-medium">{item.name}</Text>
                <Text className="text-gray-500 text-sm">{item.customer?.name}</Text>
                <View className="flex-row items-center mt-2">
                  <Calendar size={12} color="#9ca3af" />
                  <Text className="text-xs text-gray-400 ml-1">
                    {formatDate(item.startDate)} - {formatDate(item.endDate)}
                  </Text>
                </View>
              </View>
              <ChevronRight size={20} color="#9ca3af" />
            </View>
          </Pressable>
        )}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#003366" />
        }
        ListEmptyComponent={
          <View className="items-center py-12">
            <Text className="text-gray-500">Ingen avtaler funnet</Text>
          </View>
        }
      />
    </View>
  );
}
