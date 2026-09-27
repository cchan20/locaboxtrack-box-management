import { useAppDispatch } from "@/store/hooks";
import { checkoutBox, getAvailableBoxes } from "@/store/slices/boxSlice";
import { getOrders } from "@/store/slices/orderSlice";
import { getGlobalSettings } from "@/store/slices/settingsSlice";
import { Box, Order, StoreLocation, Timeslot } from "@/types/app";
import { getErrorMessage } from "@/utils/apiError";
import { normalizeBoxId } from "@/utils/boxId";
import DateTimePicker, { DateTimePickerChangeEvent } from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
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

const ADDON_LABELS: Record<string, string> = {
  xl: "Extra Large",
  pro: "Extra Protein",
  veg: "Extra Veggie",
  soup: "Extra Soup",
};

const NUMPAD_ROWS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["C", "0", "back"],
] as const;

const BOX_SEARCH_MAX_LENGTH = 8;

function formatDateLabel(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatAddonLabel(addon: string) {
  return ADDON_LABELS[addon] ?? addon;
}

function formatCurrency(amount: number) {
  return `$${amount.toFixed(2)}`;
}

export default function OrdersScreen() {
  const dispatch = useAppDispatch();

  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedTimeslotId, setSelectedTimeslotId] = useState<string | null>(null);
  const [selectedStoreLocationId, setSelectedStoreLocationId] = useState<string | null>(null);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [timeslots, setTimeslots] = useState<Timeslot[]>([]);
  const [storeLocations, setStoreLocations] = useState<StoreLocation[]>([]);
  const [storeLocationNames, setStoreLocationNames] = useState<Record<string, string>>({});

  const [orders, setOrders] = useState<Order[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");

  const [availableBoxes, setAvailableBoxes] = useState<Box[]>([]);
  const [boxSearch, setBoxSearch] = useState("");
  const [selectedBoxIds, setSelectedBoxIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [boxesLoading, setBoxesLoading] = useState(false);

  const filteredOrders = useMemo(() => {
    const query = customerSearch.trim().toLowerCase();
    if (!query) {
      return orders;
    }

    return orders.filter((order) => {
      const name = (order.customerName ?? "").toLowerCase();
      const phone = (order.customerPhone ?? "").toLowerCase();
      return name.includes(query) || phone.includes(query);
    });
  }, [customerSearch, orders]);

  const selectedOrder = useMemo(
    () => filteredOrders.find((order) => order.id === selectedOrderId) ?? null,
    [filteredOrders, selectedOrderId],
  );

  const maxSelectedBoxes = useMemo(() => {
    if (!selectedOrder) {
      return 2;
    }
    return Math.max(selectedOrder.meals.length, 1);
  }, [selectedOrder]);

  const filteredAvailableBoxes = useMemo(() => {
    const query = boxSearch.trim().toLowerCase();
    if (!query) {
      return availableBoxes;
    }

    return availableBoxes.filter((box) => {
      const id = box.id.toLowerCase();
      const bareId = id.replace(/^box-/, "");
      return id.includes(query) || bareId.includes(query);
    });
  }, [availableBoxes, boxSearch]);

  const displayedAvailableBoxes = useMemo(
    () => filteredAvailableBoxes.slice(0, 9),
    [filteredAvailableBoxes],
  );

  const dateKey = formatDateLabel(selectedDate);

  const loadSettings = useCallback(async () => {
    try {
      const response = await dispatch(getGlobalSettings()).unwrap();
      setTimeslots(response.data.timeslots ?? []);
      const locations = response.data.storeLocations ?? [];
      setStoreLocations(locations);
      const locationMap: Record<string, string> = {};
      for (const location of locations) {
        locationMap[location.id] = location.name;
      }
      setStoreLocationNames(locationMap);
    } catch {
      setTimeslots([]);
      setStoreLocations([]);
      setStoreLocationNames({});
    }
  }, [dispatch]);

  const loadOrders = useCallback(async () => {
    setListLoading(true);
    try {
      const response = await dispatch(
        getOrders({
          from: dateKey,
          to: dateKey,
          timeslotId: selectedTimeslotId ?? undefined,
          storeLocationId: selectedStoreLocationId ?? undefined,
        }),
      ).unwrap();

      const nextOrders = [...response.data].sort((a, b) =>
        (a.customerName ?? "").localeCompare(b.customerName ?? "", undefined, {
          sensitivity: "base",
        }),
      );
      setOrders(nextOrders);
      setSelectedOrderId((prev) => {
        if (prev && nextOrders.some((order) => order.id === prev)) {
          return prev;
        }
        return null;
      });
    } catch {
      setOrders([]);
      setSelectedOrderId(null);
    } finally {
      setListLoading(false);
    }
  }, [dateKey, dispatch, selectedStoreLocationId, selectedTimeslotId]);

  const loadAvailableBoxes = useCallback(async () => {
    setBoxesLoading(true);
    try {
      const response = await dispatch(getAvailableBoxes("")).unwrap();
      setAvailableBoxes(response.data);
    } catch {
      setAvailableBoxes([]);
    } finally {
      setBoxesLoading(false);
    }
  }, [dispatch]);

  useFocusEffect(
    useCallback(() => {
      void loadSettings();
      void loadOrders();
    }, [loadSettings, loadOrders]),
  );

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    if (!selectedOrderId) {
      setAvailableBoxes([]);
      return;
    }
    void loadAvailableBoxes();
  }, [selectedOrderId, loadAvailableBoxes]);

  useEffect(() => {
    setSelectedBoxIds([]);
    setBoxSearch("");
  }, [selectedOrderId]);

  const onDateChange = (_event: DateTimePickerChangeEvent, selected?: Date) => {
    if (Platform.OS !== "ios") {
      setShowDatePicker(false);
    }

    if (!selected) {
      return;
    }

    setSelectedDate(selected);
  };

  const selectTimeslot = (timeslotId: string | null) => {
    if (isSubmitting) {
      return;
    }
    setSelectedTimeslotId(timeslotId);
  };

  const selectStoreLocation = (storeLocationId: string | null) => {
    if (isSubmitting) {
      return;
    }
    setSelectedStoreLocationId(storeLocationId);
    setLocationModalOpen(false);
  };

  const selectedLocationLabel =
    selectedStoreLocationId == null
      ? "All"
      : storeLocationNames[selectedStoreLocationId] ?? "All";

  const locationOptions = useMemo(
    () => [{ id: null as string | null, name: "All" }, ...storeLocations.map((l) => ({ id: l.id as string | null, name: l.name }))],
    [storeLocations],
  );

  const handleNumpadPress = (key: string) => {
    if (isSubmitting) {
      return;
    }

    if (key === "C") {
      setBoxSearch("");
      return;
    }

    if (key === "back") {
      setBoxSearch((prev) => prev.slice(0, -1));
      return;
    }

    setBoxSearch((prev) => {
      if (prev.length >= BOX_SEARCH_MAX_LENGTH) {
        return prev;
      }
      return `${prev}${key}`;
    });
  };

  const toggleGiveBox = (boxId: string) => {
    if (isSubmitting || !selectedOrder) {
      return;
    }

    let shouldClearSearch = false;

    setSelectedBoxIds((prev) => {
      if (prev.includes(boxId)) {
        return prev.filter((id) => id !== boxId);
      }

      if (prev.length >= maxSelectedBoxes) {
        Alert.alert(
          "Selection limit",
          `This order has ${maxSelectedBoxes} meal(s). You can select up to ${maxSelectedBoxes} box(es).`,
        );
        return prev;
      }

      shouldClearSearch = true;
      return [...prev, boxId];
    });

    if (shouldClearSearch) {
      setBoxSearch("");
    }
  };

  const removeGiveBox = (boxId: string) => {
    if (isSubmitting) {
      return;
    }
    setSelectedBoxIds((prev) => prev.filter((id) => id !== boxId));
  };

  const handleGiveSubmit = async () => {
    if (isSubmitting || !selectedOrder) {
      return;
    }

    if (selectedBoxIds.length === 0) {
      Alert.alert("No box selected", "Please select at least one box.");
      return;
    }

    const customerName = selectedOrder.customerName?.trim() ?? "";
    if (!customerName) {
      Alert.alert("Missing customer", "This order has no customer name.");
      return;
    }

    setIsSubmitting(true);

    try {
      const checkoutDateIso = selectedDate.toISOString();
      const results: { ok: boolean; message: string }[] = [];

      for (const id of selectedBoxIds) {
        try {
          await dispatch(
            checkoutBox({
              boxId: normalizeBoxId(id),
              customerName,
              checkoutDate: checkoutDateIso,
            }),
          ).unwrap();
          results.push({ ok: true, message: "" });
        } catch (error) {
          results.push({ ok: false, message: getErrorMessage(error) });
        }
      }

      void loadAvailableBoxes();

      const failed = results.filter((result) => !result.ok);
      if (failed.length === 0) {
        Alert.alert("Success", `${selectedBoxIds.length} box(es) checked out to ${customerName}.`);
        setSelectedBoxIds([]);
      } else {
        Alert.alert("Partial error", failed.map((result) => result.message).join("\n"));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const resolveTimeslotLabel = (timeslotId: string) =>
    timeslots.find((slot) => slot.id === timeslotId)?.label ?? timeslotId;

  const resolveLocationLabel = (storeLocationId: string) =>
    storeLocationNames[storeLocationId] ?? storeLocationId;

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.container}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoidingView}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View pointerEvents={isSubmitting ? "none" : "auto"} style={styles.mainContent}>
            <View style={styles.leftColumn}>
              <View style={styles.filterCard}>
                <View style={styles.filterRow}>
                  <View style={styles.dateField}>
                    <Text style={styles.label}>Date</Text>
                    <Pressable
                      disabled={isSubmitting}
                      style={styles.dateSelector}
                      onPress={() => setShowDatePicker(true)}
                    >
                      <Text style={styles.dateSelectorText}>{dateKey}</Text>
                      <Ionicons name="calendar-outline" size={16} color="#42685D" />
                    </Pressable>
                  </View>

                  <View style={styles.locationField}>
                    <Text style={styles.label}>Location</Text>
                    <Pressable
                      disabled={isSubmitting}
                      style={styles.locationSelector}
                      onPress={() => setLocationModalOpen(true)}
                    >
                      <Text style={styles.locationSelectorText} numberOfLines={1}>
                        {selectedLocationLabel}
                      </Text>
                      <Ionicons name="chevron-down" size={16} color="#42685D" />
                    </Pressable>
                  </View>
                </View>

                <View style={styles.timeslotField}>
                  <Text style={styles.label}>Pickup Timeslot</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.timeslotRow}
                    keyboardShouldPersistTaps="handled"
                  >
                    <Pressable
                      disabled={isSubmitting}
                      style={[
                        styles.timeslotChip,
                        selectedTimeslotId === null ? styles.timeslotChipActive : undefined,
                      ]}
                      onPress={() => selectTimeslot(null)}
                    >
                      <Text
                        style={[
                          styles.timeslotChipText,
                          selectedTimeslotId === null ? styles.timeslotChipTextActive : undefined,
                        ]}
                      >
                        All
                      </Text>
                    </Pressable>
                    {timeslots.map((slot) => {
                      const isActive = selectedTimeslotId === slot.id;
                      return (
                        <Pressable
                          key={slot.id}
                          disabled={isSubmitting}
                          style={[
                            styles.timeslotChip,
                            isActive ? styles.timeslotChipActive : undefined,
                          ]}
                          onPress={() => selectTimeslot(slot.id)}
                        >
                          <Text
                            style={[
                              styles.timeslotChipText,
                              isActive ? styles.timeslotChipTextActive : undefined,
                            ]}
                          >
                            {slot.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>

                {showDatePicker ? (
                  <DateTimePicker
                    value={selectedDate}
                    mode="date"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    onValueChange={onDateChange}
                    onDismiss={() => setShowDatePicker(false)}
                  />
                ) : null}
              </View>

              <View style={styles.listCard}>
                <View style={styles.listHeaderRow}>
                  <Text style={styles.sectionTitle}>
                    Customers ({filteredOrders.length})
                  </Text>
                  <View style={styles.customerSearchWrap}>
                    <TextInput
                      value={customerSearch}
                      onChangeText={setCustomerSearch}
                      editable={!isSubmitting}
                      placeholder="Name / phone"
                      placeholderTextColor="#7A8F87"
                      style={[styles.input, styles.customerSearchInput]}
                    />
                    {customerSearch ? (
                      <Pressable
                        disabled={isSubmitting}
                        style={styles.customerSearchClear}
                        onPress={() => setCustomerSearch("")}
                      >
                        <Ionicons name="close-circle" size={18} color="#7A8F87" />
                      </Pressable>
                    ) : null}
                  </View>
                </View>
                <FlatList
                  data={filteredOrders}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.listContent}
                  keyboardShouldPersistTaps="handled"
                  initialNumToRender={12}
                  maxToRenderPerBatch={12}
                  windowSize={7}
                  removeClippedSubviews
                  ListEmptyComponent={
                    listLoading ? (
                      <View style={styles.emptyState}>
                        <ActivityIndicator size="large" color="#0D7A4E" />
                      </View>
                    ) : (
                      <View style={styles.emptyState}>
                        <Ionicons name="receipt-outline" size={36} color="#0D7A4E" />
                        <Text style={styles.emptyTitle}>No orders</Text>
                        <Text style={styles.emptyText}>
                          {customerSearch.trim()
                            ? "No customers match this name or phone."
                            : `No customers ordered on this day${
                                selectedTimeslotId ? " for the selected timeslot" : ""
                              }.`}
                        </Text>
                      </View>
                    )
                  }
                  renderItem={({ item }) => {
                    const isSelected = selectedOrderId === item.id;
                    return (
                      <Pressable
                        style={[styles.orderItem, isSelected ? styles.selectedItem : null]}
                        onPress={() => setSelectedOrderId(item.id)}
                      >
                        <View style={styles.orderIdentity}>
                          <View style={styles.orderNameRow}>
                            <Text style={styles.orderName} numberOfLines={1}>
                              {item.customerName || "Unknown customer"}
                            </Text>
                            <Text style={styles.orderSub} numberOfLines={1}>
                              {item.customerPhone || "No phone"}
                            </Text>
                          </View>
                          <Text style={styles.orderSub} numberOfLines={1}>
                            {resolveLocationLabel(item.storeLocationId)} ·{" "}
                            {resolveTimeslotLabel(item.timeslotId)} · {item.meals.length} meal
                            {item.meals.length === 1 ? "" : "s"} ·{" "}
                            {formatCurrency(item.totalAmount)}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color="#7A8F87" />
                      </Pressable>
                    );
                  }}
                />
              </View>
            </View>

            <View style={styles.detailsCard}>
              <Text style={styles.sectionTitle}>Order Details</Text>

              <ScrollView
                style={styles.detailsScroll}
                contentContainerStyle={styles.detailsBody}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {!selectedOrder ? (
                  <View style={styles.detailsEmptyState}>
                    <Ionicons name="information-circle-outline" size={30} color="#7A8F87" />
                    <Text style={styles.detailsEmptyText}>
                      Select a customer to view order details.
                    </Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.identityBlock}>
                      <View style={styles.panelNameRow}>
                        <Text style={styles.panelName} numberOfLines={1}>
                          {selectedOrder.customerName || "Unknown customer"}
                        </Text>
                        <Text style={styles.identitySubText} numberOfLines={1}>
                          {selectedOrder.customerPhone || "No phone"}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.mealsWrap}>
                      {selectedOrder.meals.map((meal, index) => (
                        <View key={`${selectedOrder.id}-meal-${index}`} style={styles.mealCard}>
                          <Text style={styles.mealTitle}>Meal {index + 1}</Text>
                          {meal.addons.length === 0 ? (
                            <Text style={styles.mealAddonEmpty}>Basic</Text>
                          ) : (
                            <View style={styles.addonWrap}>
                              {meal.addons.map((addon) => (
                                <View key={`${index}-${addon}`} style={styles.addonTag}>
                                  <Text style={styles.addonTagText}>{formatAddonLabel(addon)}</Text>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      ))}
                    </View>

                    <View style={styles.giveBoxSection}>
                      <View style={styles.labelRow}>
                        <Text style={styles.label}>
                          Give Box ({selectedBoxIds.length}/{maxSelectedBoxes})
                        </Text>
                        {selectedBoxIds.length > 0 ? (
                          <Pressable disabled={isSubmitting} onPress={() => setSelectedBoxIds([])}>
                            <Text style={styles.clearAllText}>Clear All</Text>
                          </Pressable>
                        ) : null}
                      </View>

                      <View style={styles.selectedBoxesArea}>
                        {selectedBoxIds.length === 0 ? (
                          <Text style={styles.tagPlaceholder}>Tap boxes below to select</Text>
                        ) : (
                          <View style={styles.tagContainer}>
                            {selectedBoxIds.map((id) => (
                              <Pressable
                                key={id}
                                disabled={isSubmitting}
                                style={styles.tag}
                                onPress={() => removeGiveBox(id)}
                              >
                                <Text style={styles.tagText}>{id.replace("BOX-", "")}</Text>
                                <Ionicons
                                  name="close"
                                  size={12}
                                  color="#0B5D44"
                                  style={styles.tagIcon}
                                />
                              </Pressable>
                            ))}
                          </View>
                        )}
                      </View>

                      <View style={styles.boxSearchWorkArea}>
                        <View style={styles.boxSearchLeft}>
                          <View style={styles.boxSearchDisplay}>
                            <Text
                              style={[
                                styles.boxSearchDisplayText,
                                !boxSearch ? styles.boxSearchDisplayPlaceholder : undefined,
                              ]}
                              numberOfLines={1}
                            >
                              {boxSearch || "Box ID"}
                            </Text>
                            {boxSearch ? (
                              <Pressable
                                disabled={isSubmitting}
                                hitSlop={8}
                                onPress={() => setBoxSearch("")}
                              >
                                <Ionicons name="close-circle" size={18} color="#7A8F87" />
                              </Pressable>
                            ) : (
                              <Ionicons name="keypad-outline" size={18} color="#7A8F87" />
                            )}
                          </View>

                          <Text style={styles.availableBoxesLabel}>
                            Available ({displayedAvailableBoxes.length}
                            {filteredAvailableBoxes.length > displayedAvailableBoxes.length
                              ? `/${filteredAvailableBoxes.length}`
                              : ""}
                            )
                          </Text>

                          <View style={styles.boxChipGridArea}>
                            {boxesLoading ? (
                              <ActivityIndicator size="small" color="#0D7A4E" />
                            ) : displayedAvailableBoxes.length === 0 ? (
                              <View style={styles.boxesEmptyState}>
                                <Ionicons name="cube-outline" size={22} color="#7A8F87" />
                                <Text style={styles.emptyText}>No available boxes</Text>
                              </View>
                            ) : (
                              <ScrollView
                                style={styles.boxChipScroll}
                                contentContainerStyle={styles.boxChipGrid}
                                showsVerticalScrollIndicator={false}
                                nestedScrollEnabled
                                keyboardShouldPersistTaps="handled"
                              >
                                {displayedAvailableBoxes.map((box) => {
                                  const isSelected = selectedBoxIds.includes(box.id);
                                  return (
                                    <Pressable
                                      key={box.id}
                                      disabled={isSubmitting}
                                      onPress={() => toggleGiveBox(box.id)}
                                      style={[
                                        styles.boxChip,
                                        isSelected ? styles.boxChipActive : undefined,
                                      ]}
                                    >
                                      <Text
                                        style={[
                                          styles.boxChipText,
                                          isSelected ? styles.boxChipTextActive : undefined,
                                        ]}
                                        numberOfLines={1}
                                      >
                                        {box.id.replace("BOX-", "")}
                                      </Text>
                                    </Pressable>
                                  );
                                })}
                              </ScrollView>
                            )}
                          </View>
                        </View>

                        <View style={styles.numpad}>
                          {NUMPAD_ROWS.map((row) => (
                            <View key={row.join("-")} style={styles.numpadRow}>
                              {row.map((key) => {
                                const isAction = key === "C" || key === "back";
                                return (
                                  <Pressable
                                    key={key}
                                    disabled={isSubmitting}
                                    onPress={() => handleNumpadPress(key)}
                                    style={({ pressed }) => [
                                      styles.numpadKey,
                                      isAction ? styles.numpadKeyAction : undefined,
                                      pressed ? styles.numpadKeyPressed : undefined,
                                    ]}
                                  >
                                    {key === "back" ? (
                                      <Ionicons name="backspace-outline" size={15} color="#0B3D2E" />
                                    ) : (
                                      <Text
                                        style={[
                                          styles.numpadKeyText,
                                          isAction ? styles.numpadKeyActionText : undefined,
                                        ]}
                                      >
                                        {key}
                                      </Text>
                                    )}
                                  </Pressable>
                                );
                              })}
                            </View>
                          ))}
                        </View>
                      </View>
                    </View>
                  </>
                )}
              </ScrollView>

              {selectedOrder ? (
                <Pressable
                  disabled={isSubmitting}
                  style={[
                    styles.submitButton,
                    isSubmitting ? styles.submitButtonDisabled : undefined,
                  ]}
                  onPress={handleGiveSubmit}
                >
                  <Text style={styles.submitButtonText}>Confirm Give Box</Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          {isSubmitting ? (
            <View style={styles.loadingOverlay}>
              <View style={styles.loadingCard}>
                <ActivityIndicator size="large" color="#0D7A4E" />
                <Text style={styles.loadingOverlayTitle}>Processing check-out...</Text>
                <Text style={styles.loadingOverlayText}>
                  Please wait until all selected boxes are updated.
                </Text>
              </View>
            </View>
          ) : null}
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>

      <Modal
        transparent
        visible={locationModalOpen}
        animationType="fade"
        onRequestClose={() => setLocationModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setLocationModalOpen(false)}
          />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Location</Text>
            <FlatList
              data={locationOptions}
              keyExtractor={(item) => item.id ?? "all"}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <Text style={styles.emptyText}>No store locations found.</Text>
              }
              renderItem={({ item }) => {
                const isActive = selectedStoreLocationId === item.id;
                return (
                  <Pressable
                    style={[styles.modalOption, isActive ? styles.modalOptionActive : undefined]}
                    onPress={() => selectStoreLocation(item.id)}
                  >
                    <Text
                      style={[
                        styles.modalOptionText,
                        isActive ? styles.modalOptionTextActive : undefined,
                      ]}
                    >
                      {item.name}
                    </Text>
                    {isActive ? <Ionicons name="checkmark" size={18} color="#0D7A4E" /> : null}
                  </Pressable>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F8F7",
    padding: 16,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  mainContent: {
    flex: 1,
    flexDirection: "row",
    gap: 12,
  },
  leftColumn: {
    flex: 1.15,
    gap: 12,
  },
  filterCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DDEBE6",
    padding: 14,
    gap: 8,
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  dateField: {
    flex: 1,
    gap: 6,
    minWidth: 0,
  },
  locationField: {
    flex: 1,
    gap: 6,
    minWidth: 0,
  },
  timeslotField: {
    gap: 6,
  },
  locationSelector: {
    borderWidth: 1,
    borderColor: "#C6D6D0",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  locationSelectorText: {
    flex: 1,
    color: "#1E2A26",
    fontWeight: "600",
    fontSize: 14,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(11, 61, 46, 0.35)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    maxHeight: "70%",
    gap: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0B3D2E",
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#E2EEE9",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
    backgroundColor: "#FAFCFB",
  },
  modalOptionActive: {
    borderColor: "#0D7A4E",
    backgroundColor: "#E8F6EF",
  },
  modalOptionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#0B3D2E",
  },
  modalOptionTextActive: {
    color: "#0D7A4E",
  },
  listCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DDEBE6",
    padding: 14,
  },
  listHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  customerSearchWrap: {
    flex: 1,
    position: "relative",
    justifyContent: "center",
    minWidth: 0,
  },
  customerSearchInput: {
    paddingVertical: 8,
    paddingRight: 36,
  },
  customerSearchClear: {
    position: "absolute",
    right: 10,
    height: "100%",
    justifyContent: "center",
  },
  listContent: {
    paddingBottom: 8,
    flexGrow: 1,
  },
  detailsCard: {
    flex: 1.05,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DDEBE6",
    padding: 14,
  },
  detailsScroll: {
    flex: 1,
    marginTop: 6,
  },
  detailsBody: {
    paddingBottom: 12,
    gap: 8,
    flexGrow: 1,
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
  timeslotRow: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 2,
  },
  timeslotChip: {
    borderWidth: 1,
    borderColor: "#C6D6D0",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "#FFFFFF",
  },
  timeslotChipActive: {
    backgroundColor: "#0D7A4E",
    borderColor: "#0D7A4E",
  },
  timeslotChipText: {
    color: "#39584F",
    fontWeight: "700",
    fontSize: 12,
  },
  timeslotChipTextActive: {
    color: "#FFFFFF",
  },
  orderItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#E2EEE9",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    backgroundColor: "#FAFCFB",
  },
  selectedItem: {
    borderColor: "#0D7A4E",
    backgroundColor: "#E8F6EF",
  },
  orderIdentity: {
    flex: 1,
    marginRight: 8,
    gap: 2,
  },
  orderNameRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    flexWrap: "wrap",
  },
  orderName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0B3D2E",
    flexShrink: 1,
  },
  orderSub: {
    fontSize: 12,
    color: "#60726A",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0B3D2E",
  },
  emptyText: {
    fontSize: 13,
    color: "#7A8F87",
    textAlign: "center",
  },
  detailsEmptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    gap: 8,
  },
  detailsEmptyText: {
    fontSize: 13,
    color: "#7A8F87",
    textAlign: "center",
  },
  identityBlock: {
    gap: 0,
  },
  panelNameRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    flexWrap: "wrap",
  },
  panelName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0B3D2E",
    flexShrink: 1,
  },
  identitySubText: {
    fontSize: 12,
    color: "#60726A",
  },
  mealsWrap: {
    flexDirection: "row",
    gap: 6,
  },
  mealCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E2EEE9",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: "#FAFCFB",
    gap: 4,
  },
  mealTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0B3D2E",
  },
  mealAddonEmpty: {
    fontSize: 11,
    color: "#7A8F87",
  },
  addonWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  addonTag: {
    backgroundColor: "#E0F2EA",
    borderWidth: 1,
    borderColor: "#A8D8C0",
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  addonTagText: {
    color: "#0B5D44",
    fontWeight: "700",
    fontSize: 10,
  },
  giveBoxSection: {
    marginTop: 2,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "#E2EEE9",
    paddingTop: 10,
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
  selectedBoxesArea: {
    height: 44,
    borderWidth: 1,
    borderColor: "#C6D6D0",
    borderRadius: 10,
    backgroundColor: "#FAFCFB",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  boxSearchWorkArea: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
  },
  boxSearchLeft: {
    flex: 1,
    gap: 6,
    minWidth: 0,
  },
  boxSearchDisplay: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#C6D6D0",
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#FFFFFF",
    gap: 8,
    height: 34,
  },
  boxSearchDisplayText: {
    flex: 1,
    color: "#1E2A26",
    fontWeight: "700",
    fontSize: 15,
    letterSpacing: 1,
  },
  boxSearchDisplayPlaceholder: {
    color: "#7A8F87",
    fontWeight: "600",
    letterSpacing: 0,
    fontSize: 12,
  },
  numpad: {
    width: 148,
    gap: 4,
    flexShrink: 0,
  },
  numpadRow: {
    flexDirection: "row",
    gap: 4,
    height: 48,
  },
  numpadKey: {
    flex: 1,
    height: 48,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "#C6D6D0",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  numpadKeyAction: {
    backgroundColor: "#E8F6EF",
    borderColor: "#A8D8C0",
  },
  numpadKeyPressed: {
    backgroundColor: "#D7EEE4",
  },
  numpadKeyText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0B3D2E",
  },
  numpadKeyActionText: {
    fontSize: 12,
    color: "#0D7A4E",
  },
  tagContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    alignSelf: "stretch",
    gap: 6,
    paddingHorizontal: 10,
  },
  tagPlaceholder: {
    color: "#7A8F87",
    fontSize: 13,
    textAlign: "center",
    width: "100%",
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
  input: {
    borderWidth: 1,
    borderColor: "#C6D6D0",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#FFFFFF",
    color: "#1E2A26",
  },
  availableBoxesLabel: {
    fontSize: 12,
    color: "#39584F",
    fontWeight: "600",
  },
  boxChipGridArea: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E2EEE9",
    borderRadius: 10,
    backgroundColor: "#FAFCFB",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  boxChipScroll: {
    flex: 1,
    alignSelf: "stretch",
  },
  boxesEmptyState: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 8,
  },
  boxChipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    padding: 6,
  },
  boxChip: {
    width: "30%",
    minWidth: 52,
    borderWidth: 1,
    borderColor: "#C6D6D0",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  boxChipActive: {
    backgroundColor: "#0D7A4E",
    borderColor: "#0D7A4E",
  },
  boxChipText: {
    color: "#0B3D2E",
    fontWeight: "700",
    fontSize: 12,
  },
  boxChipTextActive: {
    color: "#FFFFFF",
  },
  submitButton: {
    marginTop: 10,
    backgroundColor: "#0D7A4E",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(11, 61, 46, 0.28)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 20,
    paddingHorizontal: 24,
    alignItems: "center",
    gap: 8,
    maxWidth: 320,
  },
  loadingOverlayTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0B3D2E",
  },
  loadingOverlayText: {
    fontSize: 13,
    color: "#60726A",
    textAlign: "center",
  },
});
