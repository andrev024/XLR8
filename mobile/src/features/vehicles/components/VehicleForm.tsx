import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "../../../components/Button";
import { PowerCategoryBadge } from "../../../components/PowerCategoryBadge";
import { TextField } from "../../../components/TextField";
import { colors } from "../../../theme/colors";
import {
  useCatalogBrandsQuery,
  useCatalogModelsQuery,
  useCatalogVersionsQuery,
} from "../hooks";
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
  getSavedVersionText,
} from "../catalog-logic";
import { calculatePowerCategory } from "../power-category";
import {
  vehicleFormSchema,
  vehicleTypeOptions,
  type VehicleFormInput,
  type VehicleFormValues,
} from "../schemas";
import type { CatalogVersion, VehicleType } from "../types";
import { SearchableSelect, type SelectOption } from "./SearchableSelect";

const OTHER_OPTION_LABEL = "Otro / no está en la lista";

interface VehicleFormProps {
  defaultValues?: Partial<VehicleFormValues>;
  onSubmit: (values: VehicleFormValues) => void;
  submitLabel: string;
  submitting?: boolean;
}

function toOptions(values: string[] | undefined): SelectOption[] {
  return [
    ...(values ?? []).map((value) => ({ value, label: value })),
    { value: OTHER_OPTION_VALUE, label: OTHER_OPTION_LABEL },
  ];
}

function versionOptions(
  versions: CatalogVersion[] | undefined,
): SelectOption[] {
  return [
    ...(versions ?? []).map((item) => ({
      value: item.version,
      label: `${item.version} · ${item.yearFrom}–${item.yearTo ?? "actual"} · ${item.horsepower} hp`,
    })),
    { value: OTHER_OPTION_VALUE, label: OTHER_OPTION_LABEL },
  ];
}

