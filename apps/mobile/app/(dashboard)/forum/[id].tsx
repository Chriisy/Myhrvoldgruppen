import { View, Text, ScrollView, ActivityIndicator, Pressable, TextInput } from 'react-native';
import { useState } from 'react';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { trpc } from '../../../src/lib/trpc';
import { ErrorView } from '../../../src/components/ErrorView';

export default function ForumThreadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [replyContent, setReplyContent] = useState('');

  const { data: thread, isLoading, error, refetch } = trpc.forum.threadById.useQuery(
    { id: id! },
    { enabled: !!id }
  );

  const utils = trpc.useUtils();
  const replyMutation = trpc.forum.reply.useMutation({
    onSuccess: () => {
      setReplyContent('');
      utils.forum.threadById.invalidate({ id: id! });
    },
  });

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#003366" />
      </View>
    );
  }

  if (error || !thread) {
    return <ErrorView message="Kunne ikke laste trad" onRetry={refetch} />;
  }

  const handleReply = () => {
    if (!replyContent.trim()) return;
    replyMutation.mutate({
      threadId: id!,
      content: replyContent.trim(),
    });
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'general': return 'bg-blue-100 text-blue-800';
      case 'technical': return 'bg-purple-100 text-purple-800';
      case 'news': return 'bg-green-100 text-green-800';
      case 'help': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'general': return 'Generelt';
      case 'technical': return 'Teknisk';
      case 'news': return 'Nyheter';
      case 'help': return 'Hjelp';
      default: return category;
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Forumtrad',
          headerBackTitle: 'Tilbake',
        }}
      />
      <View className="flex-1 bg-gray-50">
        <ScrollView className="flex-1">
          {/* Original Post */}
          <View className="bg-white m-4 p-4 rounded-xl shadow-sm">
            <View className="flex-row justify-between items-start mb-3">
              <View className={`px-3 py-1 rounded-full ${getCategoryColor(thread.category)}`}>
                <Text className="text-sm font-medium">
                  {getCategoryLabel(thread.category)}
                </Text>
              </View>
              {thread.isPinned && (
                <View className="bg-yellow-100 px-2 py-1 rounded-full">
                  <Text className="text-yellow-800 text-xs">Festet</Text>
                </View>
              )}
            </View>

            <Text className="text-xl font-bold text-gray-900 mb-2">
              {thread.title}
            </Text>

            <Text className="text-gray-700 leading-relaxed mb-4">
              {thread.content}
            </Text>

            <View className="border-t border-gray-100 pt-3 flex-row items-center justify-between">
              <View className="flex-row items-center">
                <View className="w-8 h-8 rounded-full bg-blue-100 items-center justify-center mr-2">
                  <Text className="text-blue-800 font-semibold text-sm">
                    {thread.author?.firstName?.[0] || 'U'}
                  </Text>
                </View>
                <View>
                  <Text className="text-sm font-medium text-gray-900">
                    {thread.author?.firstName} {thread.author?.lastName}
                  </Text>
                  <Text className="text-xs text-gray-500">
                    {new Date(thread.createdAt).toLocaleDateString('nb-NO', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              </View>

              <View className="flex-row">
                <Text className="text-sm text-gray-500">
                  {thread.viewCount || 0} visninger
                </Text>
              </View>
            </View>
          </View>

          {/* Replies */}
          {thread.replies && thread.replies.length > 0 && (
            <View className="mx-4 mb-4">
              <Text className="text-lg font-semibold text-gray-900 mb-3">
                {thread.replies.length} svar
              </Text>

              {thread.replies.map((reply: any, index: number) => (
                <View key={reply.id} className="bg-white p-4 rounded-xl shadow-sm mb-3">
                  <Text className="text-gray-700 leading-relaxed mb-3">
                    {reply.content}
                  </Text>

                  <View className="border-t border-gray-100 pt-3 flex-row items-center justify-between">
                    <View className="flex-row items-center">
                      <View className="w-6 h-6 rounded-full bg-gray-100 items-center justify-center mr-2">
                        <Text className="text-gray-600 font-semibold text-xs">
                          {reply.author?.firstName?.[0] || 'U'}
                        </Text>
                      </View>
                      <Text className="text-sm text-gray-600">
                        {reply.author?.firstName} {reply.author?.lastName}
                      </Text>
                    </View>
                    <Text className="text-xs text-gray-500">
                      {new Date(reply.createdAt).toLocaleDateString('nb-NO', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>

                  {reply.isSolution && (
                    <View className="bg-green-100 px-3 py-1 rounded-full mt-2 self-start">
                      <Text className="text-green-800 text-sm font-medium">Losning</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Empty State */}
          {(!thread.replies || thread.replies.length === 0) && (
            <View className="mx-4 mb-4 bg-white p-8 rounded-xl items-center">
              <Text className="text-gray-500 text-center">
                Ingen svar enna. Var den forste til a svare!
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Reply Input */}
        <View className="bg-white border-t border-gray-200 p-4">
          <View className="flex-row items-end">
            <TextInput
              className="flex-1 bg-gray-100 rounded-xl px-4 py-3 mr-3 max-h-32"
              placeholder="Skriv et svar..."
              value={replyContent}
              onChangeText={setReplyContent}
              multiline
            />
            <Pressable
              className={`px-4 py-3 rounded-xl ${
                replyContent.trim() && !replyMutation.isPending
                  ? 'bg-blue-600 active:bg-blue-700'
                  : 'bg-gray-300'
              }`}
              onPress={handleReply}
              disabled={!replyContent.trim() || replyMutation.isPending}
            >
              {replyMutation.isPending ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text className="text-white font-semibold">Send</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </>
  );
}
