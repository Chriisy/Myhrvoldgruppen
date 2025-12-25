import { View, Text, FlatList, RefreshControl, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { trpc } from '../../../src/lib/api';
import { LoadingScreen } from '../../../src/components/LoadingScreen';
import { ErrorView } from '../../../src/components/ErrorView';
import {
  Plus, MessageCircle, Users, Hash, Lock, Bell, BellOff, ChevronRight
} from 'lucide-react-native';

export default function ChatScreen() {
  const router = useRouter();

  const { data: channels, isLoading, error, refetch, isRefetching } = trpc.chat.myChannels.useQuery();
  const { data: stats } = trpc.chat.stats.useQuery();

  if (isLoading) return <LoadingScreen />;
  if (error) return <ErrorView error={error} onRetry={refetch} />;

  const formatTime = (date: Date | string | null) => {
    if (!date) return '';
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();

    if (diff < 60000) return 'Nå';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}t`;
    return d.toLocaleDateString('nb-NO', { day: '2-digit', month: 'short' });
  };

  const getChannelIcon = (type: string, isPrivate: boolean) => {
    if (type === 'direct') return Users;
    if (isPrivate) return Lock;
    return Hash;
  };

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-primary pt-12 pb-6 px-4">
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <Text className="text-white text-2xl font-bold">Chat</Text>
            <Text className="text-white/70">{stats?.channelCount || 0} kanaler</Text>
          </View>
          <Pressable
            onPress={() => router.push('/chat/new')}
            className="bg-accent px-4 py-2 rounded-lg flex-row items-center"
          >
            <Plus size={18} color="white" />
            <Text className="text-white font-medium ml-1">Ny</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={channels}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#003366" />
        }
        renderItem={({ item }) => {
          const ChannelIcon = getChannelIcon(item.type, item.isPrivate || false);
          const hasUnread = item.membership?.lastReadAt && item.lastMessageAt &&
            new Date(item.lastMessageAt) > new Date(item.membership.lastReadAt);

          return (
            <Pressable
              onPress={() => router.push(`/chat/${item.id}`)}
              className={`bg-white p-4 rounded-xl shadow-sm mb-3 border ${
                hasUnread ? 'border-primary' : 'border-gray-100'
              }`}
            >
              <View className="flex-row items-center">
                <View className={`w-10 h-10 rounded-full items-center justify-center ${
                  item.type === 'announcement' ? 'bg-yellow-100' :
                  item.isPrivate ? 'bg-purple-100' : 'bg-blue-100'
                }`}>
                  <ChannelIcon size={20} color={
                    item.type === 'announcement' ? '#f59e0b' :
                    item.isPrivate ? '#8b5cf6' : '#3b82f6'
                  } />
                </View>

                <View className="flex-1 ml-3">
                  <View className="flex-row items-center">
                    <Text className={`font-medium ${hasUnread ? 'text-primary font-bold' : 'text-gray-900'}`}>
                      {item.name}
                    </Text>
                    {item.membership?.isMuted && (
                      <BellOff size={12} color="#9ca3af" className="ml-2" />
                    )}
                  </View>
                  {item.description && (
                    <Text className="text-gray-500 text-sm" numberOfLines={1}>
                      {item.description}
                    </Text>
                  )}
                </View>

                <View className="items-end">
                  {item.lastMessageAt && (
                    <Text className="text-gray-400 text-xs">
                      {formatTime(item.lastMessageAt)}
                    </Text>
                  )}
                  {hasUnread && (
                    <View className="w-2 h-2 rounded-full bg-primary mt-1" />
                  )}
                </View>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View className="items-center py-12">
            <MessageCircle size={48} color="#9ca3af" />
            <Text className="text-gray-500 mt-4">Ingen kanaler</Text>
            <Text className="text-gray-400 text-sm mt-1">Opprett en ny kanal for å starte</Text>
          </View>
        }
      />
    </View>
  );
}
