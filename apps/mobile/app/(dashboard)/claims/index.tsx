import { useState } from 'react';
import { View, Text, FlatList, RefreshControl, TextInput, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { trpc } from '../../../src/lib/api';
import { ClaimCard } from '../../../src/features/claims/components/ClaimCard';
import { LoadingScreen } from '../../../src/components/LoadingScreen';
import { ErrorView } from '../../../src/components/ErrorView';
import { Search, Plus, FileText, Clock, CheckCircle, AlertTriangle } from 'lucide-react-native';

export default function ClaimsListScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [search, setSearch] = useState('');

  const {
    data: claims,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = trpc.claims.list.useQuery({
    page: 1,
    limit: 50,
    search: search || undefined,
  });

  const { data: stats } = trpc.claims.stats.useQuery();

  if (isLoading) return <LoadingScreen />;
  if (error) return <ErrorView error={error} onRetry={refetch} />;

  const statItems = [
    { label: 'Nye', value: stats?.new || 0, icon: FileText, color: '#3b82f6' },
    { label: 'Behandles', value: stats?.inProgress || 0, icon: Clock, color: '#eab308' },
    { label: 'Venter', value: stats?.pendingSupplier || 0, icon: AlertTriangle, color: '#f97316' },
    { label: 'Løst', value: stats?.resolved || 0, icon: CheckCircle, color: '#22c55e' },
  ];

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-primary pt-12 pb-6 px-4">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-white text-2xl font-bold">
            {t('claims.title')}
          </Text>
          <Pressable
            onPress={() => router.push('/claims/new')}
            className="bg-accent px-4 py-2 rounded-lg flex-row items-center"
          >
            <Plus size={18} color="white" />
            <Text className="text-white font-medium ml-1">Ny</Text>
          </Pressable>
        </View>

        <View className="flex-row items-center bg-white/10 rounded-lg px-3 py-2">
          <Search size={20} color="rgba(255,255,255,0.7)" />
          <TextInput
            className="flex-1 ml-2 text-white"
            placeholder={t('common.search')}
            placeholderTextColor="rgba(255,255,255,0.5)"
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      <FlatList
        data={claims}
        renderItem={({ item }) => <ClaimCard claim={item} />}
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
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor="#003366"
          />
        }
        ListEmptyComponent={
          <View className="items-center py-12">
            <Text className="text-gray-500">{t('common.noResults')}</Text>
          </View>
        }
      />
    </View>
  );
}
