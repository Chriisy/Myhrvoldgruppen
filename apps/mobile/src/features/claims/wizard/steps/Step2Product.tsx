import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { useWizardStore } from '../useWizardStore';
import { Package, Hash, FileText } from 'lucide-react-native';

export function Step2Product() {
  const { formData, updateFormData, markStepComplete, nextStep, prevStep } = useWizardStore();

  const handleNext = () => {
    if (formData.productNameText) {
      markStepComplete(2);
      nextStep();
    }
  };

  return (
    <View className="flex-1">
      <ScrollView className="flex-1 p-4">
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-1">
            Produktnavn *
          </Text>
          <View className="flex-row items-center border border-gray-200 rounded-lg px-3 bg-white">
            <Package size={20} color="#6b7280" />
            <TextInput
              className="flex-1 py-3 px-2 text-gray-900"
              placeholder="F.eks. Rational SCC 101"
              value={formData.productNameText}
              onChangeText={(text) => updateFormData({ productNameText: text })}
            />
          </View>
        </View>

        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-1">
            Serienummer
          </Text>
          <View className="flex-row items-center border border-gray-200 rounded-lg px-3 bg-white">
            <Hash size={20} color="#6b7280" />
            <TextInput
              className="flex-1 py-3 px-2 text-gray-900"
              placeholder="SN12345678"
              value={formData.serialNumber}
              onChangeText={(text) => updateFormData({ serialNumber: text })}
            />
          </View>
        </View>

        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-1">
            Fakturanummer
          </Text>
          <View className="flex-row items-center border border-gray-200 rounded-lg px-3 bg-white">
            <FileText size={20} color="#6b7280" />
            <TextInput
              className="flex-1 py-3 px-2 text-gray-900"
              placeholder="FV-12345"
              value={formData.invoiceNumber}
              onChangeText={(text) => updateFormData({ invoiceNumber: text })}
            />
          </View>
        </View>
      </ScrollView>

      <View className="flex-row p-4 bg-white border-t border-gray-100 gap-3">
        <Pressable
          onPress={prevStep}
          className="flex-1 py-4 rounded-xl items-center border border-gray-200"
        >
          <Text className="font-semibold text-gray-700">Tilbake</Text>
        </Pressable>
        <Pressable
          onPress={handleNext}
          disabled={!formData.productNameText}
          className={`flex-1 py-4 rounded-xl items-center ${
            formData.productNameText ? 'bg-primary' : 'bg-gray-200'
          }`}
        >
          <Text className={`font-semibold ${
            formData.productNameText ? 'text-white' : 'text-gray-400'
          }`}>
            Neste: Kunde
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
