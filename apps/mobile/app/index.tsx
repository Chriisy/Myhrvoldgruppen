import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/stores/auth.store';

export default function Index() {
  const { isAuthenticated } = useAuthStore();

  if (isAuthenticated) {
    return <Redirect href="/(dashboard)" />;
  }

  return <Redirect href="/(auth)/login" />;
}
