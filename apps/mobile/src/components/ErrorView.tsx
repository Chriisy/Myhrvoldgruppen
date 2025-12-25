import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AlertCircle, RefreshCw } from 'lucide-react-native';

interface ErrorViewProps {
  error: Error | null;
  onRetry?: () => void;
}

export function ErrorView({ error, onRetry }: ErrorViewProps) {
  const { t } = useTranslation();

  return (
    <View className="flex-1 items-center justify-center bg-white p-6">
      <AlertCircle size={48} color="#ef4444" />
      <Text className="mt-4 text-lg font-semibold text-gray-900">
        {t('common.error')}
      </Text>
      <Text className="mt-2 text-center text-gray-500">
        {error?.message || 'En ukjent feil oppstod'}
      </Text>
      {onRetry && (
        <Pressable
          onPress={onRetry}
          className="mt-6 flex-row items-center rounded-lg bg-primary px-6 py-3"
        >
          <RefreshCw size={20} color="white" />
          <Text className="ml-2 font-medium text-white">
            {t('common.retry')}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
