import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { ClaimsWizard } from '../../../src/features/claims/wizard/ClaimsWizard';
import { useWizardStore } from '../../../src/features/claims/wizard/useWizardStore';

export default function NewClaimPage() {
  const router = useRouter();
  const { reset } = useWizardStore();

  const handleClose = () => {
    reset();
    router.back();
  };

  return (
    <View className="flex-1">
      <View className="bg-primary pt-12 pb-4 px-4">
        <View className="flex-row items-center">
          <Pressable onPress={handleClose} className="mr-4">
            <ArrowLeft size={24} color="white" />
          </Pressable>
          <Text className="text-white text-xl font-bold">
            Ny reklamasjon
          </Text>
        </View>
      </View>

      <ClaimsWizard />
    </View>
  );
}
