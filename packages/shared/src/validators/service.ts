import { z } from 'zod';

// Visit status enum
export const VISIT_STATUS = {
  PLANNED: 'planned',
  CONFIRMED: 'confirmed',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export const visitStatusEnum = z.enum([
  VISIT_STATUS.PLANNED,
  VISIT_STATUS.CONFIRMED,
  VISIT_STATUS.IN_PROGRESS,
  VISIT_STATUS.COMPLETED,
  VISIT_STATUS.CANCELLED,
]);

// Visit type enum
export const VISIT_TYPE = {
  SCHEDULED: 'scheduled',
  EMERGENCY: 'emergency',
  INSTALLATION: 'installation',
  INSPECTION: 'inspection',
} as const;

export const visitTypeEnum = z.enum([
  VISIT_TYPE.SCHEDULED,
  VISIT_TYPE.EMERGENCY,
  VISIT_TYPE.INSTALLATION,
  VISIT_TYPE.INSPECTION,
]);

// Create visit input
export const createVisitInput = z.object({
  customerId: z.string().uuid(),
  agreementId: z.string().uuid().optional(),
  technicianId: z.string().uuid().optional(),
  partnerId: z.string().uuid().optional(),
  visitType: visitTypeEnum.default('scheduled'),
  plannedDate: z.date(),
  plannedDuration: z.number().positive().optional(),
  description: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
});

// Update visit input
export const updateVisitInput = z.object({
  id: z.string().uuid(),
  status: visitStatusEnum.optional(),
  technicianId: z.string().uuid().optional(),
  plannedDate: z.date().optional(),
  actualStartTime: z.date().optional(),
  actualEndTime: z.date().optional(),
  workPerformed: z.string().optional(),
  findings: z.string().optional(),
  recommendations: z.string().optional(),
  notes: z.string().optional(),
});

// Complete visit input
export const completeVisitInput = z.object({
  visitId: z.string().uuid(),
  workPerformed: z.string().min(1),
  findings: z.string().optional(),
  recommendations: z.string().optional(),
  laborHours: z.number().positive(),
  laborCost: z.number().nonnegative().optional(),
  partsCost: z.number().nonnegative().optional(),
  travelCost: z.number().nonnegative().optional(),
  partsUsed: z.array(z.object({
    productId: z.string().uuid().optional(),
    name: z.string(),
    quantity: z.number().positive(),
    unitPrice: z.number().nonnegative(),
  })).optional(),
});

// Signature input
export const signatureInput = z.object({
  visitId: z.string().uuid(),
  signature: z.string().min(1), // Base64 encoded
  signedBy: z.string().min(1).max(200),
});

// Agreement status
export const AGREEMENT_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
} as const;

export const agreementStatusEnum = z.enum([
  AGREEMENT_STATUS.DRAFT,
  AGREEMENT_STATUS.ACTIVE,
  AGREEMENT_STATUS.EXPIRED,
  AGREEMENT_STATUS.CANCELLED,
]);

// Create agreement input
export const createAgreementInput = z.object({
  customerId: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  startDate: z.date(),
  endDate: z.date().optional(),
  annualValue: z.number().nonnegative().optional(),
  visitsPerYear: z.number().int().positive().optional(),
  responseTimeHours: z.number().positive().optional(),
  includesPartsDiscount: z.boolean().default(false),
  partsDiscountPercent: z.number().min(0).max(100).optional(),
});

// Types
export type VisitStatus = z.infer<typeof visitStatusEnum>;
export type VisitType = z.infer<typeof visitTypeEnum>;
export type CreateVisitInput = z.infer<typeof createVisitInput>;
export type UpdateVisitInput = z.infer<typeof updateVisitInput>;
export type CompleteVisitInput = z.infer<typeof completeVisitInput>;
export type SignatureInput = z.infer<typeof signatureInput>;
export type AgreementStatus = z.infer<typeof agreementStatusEnum>;
export type CreateAgreementInput = z.infer<typeof createAgreementInput>;
