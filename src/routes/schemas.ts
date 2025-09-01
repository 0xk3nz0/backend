import { z } from 'zod';

export const registrationSchema = z.object({
    username: z.string().min(3),
    email: z.string().email(),
    password: z.string().min(8)
})

export type RegisterBody = z.infer<typeof registrationSchema>;