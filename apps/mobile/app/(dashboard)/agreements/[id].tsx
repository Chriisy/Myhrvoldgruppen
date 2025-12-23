import { View, Text, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { trpc } from '../../../src/lib/api';
import { LoadingScreen } from '../../../src/components/LoadingScreen';
import { ErrorView } from '../../../src/components/ErrorView';
import {
  ArrowLeft, Building, Calendar, FileText, Clock, CreditCard, Users
} from 'lucide-react-native';

export default function AgreementDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data: agreement, isLoading, error, refetch } = trpc.agreements.byId.useQuery(
    { id: id! },
    { enabled: !!id }
  );

  if (isLoading) return <LoadingScreen />;
  if (error) return <ErrorView error={error} onRetry={refetch} />;
  if (!agreement) return <ErrorView error={new Error('Ikke funnet')} />;

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('nb-NO', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatCurrency = (value: string | null) => {
    if (!value) return '-';
    return new Intl.NumberFormat('nb-NO', {
      style: 'currency',
      currency: 'NOK',
    }).format(parseFloat(value));
  };

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-primary pt-12 pb-6 px-4">
        <View className="flex-row items-center">
          <Pressable onPress={() => router.back()} className="mr-4">
            <ArrowLeft size={24} color="white" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-white text-xl font-bold">{agreement.agreementNumber}</Text>
            <View className={`self-start px-2 py-0.5 rounded-full mt-1 ${
              agreement.status === 'active' ? 'bg-green-500' : 'bg-gray-500'
            }`}>
              <Text className="text-white text-xs font-medium">
                {agreement.status === 'active' ? 'Aktiv' : 'Utløpt'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
        <View className="bg-white rounded-xl p-4 mb-4">
          <View className="flex-row items-center mb-3">
            <FileText size={20} color="#003366" />
            <Text className="ml-2 text-lg font-semibold text-gray-900">Avtaledetaljer</Text>
          </View>
          <Text className="text-gray-900 font-medium text-lg">{agreement.name}</Text>
          {agreement.description && (
            <Text className="text-gray-600 mt-2">{agreement.description}</Text>
          )}
        </View>

        <View className="bg-white rounded-xl p-4 mb-4">
          <View className="flex-row items-center mb-3">
            <Building size={20} color="#003366" />
            <Text className="ml-2 text-lg font-semibold text-gray-900">Kunde</Text>
          </View>
          <Text className="text-gray-900 font-medium">{agreement.customer?.name}</Text>
        </View>

        <View className="bg-white rounded-xl p-4 mb-4">
          <View className="flex-row items-center mb-3">
            <Calendar size={20} color="#003366" />
            <Text className="ml-2 text-lg font-semibold text-gray-900">Periode</Text>
          </View>
          <View className="flex-row justify-between">
            <View>
              <Text className="text-gray-500 text-xs">Startdato</Text>
              <Text className="text-gray-900">{formatDate(agreement.startDate)}</Text>
            </View>
            <View>
              <Text className="text-gray-500 text-xs">Sluttdato</Text>
              <Text className="text-gray-900">{formatDate(agreement.endDate)}</Text>
            </View>
          </View>
        </View>

        <View className="bg-white rounded-xl p-4 mb-4">
          <View className="flex-row items-center mb-3">
            <CreditCard size={20} color="#003366" />
            <Text className="ml-2 text-lg font-semibold text-gray-900">Økonomi</Text>
          </View>
          <View className="flex-row justify-between">
            <View>
              <Text className="text-gray-500 text-xs">Årlig verdi</Text>
              <Text className="text-gray-900 font-semibold">
                {formatCurrency(agreement.annualValue)}
              </Text>
            </View>
            <View>
              <Text className="text-gray-500 text-xs">Besøk per år</Text>
              <Text className="text-gray-900 font-semibold">{agreement.visitsPerYear}</Text>
            </View>
          </View>
        </View>

        {agreement.visits && agreement.visits.length > 0 && (
          <View className="bg-white rounded-xl p-4 mb-4">
            <View className="flex-row items-center mb-3">
              <Clock size={20} color="#003366" />
              <Text className="ml-2 text-lg font-semibold text-gray-900">
                Siste besøk ({agreement.visits.length})
              </Text>
            </View>
            {agreement.visits.slice(0, 5).map((visit: any) => (
              <Pressable
                key={visit.id}
                onPress={() => router.push(`/visits/${visit.id}`)}
                className="flex-row items-center py-3 border-b border-gray-100"
              >
                <View className="flex-1">
                  <Text className="text-gray-900 font-medium">{visit.visitNumber}</Text>
                  <Text className="text-gray-500 text-sm">
                    {formatDate(visit.plannedDate)}
                  </Text>
                </View>
                <View className={`px-2 py-1 rounded ${
                  visit.status === 'completed' ? 'bg-green-100' : 'bg-yellow-100'
                }`}>
                  <Text className={`text-xs ${
                    visit.status === 'completed' ? 'text-green-700' : 'text-yellow-700'
                  }`}>
                    {visit.status === 'completed' ? 'Fullført' : 'Planlagt'}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
