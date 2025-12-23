import { Stack } from 'expo-router';

export default function LoansLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="equipment" />
      <Stack.Screen name="new" />
    </Stack>
  );
}
