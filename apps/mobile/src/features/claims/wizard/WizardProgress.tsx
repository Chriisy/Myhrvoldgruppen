import { View, Text, Pressable } from 'react-native';
import { Check } from 'lucide-react-native';

interface WizardProgressProps {
  currentStep: number;
  completedSteps: Set<number>;
  onStepPress: (step: number) => void;
}

const STEPS = [
  { number: 1, label: 'Leverandør' },
  { number: 2, label: 'Produkt' },
  { number: 3, label: 'Kunde' },
  { number: 4, label: 'Problem' },
  { number: 5, label: 'Oppsummering' },
];

export function WizardProgress({
  currentStep,
  completedSteps,
  onStepPress
}: WizardProgressProps) {
  return (
    <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-gray-100">
      {STEPS.map((step, index) => {
        const isActive = step.number === currentStep;
        const isCompleted = completedSteps.has(step.number);
        const canNavigate = isCompleted || step.number <= currentStep;

        return (
          <Pressable
            key={step.number}
            onPress={() => canNavigate && onStepPress(step.number)}
            className="items-center flex-1"
            disabled={!canNavigate}
          >
            <View
              className={`w-8 h-8 rounded-full items-center justify-center ${
                isActive
                  ? 'bg-primary'
                  : isCompleted
                  ? 'bg-green-500'
                  : 'bg-gray-200'
              }`}
            >
              {isCompleted ? (
                <Check size={16} color="white" />
              ) : (
                <Text
                  className={`text-sm font-bold ${
                    isActive ? 'text-white' : 'text-gray-500'
                  }`}
                >
                  {step.number}
                </Text>
              )}
            </View>

            <Text
              className={`text-xs mt-1 ${
                isActive ? 'text-primary font-medium' : 'text-gray-500'
              }`}
              numberOfLines={1}
            >
              {step.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
