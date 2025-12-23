import { View, Text, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { trpc } from '../../../src/lib/trpc';
import { ErrorView } from '../../../src/components/ErrorView';

export default function InstallationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: installation, isLoading, error, refetch } = trpc.installations.byId.useQuery(
    { id: id! },
    { enabled: !!id }
  );

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#003366" />
      </View>
    );
  }

  if (error || !installation) {
    return <ErrorView message="Kunne ikke laste installasjon" onRetry={refetch} />;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'on_hold': return 'bg-yellow-100 text-yellow-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'planned': return 'Planlagt';
      case 'in_progress': return 'Under arbeid';
      case 'completed': return 'Fullfort';
      case 'on_hold': return 'Pa vent';
      case 'cancelled': return 'Kansellert';
      default: return status;
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: installation.projectNumber || 'Installasjon',
          headerBackTitle: 'Tilbake',
        }}
      />
      <ScrollView className="flex-1 bg-gray-50">
        {/* Header Card */}
        <View className="bg-white m-4 p-4 rounded-xl shadow-sm">
          <View className="flex-row justify-between items-start mb-3">
            <View className="flex-1">
              <Text className="text-xl font-bold text-gray-900">
                {installation.projectNumber}
              </Text>
              <Text className="text-gray-600 mt-1">
                {installation.name}
              </Text>
            </View>
            <View className={`px-3 py-1 rounded-full ${getStatusColor(installation.status)}`}>
              <Text className="text-sm font-medium">
                {getStatusLabel(installation.status)}
              </Text>
            </View>
          </View>

          {installation.customer && (
            <View className="border-t border-gray-100 pt-3 mt-3">
              <Text className="text-sm text-gray-500">Kunde</Text>
              <Text className="text-base font-medium text-gray-900">
                {installation.customer.name}
              </Text>
            </View>
          )}
        </View>

        {/* Details Card */}
        <View className="bg-white mx-4 mb-4 p-4 rounded-xl shadow-sm">
          <Text className="text-lg font-semibold text-gray-900 mb-3">Detaljer</Text>

          <View className="space-y-3">
            {installation.installationType && (
              <View>
                <Text className="text-sm text-gray-500">Type</Text>
                <Text className="text-base text-gray-900">{installation.installationType}</Text>
              </View>
            )}

            {installation.plannedStartDate && (
              <View>
                <Text className="text-sm text-gray-500">Planlagt start</Text>
                <Text className="text-base text-gray-900">
                  {new Date(installation.plannedStartDate).toLocaleDateString('nb-NO')}
                </Text>
              </View>
            )}

            {installation.plannedEndDate && (
              <View>
                <Text className="text-sm text-gray-500">Planlagt slutt</Text>
                <Text className="text-base text-gray-900">
                  {new Date(installation.plannedEndDate).toLocaleDateString('nb-NO')}
                </Text>
              </View>
            )}

            {installation.estimatedHours && (
              <View>
                <Text className="text-sm text-gray-500">Estimerte timer</Text>
                <Text className="text-base text-gray-900">{installation.estimatedHours} timer</Text>
              </View>
            )}
          </View>
        </View>

        {/* Description Card */}
        {installation.description && (
          <View className="bg-white mx-4 mb-4 p-4 rounded-xl shadow-sm">
            <Text className="text-lg font-semibold text-gray-900 mb-2">Beskrivelse</Text>
            <Text className="text-gray-700 leading-relaxed">{installation.description}</Text>
          </View>
        )}

        {/* Address Card */}
        {installation.installationAddress && (
          <View className="bg-white mx-4 mb-4 p-4 rounded-xl shadow-sm">
            <Text className="text-lg font-semibold text-gray-900 mb-2">Installasjonsadresse</Text>
            <Text className="text-gray-700">{installation.installationAddress}</Text>
          </View>
        )}

        {/* Team Card */}
        {installation.teamMembers && installation.teamMembers.length > 0 && (
          <View className="bg-white mx-4 mb-4 p-4 rounded-xl shadow-sm">
            <Text className="text-lg font-semibold text-gray-900 mb-3">Team</Text>
            {installation.teamMembers.map((member: any, index: number) => (
              <View key={index} className="flex-row items-center py-2 border-b border-gray-100 last:border-0">
                <View className="w-10 h-10 rounded-full bg-blue-100 items-center justify-center mr-3">
                  <Text className="text-blue-800 font-semibold">
                    {member.user?.firstName?.[0] || 'U'}
                  </Text>
                </View>
                <View>
                  <Text className="text-gray-900 font-medium">
                    {member.user?.firstName} {member.user?.lastName}
                  </Text>
                  <Text className="text-sm text-gray-500">{member.role}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Actions */}
        <View className="mx-4 mb-8 space-y-3">
          <Pressable
            className="bg-blue-600 p-4 rounded-xl active:bg-blue-700"
            onPress={() => {/* TODO: Mark as complete */}}
          >
            <Text className="text-white text-center font-semibold text-lg">
              Marker som fullfort
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </>
  );
}
