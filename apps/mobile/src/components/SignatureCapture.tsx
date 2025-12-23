import { useRef, useState } from 'react';
import { View, Text, Pressable, Modal, TextInput } from 'react-native';
import { PenTool, X, Check, RotateCcw } from 'lucide-react-native';

interface SignatureCaptureProps {
  visible: boolean;
  onClose: () => void;
  onSave: (signature: string, signedBy: string) => void;
  title?: string;
}

export function SignatureCapture({
  visible,
  onClose,
  onSave,
  title = 'Kundesignatur'
}: SignatureCaptureProps) {
  const [signedBy, setSignedBy] = useState('');
  const [hasSignature, setHasSignature] = useState(false);
  // In production, would use react-native-signature-canvas
  // For now, using a simplified placeholder

  const handleClear = () => {
    setHasSignature(false);
  };

  const handleSave = () => {
    if (!signedBy.trim()) {
      return;
    }

    // In production, would capture actual signature as base64
    // Using placeholder signature data
    const signatureData = `data:image/png;base64,signature_placeholder_${Date.now()}`;
    onSave(signatureData, signedBy);
    setSignedBy('');
    setHasSignature(false);
  };

  const handleTouchStart = () => {
    setHasSignature(true);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-white">
        <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200">
          <Pressable onPress={onClose} className="p-2">
            <X size={24} color="#374151" />
          </Pressable>
          <Text className="text-lg font-semibold text-gray-900">{title}</Text>
          <View className="w-10" />
        </View>

        <View className="flex-1 p-4">
          <View className="mb-4">
            <Text className="text-gray-700 font-medium mb-2">Signert av</Text>
            <TextInput
              value={signedBy}
              onChangeText={setSignedBy}
              placeholder="Skriv inn navn"
              className="bg-gray-50 rounded-lg px-4 py-3 text-gray-900"
              placeholderTextColor="#9ca3af"
            />
          </View>

          <Text className="text-gray-700 font-medium mb-2">Signatur</Text>
          <View className="flex-1 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 mb-4">
            <Pressable
              onPressIn={handleTouchStart}
              className="flex-1 items-center justify-center"
            >
              {hasSignature ? (
                <View className="items-center">
                  <PenTool size={48} color="#003366" />
                  <Text className="text-primary font-medium mt-2">Signatur registrert</Text>
                  <Text className="text-gray-500 text-sm">Trykk Lagre for å fullføre</Text>
                </View>
              ) : (
                <View className="items-center">
                  <PenTool size={48} color="#9ca3af" />
                  <Text className="text-gray-500 mt-2">Tegn signatur her</Text>
                  <Text className="text-gray-400 text-sm">Bruk fingeren for å signere</Text>
                </View>
              )}
            </Pressable>
          </View>

          <View className="flex-row gap-3">
            <Pressable
              onPress={handleClear}
              className="flex-1 flex-row items-center justify-center py-4 bg-gray-100 rounded-xl"
            >
              <RotateCcw size={20} color="#374151" />
              <Text className="text-gray-700 font-semibold ml-2">Nullstill</Text>
            </Pressable>

            <Pressable
              onPress={handleSave}
              disabled={!hasSignature || !signedBy.trim()}
              className={`flex-1 flex-row items-center justify-center py-4 rounded-xl ${
                hasSignature && signedBy.trim() ? 'bg-accent' : 'bg-gray-300'
              }`}
            >
              <Check size={20} color="white" />
              <Text className="text-white font-semibold ml-2">Lagre</Text>
            </Pressable>
          </View>
        </View>

        <View className="px-4 pb-8 bg-blue-50">
          <Text className="text-blue-800 text-sm text-center py-3">
            Ved å signere bekrefter kunden at arbeidet er utført som beskrevet i rapporten.
          </Text>
        </View>
      </View>
    </Modal>
  );
}
