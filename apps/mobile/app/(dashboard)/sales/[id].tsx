import { View, Text, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { trpc } from '../../../src/lib/trpc';
import { ErrorView } from '../../../src/components/ErrorView';

export default function SalesOpportunityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: opportunity, isLoading, error, refetch } = trpc.sales.opportunityById.useQuery(
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

  if (error || !opportunity) {
    return <ErrorView message="Kunne ikke laste salgsmulighet" onRetry={refetch} />;
  }

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'won': return 'bg-green-100 text-green-800';
      case 'lost': return 'bg-red-100 text-red-800';
      case 'negotiation': return 'bg-purple-100 text-purple-800';
      case 'proposal': return 'bg-blue-100 text-blue-800';
      case 'qualification': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStageLabel = (stage: string) => {
    switch (stage) {
      case 'lead': return 'Lead';
      case 'qualification': return 'Kvalifisering';
      case 'proposal': return 'Tilbud';
      case 'negotiation': return 'Forhandling';
      case 'won': return 'Vunnet';
      case 'lost': return 'Tapt';
      default: return stage;
    }
  };

  const formatCurrency = (value: number | string | null) => {
    if (!value) return 'Ikke angitt';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return `${num.toLocaleString('nb-NO')} kr`;
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Salgsmulighet',
          headerBackTitle: 'Tilbake',
        }}
      />
      <ScrollView className="flex-1 bg-gray-50">
        {/* Header Card */}
        <View className="bg-white m-4 p-4 rounded-xl shadow-sm">
          <View className="flex-row justify-between items-start mb-3">
            <View className="flex-1">
              <Text className="text-xl font-bold text-gray-900">
                {opportunity.name}
              </Text>
              {opportunity.customer && (
                <Text className="text-gray-600 mt-1">
                  {opportunity.customer.name}
                </Text>
              )}
            </View>
            <View className={`px-3 py-1 rounded-full ${getStageColor(opportunity.stage)}`}>
              <Text className="text-sm font-medium">
                {getStageLabel(opportunity.stage)}
              </Text>
            </View>
          </View>

          <View className="border-t border-gray-100 pt-3 mt-3">
            <View className="flex-row">
              <View className="flex-1">
                <Text className="text-sm text-gray-500">Verdi</Text>
                <Text className="text-xl font-bold text-green-600">
                  {formatCurrency(opportunity.value)}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-sm text-gray-500">Sannsynlighet</Text>
                <Text className="text-xl font-bold text-blue-600">
                  {opportunity.probability || 0}%
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Pipeline Progress */}
        <View className="bg-white mx-4 mb-4 p-4 rounded-xl shadow-sm">
          <Text className="text-lg font-semibold text-gray-900 mb-3">Pipeline</Text>
          <View className="flex-row">
            {['lead', 'qualification', 'proposal', 'negotiation', 'won'].map((stage, index) => (
              <View key={stage} className="flex-1 items-center">
                <View
                  className={`w-8 h-8 rounded-full items-center justify-center ${
                    getStageIndex(opportunity.stage) >= index
                      ? 'bg-blue-600'
                      : 'bg-gray-200'
                  }`}
                >
                  <Text className={getStageIndex(opportunity.stage) >= index ? 'text-white' : 'text-gray-500'}>
                    {index + 1}
                  </Text>
                </View>
                <Text className="text-xs text-gray-500 mt-1 text-center">
                  {getStageLabel(stage)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Details Card */}
        <View className="bg-white mx-4 mb-4 p-4 rounded-xl shadow-sm">
          <Text className="text-lg font-semibold text-gray-900 mb-3">Detaljer</Text>

          <View className="space-y-3">
            {opportunity.source && (
              <View className="flex-row justify-between">
                <Text className="text-gray-500">Kilde</Text>
                <Text className="text-gray-900">{opportunity.source}</Text>
              </View>
            )}

            {opportunity.expectedCloseDate && (
              <View className="flex-row justify-between">
                <Text className="text-gray-500">Forventet lukkedato</Text>
                <Text className="text-gray-900">
                  {new Date(opportunity.expectedCloseDate).toLocaleDateString('nb-NO')}
                </Text>
              </View>
            )}

            {opportunity.assignedTo && (
              <View className="flex-row justify-between">
                <Text className="text-gray-500">Ansvarlig</Text>
                <Text className="text-gray-900">
                  {opportunity.assignedTo.firstName} {opportunity.assignedTo.lastName}
                </Text>
              </View>
            )}

            <View className="flex-row justify-between">
              <Text className="text-gray-500">Opprettet</Text>
              <Text className="text-gray-900">
                {new Date(opportunity.createdAt).toLocaleDateString('nb-NO')}
              </Text>
            </View>
          </View>
        </View>

        {/* Description Card */}
        {opportunity.description && (
          <View className="bg-white mx-4 mb-4 p-4 rounded-xl shadow-sm">
            <Text className="text-lg font-semibold text-gray-900 mb-2">Beskrivelse</Text>
            <Text className="text-gray-700 leading-relaxed">{opportunity.description}</Text>
          </View>
        )}

        {/* Contact Info Card */}
        {opportunity.contact && (
          <View className="bg-white mx-4 mb-4 p-4 rounded-xl shadow-sm">
            <Text className="text-lg font-semibold text-gray-900 mb-3">Kontaktperson</Text>
            <View className="space-y-2">
              <Text className="text-gray-900 font-medium">{opportunity.contact.name}</Text>
              {opportunity.contact.email && (
                <Text className="text-blue-600">{opportunity.contact.email}</Text>
              )}
              {opportunity.contact.phone && (
                <Text className="text-gray-600">{opportunity.contact.phone}</Text>
              )}
            </View>
          </View>
        )}

        {/* Actions */}
        <View className="mx-4 mb-8 space-y-3">
          {opportunity.stage !== 'won' && opportunity.stage !== 'lost' && (
            <>
              <Pressable
                className="bg-blue-600 p-4 rounded-xl active:bg-blue-700"
                onPress={() => {/* TODO: Advance stage */}}
              >
                <Text className="text-white text-center font-semibold text-lg">
                  Flytt til neste fase
                </Text>
              </Pressable>

              <Pressable
                className="bg-green-600 p-4 rounded-xl active:bg-green-700"
                onPress={() => {/* TODO: Mark as won */}}
              >
                <Text className="text-white text-center font-semibold text-lg">
                  Marker som vunnet
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
    </>
  );
}

function getStageIndex(stage: string): number {
  const stages = ['lead', 'qualification', 'proposal', 'negotiation', 'won'];
  return stages.indexOf(stage);
}
