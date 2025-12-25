import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { trpc } from '../../../../lib/api';
import { useWizardStore } from '../useWizardStore';
import { Building, Package, User, AlertTriangle, Edit2, Send, CheckCircle } from 'lucide-react-native';

export function Step5Summary() {
  const router = useRouter();
  const { formData, setStep, reset, prevStep } = useWizardStore();

  const createMutation = trpc.claims.create.useMutation({
    onSuccess: (claim) => {
      Alert.alert(
        'Reklamasjon opprettet',
        `Saksnummer: ${claim.claimNumber}`,
        [
          {
            text: 'Se reklamasjon',
            onPress: () => {
              reset();
              router.replace(`/claims/${claim.id}`);
            },
          },
          {
            text: 'Ny reklamasjon',
            onPress: () => {
              reset();
            },
          },
        ]
      );
    },
    onError: (error) => {
      Alert.alert('Feil', error.message);
    },
  });

  const handleSubmit = () => {
    createMutation.mutate({
      supplierId: formData.supplierId!,
      productId: formData.productId || undefined,
      productNameText: formData.productNameText,
      serialNumber: formData.serialNumber || undefined,
      purchaseDate: formData.purchaseDate || undefined,
      invoiceNumber: formData.invoiceNumber || undefined,
      customerId: formData.customerId || undefined,
      customerCompanyName: formData.customerCompanyName,
      customerContactName: formData.customerContactName || undefined,
      customerEmail: formData.customerEmail || undefined,
      customerPhone: formData.customerPhone || undefined,
      customerAddress: formData.customerAddress || undefined,
      customerPostalCode: formData.customerPostalCode || undefined,
      customerCity: formData.customerCity || undefined,
      problemDescription: formData.problemDescription,
      category: formData.category as any,
      priority: formData.priority as any,
    });
  };

  const SummarySection = ({ title, step, icon: Icon, children }: any) => (
    <View className="bg-white rounded-xl p-4 mb-4">
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center">
          <Icon size={20} color="#003366" />
          <Text className="ml-2 text-lg font-semibold text-gray-900">{title}</Text>
        </View>
        <Pressable onPress={() => setStep(step)} className="flex-row items-center">
          <Edit2 size={16} color="#0d9488" />
          <Text className="ml-1 text-accent text-sm">Endre</Text>
        </Pressable>
      </View>
      {children}
    </View>
  );

  return (
    <View className="flex-1">
      <ScrollView className="flex-1 p-4">
        <View className="bg-green-50 p-4 rounded-xl mb-4 flex-row items-center">
          <CheckCircle size={24} color="#22c55e" />
          <View className="ml-3 flex-1">
            <Text className="text-green-700 font-semibold">Klar til innsending</Text>
            <Text className="text-green-600 text-sm">Sjekk at all informasjon er korrekt</Text>
          </View>
        </View>

        <SummarySection title="Leverandør" step={1} icon={Building}>
          <Text className="text-gray-900 font-medium">{formData.supplierName}</Text>
        </SummarySection>

        <SummarySection title="Produkt" step={2} icon={Package}>
          <Text className="text-gray-900 font-medium">{formData.productNameText}</Text>
          {formData.serialNumber && (
            <Text className="text-gray-500 text-sm">SN: {formData.serialNumber}</Text>
          )}
          {formData.invoiceNumber && (
            <Text className="text-gray-500 text-sm">Faktura: {formData.invoiceNumber}</Text>
          )}
        </SummarySection>

        <SummarySection title="Kunde" step={3} icon={User}>
          <Text className="text-gray-900 font-medium">{formData.customerCompanyName}</Text>
          {formData.customerContactName && (
            <Text className="text-gray-500 text-sm">{formData.customerContactName}</Text>
          )}
          {formData.customerPhone && (
            <Text className="text-gray-500 text-sm">{formData.customerPhone}</Text>
          )}
        </SummarySection>

        <SummarySection title="Problem" step={4} icon={AlertTriangle}>
          <View className="flex-row items-center gap-2 mb-2">
            <View className="bg-gray-100 px-2 py-1 rounded">
              <Text className="text-gray-700 text-sm">{formData.category}</Text>
            </View>
            <View className="bg-yellow-100 px-2 py-1 rounded">
              <Text className="text-yellow-700 text-sm">{formData.priority}</Text>
            </View>
          </View>
          <Text className="text-gray-700">{formData.problemDescription}</Text>
        </SummarySection>
      </ScrollView>

      <View className="flex-row p-4 bg-white border-t border-gray-100 gap-3">
        <Pressable
          onPress={prevStep}
          className="flex-1 py-4 rounded-xl items-center border border-gray-200"
        >
          <Text className="font-semibold text-gray-700">Tilbake</Text>
        </Pressable>
        <Pressable
          onPress={handleSubmit}
          disabled={createMutation.isPending}
          className={`flex-1 flex-row items-center justify-center py-4 rounded-xl ${
            createMutation.isPending ? 'bg-primary/50' : 'bg-accent'
          }`}
        >
          <Send size={20} color="white" />
          <Text className="text-white font-semibold ml-2">
            {createMutation.isPending ? 'Sender...' : 'Send inn'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
