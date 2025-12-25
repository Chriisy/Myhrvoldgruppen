import { useState } from 'react';
import { View, Text, FlatList, RefreshControl, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { trpc } from '../../../src/lib/api';
import { LoadingScreen } from '../../../src/components/LoadingScreen';
import { ErrorView } from '../../../src/components/ErrorView';
import {
  Plus, AlertOctagon, Package, Building, ChevronRight, AlertTriangle, Hash
} from 'lucide-react-native';

export default function StinkersScreen() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [severityFilter, setSeverityFilter] = useState<string | undefined>();

  const { data: stinkers, isLoading, error, refetch, isRefetching } = trpc.stinkers.list.useQuery({
    status: statusFilter,
    severity: severityFilter,
  });

  const { data: stats } = trpc.stinkers.stats.useQuery();

  if (isLoading) return <LoadingScreen />;
  if (error) return <ErrorView error={error} onRetry={refetch} />;

  const getSeverityConfig = (severity: string) => {
    switch (severity) {
      case 'critical':
        return { bg: 'bg-red-100', text: 'text-red-700', label: 'Kritisk' };
      case 'high':
        return { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Høy' };
      case 'medium':
        return { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Medium' };
      default:
        return { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Lav' };
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'resolved':
        return { bg: 'bg-green-100', text: 'text-green-700', label: 'Løst' };
      case 'investigating':
        return { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Under undersøkelse' };
      default:
        return { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Åpen' };
    }
  };

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-primary pt-12 pb-6 px-4">
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <Text className="text-white text-2xl font-bold">Stinkere</Text>
            <Text className="text-white/70">Problematisk utstyr</Text>
          </View>
          <Pressable className="bg-accent px-4 py-2 rounded-lg flex-row items-center">
            <Plus size={18} color="white" />
            <Text className="text-white font-medium ml-1">Ny</Text>
          </Pressable>
        </View>

        {/* Stats */}
        <View className="flex-row gap-2">
          <View className="flex-1 bg-white/20 p-3 rounded-lg">
            <View className="flex-row items-center">
              <AlertOctagon size={16} color="white" />
              <Text className="text-white font-bold text-lg ml-2">{stats?.open || 0}</Text>
            </View>
            <Text className="text-white/70 text-xs">Åpne</Text>
          </View>
          <View className="flex-1 bg-white/20 p-3 rounded-lg">
            <View className="flex-row items-center">
              <AlertTriangle size={16} color="#ef4444" />
              <Text className="text-white font-bold text-lg ml-2">{stats?.critical || 0}</Text>
            </View>
            <Text className="text-white/70 text-xs">Kritiske</Text>
          </View>
          <View className="flex-1 bg-white/20 p-3 rounded-lg">
            <View className="flex-row items-center">
              <Hash size={16} color="white" />
              <Text className="text-white font-bold text-lg ml-2">{stats?.thisMonth || 0}</Text>
            </View>
            <Text className="text-white/70 text-xs">Denne mnd</Text>
          </View>
        </View>
      </View>

      <View className="px-4 py-2">
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[
            { value: undefined, label: 'Alle' },
            { value: 'open', label: 'Åpne' },
            { value: 'investigating', label: 'Under arbeid' },
            { value: 'resolved', label: 'Løst' },
          ]}
          keyExtractor={(item) => item.value || 'all'}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setStatusFilter(item.value)}
              className={`px-4 py-2 mr-2 rounded-full ${
                statusFilter === item.value ? 'bg-primary' : 'bg-gray-200'
              }`}
            >
              <Text className={statusFilter === item.value ? 'text-white' : 'text-gray-700'}>
                {item.label}
              </Text>
            </Pressable>
          )}
        />
      </View>

      <FlatList
        data={stinkers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#003366" />
        }
        renderItem={({ item }) => {
          const severityConfig = getSeverityConfig(item.severity);
          const statusConfig = getStatusConfig(item.status);

          return (
            <Pressable
              onPress={() => router.push(`/stinkers/${item.id}`)}
              className="bg-white p-4 rounded-xl shadow-sm mb-3 border border-gray-100"
            >
              <View className="flex-row items-start justify-between">
                <View className="flex-1">
                  <View className="flex-row items-center gap-2 mb-1 flex-wrap">
                    <Text className="text-primary font-bold">{item.stinkerNumber}</Text>
                    <View className={`px-2 py-0.5 rounded-full ${severityConfig.bg}`}>
                      <Text className={`text-xs font-medium ${severityConfig.text}`}>
                        {severityConfig.label}
                      </Text>
                    </View>
                    <View className={`px-2 py-0.5 rounded-full ${statusConfig.bg}`}>
                      <Text className={`text-xs font-medium ${statusConfig.text}`}>
                        {statusConfig.label}
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row items-center mt-1">
                    <Package size={14} color="#374151" />
                    <Text className="text-gray-900 font-medium ml-1">{item.productName}</Text>
                  </View>

                  {item.brand && (
                    <Text className="text-gray-600 text-sm mt-1">
                      {item.brand} {item.model ? `- ${item.model}` : ''}
                    </Text>
                  )}

                  {item.supplier && (
                    <View className="flex-row items-center mt-1">
                      <Building size={12} color="#9ca3af" />
                      <Text className="text-gray-500 text-sm ml-1">{item.supplier.name}</Text>
                    </View>
                  )}

                  <Text className="text-gray-600 text-sm mt-2" numberOfLines={2}>
                    {item.issueDescription}
                  </Text>

                  {item.totalIncidents && item.totalIncidents > 1 && (
                    <View className="mt-2 bg-red-50 px-2 py-1 rounded self-start">
                      <Text className="text-red-700 text-xs font-medium">
                        {item.totalIncidents} hendelser registrert
                      </Text>
                    </View>
                  )}
                </View>
                <ChevronRight size={20} color="#9ca3af" />
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View className="items-center py-12">
            <AlertOctagon size={48} color="#9ca3af" />
            <Text className="text-gray-500 mt-4">Ingen stinkere funnet</Text>
            <Text className="text-gray-400 text-sm mt-1">Det er bra!</Text>
          </View>
        }
      />
    </View>
  );
}
