import { View, Text, ScrollView, Pressable, Linking } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { trpc } from '../../../src/lib/api';
import { LoadingScreen } from '../../../src/components/LoadingScreen';
import { ErrorView } from '../../../src/components/ErrorView';
import {
  ArrowLeft, Building, MapPin, Phone, Mail, User, Star, Award, Wrench, Calendar
} from 'lucide-react-native';

export default function PartnerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data: partner, isLoading, error, refetch } = trpc.partners.byId.useQuery(
    { id: id! },
    { enabled: !!id }
  );

  if (isLoading) return <LoadingScreen />;
  if (error) return <ErrorView error={error} onRetry={refetch} />;
  if (!partner) return <ErrorView error={new Error('Ikke funnet')} />;

  const handleCall = () => {
    if (partner.phone) {
      Linking.openURL(`tel:${partner.phone}`);
    }
  };

  const handleEmail = () => {
    if (partner.email) {
      Linking.openURL(`mailto:${partner.email}`);
    }
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('nb-NO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-primary pt-12 pb-6 px-4">
        <View className="flex-row items-center">
          <Pressable onPress={() => router.back()} className="mr-4">
            <ArrowLeft size={24} color="white" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-white text-xl font-bold">{partner.name}</Text>
            {partner.rating && (
              <View className="flex-row items-center mt-1">
                <Star size={14} color="#f59e0b" fill="#f59e0b" />
                <Text className="text-white ml-1">{parseFloat(partner.rating).toFixed(1)}</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
        <View className="bg-white rounded-xl p-4 mb-4">
          <View className="flex-row items-center mb-3">
            <Building size={20} color="#003366" />
            <Text className="ml-2 text-lg font-semibold text-gray-900">Kontaktinfo</Text>
          </View>

          {partner.address && (
            <View className="flex-row items-start mb-2">
              <MapPin size={16} color="#9ca3af" className="mt-0.5" />
              <View className="ml-2">
                <Text className="text-gray-900">{partner.address}</Text>
                <Text className="text-gray-600">
                  {partner.postalCode} {partner.city}
                </Text>
              </View>
            </View>
          )}

          <View className="flex-row gap-2 mt-4">
            {partner.phone && (
              <Pressable
                onPress={handleCall}
                className="flex-1 flex-row items-center justify-center py-3 bg-green-100 rounded-lg"
              >
                <Phone size={18} color="#22c55e" />
                <Text className="text-green-700 font-medium ml-2">Ring</Text>
              </Pressable>
            )}
            {partner.email && (
              <Pressable
                onPress={handleEmail}
                className="flex-1 flex-row items-center justify-center py-3 bg-blue-100 rounded-lg"
              >
                <Mail size={18} color="#3b82f6" />
                <Text className="text-blue-700 font-medium ml-2">E-post</Text>
              </Pressable>
            )}
          </View>
        </View>

        {partner.contactPerson && (
          <View className="bg-white rounded-xl p-4 mb-4">
            <View className="flex-row items-center mb-3">
              <User size={20} color="#003366" />
              <Text className="ml-2 text-lg font-semibold text-gray-900">Kontaktperson</Text>
            </View>
            <Text className="text-gray-900 font-medium">{partner.contactPerson}</Text>
            {partner.contactEmail && (
              <Text className="text-gray-600">{partner.contactEmail}</Text>
            )}
            {partner.contactPhone && (
              <Text className="text-gray-600">{partner.contactPhone}</Text>
            )}
          </View>
        )}

        {partner.serviceTypes && (
          <View className="bg-white rounded-xl p-4 mb-4">
            <View className="flex-row items-center mb-3">
              <Wrench size={20} color="#003366" />
              <Text className="ml-2 text-lg font-semibold text-gray-900">Tjenester</Text>
            </View>
            <Text className="text-gray-700">{partner.serviceTypes}</Text>
          </View>
        )}

        {partner.certifications && (
          <View className="bg-white rounded-xl p-4 mb-4">
            <View className="flex-row items-center mb-3">
              <Award size={20} color="#003366" />
              <Text className="ml-2 text-lg font-semibold text-gray-900">Sertifiseringer</Text>
            </View>
            <Text className="text-gray-700">{partner.certifications}</Text>
          </View>
        )}

        {partner.brands && (
          <View className="bg-white rounded-xl p-4 mb-4">
            <View className="flex-row items-center mb-3">
              <Building size={20} color="#003366" />
              <Text className="ml-2 text-lg font-semibold text-gray-900">Merker</Text>
            </View>
            <Text className="text-gray-700">{partner.brands}</Text>
          </View>
        )}

        {partner.visits && partner.visits.length > 0 && (
          <View className="bg-white rounded-xl p-4 mb-4">
            <View className="flex-row items-center mb-3">
              <Calendar size={20} color="#003366" />
              <Text className="ml-2 text-lg font-semibold text-gray-900">
                Siste besøk ({partner.visits.length})
              </Text>
            </View>
            {partner.visits.slice(0, 5).map((visit: any) => (
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
