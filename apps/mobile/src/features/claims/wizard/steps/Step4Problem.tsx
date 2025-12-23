import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { useWizardStore } from '../useWizardStore';

const CATEGORIES = [
  { value: 'electrical', label: 'Elektrisk' },
  { value: 'mechanical', label: 'Mekanisk' },
  { value: 'cosmetic', label: 'Kosmetisk' },
  { value: 'software', label: 'Software' },
  { value: 'transport', label: 'Transportskade' },
  { value: 'other', label: 'Annet' },
];

const PRIORITIES = [
  { value: 'low', label: 'Lav' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'Høy' },
  { value: 'urgent', label: 'Haster' },
];

export function Step4Problem() {
  const { formData, updateFormData, markStepComplete, nextStep, prevStep } = useWizardStore();

  const handleNext = () => {
    if (formData.problemDescription && formData.category) {
      markStepComplete(4);
      nextStep();
    }
  };

  return (
    <View className="flex-1">
      <ScrollView className="flex-1 p-4">
        <View className="mb-6">
          <Text className="text-sm font-medium text-gray-700 mb-2">Kategori *</Text>
          <View className="flex-row flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <Pressable
                key={cat.value}
                onPress={() => updateFormData({ category: cat.value })}
                className={`px-4 py-2 rounded-lg border ${
                  formData.category === cat.value
                    ? 'bg-primary border-primary'
                    : 'bg-white border-gray-200'
                }`}
              >
                <Text className={
                  formData.category === cat.value ? 'text-white' : 'text-gray-700'
                }>
                  {cat.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View className="mb-6">
          <Text className="text-sm font-medium text-gray-700 mb-2">Prioritet</Text>
          <View className="flex-row gap-2">
            {PRIORITIES.map((pri) => (
              <Pressable
                key={pri.value}
                onPress={() => updateFormData({ priority: pri.value })}
                className={`flex-1 py-3 rounded-lg items-center border ${
                  formData.priority === pri.value
                    ? 'border-primary bg-primary/10'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <Text className={
                  formData.priority === pri.value
                    ? 'text-primary font-medium'
                    : 'text-gray-700'
                }>
                  {pri.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View className="mb-6">
          <Text className="text-sm font-medium text-gray-700 mb-2">
            Beskrivelse av problemet *
          </Text>
          <View className="border border-gray-200 rounded-lg bg-white">
            <TextInput
              className="p-3 text-gray-900 min-h-[120px]"
              placeholder="Beskriv feilen så detaljert som mulig..."
              value={formData.problemDescription}
              onChangeText={(text) => updateFormData({ problemDescription: text })}
              multiline
              textAlignVertical="top"
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
          disabled={!formData.problemDescription || !formData.category}
          className={`flex-1 py-4 rounded-xl items-center ${
            formData.problemDescription && formData.category ? 'bg-primary' : 'bg-gray-200'
          }`}
        >
          <Text className={`font-semibold ${
            formData.problemDescription && formData.category ? 'text-white' : 'text-gray-400'
          }`}>
            Neste: Oppsummering
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
