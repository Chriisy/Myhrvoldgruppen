import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { CheckCircle, ArrowRight } from 'lucide-react-native';

export default function PortalSuccessScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-green-50 items-center justify-center px-6">
      <View className="w-24 h-24 bg-green-100 rounded-full items-center justify-center mb-6">
        <CheckCircle size={48} color="#22c55e" />
      </View>

      <Text className="text-3xl font-bold text-gray-900 text-center mb-2">
        Takk for ditt svar!
      </Text>

      <Text className="text-gray-600 text-center text-lg mb-8">
        Myhrvoldgruppen har mottatt ditt svar og vil behandle saken videre.
      </Text>

      <View className="bg-white rounded-xl p-6 w-full mb-8">
        <Text className="text-gray-900 font-semibold mb-2">Hva skjer nå?</Text>
        <Text className="text-gray-600">
          • Du vil motta en bekreftelse på e-post{'\n'}
          • Myhrvoldgruppen behandler saken{'\n'}
          • Du kan bli kontaktet ved behov
        </Text>
      </View>

      <Pressable
        onPress={() => router.replace('/portal')}
        className="flex-row items-center justify-center py-4 px-8 bg-primary rounded-xl"
      >
        <Text className="text-white font-semibold">Svar på ny reklamasjon</Text>
        <ArrowRight size={20} color="white" className="ml-2" />
      </Pressable>
    </View>
  );
}
