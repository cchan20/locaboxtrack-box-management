import { useAppData } from "@/store/AppDataContext";
import DateTimePicker, { DateTimePickerChangeEvent } from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function CheckoutScreen() {
  const { boxes, customers, checkoutBox, isReady } = useAppData();
  const WALK_IN_CUSTOMER_NAME = "Walk-In User";

  // Left panel state
  const [selectedBoxIds, setSelectedBoxIds] = useState<string[]>([]);
  const [isWalkIn, setIsWalkIn] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: string; name: string } | null>(null);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [checkoutDate, setCheckoutDate] = useState(new Date());
  const [showCheckoutDatePicker, setShowCheckoutDatePicker] = useState(false);

  const customerSearchRef = useRef<import("react-native").TextInput>(null);

  // Right panel state
  const [boxSearch, setBoxSearch] = useState("");

  const availableBoxes = useMemo(() => {
    const available = boxes
      .filter((box) => box.status === "available")
      .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' }));
    const query = boxSearch.trim().toLowerCase();
    if (!query) return available;
    return available.filter((box) => box.id.toLowerCase().includes(query));
  }, [boxes, boxSearch]);

  const filteredCustomers = useMemo(() => {
    const query = customerSearch.trim().toLowerCase();
    if (!query) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.phone.includes(query),
    );
  }, [customers, customerSearch]);

  const toggleBox = (boxId: string) => {
    setSelectedBoxIds((prev) =>
      prev.includes(boxId) ? prev.filter((id) => id !== boxId) : [...prev, boxId],
    );
  };

  const removeBox = (boxId: string) => {
    setSelectedBoxIds((prev) => prev.filter((id) => id !== boxId));
  };

  const handleWalkInToggle = (value: boolean) => {
    setIsWalkIn(value);
    setSelectedCustomer(null);
  };

  const formatDateLabel = (value: Date) => {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const onCheckoutDateChange = (_event: DateTimePickerChangeEvent, selected: Date) => {
    if (Platform.OS !== "ios") {
      setShowCheckoutDatePicker(false);
    }

    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const safeDate = selected > today ? today : selected;
    setCheckoutDate(safeDate);
  };

  const handleSubmit = async () => {
    if (selectedBoxIds.length === 0) {
      Alert.alert("No box selected", "Please select at least one box.");
      return;
    }

    const name = isWalkIn ? WALK_IN_CUSTOMER_NAME : selectedCustomer?.name ?? "";
    if (!name) {
      Alert.alert("No customer", "Please enter or select a customer.");
      return;
    }

    console.log("Checking out boxes:", selectedBoxIds, "to customer:", name);

    const results = await Promise.all(selectedBoxIds.map((id) => checkoutBox(id, name, checkoutDate)));

    const failed = results.filter((r) => !r.ok);
    if (failed.length === 0) {
      Alert.alert("Success", `${selectedBoxIds.length} box(es) checked out to ${name}.`);
      setSelectedBoxIds([]);
      setSelectedCustomer(null);
    } else {
      Alert.alert("Partial error", failed.map((r) => r.message).join("\n"));
    }
  };

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.container}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          {!isReady ? (
            <Text style={styles.loadingText}>Initializing database...</Text>
          ) : null}

          <View style={styles.mainContent}>
        {/* ── LEFT PANEL ─ form ── */}
        <ScrollView
          style={styles.leftColumn}
          contentContainerStyle={styles.leftColumnContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.formCard}>
            <Text style={styles.sectionTitle}>Check-out</Text>

            {/* Selected Boxes */}
            <Text style={styles.label}>Selected Boxes</Text>
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
                selectedBoxIds.map((id) => (
                  <Pressable key={id} style={styles.tag} onPress={() => removeBox(id)}>
                    <Text style={styles.tagText}>{id.replace("BOX-", "")}</Text>
                    <Ionicons name="close" size={12} color="#0B5D44" style={styles.tagIcon} />
                  </Pressable>
                ))
              )}
            </ScrollView>

            {/* Customer */}
            <View style={styles.customerHeader}>
              <Text style={styles.label}>Customer</Text>
              <View style={styles.walkInRow}>
                <Text style={styles.walkInLabel}>Walk-in</Text>
                <Switch
                  value={isWalkIn}
                  onValueChange={handleWalkInToggle}
                  trackColor={{ false: "#C7D8D1", true: "#0D7A4E" }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>

            {isWalkIn ? (
              <TextInput
                value={WALK_IN_CUSTOMER_NAME}
                editable={false}
                style={[styles.input, styles.disabledInput]}
              />
            ) : (
              <Pressable
                style={styles.customerSelector}
                onPress={() => setCustomerModalOpen(true)}
              >
                <Text
                  style={
                    selectedCustomer ? styles.customerSelectorText : styles.customerSelectorPlaceholder
                  }
                >
                  {selectedCustomer ? selectedCustomer.name : "Tap to select customer"}
                </Text>
                <Ionicons name="chevron-down" size={16} color="#42685D" />
              </Pressable>
            )}

            <Text style={styles.label}>Checkout Date</Text>
            <Pressable style={styles.dateSelector} onPress={() => setShowCheckoutDatePicker(true)}>
              <Text style={styles.dateSelectorText}>{formatDateLabel(checkoutDate)}</Text>
              <Ionicons name="calendar-outline" size={16} color="#42685D" />
            </Pressable>

            {showCheckoutDatePicker ? (
              <DateTimePicker
                value={checkoutDate}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                maximumDate={new Date()}
                onValueChange={onCheckoutDateChange}
                onDismiss={() => setShowCheckoutDatePicker(false)}
              />
            ) : null}

            <Pressable style={styles.submitButton} onPress={handleSubmit}>
              <Text style={styles.submitButtonText}>Confirm Check-out</Text>
            </Pressable>
          </View>
        </ScrollView>

        {/* ── RIGHT PANEL ─ available boxes ── */}
            <View style={styles.rightColumn}>
              <View style={styles.searchCard}>
                <Text style={styles.sectionTitle}>Available Boxes ({availableBoxes.length})</Text>
                <View style={styles.searchInputWrap}>
                  <TextInput
                    value={boxSearch}
                    onChangeText={setBoxSearch}
                    placeholder="Search box id"
                    placeholderTextColor="#7A8F87"
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
                  data={availableBoxes}
                  keyExtractor={(item) => item.id}
                  numColumns={4}
                  contentContainerStyle={styles.boxList}
                  columnWrapperStyle={styles.boxRow}
                  keyboardShouldPersistTaps="handled"
                  ListEmptyComponent={
                    <View style={styles.emptyState}>
                      <Ionicons name="cube-outline" size={28} color="#7A8F87" />
                      <Text style={styles.emptyText}>No available boxes</Text>
                    </View>
                  }
                  renderItem={({ item }) => {
                    const isSelected = selectedBoxIds.includes(item.id);
                    return (
                      <Pressable
                        onPress={() => toggleBox(item.id)}
                        style={[styles.boxChip, isSelected ? styles.boxChipActive : undefined]}
                      >
                        <Text
                          style={[
                            styles.boxChipText,
                            isSelected ? styles.boxChipTextActive : undefined,
                          ]}
                          numberOfLines={1}
                        >
                          {item.id.replace("BOX-", "")}
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

      {/* ── Customer Modal ── */}
      <Modal
        transparent
        visible={customerModalOpen}
        animationType="fade"
        onRequestClose={() => setCustomerModalOpen(false)}
        onShow={() => setTimeout(() => customerSearchRef.current?.focus(), 100)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setCustomerModalOpen(false)}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Customer</Text>
            <View style={styles.searchInputWrap}>
              <TextInput
                ref={customerSearchRef}
                value={customerSearch}
                onChangeText={setCustomerSearch}
                placeholder="Search name, phone"
                placeholderTextColor="#7A8F87"
                style={[styles.input, styles.modalSearch, styles.searchInput]}
              />
              {customerSearch ? (
                <Pressable style={styles.clearButton} onPress={() => setCustomerSearch("")}>
                  <Ionicons name="close-circle" size={18} color="#7A8F87" />
                </Pressable>
              ) : null}
            </View>
            <ScrollView style={styles.modalList}>
              {filteredCustomers.length === 0 ? (
                <Text style={styles.emptyText}>No customers found.</Text>
              ) : (
                filteredCustomers.map((c) => (
                  <Pressable
                    key={c.id}
                    style={styles.modalItem}
                    onPress={() => {
                      setSelectedCustomer({ id: c.id, name: c.name });
                      setCustomerSearch("");
                      setCustomerModalOpen(false);
                    }}
                  >
                    <Text style={styles.modalItemName}>{c.name} <Text style={styles.modalItemSub}>({c.phone})</Text></Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>
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
    color: "#39584F",
    fontWeight: "600",
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
  tagText: {
    color: "#0B5D44",
    fontWeight: "700",
    fontSize: 12,
  },
  tagIcon: {
    marginLeft: 2,
  },
  customerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  walkInRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  walkInLabel: {
    fontSize: 12,
    color: "#39584F",
    fontWeight: "600",
  },
  customerSelector: {
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
  customerSelectorText: {
    color: "#1E2A26",
    fontWeight: "600",
    fontSize: 14,
  },
  customerSelectorPlaceholder: {
    color: "#7A8F87",
    fontSize: 13,
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
  submitButton: {
    marginTop: 4,
    backgroundColor: "#0D7A4E",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
  },
  boxList: {
    gap: 6,
    paddingBottom: 8,
  },
  boxRow: {
    justifyContent: "flex-start",
    gap: 6,
  },
  boxChip: {
    width: "23.5%",
    height: 60,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "#BCD2C9",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  boxChipActive: {
    backgroundColor: "#0D7A4E",
    borderColor: "#0D7A4E",
  },
  boxChipText: {
    color: "#114535",
    fontWeight: "700",
    fontSize: 12,
    textAlign: "center",
  },
  boxChipTextActive: {
    color: "#FFFFFF",
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.28)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    width: "90%",
    height: "90%",
    alignSelf: "center",
    gap: 10,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0B3D2E",
  },
  modalSearch: {
    marginBottom: 2,
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
  modalList: {
    flex: 1,
  },
  disabledInput: {
    backgroundColor: "#EEF4F1",
    color: "#527168",
  },
  modalItem: {
    borderWidth: 1,
    borderColor: "#DDEBE6",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  modalItemName: {
    fontWeight: "700",
    color: "#0D4A37",
    fontSize: 14,
  },
  modalItemSub: {
    marginTop: 2,
    color: "#5C7269",
    fontSize: 12,
  },
});
