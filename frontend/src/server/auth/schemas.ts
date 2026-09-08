import { z } from 'zod';

// Mirrors backend/src/app/modules/auth/schemas.py's Pydantic models. Fields declared
// `.nullable().optional()` distinguish "key omitted" (undefined) from "key sent as
// null" (null) the same way Pydantic's `model_fields_set` does, which update_profile's
// service logic (server/auth/service.ts) depends on.
export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  full_name: z.string().min(1).max(150),
  phone: z.string().max(20).nullable().optional(),
  role: z.string().max(50).nullable().optional(),
  avatar_url: z.string().max(500).nullable().optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const googleLoginSchema = z.object({
  id_token: z.string(),
});
export type GoogleLoginInput = z.infer<typeof googleLoginSchema>;

export const updateProfileSchema = z.object({
  full_name: z.string().min(1).max(150).nullable().optional(),
  phone: z.string().max(20).nullable().optional(),
  password: z.string().min(8).nullable().optional(),
  current_password: z.string().nullable().optional(),
  avatar_url: z.string().nullable().optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const refreshSchema = z.object({
  refresh_token: z.string().nullable().optional(),
});
export type RefreshInput = z.infer<typeof refreshSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(8),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
