import { useAppDispatch } from "@/store/hooks";
import { getGlobalSettings, updateTimeslots } from "@/store/slices/settingsSlice";
import { Timeslot } from "@/types/app";
import { ClearableTextInput } from "@/ui/ClearableTextInput";
import { getErrorMessage } from "@/utils/apiError";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, {
  DateTimePickerChangeEvent,
} from "@react-native-community/datetimepicker";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DEFAULT_START_TIME = "11:30";
const DEFAULT_END_TIME = "12:30";
const DEFAULT_CAPACITY = "50";

type TimeField = "start" | "end";

const isValidTime = (value: string) => TIME_PATTERN.test(value.trim());

const toMinutes = (value: string) => {
  const [hours, minutes] = value.trim().split(":").map(Number);
  return hours * 60 + minutes;
};

const parseTimeToDate = (value: string) => {
  const date = new Date();
  if (!isValidTime(value)) {
    date.setHours(11, 30, 0, 0);
    return date;
  }
  const [hours, minutes] = value.split(":").map(Number);
  date.setHours(hours, minutes, 0, 0);
  return date;
};

const formatTime = (date: Date) => {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
};

const normalizeTimeslot = (slot: Timeslot): Timeslot => ({
  ...slot,
  startTime: isValidTime(slot.startTime) ? slot.startTime.trim() : DEFAULT_START_TIME,
  endTime: isValidTime(slot.endTime) ? slot.endTime.trim() : DEFAULT_END_TIME,
});

