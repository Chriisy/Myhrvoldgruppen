import { View, ActivityIndicator, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

export function LoadingScreen() {
  const { t } = useTranslation();

  return (
    <View className="flex-1 items-center justify-center bg-white">
      <ActivityIndicator size="large" color="#003366" />
      <Text className="mt-4 text-gray-500">{t('common.loading')}</Text>
    </View>
  );
}
