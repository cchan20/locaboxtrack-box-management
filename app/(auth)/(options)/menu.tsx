import { useAppDispatch } from "@/store/hooks";
import {
  batchInsertDailyMeals,
  batchUpdateDailyMeals,
  downloadDailyMealsTemplate,
  getDailyMeals,
} from "@/store/slices/dailyMealSlice";
import { DailyMeal, DailyMealInput } from "@/types/app";
import { getErrorMessage } from "@/utils/apiError";
import { parseDailyMealsCsv } from "@/utils/dailyMealCsv";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, {
  DateTimePickerChangeEvent,
} from "@react-native-community/datetimepicker";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Stack, useFocusEffect } from "expo-router";
import * as Sharing from "expo-sharing";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;

type WeekDay = {
  dateKey: string;
  dayLabel: string;
  date: Date;
};

type FormState = {
  dishesName: string;
  dishesDescription: string;
  dishesIngredients: string;
  basicBoxPrice: string;
  basicBoxInventory: string;
  extraLargePrice: string;
  extraLargeInventory: string;
  extraProteinPrice: string;
  extraProteinInventory: string;
  extraVeggiePrice: string;
  extraVeggieInventory: string;
  extraSoupBoxPrice: string;
  extraSoupBoxInventory: string;
};

const EMPTY_FORM: FormState = {
  dishesName: "",
  dishesDescription: "",
  dishesIngredients: "",
  basicBoxPrice: "0",
  basicBoxInventory: "0",
  extraLargePrice: "0",
  extraLargeInventory: "0",
  extraProteinPrice: "0",
  extraProteinInventory: "0",
  extraVeggiePrice: "0",
  extraVeggieInventory: "0",
  extraSoupBoxPrice: "0",
  extraSoupBoxInventory: "0",
};

function formatDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfWeekMonday(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diffToMonday);
  return date;
}

function getWeekDays(anchor: Date): WeekDay[] {
  const monday = startOfWeekMonday(anchor);
  return DAY_LABELS.map((dayLabel, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return {
      dateKey: formatDateKey(date),
      dayLabel,
      date,
    };
  });
}

function mealToForm(meal: DailyMeal): FormState {
  return {
    dishesName: meal.dishesName,
    dishesDescription: meal.dishesDescription,
    dishesIngredients: meal.dishesIngredients,
    basicBoxPrice: String(meal.basicBoxPrice),
    basicBoxInventory: String(meal.basicBoxInventory),
    extraLargePrice: String(meal.extraLargePrice),
    extraLargeInventory: String(meal.extraLargeInventory),
    extraProteinPrice: String(meal.extraProteinPrice),
    extraProteinInventory: String(meal.extraProteinInventory),
    extraVeggiePrice: String(meal.extraVeggiePrice),
    extraVeggieInventory: String(meal.extraVeggieInventory),
    extraSoupBoxPrice: String(meal.extraSoupBoxPrice),
    extraSoupBoxInventory: String(meal.extraSoupBoxInventory),
  };
}

function parseNonNegativeNumber(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: false as const, message: `${label} is required.` };
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return { ok: false as const, message: `${label} must be zero or a positive number.` };
  }
  return { ok: true as const, value: parsed };
}

function parseNonNegativeInt(value: string, label: string) {
  const result = parseNonNegativeNumber(value, label);
  if (!result.ok) {
    return result;
  }
  if (!Number.isInteger(result.value)) {
    return { ok: false as const, message: `${label} must be a whole number.` };
  }
  return result;
}

