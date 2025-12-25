import { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { trpc } from '../../src/lib/api';
import { LoadingScreen } from '../../src/components/LoadingScreen';
import { ErrorView } from '../../src/components/ErrorView';
import {
  ArrowLeft, Package, Building, Calendar, FileText, AlertTriangle,
  CheckCircle, XCircle, HelpCircle, Send
} from 'lucide-react-native';

type ResponseType = 'approved' | 'rejected' | 'needs_info';

export default function PortalClaimScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const [selectedResponse, setSelectedResponse] = useState<ResponseType | null>(null);
  const [message, setMessage] = useState('');
  const [creditAmount, setCreditAmount] = useState('');

  const { data: claim, isLoading, error, refetch } = trpc.portal.getByCode.useQuery(
    { code: code! },
    { enabled: !!code }
  );

  const respondMutation = trpc.portal.respond.useMutation({
    onSuccess: () => {
      Alert.alert(
        'Svar sendt',
        'Takk for ditt svar. Myhrvoldgruppen vil behandle saken videre.',
        [{ text: 'OK', onPress: () => router.replace('/portal/success') }]
      );
    },
    onError: (err) => {
      Alert.alert('Feil', err.message);
    },
  });

  if (isLoading) return <LoadingScreen />;
  if (error) return <ErrorView error={error} onRetry={refetch} />;
  if (!claim) return <ErrorView error={new Error('Ikke funnet')} />;

  const formatDate = (date: Date | string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('nb-NO', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const handleSubmit = () => {
    if (!selectedResponse || !message.trim()) {
      Alert.alert('Feil', 'Velg et svar og skriv en melding');
      return;
    }

    respondMutation.mutate({
      code: code!,
      response: selectedResponse,
      message: message.trim(),
      creditAmount: creditAmount ? parseFloat(creditAmount) : undefined,
    });
  };

  const responseOptions = [
    {
      value: 'approved' as const,
      label: 'Godkjent',
      description: 'Reklamasjonen godkjennes',
      icon: CheckCircle,
      color: '#22c55e',
      bg: 'bg-green-50',
      border: 'border-green-500',
    },
    {
      value: 'rejected' as const,
      label: 'Avvist',
      description: 'Reklamasjonen avvises',
      icon: XCircle,
      color: '#ef4444',
      bg: 'bg-red-50',
      border: 'border-red-500',
    },
    {
      value: 'needs_info' as const,
      label: 'Trenger mer info',
      description: 'Vi trenger mer informasjon',
      icon: HelpCircle,
      color: '#f59e0b',
      bg: 'bg-yellow-50',
      border: 'border-yellow-500',
    },
  ];

  if (claim.hasResponded) {
    return (
      <View className="flex-1 bg-gray-50">
        <View className="bg-primary pt-12 pb-6 px-4">
          <Pressable onPress={() => router.back()} className="flex-row items-center">
            <ArrowLeft size={24} color="white" />
            <Text className="text-white text-xl font-bold ml-4">{claim.claimNumber}</Text>
          </Pressable>
        </View>
        <View className="flex-1 items-center justify-center p-6">
          <CheckCircle size={64} color="#22c55e" />
          <Text className="text-2xl font-bold text-gray-900 mt-4">Allerede besvart</Text>
          <Text className="text-gray-500 text-center mt-2">
            Denne reklamasjonen er allerede besvart.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-primary pt-12 pb-6 px-4">
        <Pressable onPress={() => router.back()} className="flex-row items-center">
          <ArrowLeft size={24} color="white" />
          <Text className="text-white text-xl font-bold ml-4">{claim.claimNumber}</Text>
        </Pressable>
        <Text className="text-white/70 mt-1">{claim.supplierName}</Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
        {/* Product Info */}
        <View className="bg-white rounded-xl p-4 mb-4">
          <View className="flex-row items-center mb-3">
            <Package size={20} color="#003366" />
            <Text className="ml-2 text-lg font-semibold text-gray-900">Produkt</Text>
          </View>
          <Text className="text-gray-900 font-medium">{claim.productNameText}</Text>
          {claim.serialNumber && (
            <Text className="text-gray-500 text-sm mt-1">Serienr: {claim.serialNumber}</Text>
          )}
        </View>

        {/* Customer */}
        <View className="bg-white rounded-xl p-4 mb-4">
          <View className="flex-row items-center mb-3">
            <Building size={20} color="#003366" />
            <Text className="ml-2 text-lg font-semibold text-gray-900">Kunde</Text>
          </View>
          <Text className="text-gray-900">{claim.customerCompanyName}</Text>
          {claim.customerCity && (
            <Text className="text-gray-500 text-sm">{claim.customerCity}</Text>
          )}
        </View>

        {/* Problem */}
        <View className="bg-white rounded-xl p-4 mb-4">
          <View className="flex-row items-center mb-3">
            <AlertTriangle size={20} color="#003366" />
            <Text className="ml-2 text-lg font-semibold text-gray-900">Problemet</Text>
          </View>
          <Text className="text-gray-700">{claim.problemDescription}</Text>
          <View className="flex-row mt-3">
            <View className="bg-gray-100 px-2 py-1 rounded mr-2">
              <Text className="text-gray-600 text-xs">{claim.category}</Text>
            </View>
            <View className="bg-gray-100 px-2 py-1 rounded">
              <Text className="text-gray-600 text-xs">{formatDate(claim.createdAt)}</Text>
            </View>
          </View>
        </View>

        {/* Response Options */}
        <Text className="text-lg font-semibold text-gray-900 mb-3">Ditt svar</Text>
        <View className="mb-4">
          {responseOptions.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => setSelectedResponse(option.value)}
              className={`flex-row items-center p-4 rounded-xl mb-2 border-2 ${
                selectedResponse === option.value
                  ? `${option.bg} ${option.border}`
                  : 'bg-white border-gray-100'
              }`}
            >
              <option.icon size={24} color={option.color} />
              <View className="flex-1 ml-3">
                <Text className="text-gray-900 font-semibold">{option.label}</Text>
                <Text className="text-gray-500 text-sm">{option.description}</Text>
              </View>
            </Pressable>
          ))}
        </View>

        {/* Credit Amount (if approved) */}
        {selectedResponse === 'approved' && (
          <View className="bg-white rounded-xl p-4 mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-2">Kreditbeløp (valgfritt)</Text>
            <TextInput
              className="border border-gray-200 rounded-lg px-4 py-3"
              placeholder="0.00"
              keyboardType="decimal-pad"
              value={creditAmount}
              onChangeText={setCreditAmount}
            />
          </View>
        )}

        {/* Message */}
        <View className="bg-white rounded-xl p-4 mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-2">Melding *</Text>
          <TextInput
            className="border border-gray-200 rounded-lg px-4 py-3 min-h-[120px]"
            placeholder="Skriv din begrunnelse eller kommentar..."
            multiline
            textAlignVertical="top"
            value={message}
            onChangeText={setMessage}
          />
        </View>

        {/* Submit */}
        <Pressable
          onPress={handleSubmit}
          disabled={!selectedResponse || !message.trim() || respondMutation.isPending}
          className={`flex-row items-center justify-center py-4 rounded-xl mb-8 ${
            selectedResponse && message.trim() && !respondMutation.isPending
              ? 'bg-accent'
              : 'bg-gray-200'
          }`}
        >
          <Send size={20} color="white" />
          <Text className="text-white font-semibold ml-2">
            {respondMutation.isPending ? 'Sender...' : 'Send svar'}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
