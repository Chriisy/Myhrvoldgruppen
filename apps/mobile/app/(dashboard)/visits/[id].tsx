import { View, Text, ScrollView, Pressable, TextInput, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { trpc } from '../../../src/lib/api';
import { LoadingScreen } from '../../../src/components/LoadingScreen';
import { ErrorView } from '../../../src/components/ErrorView';
import {
  ArrowLeft, Building, Calendar, Clock, User, FileText, CheckCircle, Wrench
} from 'lucide-react-native';

export default function VisitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [workPerformed, setWorkPerformed] = useState('');
  const [findings, setFindings] = useState('');

  const { data: visit, isLoading, error, refetch } = trpc.visits.byId.useQuery(
    { id: id! },
    { enabled: !!id }
  );

  const completeMutation = trpc.visits.complete.useMutation({
    onSuccess: () => {
      Alert.alert('Besøk fullført', 'Servicerapporten er lagret.');
      refetch();
    },
    onError: (err) => {
      Alert.alert('Feil', err.message);
    },
  });

  if (isLoading) return <LoadingScreen />;
  if (error) return <ErrorView error={error} onRetry={refetch} />;
  if (!visit) return <ErrorView error={new Error('Ikke funnet')} />;

  const formatDate = (date: Date | string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('nb-NO', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatTime = (date: Date | string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleTimeString('nb-NO', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleComplete = () => {
    if (!workPerformed.trim()) {
      Alert.alert('Feil', 'Beskriv utført arbeid');
      return;
    }

    completeMutation.mutate({
      id: id!,
      workPerformed: workPerformed.trim(),
      findings: findings.trim() || undefined,
    });
  };

  const isCompleted = visit.status === 'completed';

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-primary pt-12 pb-6 px-4">
        <View className="flex-row items-center">
          <Pressable onPress={() => router.back()} className="mr-4">
            <ArrowLeft size={24} color="white" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-white text-xl font-bold">{visit.visitNumber}</Text>
            <View className={`self-start px-2 py-0.5 rounded-full mt-1 ${
              isCompleted ? 'bg-green-500' : 'bg-yellow-500'
            }`}>
              <Text className="text-white text-xs font-medium">
                {isCompleted ? 'Fullført' : 'Planlagt'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
        <View className="bg-white rounded-xl p-4 mb-4">
          <View className="flex-row items-center mb-3">
            <Building size={20} color="#003366" />
            <Text className="ml-2 text-lg font-semibold text-gray-900">Kunde</Text>
          </View>
          <Text className="text-gray-900 font-medium">{visit.customer?.name}</Text>
        </View>

        <View className="bg-white rounded-xl p-4 mb-4">
          <View className="flex-row items-center mb-3">
            <Calendar size={20} color="#003366" />
            <Text className="ml-2 text-lg font-semibold text-gray-900">Tidspunkt</Text>
          </View>
          <Text className="text-gray-900">{formatDate(visit.plannedDate)}</Text>
          <Text className="text-gray-500">{formatTime(visit.plannedDate)}</Text>
          {visit.plannedDuration && (
            <Text className="text-gray-500 mt-1">
              Estimert varighet: {visit.plannedDuration} min
            </Text>
          )}
        </View>

        {visit.technician && (
          <View className="bg-white rounded-xl p-4 mb-4">
            <View className="flex-row items-center mb-3">
              <User size={20} color="#003366" />
              <Text className="ml-2 text-lg font-semibold text-gray-900">Tekniker</Text>
            </View>
            <Text className="text-gray-900">
              {visit.technician.firstName} {visit.technician.lastName}
            </Text>
          </View>
        )}

        {visit.workDescription && (
          <View className="bg-white rounded-xl p-4 mb-4">
            <View className="flex-row items-center mb-3">
              <FileText size={20} color="#003366" />
              <Text className="ml-2 text-lg font-semibold text-gray-900">Arbeidsbeskrivelse</Text>
            </View>
            <Text className="text-gray-700">{visit.workDescription}</Text>
          </View>
        )}

        {isCompleted && visit.workPerformed && (
          <View className="bg-green-50 rounded-xl p-4 mb-4 border border-green-200">
            <View className="flex-row items-center mb-3">
              <CheckCircle size={20} color="#22c55e" />
              <Text className="ml-2 text-lg font-semibold text-green-800">Utført arbeid</Text>
            </View>
            <Text className="text-green-900">{visit.workPerformed}</Text>
            {visit.findings && (
              <>
                <Text className="text-green-800 font-medium mt-3">Funn:</Text>
                <Text className="text-green-900">{visit.findings}</Text>
              </>
            )}
          </View>
        )}

        {!isCompleted && (
          <>
            <Text className="text-lg font-semibold text-gray-900 mb-3">Fullfør besøk</Text>

            <View className="bg-white rounded-xl p-4 mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-2">Utført arbeid *</Text>
              <TextInput
                className="border border-gray-200 rounded-lg px-4 py-3 min-h-[100px]"
                placeholder="Beskriv hva som ble gjort..."
                multiline
                textAlignVertical="top"
                value={workPerformed}
                onChangeText={setWorkPerformed}
              />
            </View>

            <View className="bg-white rounded-xl p-4 mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-2">Funn og anbefalinger</Text>
              <TextInput
                className="border border-gray-200 rounded-lg px-4 py-3 min-h-[80px]"
                placeholder="Eventuelle funn eller anbefalinger..."
                multiline
                textAlignVertical="top"
                value={findings}
                onChangeText={setFindings}
              />
            </View>

            <Pressable
              onPress={handleComplete}
              disabled={!workPerformed.trim() || completeMutation.isPending}
              className={`flex-row items-center justify-center py-4 rounded-xl mb-8 ${
                workPerformed.trim() && !completeMutation.isPending
                  ? 'bg-green-600'
                  : 'bg-gray-200'
              }`}
            >
              <CheckCircle size={20} color="white" />
              <Text className="text-white font-semibold ml-2">
                {completeMutation.isPending ? 'Lagrer...' : 'Fullfør besøk'}
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}
