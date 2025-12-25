import { View, Text, ScrollView, ActivityIndicator, Pressable, TextInput, FlatList } from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { trpc } from '../../../src/lib/trpc';
import { ErrorView } from '../../../src/components/ErrorView';

export default function ChatChannelScreen() {
  const { channelId } = useLocalSearchParams<{ channelId: string }>();
  const [message, setMessage] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);

  const { data: channel, isLoading: channelLoading, error: channelError } = trpc.chat.channelById.useQuery(
    { id: channelId! },
    { enabled: !!channelId }
  );

  const { data: messages, isLoading: messagesLoading, error: messagesError, refetch } = trpc.chat.messages.useQuery(
    { channelId: channelId!, limit: 50 },
    { enabled: !!channelId, refetchInterval: 5000 } // Poll every 5 seconds
  );

  const utils = trpc.useUtils();
  const sendMutation = trpc.chat.sendMessage.useMutation({
    onSuccess: () => {
      setMessage('');
      utils.chat.messages.invalidate({ channelId: channelId! });
    },
  });

  const markAsReadMutation = trpc.chat.markAsRead.useMutation();

  useEffect(() => {
    if (channelId) {
      markAsReadMutation.mutate({ channelId });
    }
  }, [channelId]);

  useEffect(() => {
    // Scroll to bottom when messages change
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  if (channelLoading || messagesLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#003366" />
      </View>
    );
  }

  if (channelError || !channel) {
    return <ErrorView message="Kunne ikke laste kanal" onRetry={refetch} />;
  }

  const handleSend = () => {
    if (!message.trim()) return;
    sendMutation.mutate({
      channelId: channelId!,
      content: message.trim(),
    });
  };

  const formatTime = (date: string | Date) => {
    return new Date(date).toLocaleTimeString('nb-NO', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (date: string | Date) => {
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) {
      return 'I dag';
    } else if (d.toDateString() === yesterday.toDateString()) {
      return 'I gar';
    } else {
      return d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' });
    }
  };

  // Group messages by date
  const groupedMessages: { date: string; messages: any[] }[] = [];
  let currentDate = '';
  messages?.forEach((msg: any) => {
    const msgDate = formatDate(msg.createdAt);
    if (msgDate !== currentDate) {
      currentDate = msgDate;
      groupedMessages.push({ date: msgDate, messages: [msg] });
    } else {
      groupedMessages[groupedMessages.length - 1].messages.push(msg);
    }
  });

  return (
    <>
      <Stack.Screen
        options={{
          title: channel.type === 'direct' ? 'Direktemelding' : `#${channel.name}`,
          headerBackTitle: 'Tilbake',
        }}
      />
      <View className="flex-1 bg-gray-50">
        {/* Messages */}
        <ScrollView
          ref={scrollViewRef}
          className="flex-1 px-4"
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 16 }}
        >
          {groupedMessages.map((group, groupIndex) => (
            <View key={groupIndex}>
              {/* Date Separator */}
              <View className="flex-row items-center my-4">
                <View className="flex-1 h-px bg-gray-300" />
                <Text className="mx-3 text-xs text-gray-500 font-medium">
                  {group.date}
                </Text>
                <View className="flex-1 h-px bg-gray-300" />
              </View>

              {/* Messages for this date */}
              {group.messages.map((msg: any, msgIndex: number) => {
                const isOwnMessage = msg.sender?.id === channel.createdById; // TODO: Get current user ID

                return (
                  <View
                    key={msg.id}
                    className={`mb-3 ${isOwnMessage ? 'items-end' : 'items-start'}`}
                  >
                    <View className="flex-row items-end max-w-[80%]">
                      {!isOwnMessage && (
                        <View className="w-8 h-8 rounded-full bg-blue-100 items-center justify-center mr-2">
                          <Text className="text-blue-800 font-semibold text-sm">
                            {msg.sender?.firstName?.[0] || 'U'}
                          </Text>
                        </View>
                      )}

                      <View>
                        {!isOwnMessage && (
                          <Text className="text-xs text-gray-500 mb-1 ml-1">
                            {msg.sender?.firstName} {msg.sender?.lastName}
                          </Text>
                        )}
                        <View
                          className={`px-4 py-2 rounded-2xl ${
                            isOwnMessage
                              ? 'bg-blue-600 rounded-br-sm'
                              : 'bg-white rounded-bl-sm shadow-sm'
                          }`}
                        >
                          <Text
                            className={`${isOwnMessage ? 'text-white' : 'text-gray-900'}`}
                          >
                            {msg.content}
                          </Text>
                        </View>
                        <Text className={`text-xs text-gray-400 mt-1 ${isOwnMessage ? 'text-right mr-1' : 'ml-1'}`}>
                          {formatTime(msg.createdAt)}
                          {msg.isEdited && ' (redigert)'}
                        </Text>
                      </View>
                    </View>

                    {/* Reactions */}
                    {msg.reactions && msg.reactions.length > 0 && (
                      <View className="flex-row mt-1 ml-10">
                        {msg.reactions.map((reaction: any, rIndex: number) => (
                          <View
                            key={rIndex}
                            className="bg-gray-100 px-2 py-0.5 rounded-full mr-1"
                          >
                            <Text className="text-sm">{reaction.emoji}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          ))}

          {/* Empty State */}
          {(!messages || messages.length === 0) && (
            <View className="flex-1 items-center justify-center py-16">
              <Text className="text-gray-500 text-center">
                Ingen meldinger enna.{'\n'}Start samtalen!
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Message Input */}
        <View className="bg-white border-t border-gray-200 p-4">
          <View className="flex-row items-end">
            <TextInput
              className="flex-1 bg-gray-100 rounded-full px-4 py-3 mr-3 max-h-32"
              placeholder="Skriv en melding..."
              value={message}
              onChangeText={setMessage}
              multiline
            />
            <Pressable
              className={`w-12 h-12 rounded-full items-center justify-center ${
                message.trim() && !sendMutation.isPending
                  ? 'bg-blue-600 active:bg-blue-700'
                  : 'bg-gray-300'
              }`}
              onPress={handleSend}
              disabled={!message.trim() || sendMutation.isPending}
            >
              {sendMutation.isPending ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text className="text-white text-lg">{">"}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </>
  );
}
