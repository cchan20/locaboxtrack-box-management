import { useAppDispatch } from "@/store/hooks";
import {
  batchDeleteDailyMeals,
  batchInsertDailyMeals,
  batchUpdateDailyMeals,
  downloadDailyMealsTemplate,
  getDailyMeals,
} from "@/store/slices/dailyMealSlice";
import { DailyMeal, DailyMealInput } from "@/types/app";
import { ClearableTextInput } from "@/ui/ClearableTextInput";
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
  extraField1Name: string;
  extraField1Price: string;
  extraField1Inventory: string;
  extraField2Name: string;
  extraField2Price: string;
  extraField2Inventory: string;
  extraField3Name: string;
  extraField3Price: string;
  extraField3Inventory: string;
  extraField4Name: string;
  extraField4Price: string;
  extraField4Inventory: string;
  extraField5Name: string;
  extraField5Price: string;
  extraField5Inventory: string;
  optionField1Name: string;
  optionField1Price: string;
  optionField1Inventory: string;
  optionField2Name: string;
  optionField2Price: string;
  optionField2Inventory: string;
};

const EMPTY_FORM: FormState = {
  dishesName: "",
  dishesDescription: "",
  dishesIngredients: "",
  basicBoxPrice: "0",
  basicBoxInventory: "0",
  extraLargePrice: "0",
  extraLargeInventory: "0",
  extraField1Name: "",
  extraField1Price: "0",
  extraField1Inventory: "0",
  extraField2Name: "",
  extraField2Price: "0",
  extraField2Inventory: "0",
  extraField3Name: "",
  extraField3Price: "0",
  extraField3Inventory: "0",
  extraField4Name: "",
  extraField4Price: "0",
  extraField4Inventory: "0",
  extraField5Name: "",
  extraField5Price: "0",
  extraField5Inventory: "0",
  optionField1Name: "",
  optionField1Price: "0",
  optionField1Inventory: "0",
  optionField2Name: "",
  optionField2Price: "0",
  optionField2Inventory: "0",
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
    extraField1Name: meal.extraField1Name,
    extraField1Price: String(meal.extraField1Price),
    extraField1Inventory: String(meal.extraField1Inventory),
    extraField2Name: meal.extraField2Name,
    extraField2Price: String(meal.extraField2Price),
    extraField2Inventory: String(meal.extraField2Inventory),
    extraField3Name: meal.extraField3Name,
    extraField3Price: String(meal.extraField3Price),
    extraField3Inventory: String(meal.extraField3Inventory),
    extraField4Name: meal.extraField4Name,
    extraField4Price: String(meal.extraField4Price),
    extraField4Inventory: String(meal.extraField4Inventory),
    extraField5Name: meal.extraField5Name,
    extraField5Price: String(meal.extraField5Price),
    extraField5Inventory: String(meal.extraField5Inventory),
    optionField1Name: meal.optionField1Name,
    optionField1Price: String(meal.optionField1Price),
    optionField1Inventory: String(meal.optionField1Inventory),
    optionField2Name: meal.optionField2Name,
    optionField2Price: String(meal.optionField2Price),
    optionField2Inventory: String(meal.optionField2Inventory),
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
  const [isDeleting, setIsDeleting] = useState(false);
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
      ["extraLargePrice", "BigBox Upgrade price"],
      ["extraField1Price", "Extra field 1 price"],
      ["extraField2Price", "Extra field 2 price"],
      ["extraField3Price", "Extra field 3 price"],
      ["extraField4Price", "Extra field 4 price"],
      ["extraField5Price", "Extra field 5 price"],
      ["optionField1Price", "Option field 1 price"],
      ["optionField2Price", "Option field 2 price"],
    ];
    const inventoryFields: Array<[keyof FormState, string]> = [
      ["basicBoxInventory", "Basic box inventory"],
      ["extraLargeInventory", "BigBox Upgrade inventory"],
      ["extraField1Inventory", "Extra field 1 inventory"],
      ["extraField2Inventory", "Extra field 2 inventory"],
      ["extraField3Inventory", "Extra field 3 inventory"],
      ["extraField4Inventory", "Extra field 4 inventory"],
      ["extraField5Inventory", "Extra field 5 inventory"],
      ["optionField1Inventory", "Option field 1 inventory"],
      ["optionField2Inventory", "Option field 2 inventory"],
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
      extraField1Name: form.extraField1Name.trim(),
      extraField1Price: prices.extraField1Price,
      extraField1Inventory: inventories.extraField1Inventory,
      extraField2Name: form.extraField2Name.trim(),
      extraField2Price: prices.extraField2Price,
      extraField2Inventory: inventories.extraField2Inventory,
      extraField3Name: form.extraField3Name.trim(),
      extraField3Price: prices.extraField3Price,
      extraField3Inventory: inventories.extraField3Inventory,
      extraField4Name: form.extraField4Name.trim(),
      extraField4Price: prices.extraField4Price,
      extraField4Inventory: inventories.extraField4Inventory,
      extraField5Name: form.extraField5Name.trim(),
      extraField5Price: prices.extraField5Price,
      extraField5Inventory: inventories.extraField5Inventory,
      optionField1Name: form.optionField1Name.trim(),
      optionField1Price: prices.optionField1Price,
      optionField1Inventory: inventories.optionField1Inventory,
      optionField2Name: form.optionField2Name.trim(),
      optionField2Price: prices.optionField2Price,
      optionField2Inventory: inventories.optionField2Inventory,
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

  const handleDelete = () => {
    if (!selectedDateKey || !isEditingExisting || isSaving || isDeleting) {
      return;
    }

    Alert.alert(
      "Remove daily meal",
      `Delete the menu for ${selectedDateKey}? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setIsDeleting(true);
            try {
              await dispatch(batchDeleteDailyMeals([selectedDateKey])).unwrap();
              resetSelection();
              await loadWeekMeals();
            } catch (error) {
              Alert.alert("Unable to remove", getErrorMessage(error));
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ],
    );
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
          <ClearableTextInput
            value={form[priceKey]}
            onChangeText={(value) => updateField(priceKey, value)}
            keyboardType="decimal-pad"
            editable={hasSelection && !isSaving && !isDeleting}
            style={styles.input}
            placeholder="0"
          />
        </View>
        <View style={styles.halfField}>
          <Text style={styles.miniLabel}>Inventory</Text>
          <ClearableTextInput
            value={form[inventoryKey]}
            onChangeText={(value) => updateField(inventoryKey, value)}
            keyboardType="number-pad"
            editable={hasSelection && !isSaving && !isDeleting}
            style={styles.input}
            placeholder="0"
          />
        </View>
      </View>
    </View>
  );

  const renderExtraFieldRow = (
    label: string,
    nameKey: keyof FormState,
    priceKey: keyof FormState,
    inventoryKey: keyof FormState,
  ) => (
    <View style={styles.priceInventoryBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.miniLabel}>Name</Text>
      <ClearableTextInput
        value={form[nameKey]}
        onChangeText={(value) => updateField(nameKey, value)}
        editable={hasSelection && !isSaving && !isDeleting}
        style={styles.input}
        placeholder="e.g. Extra Protein"
      />
      <View style={styles.priceInventoryRow}>
        <View style={styles.halfField}>
          <Text style={styles.miniLabel}>Price ($)</Text>
          <ClearableTextInput
            value={form[priceKey]}
            onChangeText={(value) => updateField(priceKey, value)}
            keyboardType="decimal-pad"
            editable={hasSelection && !isSaving && !isDeleting}
            style={styles.input}
            placeholder="0"
          />
        </View>
        <View style={styles.halfField}>
          <Text style={styles.miniLabel}>Inventory</Text>
          <ClearableTextInput
            value={form[inventoryKey]}
            onChangeText={(value) => updateField(inventoryKey, value)}
            keyboardType="number-pad"
            editable={hasSelection && !isSaving && !isDeleting}
            style={styles.input}
            placeholder="0"
          />
        </View>
      </View>
    </View>
  );

  const formBusy = isSaving || isDeleting;

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
          <Ionicons name="calendar-outline" size={16} color="#6B5348" />
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
            <ClearableTextInput
              value={form.dishesName}
              onChangeText={(value) => updateField("dishesName", value)}
              editable={hasSelection && !formBusy}
              placeholder="e.g. Grilled Chicken Bowl"
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>Description</Text>
            <ClearableTextInput
              value={form.dishesDescription}
              onChangeText={(value) => updateField("dishesDescription", value)}
              editable={hasSelection && !formBusy}
              placeholder="Short description"
              multiline
              style={[styles.input, styles.multilineInput]}
            />

            <Text style={styles.fieldLabel}>Ingredients</Text>
            <ClearableTextInput
              value={form.dishesIngredients}
              onChangeText={(value) => updateField("dishesIngredients", value)}
              editable={hasSelection && !formBusy}
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
              "BigBox Upgrade",
              "extraLargePrice",
              "extraLargeInventory",
            )}
            {renderExtraFieldRow(
              "Extra Field 1",
              "extraField1Name",
              "extraField1Price",
              "extraField1Inventory",
            )}
            {renderExtraFieldRow(
              "Extra Field 2",
              "extraField2Name",
              "extraField2Price",
              "extraField2Inventory",
            )}
            {renderExtraFieldRow(
              "Extra Field 3",
              "extraField3Name",
              "extraField3Price",
              "extraField3Inventory",
            )}
            {renderExtraFieldRow(
              "Extra Field 4",
              "extraField4Name",
              "extraField4Price",
              "extraField4Inventory",
            )}
            {renderExtraFieldRow(
              "Extra Field 5",
              "extraField5Name",
              "extraField5Price",
              "extraField5Inventory",
            )}
            {renderExtraFieldRow(
              "Option Field 1",
              "optionField1Name",
              "optionField1Price",
              "optionField1Inventory",
            )}
            {renderExtraFieldRow(
              "Option Field 2",
              "optionField2Name",
              "optionField2Price",
              "optionField2Inventory",
            )}
          </ScrollView>

          {hasSelection ? (
            <View style={styles.actionsBlock}>
              <View style={styles.actionRow}>
                <Pressable
                  style={[styles.cancelButton, styles.actionButton]}
                  disabled={formBusy}
                  onPress={handleCancel}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.addButton,
                    styles.actionButton,
                    formBusy ? styles.buttonDisabled : null,
                  ]}
                  disabled={formBusy}
                  onPress={handleSave}
                >
                  <Text style={styles.addButtonText}>
                    {isSaving ? "Saving..." : isEditingExisting ? "Save" : "Create"}
                  </Text>
                </Pressable>
              </View>
              {isEditingExisting ? (
                <Pressable
                  style={[
                    styles.deleteButton,
                    formBusy ? styles.buttonDisabled : null,
                  ]}
                  disabled={formBusy}
                  onPress={handleDelete}
                >
                  <Text style={styles.deleteButtonText}>
                    {isDeleting ? "Removing..." : "Remove Daily Meal"}
                  </Text>
                </Pressable>
              ) : null}
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
              Download the template, fill in Mon–Fri meal rows (date as YYYYMMDD), then choose the
              CSV file to import. Existing dates are updated; new dates are created.
            </Text>

            {selectedImportFileName ? (
              <Text style={styles.importFileName}>Selected: {selectedImportFileName}</Text>
            ) : null}

            {importBusy ? (
              <View style={styles.importBusyRow}>
                <ActivityIndicator color="#8A553E" />
                <Text style={styles.importBusyText}>Working...</Text>
              </View>
            ) : null}

            <Pressable
              style={[styles.secondaryButton, importBusy ? styles.buttonDisabled : null]}
              disabled={importBusy}
              onPress={handleDownloadTemplate}
            >
              <Ionicons name="download-outline" size={18} color="#8A553E" />
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
    backgroundColor: "#F8F4F1",
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
    borderColor: "#E9E0DA",
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
    color: "#3F2419",
  },
  weekSubtitle: {
    marginTop: 2,
    color: "#74675F",
    fontSize: 13,
  },
  dateSelector: {
    borderWidth: 1,
    borderColor: "#D6CBC4",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dateSelectorText: {
    color: "#5A3425",
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
    color: "#5E4336",
    fontWeight: "600",
    backgroundColor: "#F0E8E3",
    borderRadius: 10,
    padding: 10,
  },
  card: {
    borderWidth: 1,
    borderColor: "#E9E0DA",
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
    color: "#3F2419",
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 8,
    color: "#74675F",
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
    color: "#74675F",
    fontSize: 13,
    fontWeight: "600",
  },
  miniLabel: {
    color: "#7C6E67",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: "#D6CBC4",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    color: "#5A3425",
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
  actionsBlock: {
    marginTop: 12,
    gap: 10,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  actionButton: {
    flex: 1,
  },
  addButton: {
    backgroundColor: "#8A553E",
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
    borderColor: "#D6CBC4",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  cancelButtonText: {
    color: "#74675F",
    fontWeight: "700",
  },
  deleteButton: {
    borderWidth: 1,
    borderColor: "#EBC2BE",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FCECEA",
  },
  deleteButtonText: {
    color: "#B42318",
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
    borderColor: "#E9E0DA",
    borderRadius: 10,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#FFFFFF",
  },
  rowSelected: {
    borderColor: "#8A553E",
    backgroundColor: "#F0E8E3",
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  primaryText: {
    fontWeight: "700",
    color: "#5A3425",
    fontSize: 15,
  },
  secondaryText: {
    marginTop: 4,
    color: "#5A3425",
    fontSize: 14,
  },
  metaText: {
    marginTop: 2,
    color: "#74675F",
    fontSize: 12,
  },
  emptyDayText: {
    marginTop: 4,
    color: "#9A8A82",
    fontSize: 13,
    fontStyle: "italic",
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusPillFilled: {
    backgroundColor: "#EFE4DE",
  },
  statusPillEmpty: {
    backgroundColor: "#F3EFEC",
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: "700",
  },
  statusPillTextFilled: {
    color: "#6E4331",
  },
  statusPillTextEmpty: {
    color: "#7C6E67",
  },
  emptyText: {
    marginTop: 8,
    color: "#7C6E67",
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
    color: "#3F2419",
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
    color: "#74675F",
    fontSize: 14,
    lineHeight: 20,
  },
  importFileName: {
    color: "#5A3425",
    fontSize: 13,
    fontWeight: "600",
  },
  importBusyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  importBusyText: {
    color: "#5E4336",
    fontWeight: "600",
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#8A553E",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F0E8E3",
  },
  secondaryButtonText: {
    color: "#8A553E",
    fontWeight: "700",
  },
  importPrimaryButton: {
    width: "100%",
  },
  importCloseButton: {
    width: "100%",
  },
});
