import { View, Text, Pressable, Share, Platform } from 'react-native';
import { QrCode, Share2, Copy, ExternalLink } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';

interface ClaimQRCodeProps {
  claimNumber: string;
  portalCode: string;
  portalUrl?: string;
}

export function ClaimQRCode({ claimNumber, portalCode, portalUrl }: ClaimQRCodeProps) {
  const baseUrl = portalUrl || 'https://portal.myhrvold.no';
  const fullUrl = `${baseUrl}/portal/${portalCode}`;

  const handleCopyCode = async () => {
    await Clipboard.setStringAsync(portalCode);
    // Could add toast notification here
  };

  const handleShare = async () => {
    try {
      await Share.share({
        title: `Reklamasjon ${claimNumber}`,
        message: `Svar på reklamasjon ${claimNumber}\n\nKode: ${portalCode}\n\nElles besøk: ${fullUrl}`,
        url: Platform.OS === 'ios' ? fullUrl : undefined,
      });
    } catch (error) {
      console.error('Share failed:', error);
    }
  };

  return (
    <View className="bg-white rounded-xl p-4">
      <View className="flex-row items-center mb-4">
        <QrCode size={20} color="#003366" />
        <Text className="ml-2 text-lg font-semibold text-gray-900">Leverandørportal</Text>
      </View>

      <View className="bg-gray-50 rounded-xl p-6 items-center mb-4">
        {/* QR Code placeholder - would use react-native-qrcode-svg in production */}
        <View className="w-32 h-32 bg-white border-2 border-gray-200 rounded-lg items-center justify-center mb-4">
          <QrCode size={80} color="#003366" />
        </View>

        <Text className="text-2xl font-mono font-bold tracking-[0.3em] text-primary">
          {portalCode}
        </Text>
        <Text className="text-gray-500 text-sm mt-1">
          Portalkode
        </Text>
      </View>

      <View className="flex-row gap-2">
        <Pressable
          onPress={handleCopyCode}
          className="flex-1 flex-row items-center justify-center py-3 bg-gray-100 rounded-lg"
        >
          <Copy size={18} color="#374151" />
          <Text className="text-gray-700 font-medium ml-2">Kopier kode</Text>
        </Pressable>

        <Pressable
          onPress={handleShare}
          className="flex-1 flex-row items-center justify-center py-3 bg-accent rounded-lg"
        >
          <Share2 size={18} color="white" />
          <Text className="text-white font-medium ml-2">Del</Text>
        </Pressable>
      </View>

      <View className="mt-4 p-3 bg-blue-50 rounded-lg">
        <Text className="text-blue-800 text-sm">
          Send denne koden til leverandøren slik at de kan svare på reklamasjonen
          direkte via portalen.
        </Text>
      </View>
    </View>
  );
}
