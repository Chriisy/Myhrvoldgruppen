import { useState } from 'react';
import { View, Text, FlatList, RefreshControl, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { trpc } from '../../../src/lib/api';
import { LoadingScreen } from '../../../src/components/LoadingScreen';
import { ErrorView } from '../../../src/components/ErrorView';
import {
  Plus, Calendar, Clock, CheckCircle, MapPin, ChevronRight, User
} from 'lucide-react-native';

export default function VisitsListScreen() {
  const router = useRouter();

  const { data: visits, isLoading, error, refetch, isRefetching } = trpc.visits.list.useQuery({
    page: 1,
    limit: 50,
  });

  const { data: stats } = trpc.visits.stats.useQuery();

  if (isLoading) return <LoadingScreen />;
  if (error) return <ErrorView error={error} onRetry={refetch} />;

  const statItems = [
    { label: 'I dag', value: stats?.today || 0, icon: Calendar, color: '#3b82f6' },
    { label: 'Denne uka', value: stats?.thisWeek || 0, icon: Clock, color: '#8b5cf6' },
    { label: 'Planlagt', value: stats?.planned || 0, icon: MapPin, color: '#f59e0b' },
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

  const formatTime = (date: Date | string | null) => {
    if (!date) return '';
    return new Date(date).toLocaleTimeString('nb-NO', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return { bg: 'bg-green-100', text: 'text-green-700' };
      case 'in_progress': return { bg: 'bg-blue-100', text: 'text-blue-700' };
      case 'confirmed': return { bg: 'bg-purple-100', text: 'text-purple-700' };
      default: return { bg: 'bg-yellow-100', text: 'text-yellow-700' };
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'Fullført';
      case 'in_progress': return 'Pågår';
      case 'confirmed': return 'Bekreftet';
      case 'cancelled': return 'Avlyst';
      default: return 'Planlagt';
    }
  };

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-primary pt-12 pb-6 px-4">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-white text-2xl font-bold">Servicebesøk</Text>
          <Pressable className="bg-accent px-4 py-2 rounded-lg flex-row items-center">
            <Plus size={18} color="white" />
            <Text className="text-white font-medium ml-1">Nytt</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={visits}
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
        renderItem={({ item }) => {
          const statusColors = getStatusColor(item.status);
          return (
            <Pressable
              onPress={() => router.push(`/visits/${item.id}`)}
              className="bg-white p-4 rounded-xl shadow-sm mb-3 border border-gray-100"
            >
              <View className="flex-row items-start justify-between">
                <View className="flex-1">
                  <View className="flex-row items-center gap-2 mb-1">
                    <Text className="text-primary font-bold">{item.visitNumber}</Text>
                    <View className={`px-2 py-0.5 rounded-full ${statusColors.bg}`}>
                      <Text className={`text-xs font-medium ${statusColors.text}`}>
                        {getStatusLabel(item.status)}
                      </Text>
                    </View>
                  </View>
                  <Text className="text-gray-900 font-medium">{item.customer?.name}</Text>
                  <View className="flex-row items-center mt-2 gap-4">
                    <View className="flex-row items-center">
                      <Calendar size={12} color="#9ca3af" />
                      <Text className="text-xs text-gray-500 ml-1">
                        {formatDate(item.plannedDate)}
                      </Text>
                    </View>
                    {item.plannedDate && (
                      <View className="flex-row items-center">
                        <Clock size={12} color="#9ca3af" />
                        <Text className="text-xs text-gray-500 ml-1">
                          {formatTime(item.plannedDate)}
                        </Text>
                      </View>
                    )}
                  </View>
                  {item.technician && (
                    <View className="flex-row items-center mt-1">
                      <User size={12} color="#9ca3af" />
                      <Text className="text-xs text-gray-500 ml-1">
                        {item.technician.firstName} {item.technician.lastName}
                      </Text>
                    </View>
                  )}
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
            <Text className="text-gray-500">Ingen besøk funnet</Text>
          </View>
        }
      />
    </View>
  );
}
