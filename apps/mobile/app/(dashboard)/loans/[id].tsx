import { View, Text, ScrollView, ActivityIndicator, Pressable, Alert } from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { trpc } from '../../../src/lib/trpc';
import { ErrorView } from '../../../src/components/ErrorView';

export default function LoanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: loan, isLoading, error, refetch } = trpc.loans.recordById.useQuery(
    { id: id! },
    { enabled: !!id }
  );

  const utils = trpc.useUtils();
  const returnMutation = trpc.loans.return.useMutation({
    onSuccess: () => {
      Alert.alert('Suksess', 'Utstyr er returnert');
      utils.loans.recordById.invalidate({ id: id! });
      utils.loans.activeLoans.invalidate();
    },
    onError: (error) => {
      Alert.alert('Feil', error.message);
    },
  });

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#003366" />
      </View>
    );
  }

  if (error || !loan) {
    return <ErrorView message="Kunne ikke laste utlan" onRetry={refetch} />;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-blue-100 text-blue-800';
      case 'returned': return 'bg-green-100 text-green-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Aktivt utlan';
      case 'returned': return 'Returnert';
      case 'overdue': return 'Forfalt';
      default: return status;
    }
  };

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case 'excellent': return 'bg-green-100 text-green-800';
      case 'good': return 'bg-blue-100 text-blue-800';
      case 'fair': return 'bg-yellow-100 text-yellow-800';
      case 'poor': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getConditionLabel = (condition: string) => {
    switch (condition) {
      case 'excellent': return 'Utmerket';
      case 'good': return 'God';
      case 'fair': return 'OK';
      case 'poor': return 'Darlig';
      default: return condition;
    }
  };

  const handleReturn = () => {
    Alert.alert(
      'Returner utstyr',
      'Er du sikker pa at du vil returnere dette utstyret?',
      [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: 'Returner',
          onPress: () => {
            returnMutation.mutate({
              loanId: id!,
              returnCondition: 'good', // Default, could add a picker
            });
          },
        },
      ]
    );
  };

  const isOverdue = loan.status === 'active' && loan.expectedReturnDate && new Date(loan.expectedReturnDate) < new Date();

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Utlansdetaljer',
          headerBackTitle: 'Tilbake',
        }}
      />
      <ScrollView className="flex-1 bg-gray-50">
        {/* Header Card */}
        <View className="bg-white m-4 p-4 rounded-xl shadow-sm">
          <View className="flex-row justify-between items-start mb-3">
            <View className="flex-1">
              <Text className="text-xl font-bold text-gray-900">
                {loan.equipment?.name || 'Ukjent utstyr'}
              </Text>
              {loan.equipment?.serialNumber && (
                <Text className="text-gray-600 mt-1">
                  S/N: {loan.equipment.serialNumber}
                </Text>
              )}
            </View>
            <View className={`px-3 py-1 rounded-full ${getStatusColor(isOverdue ? 'overdue' : loan.status)}`}>
              <Text className="text-sm font-medium">
                {getStatusLabel(isOverdue ? 'overdue' : loan.status)}
              </Text>
            </View>
          </View>

          {loan.customer && (
            <View className="border-t border-gray-100 pt-3 mt-3">
              <Text className="text-sm text-gray-500">Utlant til</Text>
              <Text className="text-base font-medium text-gray-900">
                {loan.customer.name}
              </Text>
            </View>
          )}
        </View>

        {/* Dates Card */}
        <View className="bg-white mx-4 mb-4 p-4 rounded-xl shadow-sm">
          <Text className="text-lg font-semibold text-gray-900 mb-3">Datoer</Text>

          <View className="space-y-3">
            <View className="flex-row justify-between">
              <Text className="text-gray-500">Utlant</Text>
              <Text className="text-gray-900">
                {new Date(loan.loanedAt).toLocaleDateString('nb-NO')}
              </Text>
            </View>

            {loan.expectedReturnDate && (
              <View className="flex-row justify-between">
                <Text className="text-gray-500">Forventet retur</Text>
                <Text className={isOverdue ? 'text-red-600 font-medium' : 'text-gray-900'}>
                  {new Date(loan.expectedReturnDate).toLocaleDateString('nb-NO')}
                  {isOverdue && ' (forfalt)'}
                </Text>
              </View>
            )}

            {loan.returnedAt && (
              <View className="flex-row justify-between">
                <Text className="text-gray-500">Returnert</Text>
                <Text className="text-green-600 font-medium">
                  {new Date(loan.returnedAt).toLocaleDateString('nb-NO')}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Condition Card */}
        <View className="bg-white mx-4 mb-4 p-4 rounded-xl shadow-sm">
          <Text className="text-lg font-semibold text-gray-900 mb-3">Tilstand</Text>

          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-gray-500">Ved utlan</Text>
            <View className={`px-3 py-1 rounded-full ${getConditionColor(loan.conditionAtLoan)}`}>
              <Text className="text-sm font-medium">
                {getConditionLabel(loan.conditionAtLoan)}
              </Text>
            </View>
          </View>

          {loan.conditionAtReturn && (
            <View className="flex-row justify-between items-center">
              <Text className="text-gray-500">Ved retur</Text>
              <View className={`px-3 py-1 rounded-full ${getConditionColor(loan.conditionAtReturn)}`}>
                <Text className="text-sm font-medium">
                  {getConditionLabel(loan.conditionAtReturn)}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Equipment Details Card */}
        {loan.equipment && (
          <View className="bg-white mx-4 mb-4 p-4 rounded-xl shadow-sm">
            <Text className="text-lg font-semibold text-gray-900 mb-3">Utstyrsdetaljer</Text>

            <View className="space-y-2">
              {loan.equipment.category && (
                <View className="flex-row justify-between">
                  <Text className="text-gray-500">Kategori</Text>
                  <Text className="text-gray-900">{loan.equipment.category}</Text>
                </View>
              )}

              {loan.equipment.brand && (
                <View className="flex-row justify-between">
                  <Text className="text-gray-500">Merke</Text>
                  <Text className="text-gray-900">{loan.equipment.brand}</Text>
                </View>
              )}

              {loan.equipment.model && (
                <View className="flex-row justify-between">
                  <Text className="text-gray-500">Modell</Text>
                  <Text className="text-gray-900">{loan.equipment.model}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Notes Card */}
        {loan.notes && (
          <View className="bg-white mx-4 mb-4 p-4 rounded-xl shadow-sm">
            <Text className="text-lg font-semibold text-gray-900 mb-2">Notater</Text>
            <Text className="text-gray-700 leading-relaxed">{loan.notes}</Text>
          </View>
        )}

        {/* Return Notes Card */}
        {loan.returnNotes && (
          <View className="bg-white mx-4 mb-4 p-4 rounded-xl shadow-sm">
            <Text className="text-lg font-semibold text-gray-900 mb-2">Returnotater</Text>
            <Text className="text-gray-700 leading-relaxed">{loan.returnNotes}</Text>
          </View>
        )}

        {/* Actions */}
        {loan.status === 'active' && (
          <View className="mx-4 mb-8 space-y-3">
            <Pressable
              className={`p-4 rounded-xl ${
                returnMutation.isPending
                  ? 'bg-gray-400'
                  : 'bg-green-600 active:bg-green-700'
              }`}
              onPress={handleReturn}
              disabled={returnMutation.isPending}
            >
              {returnMutation.isPending ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white text-center font-semibold text-lg">
                  Returner utstyr
                </Text>
              )}
            </Pressable>

            {isOverdue && (
              <View className="bg-red-50 p-4 rounded-xl">
                <Text className="text-red-800 text-center">
                  Dette utlanet er forfalt. Vennligst returner utstyret snarest.
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </>
  );
}