export default function MenuScreen() {
  const dispatch = useAppDispatch();
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerValue, setPickerValue] = useState(() => new Date());
  const [meals, setMeals] = useState<DailyMeal[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [importOpen, setImportOpen] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [selectedImportFileName, setSelectedImportFileName] = useState<string | null>(null);

  const weekDays = useMemo(() => getWeekDays(anchorDate), [anchorDate]);
  const weekFrom = weekDays[0]?.dateKey ?? "";
  const weekTo = weekDays[4]?.dateKey ?? "";

  const mealsByDate = useMemo(() => {
    const map = new Map<string, DailyMeal>();
    for (const meal of meals) {
      map.set(meal.date, meal);
    }
    return map;
  }, [meals]);

  const selectedMeal = selectedDateKey ? mealsByDate.get(selectedDateKey) : undefined;
  const isEditingExisting = Boolean(selectedMeal);
  const hasSelection = selectedDateKey !== null;

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const resetSelection = () => {
    setSelectedDateKey(null);
    setForm(EMPTY_FORM);
  };

  const fillForDay = (dateKey: string) => {
    setSelectedDateKey(dateKey);
  };

  const loadWeekMeals = useCallback(async () => {
    if (!weekFrom || !weekTo) {
      return;
    }

    setIsFetching(true);
    try {
      const response = await dispatch(
        getDailyMeals({ from: weekFrom, to: weekTo }),
      ).unwrap();
      setMeals(response.data);
    } catch {
      setMeals([]);
    } finally {
      setIsFetching(false);
    }
  }, [dispatch, weekFrom, weekTo]);

  useEffect(() => {
    if (!selectedDateKey) {
      setForm(EMPTY_FORM);
      return;
    }
    if (!weekDays.some((day) => day.dateKey === selectedDateKey)) {
      setSelectedDateKey(null);
      setForm(EMPTY_FORM);
      return;
    }
    const existing = mealsByDate.get(selectedDateKey);
    setForm(existing ? mealToForm(existing) : EMPTY_FORM);
  }, [mealsByDate, selectedDateKey, weekDays]);

  useFocusEffect(
    useCallback(() => {
      void loadWeekMeals();
    }, [loadWeekMeals]),
  );

  const openDatePicker = () => {
    setPickerValue(anchorDate);
    setShowDatePicker(true);
  };

  const applyPickedDate = (date: Date) => {
    setAnchorDate(date);
    resetSelection();
  };

  const onDateChange = (_event: DateTimePickerChangeEvent, selected?: Date) => {
    if (!selected) {
      if (Platform.OS !== "ios") {
        setShowDatePicker(false);
      }
      return;
    }

    setPickerValue(selected);

    if (Platform.OS !== "ios") {
      applyPickedDate(selected);
      setShowDatePicker(false);
    }
  };

  const confirmDatePicker = () => {
    applyPickedDate(pickerValue);
    setShowDatePicker(false);
  };

  const validateForm = (): DailyMealInput | null => {
    if (!selectedDateKey) {
      Alert.alert("Select a day", "Please select a weekday from the list first.");
      return null;
    }

    const dishesName = form.dishesName.trim();
    if (!dishesName) {
      Alert.alert("Missing dish name", "Please enter a dishes name.");
      return null;
    }

    const priceFields: Array<[keyof FormState, string]> = [
      ["basicBoxPrice", "Basic box price"],
      ["extraLargePrice", "Extra large price"],
      ["extraProteinPrice", "Extra protein price"],
      ["extraVeggiePrice", "Extra veggie price"],
      ["extraSoupBoxPrice", "Extra soup price"],
    ];
    const inventoryFields: Array<[keyof FormState, string]> = [
      ["basicBoxInventory", "Basic box inventory"],
      ["extraLargeInventory", "Extra large inventory"],
      ["extraProteinInventory", "Extra protein inventory"],
      ["extraVeggieInventory", "Extra veggie inventory"],
      ["extraSoupBoxInventory", "Extra soup inventory"],
    ];

    const prices: Record<string, number> = {};
    for (const [key, label] of priceFields) {
      const result = parseNonNegativeNumber(form[key], label);
      if (!result.ok) {
        Alert.alert("Invalid price", result.message);
        return null;
      }
      prices[key] = result.value;
    }

    const inventories: Record<string, number> = {};
    for (const [key, label] of inventoryFields) {
      const result = parseNonNegativeInt(form[key], label);
      if (!result.ok) {
        Alert.alert("Invalid inventory", result.message);
        return null;
      }
      inventories[key] = result.value;
    }

    return {
      date: selectedDateKey,
      dishesName,
      dishesDescription: form.dishesDescription.trim(),
      dishesIngredients: form.dishesIngredients.trim(),
      basicBoxPrice: prices.basicBoxPrice,
      basicBoxInventory: inventories.basicBoxInventory,
      extraLargePrice: prices.extraLargePrice,
      extraLargeInventory: inventories.extraLargeInventory,
      extraProteinPrice: prices.extraProteinPrice,
      extraProteinInventory: inventories.extraProteinInventory,
      extraVeggiePrice: prices.extraVeggiePrice,
      extraVeggieInventory: inventories.extraVeggieInventory,
      extraSoupBoxPrice: prices.extraSoupBoxPrice,
      extraSoupBoxInventory: inventories.extraSoupBoxInventory,
    };
  };

  const handleSave = async () => {
    const payload = validateForm();
    if (!payload) {
      return;
    }

    setIsSaving(true);
    try {
      if (isEditingExisting) {
        await dispatch(batchUpdateDailyMeals([payload])).unwrap();
      } else {
        await dispatch(batchInsertDailyMeals([payload])).unwrap();
      }
      await loadWeekMeals();
    } catch (error) {
      Alert.alert(
        isEditingExisting ? "Unable to update" : "Unable to create",
        getErrorMessage(error),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    resetSelection();
  };

  const handleSelectDay = (day: WeekDay) => {
    if (selectedDateKey === day.dateKey) {
      return;
    }
    fillForDay(day.dateKey);
  };

  const openImportModal = () => {
    setSelectedImportFileName(null);
    setImportOpen(true);
  };

  const closeImportModal = () => {
    if (importBusy) {
      return;
    }
    setImportOpen(false);
    setSelectedImportFileName(null);
  };

  const handleDownloadTemplate = async () => {
    setImportBusy(true);
    try {
      const response = await dispatch(downloadDailyMealsTemplate()).unwrap();
      const cacheDir = FileSystem.cacheDirectory;
      if (!cacheDir) {
        throw new Error("Cache directory is unavailable on this device.");
      }

      const fileUri = `${cacheDir}daily-meals-template.csv`;
      await FileSystem.writeAsStringAsync(fileUri, response.data, {
        encoding: "utf8",
      });

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert(
          "Template ready",
          "CSV template was downloaded, but sharing is unavailable on this device.",
        );
        return;
      }

      await Sharing.shareAsync(fileUri, {
        mimeType: "text/csv",
        dialogTitle: "Save daily meals CSV template",
        UTI: "public.comma-separated-values-text",
      });
    } catch (error) {
      Alert.alert("Unable to download template", getErrorMessage(error));
    } finally {
      setImportBusy(false);
    }
  };

  const importMealsFromCsv = async (csvContent: string, fileName?: string) => {
    let meals: DailyMealInput[];
    try {
      meals = parseDailyMealsCsv(csvContent);
    } catch (error) {
      Alert.alert(
        "Invalid CSV",
        error instanceof Error ? error.message : "Unable to parse the selected CSV file.",
      );
      return;
    }

    const dates = meals.map((meal) => meal.date).sort();
    const from = dates[0];
    const to = dates[dates.length - 1];

    setImportBusy(true);
    try {
      const existingResponse = await dispatch(getDailyMeals({ from, to })).unwrap();
      const existingDates = new Set(existingResponse.data.map((meal) => meal.date));
      const toInsert = meals.filter((meal) => !existingDates.has(meal.date));
      const toUpdate = meals.filter((meal) => existingDates.has(meal.date));

      if (toInsert.length > 0) {
        await dispatch(batchInsertDailyMeals(toInsert)).unwrap();
      }
      if (toUpdate.length > 0) {
        await dispatch(batchUpdateDailyMeals(toUpdate)).unwrap();
      }

      await loadWeekMeals();
      setImportOpen(false);
      setSelectedImportFileName(null);
      Alert.alert(
        "Import complete",
        [
          fileName ? `File: ${fileName}` : null,
          `Created ${toInsert.length}`,
          `Updated ${toUpdate.length}`,
        ]
          .filter(Boolean)
          .join("\n"),
      );
    } catch (error) {
      Alert.alert("Unable to import", getErrorMessage(error));
    } finally {
      setImportBusy(false);
    }
  };

  const handlePickImportFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "text/csv",
          "text/comma-separated-values",
          "public.comma-separated-values-text",
          "*/*",
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      const asset = result.assets[0];
      setSelectedImportFileName(asset.name);
      const csvContent = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: "utf8",
      });
      await importMealsFromCsv(csvContent, asset.name);
    } catch (error) {
      Alert.alert(
        "Unable to open file",
        getErrorMessage(error, "Failed to read the selected file."),
      );
    }
  };

  const renderPriceInventoryRow = (
    label: string,
    priceKey: keyof FormState,
    inventoryKey: keyof FormState,
  ) => (
    <View style={styles.priceInventoryBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.priceInventoryRow}>
        <View style={styles.halfField}>
          <Text style={styles.miniLabel}>Price ($)</Text>
          <TextInput
            value={form[priceKey]}
            onChangeText={(value) => updateField(priceKey, value)}
            keyboardType="decimal-pad"
            editable={hasSelection && !isSaving}
            style={styles.input}
            placeholder="0"
          />
        </View>
        <View style={styles.halfField}>
          <Text style={styles.miniLabel}>Inventory</Text>
          <TextInput
            value={form[inventoryKey]}
            onChangeText={(value) => updateField(inventoryKey, value)}
            keyboardType="number-pad"
            editable={hasSelection && !isSaving}
            style={styles.input}
            placeholder="0"
          />
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.container}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <TouchableOpacity
              onPress={openImportModal}
              accessibilityRole="button"
              accessibilityLabel="Import menu CSV"
              style={styles.headerAction}
            >
              <Text style={styles.headerActionText}>Import</Text>
            </TouchableOpacity>
          ),
        }}
      />

      <View style={styles.weekBar}>
        <View style={styles.weekBarText}>
          <Text style={styles.weekTitle}>Week of {weekFrom}</Text>
          <Text style={styles.weekSubtitle}>
            Showing Mon–Fri · {weekFrom} to {weekTo}
          </Text>
        </View>
        <Pressable style={styles.dateSelector} onPress={openDatePicker}>
          <Text style={styles.dateSelectorText}>{formatDateKey(anchorDate)}</Text>
          <Ionicons name="calendar-outline" size={16} color="#42685D" />
        </Pressable>
      </View>

      {isFetching && meals.length === 0 ? (
        <Text style={styles.loadingText}>Loading weekly menu...</Text>
      ) : null}

      <KeyboardAvoidingView
        style={styles.panelRow}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.card, styles.leftCard]}>
          <Text style={styles.title}>
            {!hasSelection
              ? "Select a Day"
              : isEditingExisting
                ? `Edit ${selectedMeal?.dayOfWeek ?? ""} Menu`
                : "New Daily Menu"}
          </Text>
          <Text style={styles.subtitle}>
            {!hasSelection
              ? "Pick a weekday from the list to view or create its menu."
              : isEditingExisting
                ? `Update dishes, pricing, and inventory for ${selectedDateKey}.`
                : `No menu yet for ${selectedDateKey}. Fill in details and create it.`}
          </Text>

          <ScrollView
            style={styles.formScroll}
            contentContainerStyle={styles.formContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.fieldLabel}>Dishes name</Text>
            <TextInput
              value={form.dishesName}
              onChangeText={(value) => updateField("dishesName", value)}
              editable={hasSelection && !isSaving}
              placeholder="e.g. Grilled Chicken Bowl"
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              value={form.dishesDescription}
              onChangeText={(value) => updateField("dishesDescription", value)}
              editable={hasSelection && !isSaving}
              placeholder="Short description"
              multiline
              style={[styles.input, styles.multilineInput]}
            />

            <Text style={styles.fieldLabel}>Ingredients</Text>
            <TextInput
              value={form.dishesIngredients}
              onChangeText={(value) => updateField("dishesIngredients", value)}
              editable={hasSelection && !isSaving}
              placeholder="Comma-separated ingredients"
              multiline
              style={[styles.input, styles.multilineInput]}
            />

            {renderPriceInventoryRow(
              "Basic Box",
              "basicBoxPrice",
              "basicBoxInventory",
            )}
            {renderPriceInventoryRow(
              "Extra Large",
              "extraLargePrice",
              "extraLargeInventory",
            )}
            {renderPriceInventoryRow(
              "Extra Protein",
              "extraProteinPrice",
              "extraProteinInventory",
            )}
            {renderPriceInventoryRow(
              "Extra Veggie",
              "extraVeggiePrice",
              "extraVeggieInventory",
            )}
            {renderPriceInventoryRow(
              "Extra Soup",
              "extraSoupBoxPrice",
              "extraSoupBoxInventory",
            )}
          </ScrollView>

          {hasSelection ? (
            <View style={styles.actionRow}>
              <Pressable
                style={[styles.cancelButton, styles.actionButton]}
                disabled={isSaving}
                onPress={handleCancel}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.addButton, styles.actionButton, isSaving ? styles.buttonDisabled : null]}
                disabled={isSaving}
                onPress={handleSave}
              >
                <Text style={styles.addButtonText}>
                  {isSaving ? "Saving..." : isEditingExisting ? "Save" : "Create"}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        <View style={[styles.card, styles.rightCard]}>
          <Text style={styles.title}>Weekdays</Text>
          <FlatList
            data={weekDays}
            keyExtractor={(item) => item.dateKey}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const meal = mealsByDate.get(item.dateKey);
              const selected = selectedDateKey === item.dateKey;
              return (
                <Pressable
                  style={[styles.row, selected ? styles.rowSelected : null]}
                  onPress={() => handleSelectDay(item)}
                >
                  <View style={styles.rowText}>
                    <Text style={styles.primaryText}>
                      {item.dayLabel} · {item.dateKey}
                    </Text>
                    {meal ? (
                      <>
                        <Text style={styles.secondaryText} numberOfLines={1}>
                          {meal.dishesName || "Untitled dish"}
                        </Text>
                        <Text style={styles.metaText}>
                          Basic ${meal.basicBoxPrice.toFixed(2)} · Inv{" "}
                          {meal.basicBoxInventory}
                        </Text>
                      </>
                    ) : (
                      <Text style={styles.emptyDayText}>No menu yet — tap to create</Text>
                    )}
                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      meal ? styles.statusPillFilled : styles.statusPillEmpty,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        meal ? styles.statusPillTextFilled : styles.statusPillTextEmpty,
                      ]}
                    >
                      {meal ? "Set" : "Empty"}
                    </Text>
                  </View>
                </Pressable>
              );
            }}
            ListEmptyComponent={<Text style={styles.emptyText}>No weekdays available.</Text>}
          />
        </View>
      </KeyboardAvoidingView>

      {Platform.OS === "android" && showDatePicker ? (
        <DateTimePicker
          value={pickerValue}
          mode="date"
          display="default"
          onValueChange={onDateChange}
          onDismiss={() => setShowDatePicker(false)}
        />
      ) : null}

      <Modal
        visible={Platform.OS === "ios" && showDatePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowDatePicker(false)}>
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.modalTitle}>Select a date in the week</Text>
            <DateTimePicker
              value={pickerValue}
              mode="date"
              display="spinner"
              onValueChange={onDateChange}
            />
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.cancelButton, styles.actionButton]}
                onPress={() => setShowDatePicker(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.addButton, styles.actionButton]}
                onPress={confirmDatePicker}
              >
                <Text style={styles.addButtonText}>Done</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={importOpen}
        transparent
        animationType="fade"
        onRequestClose={closeImportModal}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeImportModal}>
          <Pressable style={styles.importModalCard} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.modalTitle}>Import Menu CSV</Text>
            <Text style={styles.importSubtitle}>
              Download the template, fill in Mon–Fri meal rows, then choose the CSV file to import.
              Existing dates are updated; new dates are created.
            </Text>

            {selectedImportFileName ? (
              <Text style={styles.importFileName}>Selected: {selectedImportFileName}</Text>
            ) : null}

            {importBusy ? (
              <View style={styles.importBusyRow}>
                <ActivityIndicator color="#0D7A4E" />
                <Text style={styles.importBusyText}>Working...</Text>
              </View>
            ) : null}

            <Pressable
              style={[styles.secondaryButton, importBusy ? styles.buttonDisabled : null]}
              disabled={importBusy}
              onPress={handleDownloadTemplate}
            >
              <Ionicons name="download-outline" size={18} color="#0D7A4E" />
              <Text style={styles.secondaryButtonText}>Download Template</Text>
            </Pressable>

            <Pressable
              style={[styles.addButton, styles.importPrimaryButton, importBusy ? styles.buttonDisabled : null]}
              disabled={importBusy}
              onPress={handlePickImportFile}
            >
              <Text style={styles.addButtonText}>Choose CSV File</Text>
            </Pressable>

            <Pressable
              style={[styles.cancelButton, styles.importCloseButton]}
              disabled={importBusy}
              onPress={closeImportModal}
            >
              <Text style={styles.cancelButtonText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F8F7",
    padding: 16,
    gap: 12,
  },
  headerAction: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 4,
  },
  headerActionText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  weekBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderWidth: 1,
    borderColor: "#DDEBE6",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  weekBarText: {
    flex: 1,
    minWidth: 0,
  },
  weekTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0B3D2E",
  },
  weekSubtitle: {
    marginTop: 2,
    color: "#577066",
    fontSize: 13,
  },
  dateSelector: {
    borderWidth: 1,
    borderColor: "#C7D8D1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dateSelectorText: {
    color: "#0D4A37",
    fontSize: 15,
    fontWeight: "600",
  },
  panelRow: {
    flex: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 0,
  },
  loadingText: {
    color: "#2D5A4B",
    fontWeight: "600",
    backgroundColor: "#E6F2ED",
    borderRadius: 10,
    padding: 10,
  },
  card: {
    borderWidth: 1,
    borderColor: "#DDEBE6",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    padding: 16,
  },
  leftCard: {
    width: "48%",
    minHeight: 0,
  },
  rightCard: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0B3D2E",
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 8,
    color: "#577066",
    fontSize: 14,
  },
  formScroll: {
    flex: 1,
    minHeight: 0,
  },
  formContent: {
    gap: 8,
    paddingBottom: 8,
  },
  fieldLabel: {
    marginTop: 4,
    color: "#577066",
    fontSize: 13,
    fontWeight: "600",
  },
  miniLabel: {
    color: "#6E7C76",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: "#C7D8D1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    color: "#0D4A37",
  },
  multilineInput: {
    minHeight: 64,
    textAlignVertical: "top",
  },
  priceInventoryBlock: {
    marginTop: 4,
  },
  priceInventoryRow: {
    flexDirection: "row",
    gap: 10,
  },
  halfField: {
    flex: 1,
  },
  actionRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 10,
  },
  actionButton: {
    flex: 1,
  },
  addButton: {
    backgroundColor: "#0D7A4E",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  addButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: "#C7D8D1",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  cancelButtonText: {
    color: "#577066",
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  listContent: {
    marginTop: 10,
    gap: 8,
    paddingBottom: 12,
    flexGrow: 1,
  },
  list: {
    flex: 1,
  },
  row: {
    borderWidth: 1,
    borderColor: "#DDEBE6",
    borderRadius: 10,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#FFFFFF",
  },
  rowSelected: {
    borderColor: "#0D7A4E",
    backgroundColor: "#E6F2ED",
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  primaryText: {
    fontWeight: "700",
    color: "#0D4A37",
    fontSize: 15,
  },
  secondaryText: {
    marginTop: 4,
    color: "#0D4A37",
    fontSize: 14,
  },
  metaText: {
    marginTop: 2,
    color: "#577066",
    fontSize: 12,
  },
  emptyDayText: {
    marginTop: 4,
    color: "#8A9A93",
    fontSize: 13,
    fontStyle: "italic",
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusPillFilled: {
    backgroundColor: "#E0F2EA",
  },
  statusPillEmpty: {
    backgroundColor: "#F0F2F1",
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: "700",
  },
  statusPillTextFilled: {
    color: "#0B5D44",
  },
  statusPillTextEmpty: {
    color: "#6E7C76",
  },
  emptyText: {
    marginTop: 8,
    color: "#6E7C76",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(11, 61, 46, 0.35)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0B3D2E",
    marginBottom: 8,
  },
  modalActions: {
    marginTop: 8,
    flexDirection: "row",
    gap: 10,
  },
  importModalCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    padding: 16,
    gap: 12,
  },
  importSubtitle: {
    color: "#577066",
    fontSize: 14,
    lineHeight: 20,
  },
  importFileName: {
    color: "#0D4A37",
    fontSize: 13,
    fontWeight: "600",
  },
  importBusyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  importBusyText: {
    color: "#2D5A4B",
    fontWeight: "600",
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#0D7A4E",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#E6F2ED",
  },
  secondaryButtonText: {
    color: "#0D7A4E",
    fontWeight: "700",
  },
  importPrimaryButton: {
    width: "100%",
  },
  importCloseButton: {
    width: "100%",
  },
});
