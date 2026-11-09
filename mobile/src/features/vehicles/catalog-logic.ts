import type { CatalogVersion } from "./types";

export const OTHER_OPTION_VALUE = "__other__";

export function getCatalogOptionValue(
  value: string,
  options: string[] | undefined,
  isOther: boolean,
): string {
  if (isOther) return OTHER_OPTION_VALUE;
  if (!value || !options) return value;
  return options.includes(value) ? value : OTHER_OPTION_VALUE;
}

export function findCatalogModel(
  savedModel: string,
  models: string[],
): string | undefined {
  return [...models]
    .sort((left, right) => right.length - left.length)
    .find(
      (model) => savedModel === model || savedModel.startsWith(`${model} `),
    );
}

export function findSavedCatalogVersion(
  savedModel: string,
  model: string,
  versions: CatalogVersion[],
  year: number | undefined,
  horsepower: number | undefined,
): CatalogVersion | undefined {
  const suffix =
    savedModel === model ? "" : savedModel.slice(model.length).trim();
  const explicitVersion = versions.find((item) => item.version === suffix);
  if (explicitVersion) return explicitVersion;

  const matchingVersion = versions.find(
    (item) =>
      item.horsepower === horsepower &&
      year !== undefined &&
      year >= item.yearFrom &&
      (item.yearTo === null || year <= item.yearTo),
  );
  if (matchingVersion) return matchingVersion;

  return suffix ? undefined : versions.length === 1 ? versions[0] : undefined;
}

export function getSavedVersionText(savedModel: string, model: string): string {
  if (savedModel === model || !savedModel.startsWith(`${model} `)) return "";
  return savedModel.slice(model.length).trim();
}

export function getAvailableYears(
  version: CatalogVersion,
  currentYear = new Date().getFullYear(),
): string[] {
  const yearTo = version.yearTo ?? currentYear;
  if (yearTo < version.yearFrom) return [];

  return Array.from({ length: yearTo - version.yearFrom + 1 }, (_, index) =>
    String(yearTo - index),
  );
}

export function getTypeChangeValues(type: "MOTORCYCLE" | "CAR") {
  return {
    type,
    brand: "",
    model: "",
    year: undefined,
    horsepower: undefined,
  };
}

export function getBrandChangeValues(brand: string) {
  return { brand, model: "", year: undefined, horsepower: undefined };
}

export function getModelChangeValues(model: string) {
  return { model, year: undefined, horsepower: undefined };
}

export function getVersionValues(
  version: CatalogVersion,
  year: number | undefined,
  currentYear = new Date().getFullYear(),
) {
  const availableYears = getAvailableYears(version, currentYear);
  const selectedYear =
    year !== undefined && availableYears.includes(String(year))
      ? year
      : Number(availableYears[0]);

  return {
    year: Number.isInteger(selectedYear) ? selectedYear : undefined,
    horsepower: version.horsepower,
  };
}

export function buildVehicleModel(model: string, version: string): string {
  return [model.trim(), version.trim()].filter(Boolean).join(" ");
}
