import { useState } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { trpc } from '../../../src/lib/api';
import { LoadingScreen } from '../../../src/components/LoadingScreen';
import { ErrorView } from '../../../src/components/ErrorView';
import {
  Plus, Package, Calendar, User, ChevronRight, CheckCircle, Clock, AlertTriangle, Box
} from 'lucide-react-native';

export default function LoansScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<'active' | 'returned' | undefined>(undefined);

  const { data: loans, isLoading, error, refetch, isRefetching } = trpc.loans.loansList.useQuery({
    status: filter,
  });

  const { data: stats } = trpc.loans.stats.useQuery();

  if (isLoading) return <LoadingScreen />;
  if (error) return <ErrorView error={error} onRetry={refetch} />;

  const statItems = [
    { label: 'Totalt utstyr', value: stats?.totalEquipment || 0, icon: Box, color: '#3b82f6' },
    { label: 'Tilgjengelig', value: stats?.available || 0, icon: CheckCircle, color: '#22c55e' },
    { label: 'Utlånt', value: stats?.onLoan || 0, icon: Clock, color: '#f59e0b' },
    { label: 'Aktive lån', value: stats?.activeLoans || 0, icon: Package, color: '#8b5cf6' },
  ];

  const formatDate = (date: Date | string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('nb-NO', {
      day: '2-digit',
      month: 'short',
    });
  };

  const isOverdue = (expectedDate: Date | string | null) => {
    if (!expectedDate) return false;
    return new Date(expectedDate) < new Date();
  };

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-primary pt-12 pb-6 px-4">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-white text-2xl font-bold">Låneutstyr</Text>
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => router.push('/loans/equipment')}
              className="bg-white/20 px-3 py-2 rounded-lg flex-row items-center"
            >
              <Box size={16} color="white" />
              <Text className="text-white font-medium ml-1">Utstyr</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/loans/new')}
              className="bg-accent px-3 py-2 rounded-lg flex-row items-center"
            >
              <Plus size={16} color="white" />
              <Text className="text-white font-medium ml-1">Nytt lån</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <FlatList
        data={loans}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        ListHeaderComponent={
          <>
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

            <View className="flex-row gap-2 mb-4">
              {[
                { value: undefined, label: 'Alle' },
                { value: 'active' as const, label: 'Aktive' },
                { value: 'returned' as const, label: 'Returnert' },
              ].map((item) => (
                <Pressable
                  key={item.label}
                  onPress={() => setFilter(item.value)}
                  className={`px-4 py-2 rounded-full ${
                    filter === item.value ? 'bg-primary' : 'bg-gray-200'
                  }`}
                >
                  <Text className={filter === item.value ? 'text-white' : 'text-gray-700'}>
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        }
        renderItem={({ item }) => {
          const overdue = item.status === 'active' && isOverdue(item.expectedReturnDate);

          return (
            <Pressable
              onPress={() => router.push(`/loans/${item.id}`)}
              className={`bg-white p-4 rounded-xl shadow-sm mb-3 border ${
                overdue ? 'border-red-300' : 'border-gray-100'
              }`}
            >
              <View className="flex-row items-start justify-between">
                <View className="flex-1">
                  <View className="flex-row items-center gap-2 mb-1">
                    <Text className="text-primary font-bold">{item.loanNumber}</Text>
                    <View className={`px-2 py-0.5 rounded-full ${
                      item.status === 'returned' ? 'bg-green-100' :
                      overdue ? 'bg-red-100' : 'bg-yellow-100'
                    }`}>
                      <Text className={`text-xs font-medium ${
                        item.status === 'returned' ? 'text-green-700' :
                        overdue ? 'text-red-700' : 'text-yellow-700'
                      }`}>
                        {item.status === 'returned' ? 'Returnert' :
                         overdue ? 'Forfalt' : 'Aktiv'}
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row items-center mt-1">
                    <Package size={14} color="#9ca3af" />
                    <Text className="text-gray-900 font-medium ml-1">
                      {item.equipment?.name}
                    </Text>
                  </View>

                  <View className="flex-row items-center mt-1">
                    <User size={12} color="#9ca3af" />
                    <Text className="text-gray-600 text-sm ml-1">
                      {item.customer?.name}
                    </Text>
                  </View>

                  <View className="flex-row items-center mt-2 gap-4">
                    <View className="flex-row items-center">
                      <Calendar size={12} color="#9ca3af" />
                      <Text className="text-gray-500 text-xs ml-1">
                        Ut: {formatDate(item.loanDate)}
                      </Text>
                    </View>
                    {item.expectedReturnDate && (
                      <View className="flex-row items-center">
                        {overdue ? (
                          <AlertTriangle size={12} color="#ef4444" />
                        ) : (
                          <Calendar size={12} color="#9ca3af" />
                        )}
                        <Text className={`text-xs ml-1 ${overdue ? 'text-red-600' : 'text-gray-500'}`}>
                          Retur: {formatDate(item.expectedReturnDate)}
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
            <Package size={48} color="#9ca3af" />
            <Text className="text-gray-500 mt-4">Ingen lån funnet</Text>
          </View>
        }
      />
    </View>
  );
}
