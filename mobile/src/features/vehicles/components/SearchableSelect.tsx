import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { colors } from "../../../theme/colors";

export interface SelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
}

function normalizeSearchValue(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase();
}

export function SearchableSelect({
  label,
  value,
  options,
  onChange,
  placeholder,
  disabled = false,
  loading = false,
  error,
  onRetry,
}: SearchableSelectProps) {
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState("");

  const selectedLabel =
    options.find((option) => option.value === value)?.label ??
    (value.startsWith("__") ? "" : value);
  const filteredOptions = useMemo(() => {
    const query = normalizeSearchValue(search.trim());
    if (!query) return options;
    return options.filter((option) =>
      normalizeSearchValue(option.label).includes(query),
    );
  }, [options, search]);

  const close = () => {
    setVisible(false);
    setSearch("");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
        onPress={() => setVisible(true)}
        style={[styles.trigger, disabled && styles.disabled]}
      >
        <Text
          numberOfLines={1}
          style={[styles.triggerText, !selectedLabel && styles.placeholder]}
        >
          {selectedLabel || placeholder}
        </Text>
        {loading ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : (
          <Text style={styles.chevron}>⌄</Text>
        )}
      </Pressable>

      {error ? (
        <View style={styles.errorRow}>
          <Text style={styles.errorText}>{error}</Text>
          {onRetry ? (
            <Pressable accessibilityRole="button" onPress={onRetry}>
              <Text style={styles.retryText}>Reintentar</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <Modal
        animationType="slide"
        onRequestClose={close}
        transparent
        visible={visible}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{label}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cerrar"
                onPress={close}
              >
                <Text style={styles.closeText}>Cerrar</Text>
              </Pressable>
            </View>
            <TextInput
              accessibilityLabel={`Buscar ${label.toLocaleLowerCase()}`}
              autoCapitalize="none"
              onChangeText={setSearch}
              placeholder={`Buscar ${label.toLocaleLowerCase()}...`}
              placeholderTextColor={colors.textSecondary}
              style={styles.search}
              value={search}
            />
            <FlatList
              data={filteredOptions}
              keyboardShouldPersistTaps="handled"
              keyExtractor={(option) => option.value}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No hay resultados</Text>
              }
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    onChange(item.value);
                    close();
                  }}
                  style={styles.option}
                >
                  <Text
                    style={[
                      styles.optionText,
                      item.value === value && styles.optionSelected,
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    color: colors.textSecondary,
    marginBottom: 6,
    fontSize: 14,
  },
  trigger: {
    minHeight: 50,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  triggerText: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 16,
  },
  placeholder: {
    color: colors.textSecondary,
  },
  chevron: {
    color: colors.textSecondary,
    fontSize: 20,
  },
  disabled: {
    opacity: 0.5,
  },
  errorRow: {
    marginTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  errorText: {
    flex: 1,
    color: colors.danger,
    fontSize: 13,
  },
  retryText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "700",
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "#00000099",
  },
  modal: {
    height: "78%",
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: "700",
  },
  closeText: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: "600",
  },
  search: {
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  option: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionText: {
    color: colors.textPrimary,
    fontSize: 16,
  },
  optionSelected: {
    color: colors.accent,
    fontWeight: "700",
  },
  emptyText: {
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 24,
  },
});
