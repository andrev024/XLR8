import type { CatalogVersion } from "./types";
import {
  OTHER_OPTION_VALUE,
  buildVehicleModel,
  findCatalogModel,
  findSavedCatalogVersion,
  getAvailableYears,
  getBrandChangeValues,
  getCatalogOptionValue,
  getModelChangeValues,
  getTypeChangeValues,
  getVersionValues,
} from "./catalog-logic";
import { calculatePowerCategory } from "./power-category";

const version: CatalogVersion = {
  version: "2.0 (149 cc)",
  yearFrom: 2018,
  yearTo: 2022,
  horsepower: 13,
  source: "Ficha técnica de prueba",
};

describe("vehicle catalog selector logic", () => {
  it("resets downstream values when type, brand, and model change", () => {
    expect(getTypeChangeValues("CAR")).toEqual({
      type: "CAR",
      brand: "",
      model: "",
      year: undefined,
      horsepower: undefined,
    });
    expect(getBrandChangeValues("Yamaha")).toEqual({
      brand: "Yamaha",
      model: "",
      year: undefined,
      horsepower: undefined,
    });
    expect(getModelChangeValues("FZ")).toEqual({
      model: "FZ",
      year: undefined,
      horsepower: undefined,
    });
  });

  it("autocompletes horsepower and selects an available year for a version", () => {
    expect(getAvailableYears(version, 2026)).toEqual([
      "2022",
      "2021",
      "2020",
      "2019",
      "2018",
    ]);
    expect(getVersionValues(version, 2020, 2026)).toEqual({
      year: 2020,
      horsepower: 13,
    });
    expect(getVersionValues(version, undefined, 2026)).toEqual({
      year: 2022,
      horsepower: 13,
    });
  });

  it("calculates power categories using the server thresholds", () => {
    expect(calculatePowerCategory("MOTORCYCLE", 49)).toBe("LOW");
    expect(calculatePowerCategory("MOTORCYCLE", 50)).toBe("MID");
    expect(calculatePowerCategory("MOTORCYCLE", 101)).toBe("HIGH");
    expect(calculatePowerCategory("CAR", 119)).toBe("LOW");
    expect(calculatePowerCategory("CAR", 120)).toBe("MID");
    expect(calculatePowerCategory("CAR", 251)).toBe("HIGH");
  });

  it("resolves saved model/version combinations for editing", () => {
    const models = ["Mazda 3", "Mazda"];
    expect(findCatalogModel("Mazda 3 2.0", models)).toBe("Mazda 3");
    expect(
      findSavedCatalogVersion(
        "Mazda 3 2.0 (149 cc)",
        "Mazda 3",
        [version],
        2020,
        13,
      ),
    ).toEqual(version);
  });

  it("keeps an Other option available and preserves manual model details", () => {
    expect(getCatalogOptionValue("Otra marca", ["Yamaha"], false)).toBe(
      OTHER_OPTION_VALUE,
    );
    expect(getCatalogOptionValue("", ["Yamaha"], true)).toBe(
      OTHER_OPTION_VALUE,
    );
    expect(buildVehicleModel("Mi moto", "180 cc")).toBe("Mi moto 180 cc");
  });
});
