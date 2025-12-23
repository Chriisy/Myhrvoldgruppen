import { View, Text, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { trpc } from '../../../src/lib/api';
import { LoadingScreen } from '../../../src/components/LoadingScreen';
import { ErrorView } from '../../../src/components/ErrorView';
import { ClaimStatusBadge } from '../../../src/features/claims/components/ClaimStatusBadge';
import { ArrowLeft, Building, Package, User, Calendar, FileText, MessageSquare } from 'lucide-react-native';

export default function ClaimDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();

  const { data: claim, isLoading, error, refetch } = trpc.claims.byId.useQuery(
    { id: id! },
    { enabled: !!id }
  );

  if (isLoading) return <LoadingScreen />;
  if (error) return <ErrorView error={error} onRetry={refetch} />;
  if (!claim) return <ErrorView error={new Error('Ikke funnet')} />;

  const formatDate = (date: Date | null | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('nb-NO', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-primary pt-12 pb-6 px-4">
        <View className="flex-row items-center mb-4">
          <Pressable onPress={() => router.back()} className="mr-4">
            <ArrowLeft size={24} color="white" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-white text-xl font-bold">
              {claim.claimNumber}
            </Text>
            <View className="mt-1">
              <ClaimStatusBadge status={claim.status} />
            </View>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
        <View className="bg-white rounded-xl p-4 mb-4">
          <View className="flex-row items-center mb-3">
            <Package size={20} color="#003366" />
            <Text className="ml-2 text-lg font-semibold text-gray-900">
              Produkt
            </Text>
          </View>
          <Text className="text-gray-900 font-medium">
            {claim.productNameText || 'Ikke angitt'}
          </Text>
          {claim.serialNumber && (
            <Text className="text-gray-500 text-sm mt-1">
              Serienr: {claim.serialNumber}
            </Text>
          )}
        </View>

        <View className="bg-white rounded-xl p-4 mb-4">
          <View className="flex-row items-center mb-3">
            <Building size={20} color="#003366" />
            <Text className="ml-2 text-lg font-semibold text-gray-900">
              Kunde
            </Text>
          </View>
          <Text className="text-gray-900 font-medium">
            {claim.customer?.name || claim.customerCompanyName || 'Ikke angitt'}
          </Text>
          {claim.customerContactName && (
            <Text className="text-gray-500 text-sm mt-1">
              Kontakt: {claim.customerContactName}
            </Text>
          )}
        </View>

        <View className="bg-white rounded-xl p-4 mb-4">
          <View className="flex-row items-center mb-3">
            <User size={20} color="#003366" />
            <Text className="ml-2 text-lg font-semibold text-gray-900">
              Leverandør
            </Text>
          </View>
          <Text className="text-gray-900 font-medium">
            {claim.supplier?.name || 'Ikke angitt'}
          </Text>
        </View>

        {claim.problemDescription && (
          <View className="bg-white rounded-xl p-4 mb-4">
            <View className="flex-row items-center mb-3">
              <FileText size={20} color="#003366" />
              <Text className="ml-2 text-lg font-semibold text-gray-900">
                Beskrivelse
              </Text>
            </View>
            <Text className="text-gray-700">
              {claim.problemDescription}
            </Text>
          </View>
        )}

        <View className="bg-white rounded-xl p-4 mb-4">
          <View className="flex-row items-center mb-3">
            <Calendar size={20} color="#003366" />
            <Text className="ml-2 text-lg font-semibold text-gray-900">
              Datoer
            </Text>
          </View>
          <View className="flex-row justify-between">
            <View>
              <Text className="text-gray-500 text-xs">Opprettet</Text>
              <Text className="text-gray-900">{formatDate(claim.createdAt)}</Text>
            </View>
            <View>
              <Text className="text-gray-500 text-xs">Kjøpsdato</Text>
              <Text className="text-gray-900">{formatDate(claim.purchaseDate)}</Text>
            </View>
          </View>
        </View>

        {claim.timeline && claim.timeline.length > 0 && (
          <View className="bg-white rounded-xl p-4 mb-4">
            <View className="flex-row items-center mb-3">
              <MessageSquare size={20} color="#003366" />
              <Text className="ml-2 text-lg font-semibold text-gray-900">
                Historikk
              </Text>
            </View>
            {claim.timeline.map((entry: any, index: number) => (
              <View
                key={entry.id}
                className={`pl-4 border-l-2 border-gray-200 ${
                  index < claim.timeline.length - 1 ? 'pb-4' : ''
                }`}
              >
                <Text className="text-gray-900 font-medium">
                  {entry.description}
                </Text>
                <Text className="text-gray-500 text-xs mt-1">
                  {formatDate(entry.createdAt)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
