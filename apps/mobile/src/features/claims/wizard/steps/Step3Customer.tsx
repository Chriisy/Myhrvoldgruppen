import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { useWizardStore } from '../useWizardStore';
import { Building, User, Mail, Phone, MapPin } from 'lucide-react-native';

export function Step3Customer() {
  const { formData, updateFormData, markStepComplete, nextStep, prevStep } = useWizardStore();

  const handleNext = () => {
    if (formData.customerCompanyName) {
      markStepComplete(3);
      nextStep();
    }
  };

  const InputField = ({ label, icon: Icon, value, field, placeholder, keyboardType = 'default' }: any) => (
    <View className="mb-4">
      <Text className="text-sm font-medium text-gray-700 mb-1">{label}</Text>
      <View className="flex-row items-center border border-gray-200 rounded-lg px-3 bg-white">
        <Icon size={20} color="#6b7280" />
        <TextInput
          className="flex-1 py-3 px-2 text-gray-900"
          placeholder={placeholder}
          value={value}
          onChangeText={(text) => updateFormData({ [field]: text })}
          keyboardType={keyboardType}
        />
      </View>
    </View>
  );

  return (
    <View className="flex-1">
      <ScrollView className="flex-1 p-4">
        <InputField
          label="Firmanavn *"
          icon={Building}
          value={formData.customerCompanyName}
          field="customerCompanyName"
          placeholder="Kiwi Storgata"
        />
        <InputField
          label="Kontaktperson"
          icon={User}
          value={formData.customerContactName}
          field="customerContactName"
          placeholder="Ola Nordmann"
        />
        <InputField
          label="E-post"
          icon={Mail}
          value={formData.customerEmail}
          field="customerEmail"
          placeholder="ola@kunde.no"
          keyboardType="email-address"
        />
        <InputField
          label="Telefon"
          icon={Phone}
          value={formData.customerPhone}
          field="customerPhone"
          placeholder="+47 123 45 678"
          keyboardType="phone-pad"
        />
        <InputField
          label="Adresse"
          icon={MapPin}
          value={formData.customerAddress}
          field="customerAddress"
          placeholder="Storgata 1"
        />
        <View className="flex-row gap-3">
          <View className="flex-1">
            <InputField
              label="Postnr"
              icon={MapPin}
              value={formData.customerPostalCode}
              field="customerPostalCode"
              placeholder="0123"
              keyboardType="number-pad"
            />
          </View>
          <View className="flex-[2]">
            <InputField
              label="Sted"
              icon={MapPin}
              value={formData.customerCity}
              field="customerCity"
              placeholder="Oslo"
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
          disabled={!formData.customerCompanyName}
          className={`flex-1 py-4 rounded-xl items-center ${
            formData.customerCompanyName ? 'bg-primary' : 'bg-gray-200'
          }`}
        >
          <Text className={`font-semibold ${
            formData.customerCompanyName ? 'text-white' : 'text-gray-400'
          }`}>
            Neste: Problem
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