export default function PickupTimeslotScreen() {
  const dispatch = useAppDispatch();
  const [items, setItems] = useState<Timeslot[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [startTime, setStartTime] = useState(DEFAULT_START_TIME);
  const [endTime, setEndTime] = useState(DEFAULT_END_TIME);
  const [capacity, setCapacity] = useState(DEFAULT_CAPACITY);
  const [timePickerField, setTimePickerField] = useState<TimeField | null>(null);
  const [pickerValue, setPickerValue] = useState(() => parseTimeToDate(DEFAULT_START_TIME));

  const isEditing = selectedId !== null;

  const resetForm = () => {
    setSelectedId(null);
    setLabel("");
    setStartTime(DEFAULT_START_TIME);
    setEndTime(DEFAULT_END_TIME);
    setCapacity(DEFAULT_CAPACITY);
    setTimePickerField(null);
  };

  const fillForm = (item: Timeslot) => {
    setSelectedId(item.id);
    setLabel(item.label);
    setStartTime(item.startTime || DEFAULT_START_TIME);
    setEndTime(item.endTime || DEFAULT_END_TIME);
    setCapacity(String(item.capacity));
    setTimePickerField(null);
  };

  const loadTimeslots = useCallback(async () => {
    setIsFetching(true);
    try {
      const response = await dispatch(getGlobalSettings()).unwrap();
      // Legacy slots may predate start/end time fields — hydrate defaults locally.
      setItems(response.data.timeslots.map(normalizeTimeslot));
    } catch {
      setItems([]);
    } finally {
      setIsFetching(false);
    }
  }, [dispatch]);

  useFocusEffect(
    useCallback(() => {
      void loadTimeslots();
    }, [loadTimeslots]),
  );

  const persistTimeslots = async (next: Timeslot[]) => {
    const payload = next.map(normalizeTimeslot);
    const response = await dispatch(updateTimeslots(payload)).unwrap();
    setItems(response.data.timeslots.map(normalizeTimeslot));
    return response.data.timeslots;
  };

  const openTimePicker = (field: TimeField) => {
    const current = field === "start" ? startTime : endTime;
    setPickerValue(parseTimeToDate(current));
    setTimePickerField(field);
  };

  const applyPickedTime = (date: Date) => {
    const formatted = formatTime(date);
    if (timePickerField === "start") {
      setStartTime(formatted);
    } else if (timePickerField === "end") {
      setEndTime(formatted);
    }
  };

  const closeTimePicker = () => {
    setTimePickerField(null);
  };

  const onTimeChange = (_event: DateTimePickerChangeEvent, selected?: Date) => {
    if (!selected) {
      if (Platform.OS !== "ios") {
        closeTimePicker();
      }
      return;
    }

    setPickerValue(selected);

    if (Platform.OS !== "ios") {
      applyPickedTime(selected);
      closeTimePicker();
    }
  };

  const confirmTimePicker = () => {
    applyPickedTime(pickerValue);
    closeTimePicker();
  };

  const validateForm = () => {
    const trimmedLabel = label.trim();
    const trimmedStart = startTime.trim();
    const trimmedEnd = endTime.trim();
    const parsedCapacity = Number.parseInt(capacity, 10);

    if (!trimmedLabel) {
      Alert.alert("Missing label", "Please enter a timeslot label.");
      return null;
    }

    if (!isValidTime(trimmedStart)) {
      Alert.alert("Invalid start time", "Please select a valid start time.");
      return null;
    }

    if (!isValidTime(trimmedEnd)) {
      Alert.alert("Invalid end time", "Please select a valid end time.");
      return null;
    }

    if (toMinutes(trimmedEnd) <= toMinutes(trimmedStart)) {
      Alert.alert("Invalid time range", "End time must be after start time.");
      return null;
    }

    if (!Number.isFinite(parsedCapacity) || parsedCapacity < 0) {
      Alert.alert("Invalid capacity", "Capacity must be zero or a positive number.");
      return null;
    }

    return {
      label: trimmedLabel,
      startTime: trimmedStart,
      endTime: trimmedEnd,
      capacity: parsedCapacity,
    };
  };

  const handleAdd = async () => {
    const form = validateForm();
    if (!form) {
      return;
    }

    const next: Timeslot[] = [
      ...items,
      {
        id: "",
        label: form.label,
        startTime: form.startTime,
        endTime: form.endTime,
        capacity: form.capacity,
      },
    ];

    try {
      await persistTimeslots(next);
      resetForm();
    } catch (error) {
      Alert.alert("Unable to add", getErrorMessage(error, "Failed to save timeslot."));
    }
  };

  const handleSave = async () => {
    if (!selectedId) {
      return;
    }

    const form = validateForm();
    if (!form) {
      return;
    }

    const next = items.map((slot) =>
      slot.id === selectedId
        ? {
            ...slot,
            label: form.label,
            startTime: form.startTime,
            endTime: form.endTime,
            capacity: form.capacity,
          }
        : slot,
    );

    try {
      await persistTimeslots(next);
      resetForm();
    } catch (error) {
      Alert.alert("Unable to save", getErrorMessage(error));
      await loadTimeslots();
    }
  };

  const handleCancel = () => {
    resetForm();
  };

  const handleSelect = (item: Timeslot) => {
    if (selectedId === item.id) {
      return;
    }
    fillForm(item);
  };

  const handleDelete = (item: Timeslot) => {
    Alert.alert("Delete Timeslot", `Delete "${item.label}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await persistTimeslots(items.filter((slot) => slot.id !== item.id));
            if (selectedId === item.id) {
              resetForm();
            }
          } catch (error) {
            Alert.alert("Unable to delete", getErrorMessage(error));
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.container}>
      {isFetching && items.length === 0 ? (
        <Text style={styles.loadingText}>Loading pickup timeslots...</Text>
      ) : null}

      <View style={styles.panelRow}>
        <View style={[styles.card, styles.leftCard]}>
          <Text style={styles.title}>{isEditing ? "Edit Timeslot" : "New Timeslot"}</Text>
          <Text style={styles.subtitle}>
            {isEditing
              ? "Update the selected pickup window, then save or cancel."
              : "Create a pickup window with start time, end time, and capacity."}
          </Text>

          <ClearableTextInput
            value={label}
            onChangeText={setLabel}
            placeholder="Label (e.g. Lunch)"
            style={[styles.input, styles.stackedInput]}
          />
          <View style={styles.createTimeRow}>
            <View style={styles.createTimeField}>
              <Text style={styles.createFieldLabel}>Start</Text>
              <Pressable style={styles.timeSelector} onPress={() => openTimePicker("start")}>
                <Text style={styles.timeSelectorText}>{startTime}</Text>
                <Ionicons name="time-outline" size={16} color="#42685D" />
              </Pressable>
            </View>
            <View style={styles.createTimeField}>
              <Text style={styles.createFieldLabel}>End</Text>
              <Pressable style={styles.timeSelector} onPress={() => openTimePicker("end")}>
                <Text style={styles.timeSelectorText}>{endTime}</Text>
                <Ionicons name="time-outline" size={16} color="#42685D" />
              </Pressable>
            </View>
          </View>
          <View style={styles.createCapacityRow}>
            <Text style={styles.createFieldLabel}>Capacity</Text>
            <ClearableTextInput
              value={capacity}
              onChangeText={setCapacity}
              placeholder="0"
              keyboardType="number-pad"
              style={styles.input}
              containerStyle={styles.createCapacityInput}
            />
          </View>

          {isEditing ? (
            <View style={styles.actionRow}>
              <Pressable style={[styles.cancelButton, styles.actionButton]} onPress={handleCancel}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.addButton, styles.actionButton]} onPress={handleSave}>
                <Text style={styles.addButtonText}>Save</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable style={[styles.addButton, styles.stackedAddButton]} onPress={handleAdd}>
              <Text style={styles.addButtonText}>Add</Text>
            </Pressable>
          )}
        </View>

        <View style={[styles.card, styles.rightCard]}>
          <Text style={styles.title}>Timeslot List</Text>

          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const selected = selectedId === item.id;
              return (
                <Pressable
                  style={[styles.row, selected ? styles.rowSelected : null]}
                  onPress={() => handleSelect(item)}
                >
                  <View style={styles.rowText}>
                    <Text style={styles.primaryText}>{item.label}</Text>
                    <Text style={styles.secondaryText}>
                      {item.startTime || "--:--"} – {item.endTime || "--:--"} · Capacity{" "}
                      {item.capacity}
                    </Text>
                  </View>
                  <Pressable
                    style={styles.deleteButton}
                    onPress={() => handleDelete(item)}
                  >
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </Pressable>
                </Pressable>
              );
            }}
            ListEmptyComponent={<Text style={styles.emptyText}>No timeslots found.</Text>}
          />
        </View>
      </View>

      {Platform.OS === "android" && timePickerField ? (
        <DateTimePicker
          value={pickerValue}
          mode="time"
          display="default"
          is24Hour
          onValueChange={onTimeChange}
          onDismiss={closeTimePicker}
        />
      ) : null}

      <Modal
        visible={Platform.OS === "ios" && timePickerField !== null}
        transparent
        animationType="fade"
        onRequestClose={closeTimePicker}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeTimePicker}>
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.modalTitle}>
              Select {timePickerField === "end" ? "end" : "start"} time
            </Text>
            <DateTimePicker
              value={pickerValue}
              mode="time"
              display="spinner"
              is24Hour
              onValueChange={onTimeChange}
            />
            <View style={styles.modalActions}>
              <Pressable style={[styles.cancelButton, styles.actionButton]} onPress={closeTimePicker}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.addButton, styles.actionButton]} onPress={confirmTimePicker}>
                <Text style={styles.addButtonText}>Done</Text>
              </Pressable>
            </View>
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
    width: "38%",
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
    color: "#577066",
    fontSize: 14,
  },
  stackedInput: {
    marginTop: 12,
    flexGrow: 0,
    flexShrink: 0,
    width: "100%",
  },
  createTimeRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 10,
  },
  createTimeField: {
    flex: 1,
    gap: 6,
  },
  createCapacityRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  createFieldLabel: {
    color: "#577066",
    fontSize: 14,
    fontWeight: "600",
  },
  createCapacityInput: {
    flex: 1,
  },
  input: {
    borderWidth: 1,
    borderColor: "#C7D8D1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
  },
  timeSelector: {
    borderWidth: 1,
    borderColor: "#C7D8D1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  timeSelectorText: {
    color: "#0D4A37",
    fontSize: 15,
    fontWeight: "600",
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
  stackedAddButton: {
    marginTop: 12,
    width: "100%",
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
    marginTop: 2,
    color: "#577066",
    fontSize: 12,
  },
  deleteButton: {
    borderWidth: 1,
    borderColor: "#EBC2BE",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "#FCECEA",
  },
  deleteButtonText: {
    color: "#B42318",
    fontWeight: "700",
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
});
