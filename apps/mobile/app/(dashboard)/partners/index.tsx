import { useState } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { trpc } from '../../../src/lib/api';
import { LoadingScreen } from '../../../src/components/LoadingScreen';
import { ErrorView } from '../../../src/components/ErrorView';
import {
  Map, List, Search, MapPin, Phone, Mail, Star, ChevronRight, Building
} from 'lucide-react-native';

export default function PartnersScreen() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [search, setSearch] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<string | undefined>();

  const { data: partners, isLoading, error, refetch, isRefetching } = trpc.partners.list.useQuery({
    search: search || undefined,
    region: selectedRegion,
  });

  const { data: regions } = trpc.partners.regions.useQuery();
  const { data: stats } = trpc.partners.stats.useQuery();

  if (isLoading) return <LoadingScreen />;
  if (error) return <ErrorView error={error} onRetry={refetch} />;

  const renderRating = (rating: string | null) => {
    if (!rating) return null;
    const stars = parseFloat(rating);
    return (
      <View className="flex-row items-center">
        <Star size={12} color="#f59e0b" fill="#f59e0b" />
        <Text className="text-yellow-600 text-xs ml-1">{stars.toFixed(1)}</Text>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-primary pt-12 pb-4 px-4">
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <Text className="text-white text-2xl font-bold">Servicepartnere</Text>
            <Text className="text-white/70">{stats?.total || 0} partnere</Text>
          </View>
          <View className="flex-row bg-white/20 rounded-lg p-1">
            <Pressable
              onPress={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md ${viewMode === 'list' ? 'bg-white' : ''}`}
            >
              <List size={18} color={viewMode === 'list' ? '#003366' : 'white'} />
            </Pressable>
            <Pressable
              onPress={() => setViewMode('map')}
              className={`px-3 py-1.5 rounded-md ${viewMode === 'map' ? 'bg-white' : ''}`}
            >
              <Map size={18} color={viewMode === 'map' ? '#003366' : 'white'} />
            </Pressable>
          </View>
        </View>

        <View className="flex-row bg-white rounded-lg px-3 py-2 items-center">
          <Search size={18} color="#9ca3af" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Søk partnere..."
            className="flex-1 ml-2 text-gray-900"
            placeholderTextColor="#9ca3af"
          />
        </View>
      </View>

      {viewMode === 'map' ? (
        // Map view placeholder
        <View className="flex-1 bg-gray-200 items-center justify-center">
          <Map size={64} color="#9ca3af" />
          <Text className="text-gray-500 mt-4 text-lg">Kartvisning</Text>
          <Text className="text-gray-400 mt-1">Krever MapView-integrasjon</Text>
          <Text className="text-gray-400 text-sm mt-4 px-8 text-center">
            I produksjon ville dette vise et kart med alle partnere markert basert på deres lokasjon.
          </Text>
        </View>
      ) : (
        <>
          {/* Region filter */}
          <View className="px-4 py-2">
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={[{ id: undefined, name: 'Alle' }, ...(regions || [])]}
              keyExtractor={(item) => item.id || 'all'}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => setSelectedRegion(item.id)}
                  className={`px-4 py-2 mr-2 rounded-full ${
                    selectedRegion === item.id ? 'bg-primary' : 'bg-gray-200'
                  }`}
                >
                  <Text className={selectedRegion === item.id ? 'text-white' : 'text-gray-700'}>
                    {item.name}
                  </Text>
                </Pressable>
              )}
            />
          </View>

          <FlatList
            data={partners}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16 }}
            refreshControl={
              <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#003366" />
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => router.push(`/partners/${item.id}`)}
                className="bg-white p-4 rounded-xl shadow-sm mb-3 border border-gray-100"
              >
                <View className="flex-row items-start justify-between">
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2 mb-1">
                      <Building size={16} color="#003366" />
                      <Text className="text-primary font-bold">{item.name}</Text>
                      {renderRating(item.rating)}
                    </View>

                    {item.city && (
                      <View className="flex-row items-center mt-1">
                        <MapPin size={12} color="#9ca3af" />
                        <Text className="text-gray-500 text-sm ml-1">
                          {item.city}{item.region ? `, ${item.region}` : ''}
                        </Text>
                      </View>
                    )}

                    {item.serviceTypes && (
                      <Text className="text-gray-600 text-sm mt-2">{item.serviceTypes}</Text>
                    )}

                    <View className="flex-row mt-3 gap-4">
                      {item.phone && (
                        <View className="flex-row items-center">
                          <Phone size={12} color="#9ca3af" />
                          <Text className="text-gray-500 text-xs ml-1">{item.phone}</Text>
                        </View>
                      )}
                      {item.email && (
                        <View className="flex-row items-center">
                          <Mail size={12} color="#9ca3af" />
                          <Text className="text-gray-500 text-xs ml-1">{item.email}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <ChevronRight size={20} color="#9ca3af" />
                </View>
              </Pressable>
            )}
            ListEmptyComponent={
              <View className="items-center py-12">
                <Text className="text-gray-500">Ingen partnere funnet</Text>
              </View>
            }
          />
        </>
      )}
    </View>
  );
}
