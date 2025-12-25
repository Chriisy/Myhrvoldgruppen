import { useState } from 'react';
import { View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { trpc } from '../../src/lib/api';
import { useAuthStore } from '../../src/stores/auth.store';
import { LogIn, Mail, Lock, AlertCircle } from 'lucide-react-native';

const loginSchema = z.object({
  email: z.string().email('Ugyldig e-postadresse'),
  password: z.string().min(6, 'Passord må være minst 6 tegn'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async (data) => {
      await setAuth(data.user, data.token);
      router.replace('/(dashboard)');
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const onSubmit = (data: LoginForm) => {
    setError(null);
    loginMutation.mutate(data);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-primary"
    >
      <View className="flex-1 justify-center px-6">
        <View className="items-center mb-12">
          <Text className="text-4xl font-bold text-white">Myhrvoldgruppen</Text>
          <Text className="text-white/70 mt-2">Service</Text>
        </View>

        <View className="bg-white rounded-2xl p-6 shadow-xl">
          <Text className="text-2xl font-bold text-gray-900 mb-6">
            {t('auth.login')}
          </Text>

          {error && (
            <View className="flex-row items-center bg-red-50 p-3 rounded-lg mb-4">
              <AlertCircle size={20} color="#ef4444" />
              <Text className="ml-2 text-red-600 flex-1">{error}</Text>
            </View>
          )}

          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-1">
              {t('auth.email')}
            </Text>
            <View className="flex-row items-center border border-gray-300 rounded-lg px-3">
              <Mail size={20} color="#9ca3af" />
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    className="flex-1 py-3 px-2 text-gray-900"
                    placeholder="din@epost.no"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                  />
                )}
              />
            </View>
            {errors.email && (
              <Text className="text-red-500 text-sm mt-1">{errors.email.message}</Text>
            )}
          </View>

          <View className="mb-6">
            <Text className="text-sm font-medium text-gray-700 mb-1">
              {t('auth.password')}
            </Text>
            <View className="flex-row items-center border border-gray-300 rounded-lg px-3">
              <Lock size={20} color="#9ca3af" />
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    className="flex-1 py-3 px-2 text-gray-900"
                    placeholder="••••••••"
                    secureTextEntry
                    autoComplete="password"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                  />
                )}
              />
            </View>
            {errors.password && (
              <Text className="text-red-500 text-sm mt-1">{errors.password.message}</Text>
            )}
          </View>

          <Pressable
            onPress={handleSubmit(onSubmit)}
            disabled={isSubmitting || loginMutation.isPending}
            className={`flex-row items-center justify-center py-4 rounded-lg ${
              isSubmitting || loginMutation.isPending
                ? 'bg-primary/50'
                : 'bg-primary'
            }`}
          >
            <LogIn size={20} color="white" />
            <Text className="ml-2 text-white font-semibold text-lg">
              {isSubmitting || loginMutation.isPending ? t('auth.loggingIn') : t('auth.login')}
            </Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