export function VehicleForm({
  defaultValues,
  onSubmit,
  submitLabel,
  submitting = false,
}: VehicleFormProps) {
  const {
    control,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<VehicleFormInput, unknown, VehicleFormValues>({
    resolver: zodResolver(vehicleFormSchema),
    defaultValues: {
      type: defaultValues?.type ?? "MOTORCYCLE",
      brand: defaultValues?.brand ?? "",
      model: defaultValues?.model ?? "",
      year: defaultValues?.year,
      horsepower: defaultValues?.horsepower,
      engineDisplacementCc: defaultValues?.engineDisplacementCc,
      engineType: defaultValues?.engineType,
      weightKg: defaultValues?.weightKg,
      fuelConsumptionLitersPer100Km:
        defaultValues?.fuelConsumptionLitersPer100Km,
    },
  });

  const type = useWatch({ control, name: "type" });
  const brand = useWatch({ control, name: "brand" }) ?? "";
  const model = useWatch({ control, name: "model" }) ?? "";
  const year = useWatch({ control, name: "year" });
  const horsepower = useWatch({ control, name: "horsepower" });

  const [brandIsOther, setBrandIsOther] = useState(false);
  const [modelIsOther, setModelIsOther] = useState(false);
  const [versionChoiceOverride, setVersionChoiceOverride] = useState<
    string | undefined
  >(undefined);
  const [manualVersionOverride, setManualVersionOverride] = useState<
    string | undefined
  >(undefined);
  const initializedModelKey = useRef("");

  const brandsQuery = useCatalogBrandsQuery(type);
  const isCatalogBrand =
    Boolean(brand) &&
    !brandIsOther &&
    (brandsQuery.data === undefined || brandsQuery.data.includes(brand));
  const modelsQuery = useCatalogModelsQuery(type, brand, isCatalogBrand);
  const matchedModel = findCatalogModel(model, modelsQuery.data ?? []);
  const modelSelectionIsOther =
    modelIsOther ||
    (modelsQuery.data !== undefined && Boolean(model) && !matchedModel);
  const selectedModelValue = modelSelectionIsOther
    ? OTHER_OPTION_VALUE
    : (matchedModel ?? model);
  const isCatalogModel = Boolean(matchedModel && !modelSelectionIsOther);
  const versionsQuery = useCatalogVersionsQuery(
    type,
    brand,
    matchedModel ?? "",
    isCatalogBrand && isCatalogModel,
  );
  const initialModel = defaultValues?.model ?? "";
  const initialCatalogModel = findCatalogModel(
    initialModel,
    modelsQuery.data ?? [],
  );
  const shouldUseInitialVersion =
    versionChoiceOverride === undefined &&
    Boolean(initialModel) &&
    defaultValues?.brand === brand &&
    defaultValues?.type === type &&
    initialCatalogModel === matchedModel &&
    model === matchedModel;
  const inferredVersion =
    shouldUseInitialVersion && versionsQuery.data && matchedModel
      ? findSavedCatalogVersion(
          initialModel,
          matchedModel,
          versionsQuery.data,
          defaultValues?.year,
          defaultValues?.horsepower,
        )
      : undefined;
  const inferredManualVersion =
    shouldUseInitialVersion && matchedModel && !inferredVersion
      ? getSavedVersionText(initialModel, matchedModel)
      : "";
  const versionChoice =
    versionChoiceOverride ??
    inferredVersion?.version ??
    (inferredManualVersion ? OTHER_OPTION_VALUE : "");
  const manualVersion = manualVersionOverride ?? inferredManualVersion;
  const selectedVersion =
    versionChoice !== OTHER_OPTION_VALUE && versionChoice
      ? versionsQuery.data?.find((item) => item.version === versionChoice)
      : undefined;
  const yearOptions = selectedVersion ? getAvailableYears(selectedVersion) : [];
  const selectedYear = year === undefined ? "" : String(year);
  const numericHorsepower =
    typeof horsepower === "number" ? horsepower : Number(horsepower);
  const powerCategory =
    Number.isFinite(numericHorsepower) && numericHorsepower > 0
      ? calculatePowerCategory(type, numericHorsepower)
      : null;

  const showOtherBrand =
    brandIsOther ||
    (brandsQuery.data !== undefined &&
      Boolean(brand) &&
      !brandsQuery.data.includes(brand));
  const brandSelectionValue = getCatalogOptionValue(
    brand,
    brandsQuery.data,
    showOtherBrand,
  );
  const showOtherModel = modelSelectionIsOther;
  const showOtherVersion =
    versionChoice === OTHER_OPTION_VALUE ||
    Boolean(
      versionChoice &&
      versionsQuery.data &&
      !versionsQuery.data.some((item) => item.version === versionChoice),
    );

  useEffect(() => {
    if (!modelsQuery.data || !brand || brandIsOther) return;
    const key = `${type}:${brand}`;
    if (initializedModelKey.current === key) return;
    initializedModelKey.current = key;

    const savedModel = getValues("model");
    const catalogModel = findCatalogModel(savedModel, modelsQuery.data);
    if (catalogModel && catalogModel !== savedModel) {
      setValue("model", catalogModel, { shouldDirty: false });
    }
  }, [brand, brandIsOther, getValues, modelsQuery.data, setValue, type]);

  const changeType = (nextType: VehicleType) => {
    const nextValues = getTypeChangeValues(nextType);
    setValue("type", nextValues.type);
    setValue("brand", nextValues.brand);
    setValue("model", nextValues.model);
    setValue("year", nextValues.year);
    setValue("horsepower", nextValues.horsepower);
    setBrandIsOther(false);
    setModelIsOther(false);
    setVersionChoiceOverride("");
    setManualVersionOverride("");
  };

  const changeBrand = (value: string) => {
    const isOther = value === OTHER_OPTION_VALUE;
    const nextValues = getBrandChangeValues(isOther ? "" : value);
    setValue("brand", nextValues.brand, { shouldValidate: true });
    setValue("model", nextValues.model);
    setValue("year", nextValues.year);
    setValue("horsepower", nextValues.horsepower);
    setBrandIsOther(isOther);
    setModelIsOther(false);
    setVersionChoiceOverride("");
    setManualVersionOverride("");
  };

  const changeModel = (value: string) => {
    const isOther = value === OTHER_OPTION_VALUE;
    const nextValues = getModelChangeValues(isOther ? "" : value);
    setValue("model", nextValues.model, { shouldValidate: true });
    setValue("year", nextValues.year);
    setValue("horsepower", nextValues.horsepower);
    setModelIsOther(isOther);
    setVersionChoiceOverride("");
    setManualVersionOverride("");
  };

  const changeVersion = (value: string) => {
    setVersionChoiceOverride(value);
    setManualVersionOverride("");
    const version = versionsQuery.data?.find((item) => item.version === value);
    if (!version) return;

    const currentYear = getValues("year");
    const nextValues = getVersionValues(
      version,
      typeof currentYear === "number" ? currentYear : undefined,
    );
    setValue("year", nextValues.year, { shouldValidate: true });
    setValue("horsepower", nextValues.horsepower, { shouldValidate: true });
  };

  const submitForm = (values: VehicleFormValues) => {
    const version = showOtherVersion ? manualVersion : (versionChoice ?? "");
    onSubmit({ ...values, model: buildVehicleModel(values.model, version) });
  };

  return (
    <View>
      <View style={styles.typeContainer}>
        <Text style={styles.label}>Tipo</Text>
        <View style={styles.typeOptions}>
          {vehicleTypeOptions.map((option) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: type === option.value }}
              key={option.value}
              onPress={() => changeType(option.value)}
              style={[
                styles.typeOption,
                type === option.value && styles.typeOptionActive,
              ]}
            >
              <Text
                style={[
                  styles.typeOptionText,
                  type === option.value && styles.typeOptionTextActive,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <SearchableSelect
        error={
          brandsQuery.isError
            ? "No se pudieron cargar las marcas"
            : errors.brand?.message
        }
        label="Marca"
        loading={brandsQuery.isLoading}
        onChange={changeBrand}
        onRetry={() => void brandsQuery.refetch()}
        options={toOptions(brandsQuery.data)}
        placeholder="Selecciona una marca"
        value={brandSelectionValue}
      />
      {showOtherBrand ? (
        <TextField
          autoCapitalize="words"
          control={control}
          label="Otra marca"
          name="brand"
          placeholder="Escribe la marca"
        />
      ) : null}

      <SearchableSelect
        disabled={!brand || (brandIsOther && !brand)}
        error={
          modelsQuery.isError
            ? "No se pudieron cargar los modelos"
            : errors.model?.message
        }
        label="Modelo"
        loading={modelsQuery.isLoading}
        onChange={changeModel}
        onRetry={() => void modelsQuery.refetch()}
        options={toOptions(modelsQuery.data)}
        placeholder="Selecciona un modelo"
        value={selectedModelValue}
      />
      {showOtherModel ? (
        <TextField
          autoCapitalize="words"
          control={control}
          label="Otro modelo"
          name="model"
          placeholder="Escribe el modelo"
        />
      ) : null}

      <SearchableSelect
        disabled={!brand || (!model && !modelIsOther)}
        error={
          versionsQuery.isError
            ? "No se pudieron cargar las versiones"
            : undefined
        }
        label="Versión"
        loading={versionsQuery.isLoading}
        onChange={changeVersion}
        onRetry={() => void versionsQuery.refetch()}
        options={versionOptions(versionsQuery.data)}
        placeholder="Selecciona una versión"
        value={versionChoice}
      />
      {showOtherVersion ? (
        <View style={styles.manualField}>
          <Text style={styles.label}>Otra versión o cilindraje</Text>
          <TextInput
            accessibilityLabel="Otra versión o cilindraje"
            autoCapitalize="words"
            onChangeText={setManualVersionOverride}
            placeholder="Ej. 180 cc"
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
            value={manualVersion}
          />
        </View>
      ) : null}

      {selectedVersion && yearOptions.length > 0 ? (
        <SearchableSelect
          error={errors.year?.message}
          label="Año"
          onChange={(value) =>
            setValue("year", Number(value), { shouldValidate: true })
          }
          options={yearOptions.map((value) => ({ value, label: value }))}
          placeholder="Selecciona un año"
          value={selectedYear}
        />
      ) : (
        <TextField
          control={control}
          keyboardType="number-pad"
          label="Año"
          name="year"
          placeholder="2023"
        />
      )}

      {selectedVersion ? (
        <Text style={styles.source}>
          Potencia aproximada según {selectedVersion.source}.
        </Text>
      ) : null}

      <TextField
        control={control}
        keyboardType="number-pad"
        label="Potencia (hp)"
        name="horsepower"
        placeholder="73"
      />
      <TextField
        control={control}
        keyboardType="number-pad"
        label="Cilindraje (cc, opcional)"
        name="engineDisplacementCc"
        placeholder="689"
      />
      <TextField
        control={control}
        label="Tipo de motor (opcional)"
        name="engineType"
        placeholder="4 tiempos, bicilíndrico"
        autoCapitalize="sentences"
      />
      <TextField
        control={control}
        keyboardType="decimal-pad"
        label="Peso aproximado (kg, opcional)"
        name="weightKg"
        placeholder="184"
      />
      <TextField
        control={control}
        keyboardType="decimal-pad"
        label="Consumo (L/100 km, opcional)"
        name="fuelConsumptionLitersPer100Km"
        placeholder="4.5"
      />
      {powerCategory ? (
        <View style={styles.categoryRow}>
          <Text style={styles.label}>Categoría estimada</Text>
          <PowerCategoryBadge category={powerCategory} />
        </View>
      ) : null}

      <Button
        label={submitLabel}
        onPress={handleSubmit(submitForm)}
        loading={submitting}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    color: colors.textSecondary,
    marginBottom: 6,
    fontSize: 14,
  },
  typeContainer: {
    marginBottom: 16,
  },
  typeOptions: {
    flexDirection: "row",
    gap: 10,
  },
  typeOption: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: colors.surface,
  },
  typeOptionActive: {
    borderColor: colors.accent,
    backgroundColor: colors.surfaceAlt,
  },
  typeOptionText: {
    color: colors.textSecondary,
    fontWeight: "600",
  },
  typeOptionTextActive: {
    color: colors.accent,
  },
  manualField: {
    marginBottom: 16,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.textPrimary,
    fontSize: 16,
  },
  source: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: -8,
    marginBottom: 14,
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: -8,
    marginBottom: 16,
  },
});
