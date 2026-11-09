import { z } from "zod";

export const vehicleTypeOptions = [
  { value: "MOTORCYCLE", label: "Moto" },
  { value: "CAR", label: "Carro" },
] as const;

export const vehicleFormSchema = z.object({
  type: z.enum(["MOTORCYCLE", "CAR"], {
    message: "Selecciona un tipo de vehículo",
  }),
  brand: z.string().min(1, "La marca es obligatoria"),
  model: z.string().min(1, "El modelo es obligatorio"),
  year: z.coerce
    .number({ message: "El año debe ser un número" })
    .int("El año debe ser un número entero")
    .min(1900, "Año inválido")
    .max(2100, "Año inválido"),
  horsepower: z.coerce
    .number({ message: "La potencia debe ser un número" })
    .int("La potencia debe ser un número entero")
    .min(1, "La potencia debe ser mayor a 0"),
});
export type VehicleFormValues = z.infer<typeof vehicleFormSchema>;
export type VehicleFormInput = z.input<typeof vehicleFormSchema>;
