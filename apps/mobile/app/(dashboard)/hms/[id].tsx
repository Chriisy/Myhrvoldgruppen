import { View, Text, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { trpc } from '../../../src/lib/trpc';
import { ErrorView } from '../../../src/components/ErrorView';

export default function HmsDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: sja, isLoading, error, refetch } = trpc.hms.sjaById.useQuery(
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

  if (error || !sja) {
    return <ErrorView message="Kunne ikke laste SJA" onRetry={refetch} />;
  }

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRiskLabel = (level: string) => {
    switch (level) {
      case 'high': return 'Hoy risiko';
      case 'medium': return 'Middels risiko';
      case 'low': return 'Lav risiko';
      default: return level;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft': return 'Utkast';
      case 'pending_approval': return 'Venter godkjenning';
      case 'approved': return 'Godkjent';
      case 'rejected': return 'Avvist';
      case 'completed': return 'Fullfort';
      default: return status;
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'SJA Detaljer',
          headerBackTitle: 'Tilbake',
        }}
      />
      <ScrollView className="flex-1 bg-gray-50">
        {/* Header Card */}
        <View className="bg-white m-4 p-4 rounded-xl shadow-sm">
          <View className="flex-row justify-between items-start mb-3">
            <View className="flex-1">
              <Text className="text-xl font-bold text-gray-900">
                {sja.title}
              </Text>
              <Text className="text-gray-600 mt-1">
                {getStatusLabel(sja.status)}
              </Text>
            </View>
            <View className={`px-3 py-1 rounded-full ${getRiskColor(sja.overallRiskLevel)}`}>
              <Text className="text-sm font-medium">
                {getRiskLabel(sja.overallRiskLevel)}
              </Text>
            </View>
          </View>

          <View className="border-t border-gray-100 pt-3 mt-3 flex-row">
            <View className="flex-1">
              <Text className="text-sm text-gray-500">Lokasjon</Text>
              <Text className="text-base font-medium text-gray-900">
                {sja.location || 'Ikke angitt'}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-sm text-gray-500">Arbeidsdato</Text>
              <Text className="text-base font-medium text-gray-900">
                {sja.workDate ? new Date(sja.workDate).toLocaleDateString('nb-NO') : 'Ikke angitt'}
              </Text>
            </View>
          </View>
        </View>

        {/* Description Card */}
        {sja.description && (
          <View className="bg-white mx-4 mb-4 p-4 rounded-xl shadow-sm">
            <Text className="text-lg font-semibold text-gray-900 mb-2">Beskrivelse</Text>
            <Text className="text-gray-700 leading-relaxed">{sja.description}</Text>
          </View>
        )}

        {/* Hazards Card */}
        {sja.hazards && sja.hazards.length > 0 && (
          <View className="bg-white mx-4 mb-4 p-4 rounded-xl shadow-sm">
            <Text className="text-lg font-semibold text-gray-900 mb-3">Identifiserte farer</Text>
            {sja.hazards.map((hazard: any, index: number) => (
              <View key={index} className="border-b border-gray-100 pb-3 mb-3 last:border-0 last:mb-0 last:pb-0">
                <View className="flex-row justify-between items-start">
                  <Text className="text-gray-900 font-medium flex-1">{hazard.description}</Text>
                  <View className={`px-2 py-0.5 rounded-full ml-2 ${getRiskColor(hazard.riskLevel)}`}>
                    <Text className="text-xs font-medium">{getRiskLabel(hazard.riskLevel)}</Text>
                  </View>
                </View>
                {hazard.mitigationMeasures && (
                  <Text className="text-sm text-gray-600 mt-1">
                    Tiltak: {hazard.mitigationMeasures}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Safety Equipment Card */}
        {sja.safetyEquipment && sja.safetyEquipment.length > 0 && (
          <View className="bg-white mx-4 mb-4 p-4 rounded-xl shadow-sm">
            <Text className="text-lg font-semibold text-gray-900 mb-3">Verneutstyr</Text>
            <View className="flex-row flex-wrap">
              {sja.safetyEquipment.map((equipment: string, index: number) => (
                <View key={index} className="bg-blue-100 px-3 py-1 rounded-full mr-2 mb-2">
                  <Text className="text-blue-800 text-sm">{equipment}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Emergency Procedures Card */}
        {sja.emergencyProcedures && (
          <View className="bg-white mx-4 mb-4 p-4 rounded-xl shadow-sm">
            <Text className="text-lg font-semibold text-gray-900 mb-2">Nodprosedyrer</Text>
            <Text className="text-gray-700 leading-relaxed">{sja.emergencyProcedures}</Text>
          </View>
        )}

        {/* Participants Card */}
        {sja.participants && sja.participants.length > 0 && (
          <View className="bg-white mx-4 mb-4 p-4 rounded-xl shadow-sm">
            <Text className="text-lg font-semibold text-gray-900 mb-3">Deltakere</Text>
            {sja.participants.map((participant: any, index: number) => (
              <View key={index} className="flex-row items-center py-2 border-b border-gray-100 last:border-0">
                <View className="w-10 h-10 rounded-full bg-orange-100 items-center justify-center mr-3">
                  <Text className="text-orange-800 font-semibold">
                    {participant.user?.firstName?.[0] || 'D'}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-gray-900 font-medium">
                    {participant.user?.firstName} {participant.user?.lastName}
                  </Text>
                  <Text className="text-sm text-gray-500">{participant.role}</Text>
                </View>
                {participant.signedAt && (
                  <Text className="text-xs text-green-600">Signert</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Actions */}
        <View className="mx-4 mb-8 space-y-3">
          {sja.status === 'draft' && (
            <Pressable
              className="bg-blue-600 p-4 rounded-xl active:bg-blue-700"
              onPress={() => {/* TODO: Submit for approval */}}
            >
              <Text className="text-white text-center font-semibold text-lg">
                Send til godkjenning
              </Text>
            </Pressable>
          )}
          {sja.status === 'approved' && (
            <Pressable
              className="bg-green-600 p-4 rounded-xl active:bg-green-700"
              onPress={() => {/* TODO: Sign SJA */}}
            >
              <Text className="text-white text-center font-semibold text-lg">
                Signer SJA
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </>
  );
}
