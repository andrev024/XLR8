import { z } from "zod";

const optionalPositiveNumber = (
  minimum: number,
  maximum: number,
  integer = false,
) =>
  z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    (integer
      ? z.coerce.number().int().min(minimum).max(maximum)
      : z.coerce.number().min(minimum).max(maximum)
    ).optional(),
  );

const optionalText = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.string().trim().min(1).max(80).optional(),
);

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
  engineDisplacementCc: optionalPositiveNumber(1, 5000, true),
  engineType: optionalText,
  weightKg: optionalPositiveNumber(1, 5000),
  fuelConsumptionLitersPer100Km: optionalPositiveNumber(0.1, 100),
});
export type VehicleFormValues = z.infer<typeof vehicleFormSchema>;
export type VehicleFormInput = z.input<typeof vehicleFormSchema>;
