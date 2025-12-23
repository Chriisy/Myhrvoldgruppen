import { useState } from 'react';
import { View, Text, FlatList, RefreshControl, Pressable, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { trpc } from '../../../src/lib/api';
import { LoadingScreen } from '../../../src/components/LoadingScreen';
import { ErrorView } from '../../../src/components/ErrorView';
import {
  Plus, MessageSquare, Search, Pin, Lock, CheckCircle, User,
  MessageCircle, ChevronRight, Clock
} from 'lucide-react-native';

export default function ForumScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>();

  const { data: issues, isLoading, error, refetch, isRefetching } = trpc.forum.issuesList.useQuery({
    search: search || undefined,
    category: categoryFilter,
  });

  const { data: categories } = trpc.forum.categories.useQuery();
  const { data: stats } = trpc.forum.stats.useQuery();

  if (isLoading) return <LoadingScreen />;
  if (error) return <ErrorView error={error} onRetry={refetch} />;

  const formatDate = (date: Date | string | null) => {
    if (!date) return '';
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();

    if (diff < 3600000) return `${Math.floor(diff / 60000)} min siden`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} timer siden`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} dager siden`;
    return d.toLocaleDateString('nb-NO', { day: '2-digit', month: 'short' });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-700';
      case 'high': return 'bg-orange-100 text-orange-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-primary pt-12 pb-4 px-4">
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <Text className="text-white text-2xl font-bold">Forum</Text>
            <Text className="text-white/70">{stats?.total || 0} diskusjoner</Text>
          </View>
          <Pressable
            onPress={() => router.push('/forum/new')}
            className="bg-accent px-4 py-2 rounded-lg flex-row items-center"
          >
            <Plus size={18} color="white" />
            <Text className="text-white font-medium ml-1">Ny</Text>
          </Pressable>
        </View>

        {/* Stats */}
        <View className="flex-row gap-2 mb-4">
          <View className="flex-1 bg-white/20 p-3 rounded-lg">
            <Text className="text-white font-bold text-lg">{stats?.open || 0}</Text>
            <Text className="text-white/70 text-xs">Åpne</Text>
          </View>
          <View className="flex-1 bg-white/20 p-3 rounded-lg">
            <Text className="text-white font-bold text-lg">{stats?.thisWeek || 0}</Text>
            <Text className="text-white/70 text-xs">Denne uka</Text>
          </View>
          <View className="flex-1 bg-white/20 p-3 rounded-lg">
            <Text className="text-white font-bold text-lg">{stats?.myIssues || 0}</Text>
            <Text className="text-white/70 text-xs">Mine</Text>
          </View>
        </View>

        {/* Search */}
        <View className="flex-row bg-white rounded-lg px-3 py-2 items-center">
          <Search size={18} color="#9ca3af" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Søk i forum..."
            className="flex-1 ml-2 text-gray-900"
            placeholderTextColor="#9ca3af"
          />
        </View>
      </View>

      {/* Category filter */}
      <View className="px-4 py-2">
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[{ id: undefined, name: 'Alle' }, ...(categories || [])]}
          keyExtractor={(item) => item.id || 'all'}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setCategoryFilter(item.id)}
              className={`px-4 py-2 mr-2 rounded-full ${
                categoryFilter === item.id ? 'bg-primary' : 'bg-gray-200'
              }`}
            >
              <Text className={categoryFilter === item.id ? 'text-white' : 'text-gray-700'}>
                {item.name}
              </Text>
            </Pressable>
          )}
        />
      </View>

      <FlatList
        data={issues}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#003366" />
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/forum/${item.id}`)}
            className="bg-white p-4 rounded-xl shadow-sm mb-3 border border-gray-100"
          >
            <View className="flex-row items-start">
              {item.isPinned && (
                <Pin size={14} color="#f59e0b" className="mt-1 mr-2" />
              )}
              <View className="flex-1">
                <View className="flex-row items-center gap-2 flex-wrap mb-1">
                  <Text className="text-gray-900 font-semibold flex-1" numberOfLines={2}>
                    {item.title}
                  </Text>
                  {item.isLocked && <Lock size={12} color="#9ca3af" />}
                  {item.status === 'resolved' && (
                    <CheckCircle size={14} color="#22c55e" />
                  )}
                </View>

                <View className="flex-row items-center gap-2 mt-2">
                  {item.category && (
                    <View className="px-2 py-0.5 rounded-full bg-blue-100">
                      <Text className="text-blue-700 text-xs">{item.category}</Text>
                    </View>
                  )}
                  {item.priority && item.priority !== 'normal' && (
                    <View className={`px-2 py-0.5 rounded-full ${getPriorityColor(item.priority)}`}>
                      <Text className="text-xs">
                        {item.priority === 'urgent' ? 'Haster' :
                         item.priority === 'high' ? 'Høy' : item.priority}
                      </Text>
                    </View>
                  )}
                </View>

                <View className="flex-row items-center mt-3 gap-4">
                  <View className="flex-row items-center">
                    <User size={12} color="#9ca3af" />
                    <Text className="text-gray-500 text-xs ml-1">
                      {item.createdBy?.firstName} {item.createdBy?.lastName}
                    </Text>
                  </View>
                  <View className="flex-row items-center">
                    <MessageCircle size={12} color="#9ca3af" />
                    <Text className="text-gray-500 text-xs ml-1">{item.replyCount}</Text>
                  </View>
                  <View className="flex-row items-center">
                    <Clock size={12} color="#9ca3af" />
                    <Text className="text-gray-500 text-xs ml-1">
                      {formatDate(item.lastActivityAt)}
                    </Text>
                  </View>
                </View>
              </View>
              <ChevronRight size={20} color="#9ca3af" />
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          <View className="items-center py-12">
            <MessageSquare size={48} color="#9ca3af" />
            <Text className="text-gray-500 mt-4">Ingen diskusjoner</Text>
            <Text className="text-gray-400 text-sm mt-1">Start en ny diskusjon</Text>
          </View>
        }
      />
    </View>
  );
}
