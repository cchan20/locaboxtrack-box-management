import { useAppData } from "@/store/AppDataContext";
import DateTimePicker, { DateTimePickerChangeEvent } from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function CheckinScreen() {
  const { boxes, checkinBox, getDaysOut, isReady } = useAppData();
  const [selectedBoxIds, setSelectedBoxIds] = useState<string[]>([]);
  const [boxSearch, setBoxSearch] = useState("");
  const [checkinDate, setCheckinDate] = useState(new Date());
  const [showCheckinDatePicker, setShowCheckinDatePicker] = useState(false);

  const formatDateLabel = (value: Date) => {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const onCheckinDateChange = (_event: DateTimePickerChangeEvent, selected: Date) => {
    if (Platform.OS !== "ios") {
      setShowCheckinDatePicker(false);
    }

    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const safeDate = selected > today ? today : selected;
    setCheckinDate(safeDate);
  };

  const checkedOutBoxes = useMemo(
    () =>
      boxes
        .filter((box) => box.status === "checked-out")
        .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' }))
        .filter((box) => {
          const query = boxSearch.trim().toLowerCase();

          if (!query) {
            return true;
          }

          return (
            box.id.toLowerCase().includes(query) ||
            (box.customerName ?? "").toLowerCase().includes(query)
          );
        }),
    [boxes, boxSearch],
  );

  const toggleBox = (boxId: string) => {
    setSelectedBoxIds((prev) =>
      prev.includes(boxId) ? prev.filter((id) => id !== boxId) : [...prev, boxId],
    );
  };

  const removeBox = (boxId: string) => {
    setSelectedBoxIds((prev) => prev.filter((id) => id !== boxId));
  };

  const handleReturn = async () => {
    if (selectedBoxIds.length === 0) {
      Alert.alert("No box selected", "Please select at least one box.");
      return;
    }

    const results = await Promise.all(selectedBoxIds.map((boxId) => checkinBox(boxId, checkinDate)));
    const failed = results.filter((result) => !result.ok);

    if (failed.length === 0) {
      Alert.alert("Success", `${selectedBoxIds.length} box(es) checked in successfully.`);
      setSelectedBoxIds([]);
    } else {
      Alert.alert("Partial error", failed.map((result) => result.message).join("\n"));
    }
  };

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.container}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          {!isReady ? <Text style={styles.loadingText}>Initializing database...</Text> : null}

          <View style={styles.mainContent}>
            <ScrollView
              style={styles.leftColumn}
              contentContainerStyle={styles.leftColumnContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.formCard}>
                <Text style={styles.sectionTitle}>Check-in</Text>

                <View style={styles.labelRow}>
                  <Text style={styles.label}>Selected Boxes</Text>
                  {selectedBoxIds.length > 0 && (
                    <Pressable onPress={() => setSelectedBoxIds([])}>
                      <Text style={styles.clearAllText}>Clear All</Text>
                    </Pressable>
                  )}
                </View>
                <ScrollView
                  style={styles.tagScroll}
                  contentContainerStyle={[
                    styles.tagContainer,
                    selectedBoxIds.length === 0 ? styles.tagContainerEmpty : undefined,
                  ]}
                  showsVerticalScrollIndicator={selectedBoxIds.length > 0}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                >
                  {selectedBoxIds.length === 0 ? (
                    <Text style={styles.tagPlaceholder}>Tap boxes on the right to select</Text>
                  ) : (
                    selectedBoxIds.map((id) => {
                      const box = boxes.find((item) => item.id === id);
                      const daysOut = getDaysOut(box?.dateOut ?? null);
                      const isWarning = daysOut > 7 && daysOut <= 14;
                      const isOverdue = daysOut > 14;

                      return (
                        <Pressable
                          key={id}
                          style={[
                            styles.tag,
                            isWarning ? styles.tagWarning : undefined,
                            isOverdue ? styles.tagOverdue : undefined,
                          ]}
                          onPress={() => removeBox(id)}
                        >
                          <Text
                            style={[
                              styles.tagText,
                              isWarning ? styles.tagTextWarning : undefined,
                              isOverdue ? styles.tagTextOverdue : undefined,
                            ]}
                          >
                            {id.replace("BOX-", "")}
                          </Text>
                          <Ionicons
                            name="close"
                            size={12}
                            color={isOverdue ? "#8E1F1F" : isWarning ? "#725300" : "#0B5D44"}
                            style={styles.tagIcon}
                          />
                        </Pressable>
                      );
                    })
                  )}
                </ScrollView>

                <Text style={styles.label}>Checkin Date</Text>
                <Pressable style={styles.dateSelector} onPress={() => setShowCheckinDatePicker(true)}>
                  <Text style={styles.dateSelectorText}>{formatDateLabel(checkinDate)}</Text>
                  <Ionicons name="calendar-outline" size={16} color="#42685D" />
                </Pressable>

                {showCheckinDatePicker ? (
                  <DateTimePicker
                    value={checkinDate}
                    mode="date"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    maximumDate={new Date()}
                    onValueChange={onCheckinDateChange}
                    onDismiss={() => setShowCheckinDatePicker(false)}
                  />
                ) : null}

                <Pressable style={styles.submitButton} onPress={handleReturn}>
                  <Text style={styles.submitButtonText}>Confirm Check-in</Text>
                </Pressable>
              </View>
            </ScrollView>

            <View style={styles.rightColumn}>
              <View style={styles.searchCard}>
                <Text style={styles.sectionTitle}>Checked-out Boxes ({checkedOutBoxes.length})</Text>
                <View style={styles.searchInputWrap}>
                  <TextInput
                    value={boxSearch}
                    onChangeText={setBoxSearch}
                    placeholder="Search box id or customer"
                    placeholderTextColor="#7A8F87"
                    keyboardType="number-pad"
                    style={[styles.input, styles.searchInput]}
                  />
                  {boxSearch ? (
                    <Pressable style={styles.clearButton} onPress={() => setBoxSearch("")}>
                      <Ionicons name="close-circle" size={18} color="#7A8F87" />
                    </Pressable>
                  ) : null}
                </View>
              </View>

              <View style={styles.boxListCard}>
                <FlatList
                  data={checkedOutBoxes}
                  keyExtractor={(item) => item.id}
                  numColumns={3}
                  contentContainerStyle={styles.boxList}
                  columnWrapperStyle={styles.boxRow}
                  keyboardShouldPersistTaps="handled"
                  ListEmptyComponent={
                    <View style={styles.emptyState}>
                      <Ionicons name="archive-outline" size={28} color="#7A8F87" />
                      <Text style={styles.emptyText}>No checked-out boxes</Text>
                    </View>
                  }
                  renderItem={({ item }) => {
                    const isSelected = selectedBoxIds.includes(item.id);
                    const daysOut = getDaysOut(item.dateOut);
                    const isWarning = daysOut > 7 && daysOut <= 14;
                    const isOverdue = daysOut > 14;
                    const isAged = isWarning || isOverdue;

                    return (
                      <Pressable
                        onPress={() => toggleBox(item.id)}
                        style={[
                          styles.inventoryCard,
                          isWarning ? styles.inventoryCardWarning : undefined,
                          isOverdue ? styles.inventoryCardOverdue : undefined,
                          isSelected
                            ? isAged
                              ? styles.inventoryCardSelectedOutline
                              : styles.inventoryCardActive
                            : undefined,
                        ]}
                      >
                        <Text
                          style={[
                            styles.inventoryId,
                            isWarning ? styles.inventoryIdWarning : undefined,
                            isOverdue ? styles.inventoryIdOverdue : undefined,
                            isSelected && !isAged ? styles.inventoryIdActive : undefined,
                          ]}
                          numberOfLines={1}
                        >
                          {item.id.replace("BOX-", "")}
                        </Text>
                        <Text
                          style={[
                            styles.inventoryCustomer,
                            isWarning ? styles.inventoryCustomerWarning : undefined,
                            isOverdue ? styles.inventoryCustomerOverdue : undefined,
                            isSelected && !isAged ? styles.inventoryCustomerActive : undefined,
                          ]}
                          numberOfLines={1}
                        >
                          {item.customerName ?? "Unknown"}
                        </Text>
                        <Text
                          style={[
                            styles.inventoryMeta,
                            isWarning ? styles.inventoryMetaWarning : undefined,
                            isOverdue ? styles.inventoryMetaOverdue : undefined,
                            isSelected && !isAged ? styles.inventoryMetaActive : undefined,
                          ]}
                        >
                          {daysOut} day{daysOut === 1 ? "" : "s"} out
                        </Text>
                      </Pressable>
                    );
                  }}
                />
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
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
  keyboardView: {
    flex: 1,
  },
  loadingText: {
    color: "#2D5A4B",
    fontWeight: "600",
    backgroundColor: "#E6F2ED",
    borderRadius: 10,
    padding: 10,
  },
  mainContent: {
    flex: 1,
    flexDirection: "row",
    gap: 12,
  },
  leftColumn: {
    flex: 1,
  },
  leftColumnContent: {
    paddingBottom: 12,
  },
  rightColumn: {
    flex: 1.4,
    gap: 12,
  },
  formCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#DDEBE6",
    gap: 8,
  },
  searchCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#DDEBE6",
    gap: 8,
  },
  boxListCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#DDEBE6",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0B3D2E",
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#39584F",
  },
  input: {
    borderWidth: 1,
    borderColor: "#C6D6D0",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#FFFFFF",
    color: "#1E2A26",
  },
  tagContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    minHeight: 38,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  tagContainerEmpty: {
    alignItems: "center",
    justifyContent: "center",
  },
  tagScroll: {
    borderWidth: 1,
    borderColor: "#C6D6D0",
    borderRadius: 10,
    backgroundColor: "#FAFCFB",
    maxHeight: 116,
  },
  tagPlaceholder: {
    color: "#7A8F87",
    fontSize: 13,
    alignSelf: "center",
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E0F2EA",
    borderWidth: 1,
    borderColor: "#A8D8C0",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 4,
  },
  tagWarning: {
    backgroundColor: "#FFF6CC",
    borderColor: "#E4C85A",
  },
  tagOverdue: {
    backgroundColor: "#FFE0E0",
    borderColor: "#E25A5A",
  },
  tagText: {
    color: "#0B5D44",
    fontWeight: "700",
    fontSize: 12,
  },
  tagTextWarning: {
    color: "#725300",
  },
  tagTextOverdue: {
    color: "#8E1F1F",
  },
  tagIcon: {
    marginLeft: 2,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  clearAllText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0D7A4E",
  },
  submitButton: {
    marginTop: 4,
    backgroundColor: "#0D7A4E",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  dateSelector: {
    borderWidth: 1,
    borderColor: "#C6D6D0",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dateSelectorText: {
    color: "#1E2A26",
    fontWeight: "600",
    fontSize: 14,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
  },
  boxList: {
    gap: 8,
    paddingBottom: 8,
  },
  boxRow: {
    justifyContent: "flex-start",
    gap: 8,
  },
  inventoryCard: {
    width: "31%",
    minHeight: 82,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#BCD2C9",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    justifyContent: "center",
  },
  inventoryCardActive: {
    backgroundColor: "#0D7A4E",
    borderColor: "#0D7A4E",
  },
  inventoryCardSelectedOutline: {
    borderColor: "#0D7A4E",
    borderWidth: 2,
  },
  inventoryCardWarning: {
    backgroundColor: "#FFF6CC",
    borderColor: "#E4C85A",
  },
  inventoryCardOverdue: {
    backgroundColor: "#FFE0E0",
    borderColor: "#E25A5A",
  },
  inventoryId: {
    color: "#114535",
    fontWeight: "700",
    fontSize: 13,
  },
  inventoryIdWarning: {
    color: "#725300",
  },
  inventoryIdOverdue: {
    color: "#8E1F1F",
  },
  inventoryIdActive: {
    color: "#FFFFFF",
  },
  inventoryCustomer: {
    marginTop: 4,
    color: "#39584F",
    fontSize: 12,
    fontWeight: "600",
  },
  inventoryCustomerWarning: {
    color: "#8A6607",
  },
  inventoryCustomerOverdue: {
    color: "#9E2A2A",
  },
  inventoryCustomerActive: {
    color: "#E4F6EE",
  },
  inventoryMeta: {
    marginTop: 4,
    color: "#678279",
    fontSize: 11,
  },
  inventoryMetaWarning: {
    color: "#946E05",
  },
  inventoryMetaOverdue: {
    color: "#AA2E2E",
  },
  inventoryMetaActive: {
    color: "#D0EFE1",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 6,
  },
  emptyText: {
    color: "#6E7C76",
    fontSize: 13,
    textAlign: "center",
  },
  searchInputWrap: {
    position: "relative",
  },
  searchInput: {
    paddingRight: 34,
  },
  clearButton: {
    position: "absolute",
    right: 10,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
});
