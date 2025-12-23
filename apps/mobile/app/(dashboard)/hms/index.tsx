import { useState } from 'react';
import { View, Text, FlatList, RefreshControl, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { trpc } from '../../../src/lib/api';
import { LoadingScreen } from '../../../src/components/LoadingScreen';
import { ErrorView } from '../../../src/components/ErrorView';
import {
  Plus, Shield, AlertTriangle, ClipboardCheck, ChevronRight, Calendar, User,
  CheckCircle, Clock, FileText
} from 'lucide-react-native';

type TabType = 'sja' | 'incidents';

export default function HMSScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('sja');

  const { data: sjaList, isLoading: loadingSJA, refetch: refetchSJA, isRefetching: isRefetchingSJA } =
    trpc.hms.sjaList.useQuery({});

  const { data: incidents, isLoading: loadingIncidents, refetch: refetchIncidents, isRefetching: isRefetchingIncidents } =
    trpc.hms.incidentsList.useQuery({});

  const { data: stats } = trpc.hms.stats.useQuery();

  const isLoading = activeTab === 'sja' ? loadingSJA : loadingIncidents;
  const isRefetching = activeTab === 'sja' ? isRefetchingSJA : isRefetchingIncidents;
  const refetch = activeTab === 'sja' ? refetchSJA : refetchIncidents;

  if (isLoading) return <LoadingScreen />;

  const formatDate = (date: Date | string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('nb-NO', {
      day: '2-digit',
      month: 'short',
    });
  };

  const getSJAStatusConfig = (status: string) => {
    switch (status) {
      case 'approved':
        return { bg: 'bg-green-100', text: 'text-green-700', label: 'Godkjent' };
      case 'completed':
        return { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Fullført' };
      default:
        return { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Utkast' };
    }
  };

  const getIncidentSeverity = (severity: string) => {
    switch (severity) {
      case 'critical':
        return { bg: 'bg-red-100', text: 'text-red-700', label: 'Kritisk' };
      case 'serious':
        return { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Alvorlig' };
      case 'moderate':
        return { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Moderat' };
      default:
        return { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Mindre' };
    }
  };

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-primary pt-12 pb-4 px-4">
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <Text className="text-white text-2xl font-bold">HMS</Text>
            <Text className="text-white/70">Helse, Miljø og Sikkerhet</Text>
          </View>
          <Pressable
            onPress={() => router.push(activeTab === 'sja' ? '/hms/new-sja' : '/hms/new-incident')}
            className="bg-accent px-4 py-2 rounded-lg flex-row items-center"
          >
            <Plus size={18} color="white" />
            <Text className="text-white font-medium ml-1">Ny</Text>
          </Pressable>
        </View>

        {/* Stats */}
        <View className="flex-row gap-2 mb-4">
          <View className="flex-1 bg-white/20 p-3 rounded-lg">
            <View className="flex-row items-center">
              <AlertTriangle size={16} color="white" />
              <Text className="text-white font-bold text-lg ml-2">{stats?.openIncidents || 0}</Text>
            </View>
            <Text className="text-white/70 text-xs">Åpne hendelser</Text>
          </View>
          <View className="flex-1 bg-white/20 p-3 rounded-lg">
            <View className="flex-row items-center">
              <ClipboardCheck size={16} color="white" />
              <Text className="text-white font-bold text-lg ml-2">{stats?.pendingSJA || 0}</Text>
            </View>
            <Text className="text-white/70 text-xs">SJA til godkjenning</Text>
          </View>
          <View className="flex-1 bg-white/20 p-3 rounded-lg">
            <View className="flex-row items-center">
              <Calendar size={16} color="white" />
              <Text className="text-white font-bold text-lg ml-2">{stats?.thisMonthIncidents || 0}</Text>
            </View>
            <Text className="text-white/70 text-xs">Denne mnd</Text>
          </View>
        </View>

        {/* Tabs */}
        <View className="flex-row bg-white/20 rounded-lg p-1">
          <Pressable
            onPress={() => setActiveTab('sja')}
            className={`flex-1 py-2 rounded-md ${activeTab === 'sja' ? 'bg-white' : ''}`}
          >
            <Text className={`text-center font-medium ${activeTab === 'sja' ? 'text-primary' : 'text-white'}`}>
              SJA
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab('incidents')}
            className={`flex-1 py-2 rounded-md ${activeTab === 'incidents' ? 'bg-white' : ''}`}
          >
            <Text className={`text-center font-medium ${activeTab === 'incidents' ? 'text-primary' : 'text-white'}`}>
              Hendelser
            </Text>
          </Pressable>
        </View>
      </View>

      {activeTab === 'sja' ? (
        <FlatList
          data={sjaList}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#003366" />
          }
          renderItem={({ item }) => {
            const statusConfig = getSJAStatusConfig(item.status);

            return (
              <Pressable
                onPress={() => router.push(`/hms/sja/${item.id}`)}
                className="bg-white p-4 rounded-xl shadow-sm mb-3 border border-gray-100"
              >
                <View className="flex-row items-start justify-between">
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2 mb-1">
                      <Text className="text-primary font-bold">{item.sjaNumber}</Text>
                      <View className={`px-2 py-0.5 rounded-full ${statusConfig.bg}`}>
                        <Text className={`text-xs font-medium ${statusConfig.text}`}>
                          {statusConfig.label}
                        </Text>
                      </View>
                    </View>

                    <Text className="text-gray-900 font-medium">{item.jobTitle}</Text>

                    {item.customer && (
                      <View className="flex-row items-center mt-1">
                        <User size={12} color="#9ca3af" />
                        <Text className="text-gray-600 text-sm ml-1">{item.customer.name}</Text>
                      </View>
                    )}

                    <View className="flex-row items-center mt-2">
                      <Calendar size={12} color="#9ca3af" />
                      <Text className="text-xs text-gray-500 ml-1">
                        {formatDate(item.plannedDate)}
                      </Text>
                    </View>
                  </View>
                  <ChevronRight size={20} color="#9ca3af" />
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View className="items-center py-12">
              <ClipboardCheck size={48} color="#9ca3af" />
              <Text className="text-gray-500 mt-4">Ingen SJA registrert</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={incidents}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#003366" />
          }
          renderItem={({ item }) => {
            const severityConfig = getIncidentSeverity(item.severity);

            return (
              <Pressable
                onPress={() => router.push(`/hms/incidents/${item.id}`)}
                className="bg-white p-4 rounded-xl shadow-sm mb-3 border border-gray-100"
              >
                <View className="flex-row items-start justify-between">
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2 mb-1">
                      <Text className="text-primary font-bold">{item.incidentNumber}</Text>
                      <View className={`px-2 py-0.5 rounded-full ${severityConfig.bg}`}>
                        <Text className={`text-xs font-medium ${severityConfig.text}`}>
                          {severityConfig.label}
                        </Text>
                      </View>
                      {item.status === 'closed' && (
                        <View className="px-2 py-0.5 rounded-full bg-gray-100">
                          <Text className="text-xs font-medium text-gray-700">Lukket</Text>
                        </View>
                      )}
                    </View>

                    <Text className="text-gray-900 font-medium">{item.title}</Text>

                    <Text className="text-gray-600 text-sm mt-1" numberOfLines={2}>
                      {item.description}
                    </Text>

                    <View className="flex-row items-center mt-2 gap-4">
                      <View className="flex-row items-center">
                        <Calendar size={12} color="#9ca3af" />
                        <Text className="text-xs text-gray-500 ml-1">
                          {formatDate(item.incidentDate)}
                        </Text>
                      </View>
                      {item.injuryOccurred && (
                        <View className="flex-row items-center">
                          <AlertTriangle size={12} color="#ef4444" />
                          <Text className="text-xs text-red-600 ml-1">Personskade</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <ChevronRight size={20} color="#9ca3af" />
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View className="items-center py-12">
              <Shield size={48} color="#9ca3af" />
              <Text className="text-gray-500 mt-4">Ingen hendelser registrert</Text>
            </View>
          }
        />
      )}
    </View>
  );
}
