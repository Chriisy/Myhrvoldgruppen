import { View, Text, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { trpc } from '../../../src/lib/trpc';
import { ErrorView } from '../../../src/components/ErrorView';

export default function StinkerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: stinker, isLoading, error, refetch } = trpc.stinkers.byId.useQuery(
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

  if (error || !stinker) {
    return <ErrorView message="Kunne ikke laste stinker" onRetry={refetch} />;
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSeverityLabel = (severity: string) => {
    switch (severity) {
      case 'critical': return 'Kritisk';
      case 'high': return 'Hoy';
      case 'medium': return 'Middels';
      case 'low': return 'Lav';
      default: return severity;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Aktiv';
      case 'monitoring': return 'Under overvaking';
      case 'resolved': return 'Lost';
      default: return status;
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Stinker Detaljer',
          headerBackTitle: 'Tilbake',
        }}
      />
      <ScrollView className="flex-1 bg-gray-50">
        {/* Header Card */}
        <View className="bg-white m-4 p-4 rounded-xl shadow-sm">
          <View className="flex-row justify-between items-start mb-3">
            <View className="flex-1">
              <Text className="text-xl font-bold text-gray-900">
                {stinker.productName}
              </Text>
              {stinker.supplier && (
                <Text className="text-gray-600 mt-1">
                  {stinker.supplier.name}
                </Text>
              )}
            </View>
            <View className={`px-3 py-1 rounded-full ${getSeverityColor(stinker.severity)}`}>
              <Text className="text-sm font-medium">
                {getSeverityLabel(stinker.severity)}
              </Text>
            </View>
          </View>

          <View className="border-t border-gray-100 pt-3 mt-3 flex-row">
            <View className="flex-1">
              <Text className="text-sm text-gray-500">Status</Text>
              <Text className="text-base font-medium text-gray-900">
                {getStatusLabel(stinker.status)}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-sm text-gray-500">Antall saker</Text>
              <Text className="text-base font-medium text-gray-900">
                {stinker.totalClaims || 0} reklamasjoner
              </Text>
            </View>
          </View>
        </View>

        {/* Stats Card */}
        <View className="bg-white mx-4 mb-4 p-4 rounded-xl shadow-sm">
          <Text className="text-lg font-semibold text-gray-900 mb-3">Statistikk</Text>

          <View className="flex-row mb-3">
            <View className="flex-1 bg-red-50 p-3 rounded-lg mr-2">
              <Text className="text-2xl font-bold text-red-600">
                {stinker.totalClaims || 0}
              </Text>
              <Text className="text-sm text-red-600">Reklamasjoner</Text>
            </View>
            <View className="flex-1 bg-orange-50 p-3 rounded-lg">
              <Text className="text-2xl font-bold text-orange-600">
                {stinker.failureRate ? `${(stinker.failureRate * 100).toFixed(1)}%` : 'N/A'}
              </Text>
              <Text className="text-sm text-orange-600">Feilrate</Text>
            </View>
          </View>

          <View className="flex-row">
            <View className="flex-1 bg-blue-50 p-3 rounded-lg mr-2">
              <Text className="text-2xl font-bold text-blue-600">
                {stinker.totalCost ? `${Math.round(stinker.totalCost).toLocaleString('nb-NO')} kr` : 'N/A'}
              </Text>
              <Text className="text-sm text-blue-600">Total kostnad</Text>
            </View>
            <View className="flex-1 bg-purple-50 p-3 rounded-lg">
              <Text className="text-2xl font-bold text-purple-600">
                {stinker.avgResolutionDays ? `${stinker.avgResolutionDays} dager` : 'N/A'}
              </Text>
              <Text className="text-sm text-purple-600">Snitt lostid</Text>
            </View>
          </View>
        </View>

        {/* Reason Card */}
        {stinker.reason && (
          <View className="bg-white mx-4 mb-4 p-4 rounded-xl shadow-sm">
            <Text className="text-lg font-semibold text-gray-900 mb-2">Arsak</Text>
            <Text className="text-gray-700 leading-relaxed">{stinker.reason}</Text>
          </View>
        )}

        {/* Actions Taken Card */}
        {stinker.actionsTaken && (
          <View className="bg-white mx-4 mb-4 p-4 rounded-xl shadow-sm">
            <Text className="text-lg font-semibold text-gray-900 mb-2">Tiltak utfort</Text>
            <Text className="text-gray-700 leading-relaxed">{stinker.actionsTaken}</Text>
          </View>
        )}

        {/* Product Info Card */}
        <View className="bg-white mx-4 mb-4 p-4 rounded-xl shadow-sm">
          <Text className="text-lg font-semibold text-gray-900 mb-3">Produktinformasjon</Text>

          <View className="space-y-2">
            {stinker.productSku && (
              <View className="flex-row justify-between">
                <Text className="text-gray-500">SKU</Text>
                <Text className="text-gray-900">{stinker.productSku}</Text>
              </View>
            )}
            {stinker.productCategory && (
              <View className="flex-row justify-between">
                <Text className="text-gray-500">Kategori</Text>
                <Text className="text-gray-900">{stinker.productCategory}</Text>
              </View>
            )}
            <View className="flex-row justify-between">
              <Text className="text-gray-500">Forste registrert</Text>
              <Text className="text-gray-900">
                {new Date(stinker.firstClaimDate || stinker.createdAt).toLocaleDateString('nb-NO')}
              </Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        <View className="mx-4 mb-8 space-y-3">
          <Pressable
            className="bg-blue-600 p-4 rounded-xl active:bg-blue-700"
            onPress={() => router.push(`/claims?productName=${encodeURIComponent(stinker.productName)}`)}
          >
            <Text className="text-white text-center font-semibold text-lg">
              Se relaterte reklamasjoner
            </Text>
          </Pressable>

          {stinker.status === 'active' && (
            <Pressable
              className="bg-green-600 p-4 rounded-xl active:bg-green-700"
              onPress={() => {/* TODO: Mark as resolved */}}
            >
              <Text className="text-white text-center font-semibold text-lg">
                Marker som lost
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </>
  );
}
