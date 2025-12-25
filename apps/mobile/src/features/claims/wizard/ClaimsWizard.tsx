import { View } from 'react-native';
import { useWizardStore } from './useWizardStore';
import { WizardProgress } from './WizardProgress';
import { Step1Supplier } from './steps/Step1Supplier';
import { Step2Product } from './steps/Step2Product';
import { Step3Customer } from './steps/Step3Customer';
import { Step4Problem } from './steps/Step4Problem';
import { Step5Summary } from './steps/Step5Summary';

export function ClaimsWizard() {
  const { currentStep, completedSteps, setStep } = useWizardStore();

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <Step1Supplier />;
      case 2:
        return <Step2Product />;
      case 3:
        return <Step3Customer />;
      case 4:
        return <Step4Problem />;
      case 5:
        return <Step5Summary />;
      default:
        return <Step1Supplier />;
    }
  };

  return (
    <View className="flex-1 bg-gray-50">
      <WizardProgress
        currentStep={currentStep}
        completedSteps={completedSteps}
        onStepPress={setStep}
      />
      {renderStep()}
    </View>
  );
}
