import { loginSchema, registerSchema } from "./schemas";

describe("loginSchema", () => {
  it("acepta credenciales válidas", () => {
    const result = loginSchema.safeParse({
      email: "piloto@xlr8.app",
      password: "secreto123",
    });
    expect(result.success).toBe(true);
  });

  it("rechaza un email inválido", () => {
    const result = loginSchema.safeParse({
      email: "no-es-email",
      password: "secreto123",
    });
    expect(result.success).toBe(false);
  });

  it("rechaza una contraseña vacía", () => {
    const result = loginSchema.safeParse({
      email: "piloto@xlr8.app",
      password: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("registerSchema", () => {
  it("acepta datos válidos", () => {
    const result = registerSchema.safeParse({
      email: "piloto@xlr8.app",
      password: "secreto123",
      displayName: "Piloto XLR8",
    });
    expect(result.success).toBe(true);
  });

  it("rechaza contraseñas de menos de 8 caracteres", () => {
    const result = registerSchema.safeParse({
      email: "piloto@xlr8.app",
      password: "1234567",
      displayName: "Piloto XLR8",
    });
    expect(result.success).toBe(false);
  });

  it("rechaza un displayName vacío", () => {
    const result = registerSchema.safeParse({
      email: "piloto@xlr8.app",
      password: "secreto123",
      displayName: "",
    });
    expect(result.success).toBe(false);
  });
});
