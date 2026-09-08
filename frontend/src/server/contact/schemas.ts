import { z } from 'zod';

// Mirrors backend/src/app/modules/contact/schemas.py.
const PHONE_PATTERN = /^\+?[\d\s()-]{7,20}$/;

export const contactMessageCreateSchema = z.object({
  name: z.string().min(1).max(150),
  email: z.string().email(),
  phone_number: z.string().regex(PHONE_PATTERN),
  organization: z.string().min(1).max(150),
  subject: z.string().min(1).max(200),
  message: z.string().min(10).max(5000),
});
export type ContactMessageCreateInput = z.infer<typeof contactMessageCreateSchema>;
