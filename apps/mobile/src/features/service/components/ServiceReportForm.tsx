import { useState } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, Alert } from 'react-native';
import { trpc } from '../../../lib/api';
import { SignatureCapture } from '../../../components/SignatureCapture';
import {
  FileText, Clock, Wrench, AlertCircle, MessageSquare, CreditCard, PenTool
} from 'lucide-react-native';

interface ServiceReportFormProps {
  visitId: string;
  visitNumber: string;
  customerName: string;
  onComplete: () => void;
}

export function ServiceReportForm({
  visitId,
  visitNumber,
  customerName,
  onComplete
}: ServiceReportFormProps) {
  const [workPerformed, setWorkPerformed] = useState('');
  const [findings, setFindings] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [laborHours, setLaborHours] = useState('');
  const [laborCost, setLaborCost] = useState('');
  const [partsCost, setPartsCost] = useState('');
  const [travelCost, setTravelCost] = useState('');
  const [notes, setNotes] = useState('');
  const [showSignature, setShowSignature] = useState(false);
  const [signature, setSignature] = useState<{ data: string; signedBy: string } | null>(null);

  const completeReport = trpc.reports.completeReport.useMutation();
  const saveSignature = trpc.reports.saveSignature.useMutation();

  const handleSignatureSave = (signatureData: string, signedBy: string) => {
    setSignature({ data: signatureData, signedBy });
    setShowSignature(false);
  };

  const handleSubmit = async () => {
    if (!workPerformed.trim()) {
      Alert.alert('Mangler informasjon', 'Vennligst beskriv utført arbeid');
      return;
    }

    try {
      // Complete the report
      await completeReport.mutateAsync({
        visitId,
        workPerformed,
        findings: findings || undefined,
        recommendations: recommendations || undefined,
        laborHours: laborHours ? parseFloat(laborHours) : undefined,
        laborCost: laborCost ? parseFloat(laborCost) : undefined,
        partsCost: partsCost ? parseFloat(partsCost) : undefined,
        travelCost: travelCost ? parseFloat(travelCost) : undefined,
        notes: notes || undefined,
      });

      // Save signature if captured
      if (signature) {
        await saveSignature.mutateAsync({
          visitId,
          signature: signature.data,
          signedBy: signature.signedBy,
        });
      }

      Alert.alert('Fullført', 'Servicerapporten er lagret', [
        { text: 'OK', onPress: onComplete }
      ]);
    } catch (error) {
      Alert.alert('Feil', 'Kunne ikke lagre rapporten. Prøv igjen.');
    }
  };

  const totalCost = (
    (parseFloat(laborCost) || 0) +
    (parseFloat(partsCost) || 0) +
    (parseFloat(travelCost) || 0)
  );

  return (
    <>
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
        <View className="bg-white rounded-xl p-4 mb-4">
          <View className="flex-row items-center mb-3">
            <FileText size={20} color="#003366" />
            <Text className="ml-2 text-lg font-semibold text-gray-900">
              Rapport: {visitNumber}
            </Text>
          </View>
          <Text className="text-gray-600">{customerName}</Text>
        </View>

        <View className="bg-white rounded-xl p-4 mb-4">
          <View className="flex-row items-center mb-3">
            <Wrench size={20} color="#003366" />
            <Text className="ml-2 text-lg font-semibold text-gray-900">Utført arbeid</Text>
          </View>
          <TextInput
            value={workPerformed}
            onChangeText={setWorkPerformed}
            placeholder="Beskriv arbeidet som er utført..."
            multiline
            numberOfLines={4}
            className="bg-gray-50 rounded-lg px-4 py-3 text-gray-900 min-h-[120px]"
            placeholderTextColor="#9ca3af"
            textAlignVertical="top"
          />
        </View>

        <View className="bg-white rounded-xl p-4 mb-4">
          <View className="flex-row items-center mb-3">
            <AlertCircle size={20} color="#003366" />
            <Text className="ml-2 text-lg font-semibold text-gray-900">Funn</Text>
          </View>
          <TextInput
            value={findings}
            onChangeText={setFindings}
            placeholder="Eventuelle funn eller avvik..."
            multiline
            numberOfLines={3}
            className="bg-gray-50 rounded-lg px-4 py-3 text-gray-900 min-h-[80px]"
            placeholderTextColor="#9ca3af"
            textAlignVertical="top"
          />
        </View>

        <View className="bg-white rounded-xl p-4 mb-4">
          <View className="flex-row items-center mb-3">
            <MessageSquare size={20} color="#003366" />
            <Text className="ml-2 text-lg font-semibold text-gray-900">Anbefalinger</Text>
          </View>
          <TextInput
            value={recommendations}
            onChangeText={setRecommendations}
            placeholder="Anbefalinger til kunden..."
            multiline
            numberOfLines={3}
            className="bg-gray-50 rounded-lg px-4 py-3 text-gray-900 min-h-[80px]"
            placeholderTextColor="#9ca3af"
            textAlignVertical="top"
          />
        </View>

        <View className="bg-white rounded-xl p-4 mb-4">
          <View className="flex-row items-center mb-3">
            <Clock size={20} color="#003366" />
            <Text className="ml-2 text-lg font-semibold text-gray-900">Tid</Text>
          </View>
          <TextInput
            value={laborHours}
            onChangeText={setLaborHours}
            placeholder="Antall timer"
            keyboardType="decimal-pad"
            className="bg-gray-50 rounded-lg px-4 py-3 text-gray-900"
            placeholderTextColor="#9ca3af"
          />
        </View>

        <View className="bg-white rounded-xl p-4 mb-4">
          <View className="flex-row items-center mb-3">
            <CreditCard size={20} color="#003366" />
            <Text className="ml-2 text-lg font-semibold text-gray-900">Kostnader</Text>
          </View>

          <View className="mb-3">
            <Text className="text-gray-600 text-sm mb-1">Arbeid (kr)</Text>
            <TextInput
              value={laborCost}
              onChangeText={setLaborCost}
              placeholder="0"
              keyboardType="decimal-pad"
              className="bg-gray-50 rounded-lg px-4 py-3 text-gray-900"
              placeholderTextColor="#9ca3af"
            />
          </View>

          <View className="mb-3">
            <Text className="text-gray-600 text-sm mb-1">Deler (kr)</Text>
            <TextInput
              value={partsCost}
              onChangeText={setPartsCost}
              placeholder="0"
              keyboardType="decimal-pad"
              className="bg-gray-50 rounded-lg px-4 py-3 text-gray-900"
              placeholderTextColor="#9ca3af"
            />
          </View>

          <View className="mb-3">
            <Text className="text-gray-600 text-sm mb-1">Reise (kr)</Text>
            <TextInput
              value={travelCost}
              onChangeText={setTravelCost}
              placeholder="0"
              keyboardType="decimal-pad"
              className="bg-gray-50 rounded-lg px-4 py-3 text-gray-900"
              placeholderTextColor="#9ca3af"
            />
          </View>

          <View className="pt-3 border-t border-gray-100">
            <View className="flex-row justify-between">
              <Text className="text-gray-700 font-semibold">Total</Text>
              <Text className="text-primary font-bold text-lg">
                {totalCost.toLocaleString('nb-NO')} kr
              </Text>
            </View>
          </View>
        </View>

        <View className="bg-white rounded-xl p-4 mb-4">
          <View className="flex-row items-center mb-3">
            <MessageSquare size={20} color="#003366" />
            <Text className="ml-2 text-lg font-semibold text-gray-900">Notater</Text>
          </View>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Interne notater..."
            multiline
            numberOfLines={2}
            className="bg-gray-50 rounded-lg px-4 py-3 text-gray-900 min-h-[60px]"
            placeholderTextColor="#9ca3af"
            textAlignVertical="top"
          />
        </View>

        <View className="bg-white rounded-xl p-4 mb-4">
          <View className="flex-row items-center mb-3">
            <PenTool size={20} color="#003366" />
            <Text className="ml-2 text-lg font-semibold text-gray-900">Kundesignatur</Text>
          </View>

          {signature ? (
            <View className="bg-green-50 rounded-lg p-4 items-center">
              <Text className="text-green-700 font-medium">Signert av: {signature.signedBy}</Text>
              <Pressable
                onPress={() => setShowSignature(true)}
                className="mt-2"
              >
                <Text className="text-primary underline">Endre signatur</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => setShowSignature(true)}
              className="bg-gray-50 rounded-lg p-6 items-center border-2 border-dashed border-gray-300"
            >
              <PenTool size={32} color="#9ca3af" />
              <Text className="text-gray-500 mt-2">Trykk for å signere</Text>
            </Pressable>
          )}
        </View>

        <Pressable
          onPress={handleSubmit}
          disabled={completeReport.isPending || saveSignature.isPending}
          className={`rounded-xl py-4 mb-8 ${
            completeReport.isPending || saveSignature.isPending
              ? 'bg-gray-400'
              : 'bg-accent'
          }`}
        >
          <Text className="text-white font-semibold text-center text-lg">
            {completeReport.isPending ? 'Lagrer...' : 'Fullfør rapport'}
          </Text>
        </Pressable>
      </ScrollView>

      <SignatureCapture
        visible={showSignature}
        onClose={() => setShowSignature(false)}
        onSave={handleSignatureSave}
      />
    </>
  );
}
