import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "El email es obligatorio")
    .email("Ingresa un email válido"),
  password: z.string().min(1, "La contraseña es obligatoria"),
});
export type LoginFormValues = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  email: z
    .string()
    .min(1, "El email es obligatorio")
    .email("Ingresa un email válido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  displayName: z.string().min(1, "El nombre es obligatorio"),
});
export type RegisterFormValues = z.infer<typeof registerSchema>;
