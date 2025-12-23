import { z } from 'zod';

// Login input
export const loginSchema = z.object({
  email: z.string().email('Ugyldig e-postadresse'),
  password: z.string().min(6, 'Passord må være minst 6 tegn'),
});

export type LoginInput = z.infer<typeof loginSchema>;

// Register input
export const registerSchema = z.object({
  email: z.string().email('Ugyldig e-postadresse'),
  password: z.string().min(8, 'Passord må være minst 8 tegn'),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().max(20).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;

// User role enum
export const userRoleSchema = z.enum([
  'admin',
  'manager',
  'technician',
  'sales',
  'user',
]);

export type UserRole = z.infer<typeof userRoleSchema>;

// User response
export const userResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  role: userRoleSchema,
  departmentId: z.string().uuid().nullable(),
});

export type UserResponse = z.infer<typeof userResponseSchema>;
