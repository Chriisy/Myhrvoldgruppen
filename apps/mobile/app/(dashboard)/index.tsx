import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../src/stores/auth.store';
import { trpc } from '../../src/lib/api';
import { FileText, Clock, CheckCircle, Plus, AlertTriangle } from 'lucide-react-native';

export default function DashboardScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuthStore();
  const { data: stats } = trpc.claims.stats.useQuery();

  const statCards = [
    { label: 'Nye', value: stats?.new || 0, icon: FileText, color: '#3b82f6', bg: 'bg-blue-50' },
    { label: 'Under behandling', value: stats?.inProgress || 0, icon: Clock, color: '#eab308', bg: 'bg-yellow-50' },
    { label: 'Venter leverandør', value: stats?.pendingSupplier || 0, icon: AlertTriangle, color: '#f97316', bg: 'bg-orange-50' },
    { label: 'Løst', value: stats?.resolved || 0, icon: CheckCircle, color: '#22c55e', bg: 'bg-green-50' },
  ];

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-primary pt-12 pb-6 px-4">
        <Text className="text-2xl font-bold text-white">
          {t('dashboard.title')}
        </Text>
        <Text className="text-white/70 mt-1">
          {t('dashboard.welcome', { name: user?.firstName || 'Bruker' })}
        </Text>
      </View>

      <ScrollView className="flex-1 p-4">
        <View className="flex-row flex-wrap gap-3 mb-6">
          {statCards.map((stat) => (
            <View key={stat.label} className={`flex-1 min-w-[45%] p-4 rounded-xl ${stat.bg}`}>
              <View className="flex-row items-center gap-2">
                <stat.icon size={20} color={stat.color} />
                <Text className="text-2xl font-bold" style={{ color: stat.color }}>
                  {stat.value}
                </Text>
              </View>
              <Text className="text-gray-600 text-sm mt-1">{stat.label}</Text>
            </View>
          ))}
        </View>

        <View className="mb-6">
          <Text className="text-lg font-semibold text-gray-900 mb-3">
            {t('dashboard.quickActions')}
          </Text>
          <Pressable
            onPress={() => router.push('/claims/new')}
            className="bg-accent flex-row items-center justify-center py-4 rounded-xl"
          >
            <Plus size={20} color="white" />
            <Text className="text-white font-semibold ml-2">{t('dashboard.newClaim')}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
