import { useState } from 'react';
import { View, Text, FlatList, RefreshControl, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { trpc } from '../../../src/lib/api';
import { LoadingScreen } from '../../../src/components/LoadingScreen';
import { ErrorView } from '../../../src/components/ErrorView';
import {
  Plus, Truck, Calendar, Clock, CheckCircle, MapPin, ChevronRight, User, Package
} from 'lucide-react-native';

export default function InstallationsScreen() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();

  const { data: installations, isLoading, error, refetch, isRefetching } = trpc.installations.list.useQuery({
    status: statusFilter,
  });

  const { data: stats } = trpc.installations.stats.useQuery();

  if (isLoading) return <LoadingScreen />;
  if (error) return <ErrorView error={error} onRetry={refetch} />;

  const statItems = [
    { label: 'Planlagt', value: stats?.planned || 0, icon: Calendar, color: '#3b82f6' },
    { label: 'Denne uka', value: stats?.thisWeek || 0, icon: Clock, color: '#8b5cf6' },
    { label: 'Fullført', value: stats?.completed || 0, icon: CheckCircle, color: '#22c55e' },
  ];

  const formatDate = (date: Date | string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('nb-NO', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    });
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'completed':
        return { bg: 'bg-green-100', text: 'text-green-700', label: 'Fullført' };
      case 'in_progress':
        return { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Pågår' };
      case 'confirmed':
        return { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Bekreftet' };
      case 'cancelled':
        return { bg: 'bg-red-100', text: 'text-red-700', label: 'Avlyst' };
      default:
        return { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Planlagt' };
    }
  };

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-primary pt-12 pb-6 px-4">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-white text-2xl font-bold">Installasjoner</Text>
          <Pressable className="bg-accent px-4 py-2 rounded-lg flex-row items-center">
            <Plus size={18} color="white" />
            <Text className="text-white font-medium ml-1">Ny</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={installations}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        ListHeaderComponent={
          <>
            <View className="flex-row gap-2 mb-4">
              {statItems.map((stat) => (
                <View key={stat.label} className="flex-1 bg-white p-3 rounded-lg">
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

            <View className="flex-row gap-2 mb-4">
              {[
                { value: undefined, label: 'Alle' },
                { value: 'planned', label: 'Planlagt' },
                { value: 'confirmed', label: 'Bekreftet' },
                { value: 'completed', label: 'Fullført' },
              ].map((item) => (
                <Pressable
                  key={item.label}
                  onPress={() => setStatusFilter(item.value)}
                  className={`px-3 py-2 rounded-full ${
                    statusFilter === item.value ? 'bg-primary' : 'bg-gray-200'
                  }`}
                >
                  <Text className={`text-sm ${statusFilter === item.value ? 'text-white' : 'text-gray-700'}`}>
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        }
        renderItem={({ item }) => {
          const statusConfig = getStatusConfig(item.status);

          return (
            <Pressable
              onPress={() => router.push(`/installations/${item.id}`)}
              className="bg-white p-4 rounded-xl shadow-sm mb-3 border border-gray-100"
            >
              <View className="flex-row items-start justify-between">
                <View className="flex-1">
                  <View className="flex-row items-center gap-2 mb-1">
                    <Text className="text-primary font-bold">{item.installationNumber}</Text>
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

                  <View className="flex-row items-center mt-1">
                    <User size={12} color="#9ca3af" />
                    <Text className="text-gray-600 text-sm ml-1">{item.customer?.name}</Text>
                  </View>

                  <View className="flex-row items-center mt-2 gap-4">
                    <View className="flex-row items-center">
                      <Calendar size={12} color="#9ca3af" />
                      <Text className="text-xs text-gray-500 ml-1">
                        {formatDate(item.plannedDate)}
                      </Text>
                    </View>
                    {item.installationCity && (
                      <View className="flex-row items-center">
                        <MapPin size={12} color="#9ca3af" />
                        <Text className="text-xs text-gray-500 ml-1">
                          {item.installationCity}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                <ChevronRight size={20} color="#9ca3af" />
              </View>
            </Pressable>
          );
        }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#003366" />
        }
        ListEmptyComponent={
          <View className="items-center py-12">
            <Truck size={48} color="#9ca3af" />
            <Text className="text-gray-500 mt-4">Ingen installasjoner funnet</Text>
          </View>
        }
      />
    </View>
  );
}
