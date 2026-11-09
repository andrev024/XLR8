import { vehicleFormSchema } from "./schemas";

const baseInput = {
  type: "MOTORCYCLE" as const,
  brand: "Yamaha",
  model: "MT-07",
};

describe("vehicleFormSchema", () => {
  it("acepta un vehículo válido", () => {
    const result = vehicleFormSchema.safeParse({
      ...baseInput,
      year: 2023,
      horsepower: 73,
    });
    expect(result.success).toBe(true);
  });

  it("rechaza un año fuera de rango", () => {
    const result = vehicleFormSchema.safeParse({
      ...baseInput,
      year: 1800,
      horsepower: 73,
    });
    expect(result.success).toBe(false);
  });

  it("rechaza una potencia menor o igual a 0", () => {
    const result = vehicleFormSchema.safeParse({
      ...baseInput,
      year: 2023,
      horsepower: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rechaza un tipo de vehículo inválido", () => {
    const result = vehicleFormSchema.safeParse({
      ...baseInput,
      type: "BOAT",
      year: 2023,
      horsepower: 73,
    });
    expect(result.success).toBe(false);
  });

  it("coacciona strings numéricos provenientes de un input de texto", () => {
    const result = vehicleFormSchema.safeParse({
      ...baseInput,
      year: "2023",
      horsepower: "73",
    });
    expect(result.success).toBe(true);
  });
});
