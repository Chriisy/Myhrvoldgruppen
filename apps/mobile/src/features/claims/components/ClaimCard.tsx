import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight, Calendar } from 'lucide-react-native';
import { ClaimStatusBadge } from './ClaimStatusBadge';

interface Claim {
  id: string;
  claimNumber: string;
  status: string;
  productNameText?: string | null;
  customerCompanyName?: string | null;
  supplier?: { name: string } | null;
  createdAt: Date;
}

interface ClaimCardProps {
  claim: Claim;
}

export function ClaimCard({ claim }: ClaimCardProps) {
  const router = useRouter();

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('nb-NO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <Pressable
      onPress={() => router.push(`/claims/${claim.id}`)}
      className="bg-white p-4 rounded-xl shadow-sm mb-3 border border-gray-100 active:bg-gray-50"
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <View className="flex-row items-center gap-2 mb-2">
            <Text className="text-primary font-bold text-base">
              {claim.claimNumber}
            </Text>
            <ClaimStatusBadge status={claim.status} />
          </View>

          <Text className="text-gray-900 font-medium" numberOfLines={1}>
            {claim.productNameText || 'Ukjent produkt'}
          </Text>

          <Text className="text-gray-500 text-sm" numberOfLines={1}>
            {claim.customerCompanyName || 'Ingen kunde'}
          </Text>

          <View className="flex-row items-center mt-2">
            <Text className="text-xs text-gray-400">
              {claim.supplier?.name}
            </Text>
            <View className="mx-2 w-1 h-1 rounded-full bg-gray-300" />
            <View className="flex-row items-center">
              <Calendar size={12} color="#9ca3af" />
              <Text className="text-xs text-gray-400 ml-1">
                {formatDate(claim.createdAt)}
              </Text>
            </View>
          </View>
        </View>

        <ChevronRight size={20} color="#9ca3af" />
      </View>
    </Pressable>
  );
}
