import { create } from 'zustand';

export interface WizardFormData {
  // Step 1: Supplier
  supplierId: string | null;
  supplierName: string;

  // Step 2: Product
  productId: string | null;
  productNameText: string;
  serialNumber: string;
  purchaseDate: Date | null;
  invoiceNumber: string;

  // Step 3: Customer
  customerId: string | null;
  customerCompanyName: string;
  customerContactName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  customerPostalCode: string;
  customerCity: string;

  // Step 4: Problem
  category: string;
  priority: string;
  problemDescription: string;
  photos: Array<{ uri: string; base64?: string }>;
}

interface WizardState {
  currentStep: number;
  formData: WizardFormData;
  completedSteps: Set<number>;

  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  updateFormData: (data: Partial<WizardFormData>) => void;
  markStepComplete: (step: number) => void;
  reset: () => void;
  canProceed: (step: number) => boolean;
}

const initialFormData: WizardFormData = {
  supplierId: null,
  supplierName: '',
  productId: null,
  productNameText: '',
  serialNumber: '',
  purchaseDate: null,
  invoiceNumber: '',
  customerId: null,
  customerCompanyName: '',
  customerContactName: '',
  customerEmail: '',
  customerPhone: '',
  customerAddress: '',
  customerPostalCode: '',
  customerCity: '',
  category: '',
  priority: 'medium',
  problemDescription: '',
  photos: [],
};

export const useWizardStore = create<WizardState>((set, get) => ({
  currentStep: 1,
  formData: initialFormData,
  completedSteps: new Set(),

  setStep: (step) => set({ currentStep: step }),

  nextStep: () => set((state) => ({
    currentStep: Math.min(state.currentStep + 1, 5)
  })),

  prevStep: () => set((state) => ({
    currentStep: Math.max(state.currentStep - 1, 1)
  })),

  updateFormData: (data) => set((state) => ({
    formData: { ...state.formData, ...data },
  })),

  markStepComplete: (step) => set((state) => ({
    completedSteps: new Set([...state.completedSteps, step]),
  })),

  reset: () => set({
    currentStep: 1,
    formData: initialFormData,
    completedSteps: new Set(),
  }),

  canProceed: (step) => {
    const { formData } = get();
    switch (step) {
      case 1:
        return !!formData.supplierId;
      case 2:
        return !!formData.productNameText;
      case 3:
        return !!formData.customerCompanyName;
      case 4:
        return !!formData.problemDescription && !!formData.category;
      default:
        return true;
    }
  },
}));
