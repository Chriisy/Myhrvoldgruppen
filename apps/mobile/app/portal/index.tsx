import { useState } from 'react';
import { View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { FileText, ArrowRight, AlertCircle } from 'lucide-react-native';
import { trpc } from '../../src/lib/api';

export default function PortalEntryScreen() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const verifyMutation = trpc.portal.getByCode.useQuery(
    { code: code.toUpperCase() },
    {
      enabled: false,
      retry: false,
    }
  );

  const handleSubmit = async () => {
    if (code.length !== 6) {
      setError('Koden må være 6 tegn');
      return;
    }

    setError(null);
    try {
      const result = await verifyMutation.refetch();
      if (result.data) {
        router.push(`/portal/${code.toUpperCase()}`);
      }
    } catch (err: any) {
      setError(err.message || 'Ugyldig kode');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-primary"
    >
      <View className="flex-1 justify-center px-6">
        <View className="items-center mb-12">
          <View className="w-20 h-20 bg-accent rounded-2xl items-center justify-center mb-4">
            <FileText size={40} color="white" />
          </View>
          <Text className="text-3xl font-bold text-white">Leverandørportal</Text>
          <Text className="text-white/70 mt-2 text-center">
            Svar på reklamasjoner fra Myhrvoldgruppen
          </Text>
        </View>

        <View className="bg-white rounded-2xl p-6 shadow-xl">
          <Text className="text-xl font-bold text-gray-900 mb-2">
            Skriv inn kode
          </Text>
          <Text className="text-gray-500 mb-6">
            Du finner koden i e-posten eller på reklamasjonsdokumentet
          </Text>

          {error && (
            <View className="flex-row items-center bg-red-50 p-3 rounded-lg mb-4">
              <AlertCircle size={20} color="#ef4444" />
              <Text className="ml-2 text-red-600 flex-1">{error}</Text>
            </View>
          )}

          <TextInput
            className="text-center text-3xl font-mono tracking-[0.5em] border-2 border-gray-200 rounded-xl py-4 mb-6 text-gray-900"
            placeholder="ABC123"
            placeholderTextColor="#9ca3af"
            value={code}
            onChangeText={(text) => setCode(text.toUpperCase().slice(0, 6))}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
          />

          <Pressable
            onPress={handleSubmit}
            disabled={code.length !== 6}
            className={`flex-row items-center justify-center py-4 rounded-xl ${
              code.length === 6 ? 'bg-accent' : 'bg-gray-200'
            }`}
          >
            <Text className={`font-semibold text-lg ${
              code.length === 6 ? 'text-white' : 'text-gray-400'
            }`}>
              Fortsett
            </Text>
            <ArrowRight size={20} color={code.length === 6 ? 'white' : '#9ca3af'} className="ml-2" />
          </Pressable>
        </View>

        <Text className="text-white/50 text-center text-sm mt-8">
          Myhrvoldgruppen AS - Leverandørportal
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}
