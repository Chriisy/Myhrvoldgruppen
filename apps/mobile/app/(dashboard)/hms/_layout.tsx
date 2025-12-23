import { Stack } from 'expo-router';

export default function HMSLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="sja/[id]" />
      <Stack.Screen name="incidents/[id]" />
      <Stack.Screen name="new-sja" />
      <Stack.Screen name="new-incident" />
    </Stack>
  );
}
