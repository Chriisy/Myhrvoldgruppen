import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../src/stores/auth.store';
import { trpc } from '../../src/lib/api';
import { LogOut, User, Mail, Building } from 'lucide-react-native';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const logoutMutation = trpc.auth.logout.useMutation();

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch {
      // Ignore error
    }
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-primary pt-12 pb-6 px-4">
        <Text className="text-2xl font-bold text-white">{t('profile.title')}</Text>
      </View>

      <View className="p-4">
        <View className="bg-white rounded-xl p-4 mb-4">
          <View className="items-center mb-4">
            <View className="w-20 h-20 bg-accent rounded-full items-center justify-center mb-3">
              <Text className="text-3xl font-bold text-white">
                {user?.firstName?.charAt(0) || 'U'}{user?.lastName?.charAt(0) || ''}
              </Text>
            </View>
            <Text className="text-xl font-semibold text-gray-900">
              {user?.firstName} {user?.lastName}
            </Text>
            <Text className="text-gray-500 capitalize">{user?.role}</Text>
          </View>

          <View className="border-t border-gray-100 pt-4">
            <View className="flex-row items-center py-3">
              <Mail size={20} color="#6b7280" />
              <Text className="ml-3 text-gray-700">{user?.email}</Text>
            </View>
          </View>
        </View>

        <Pressable
          onPress={handleLogout}
          className="bg-red-50 flex-row items-center justify-center py-4 rounded-xl"
        >
          <LogOut size={20} color="#ef4444" />
          <Text className="text-red-600 font-semibold ml-2">{t('auth.logout')}</Text>
        </Pressable>
      </View>
    </View>
  );
}
