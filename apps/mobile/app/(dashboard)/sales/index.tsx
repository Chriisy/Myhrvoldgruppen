import { useState } from 'react';
import { View, Text, FlatList, RefreshControl, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { trpc } from '../../../src/lib/api';
import { LoadingScreen } from '../../../src/components/LoadingScreen';
import { ErrorView } from '../../../src/components/ErrorView';
import {
  Plus, Users, Target, FileText, TrendingUp, ChevronRight, Building,
  Phone, Mail, DollarSign, Calendar
} from 'lucide-react-native';

type TabType = 'leads' | 'opportunities' | 'quotations';

export default function SalesScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('leads');

  const { data: leads, isLoading: loadingLeads, refetch: refetchLeads, isRefetching: isRefetchingLeads } =
    trpc.sales.leadsList.useQuery({});

  const { data: opportunities, isLoading: loadingOpps, refetch: refetchOpps, isRefetching: isRefetchingOpps } =
    trpc.sales.opportunitiesList.useQuery({});

  const { data: quotations, isLoading: loadingQuotes, refetch: refetchQuotes, isRefetching: isRefetchingQuotes } =
    trpc.sales.quotationsList.useQuery({});

  const { data: stats } = trpc.sales.stats.useQuery();

  const isLoading = activeTab === 'leads' ? loadingLeads :
                    activeTab === 'opportunities' ? loadingOpps : loadingQuotes;
  const isRefetching = activeTab === 'leads' ? isRefetchingLeads :
                       activeTab === 'opportunities' ? isRefetchingOpps : isRefetchingQuotes;
  const refetch = activeTab === 'leads' ? refetchLeads :
                  activeTab === 'opportunities' ? refetchOpps : refetchQuotes;

  if (isLoading) return <LoadingScreen />;

  const formatCurrency = (value: string | null) => {
    if (!value) return '-';
    return new Intl.NumberFormat('nb-NO', {
      style: 'currency',
      currency: 'NOK',
      maximumFractionDigits: 0,
    }).format(parseFloat(value));
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('nb-NO', {
      day: '2-digit',
      month: 'short',
    });
  };

  const getLeadTemperature = (temp: string) => {
    switch (temp) {
      case 'hot': return { bg: 'bg-red-100', text: 'text-red-700', label: 'Varm' };
      case 'warm': return { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Lun' };
      default: return { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Kald' };
    }
  };

  const getStageConfig = (stage: string) => {
    switch (stage) {
      case 'qualification': return { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Kvalifisering' };
      case 'needs_analysis': return { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Behovsanalyse' };
      case 'proposal': return { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Tilbud' };
      case 'negotiation': return { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Forhandling' };
      case 'closed_won': return { bg: 'bg-green-100', text: 'text-green-700', label: 'Vunnet' };
      case 'closed_lost': return { bg: 'bg-red-100', text: 'text-red-700', label: 'Tapt' };
      default: return { bg: 'bg-gray-100', text: 'text-gray-700', label: stage };
    }
  };

  const renderLeadItem = ({ item }: { item: any }) => {
    const tempConfig = getLeadTemperature(item.temperature);

    return (
      <Pressable
        onPress={() => router.push(`/sales/leads/${item.id}`)}
        className="bg-white p-4 rounded-xl shadow-sm mb-3 border border-gray-100"
      >
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <View className="flex-row items-center gap-2 mb-1">
              <Text className="text-primary font-bold">{item.leadNumber}</Text>
              <View className={`px-2 py-0.5 rounded-full ${tempConfig.bg}`}>
                <Text className={`text-xs font-medium ${tempConfig.text}`}>{tempConfig.label}</Text>
              </View>
            </View>

            <View className="flex-row items-center">
              <Building size={14} color="#374151" />
              <Text className="text-gray-900 font-medium ml-1">{item.companyName}</Text>
            </View>

            {item.contactName && (
              <Text className="text-gray-600 text-sm mt-1">{item.contactName}</Text>
            )}

            <View className="flex-row items-center mt-2 gap-4">
              {item.phone && (
                <View className="flex-row items-center">
                  <Phone size={12} color="#9ca3af" />
                  <Text className="text-xs text-gray-500 ml-1">{item.phone}</Text>
                </View>
              )}
              {item.estimatedValue && (
                <View className="flex-row items-center">
                  <DollarSign size={12} color="#9ca3af" />
                  <Text className="text-xs text-gray-500 ml-1">
                    {formatCurrency(item.estimatedValue)}
                  </Text>
                </View>
              )}
            </View>
          </View>
          <ChevronRight size={20} color="#9ca3af" />
        </View>
      </Pressable>
    );
  };

  const renderOpportunityItem = ({ item }: { item: any }) => {
    const stageConfig = getStageConfig(item.stage);

    return (
      <Pressable
        onPress={() => router.push(`/sales/opportunities/${item.id}`)}
        className="bg-white p-4 rounded-xl shadow-sm mb-3 border border-gray-100"
      >
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <View className="flex-row items-center gap-2 mb-1">
              <Text className="text-primary font-bold">{item.opportunityNumber}</Text>
              <View className={`px-2 py-0.5 rounded-full ${stageConfig.bg}`}>
                <Text className={`text-xs font-medium ${stageConfig.text}`}>{stageConfig.label}</Text>
              </View>
            </View>

            <Text className="text-gray-900 font-medium">{item.name}</Text>

            {item.customer && (
              <View className="flex-row items-center mt-1">
                <Building size={12} color="#9ca3af" />
                <Text className="text-gray-600 text-sm ml-1">{item.customer.name}</Text>
              </View>
            )}

            <View className="flex-row items-center mt-2 gap-4">
              {item.value && (
                <View className="flex-row items-center">
                  <DollarSign size={12} color="#22c55e" />
                  <Text className="text-green-600 text-sm font-medium">
                    {formatCurrency(item.value)}
                  </Text>
                </View>
              )}
              {item.expectedCloseDate && (
                <View className="flex-row items-center">
                  <Calendar size={12} color="#9ca3af" />
                  <Text className="text-xs text-gray-500 ml-1">
                    {formatDate(item.expectedCloseDate)}
                  </Text>
                </View>
              )}
            </View>
          </View>
          <ChevronRight size={20} color="#9ca3af" />
        </View>
      </Pressable>
    );
  };

  const renderQuotationItem = ({ item }: { item: any }) => (
    <Pressable className="bg-white p-4 rounded-xl shadow-sm mb-3 border border-gray-100">
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <View className="flex-row items-center gap-2 mb-1">
            <Text className="text-primary font-bold">{item.quotationNumber}</Text>
            <View className={`px-2 py-0.5 rounded-full ${
              item.status === 'accepted' ? 'bg-green-100' :
              item.status === 'sent' ? 'bg-blue-100' : 'bg-gray-100'
            }`}>
              <Text className={`text-xs font-medium ${
                item.status === 'accepted' ? 'text-green-700' :
                item.status === 'sent' ? 'text-blue-700' : 'text-gray-700'
              }`}>
                {item.status === 'accepted' ? 'Akseptert' :
                 item.status === 'sent' ? 'Sendt' : 'Utkast'}
              </Text>
            </View>
          </View>

          <Text className="text-gray-900 font-medium">{item.title}</Text>

          {item.customer && (
            <Text className="text-gray-600 text-sm mt-1">{item.customer.name}</Text>
          )}

          {item.total && (
            <Text className="text-green-600 font-semibold mt-2">
              {formatCurrency(item.total)}
            </Text>
          )}
        </View>
        <ChevronRight size={20} color="#9ca3af" />
      </View>
    </Pressable>
  );

  const getData = () => {
    switch (activeTab) {
      case 'leads': return leads;
      case 'opportunities': return opportunities;
      case 'quotations': return quotations;
    }
  };

  const getRenderItem = () => {
    switch (activeTab) {
      case 'leads': return renderLeadItem;
      case 'opportunities': return renderOpportunityItem;
      case 'quotations': return renderQuotationItem;
    }
  };

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-primary pt-12 pb-4 px-4">
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <Text className="text-white text-2xl font-bold">Salg</Text>
            <Text className="text-white/70">
              Pipeline: {formatCurrency(stats?.pipelineValue?.toString() || '0')}
            </Text>
          </View>
          <Pressable className="bg-accent px-4 py-2 rounded-lg flex-row items-center">
            <Plus size={18} color="white" />
            <Text className="text-white font-medium ml-1">Ny</Text>
          </Pressable>
        </View>

        {/* Stats */}
        <View className="flex-row gap-2 mb-4">
          <View className="flex-1 bg-white/20 p-3 rounded-lg">
            <View className="flex-row items-center">
              <Users size={16} color="white" />
              <Text className="text-white font-bold text-lg ml-2">{stats?.openLeads || 0}</Text>
            </View>
            <Text className="text-white/70 text-xs">Nye leads</Text>
          </View>
          <View className="flex-1 bg-white/20 p-3 rounded-lg">
            <View className="flex-row items-center">
              <Target size={16} color="white" />
              <Text className="text-white font-bold text-lg ml-2">{stats?.openOpportunities || 0}</Text>
            </View>
            <Text className="text-white/70 text-xs">Muligheter</Text>
          </View>
          <View className="flex-1 bg-white/20 p-3 rounded-lg">
            <View className="flex-row items-center">
              <FileText size={16} color="white" />
              <Text className="text-white font-bold text-lg ml-2">{stats?.pendingQuotations || 0}</Text>
            </View>
            <Text className="text-white/70 text-xs">Tilbud</Text>
          </View>
        </View>

        {/* Tabs */}
        <View className="flex-row bg-white/20 rounded-lg p-1">
          <Pressable
            onPress={() => setActiveTab('leads')}
            className={`flex-1 py-2 rounded-md ${activeTab === 'leads' ? 'bg-white' : ''}`}
          >
            <Text className={`text-center font-medium ${activeTab === 'leads' ? 'text-primary' : 'text-white'}`}>
              Leads
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab('opportunities')}
            className={`flex-1 py-2 rounded-md ${activeTab === 'opportunities' ? 'bg-white' : ''}`}
          >
            <Text className={`text-center font-medium ${activeTab === 'opportunities' ? 'text-primary' : 'text-white'}`}>
              Muligheter
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab('quotations')}
            className={`flex-1 py-2 rounded-md ${activeTab === 'quotations' ? 'bg-white' : ''}`}
          >
            <Text className={`text-center font-medium ${activeTab === 'quotations' ? 'text-primary' : 'text-white'}`}>
              Tilbud
            </Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={getData()}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#003366" />
        }
        renderItem={getRenderItem()}
        ListEmptyComponent={
          <View className="items-center py-12">
            <TrendingUp size={48} color="#9ca3af" />
            <Text className="text-gray-500 mt-4">Ingen {
              activeTab === 'leads' ? 'leads' :
              activeTab === 'opportunities' ? 'muligheter' : 'tilbud'
            } funnet</Text>
          </View>
        }
      />
    </View>
  );
}
