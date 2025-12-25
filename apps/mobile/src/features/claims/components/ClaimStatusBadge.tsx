import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

const STATUS_COLORS = {
  draft: { bg: 'bg-gray-100', text: 'text-gray-700' },
  new: { bg: 'bg-blue-100', text: 'text-blue-700' },
  in_progress: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  pending_supplier: { bg: 'bg-orange-100', text: 'text-orange-700' },
  pending_parts: { bg: 'bg-purple-100', text: 'text-purple-700' },
  resolved: { bg: 'bg-green-100', text: 'text-green-700' },
  closed: { bg: 'bg-gray-100', text: 'text-gray-700' },
  rejected: { bg: 'bg-red-100', text: 'text-red-700' },
} as const;

interface ClaimStatusBadgeProps {
  status: string;
}

export function ClaimStatusBadge({ status }: ClaimStatusBadgeProps) {
  const { t } = useTranslation();
  const colors = STATUS_COLORS[status as keyof typeof STATUS_COLORS] || STATUS_COLORS.new;

  return (
    <View className={`px-2 py-1 rounded-full ${colors.bg}`}>
      <Text className={`text-xs font-medium ${colors.text}`}>
        {t(`claims.status.${status}`)}
      </Text>
    </View>
  );
}
