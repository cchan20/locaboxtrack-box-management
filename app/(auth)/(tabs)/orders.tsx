import { useAppDispatch } from "@/store/hooks";
import { checkinBox, checkoutBox, getAvailableBoxes } from "@/store/slices/boxSlice";
import { getDailyMeals } from "@/store/slices/dailyMealSlice";
import {
  cancelOrderForCustomer,
  getOrders,
  markOrderPicked,
} from "@/store/slices/orderSlice";
import { getGlobalSettings } from "@/store/slices/settingsSlice";
import { Box, DailyMeal, Order, StoreLocation, Timeslot } from "@/types/app";
import { ClearableTextInput } from "@/ui/ClearableTextInput";
import { HeaderActionsWithCreate } from "@/ui/HeaderActionsWithCreate";
import { getErrorMessage } from "@/utils/apiError";
import { normalizeBoxId } from "@/utils/boxId";
import { buildOrdersCsv } from "@/utils/orderCsv";
import { addonLabelFromMeal } from "@/utils/orderWeek";
import DateTimePicker, { DateTimePickerChangeEvent } from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import { useFocusEffect, useLocalSearchParams, useNavigation } from "expo-router";
import * as Sharing from "expo-sharing";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const ORDER_STATUS_LABELS: Record<string, string> = {
  confirmed: "Confirmed",
  picked: "Picked",
  cancelled: "Cancelled",
};

const ORDER_STATUS_FILTERS = [
  { key: null as string | null, label: "All" },
  { key: "confirmed", label: "Confirmed" },
  { key: "picked", label: "Picked" },
  { key: "cancelled", label: "Cancelled" },
] as const;

type OrderListRow =
  | { type: "orders"; key: string; left: Order; right?: Order }
  | { type: "separator"; key: string };

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

function parseDateKey(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || !month || !day) {
    return null;
  }
  return new Date(year, month - 1, day);
}

function formatCurrency(amount: number) {
  return `$${amount.toFixed(2)}`;
}

function formatOrderStatus(status: string) {
  return ORDER_STATUS_LABELS[status] ?? status;
}

function sortOrdersByTimeslot(orders: Order[], timeslots: Timeslot[]) {
  const timeslotStartById = new Map(
    timeslots.map((slot) => [slot.id, slot.startTime] as const),
  );
  return [...orders].sort((a, b) => {
    const aStart = timeslotStartById.get(a.timeslotId) ?? "";
    const bStart = timeslotStartById.get(b.timeslotId) ?? "";
    const timeslotCompare = aStart.localeCompare(bStart);
    if (timeslotCompare !== 0) {
      return timeslotCompare;
    }
    return (a.customerName ?? "").localeCompare(b.customerName ?? "", undefined, {
      sensitivity: "base",
    });
  });
}

export default function OrdersScreen() {
  const dispatch = useAppDispatch();
  const navigation = useNavigation();
  const { date: dateParam } = useLocalSearchParams<{ date?: string | string[] }>();

  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedTimeslotId, setSelectedTimeslotId] = useState<string | null>(null);
  const [selectedStoreLocationId, setSelectedStoreLocationId] = useState<string | null>(null);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [timeslots, setTimeslots] = useState<Timeslot[]>([]);
  const [storeLocations, setStoreLocations] = useState<StoreLocation[]>([]);
  const [storeLocationNames, setStoreLocationNames] = useState<Record<string, string>>({});

  const [orders, setOrders] = useState<Order[]>([]);
  const [dayMeal, setDayMeal] = useState<DailyMeal | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);

  const [availableBoxes, setAvailableBoxes] = useState<Box[]>([]);
  const [boxSearch, setBoxSearch] = useState("");
  const [selectedBoxIds, setSelectedBoxIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMode, setSubmitMode] = useState<"checkout" | "update" | "cancel" | null>(null);
  const [boxesLoading, setBoxesLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [boxMismatchConfirmOpen, setBoxMismatchConfirmOpen] = useState(false);
  const timeslotsRef = useRef(timeslots);
  timeslotsRef.current = timeslots;
  const handleExportOrdersRef = useRef<() => Promise<void>>(async () => {});
  const exportDisabledRef = useRef(false);

  const filteredOrders = useMemo(() => {
    const query = customerSearch.trim().toLowerCase();

    return orders.filter((order) => {
      if (selectedStatus && order.status !== selectedStatus) {
        return false;
      }
      if (!query) {
        return true;
      }
      const name = (order.customerName ?? "").toLowerCase();
      const phone = (order.customerPhone ?? "").toLowerCase();
      return name.includes(query) || phone.includes(query);
    });
  }, [customerSearch, orders, selectedStatus]);

  const orderListRows = useMemo((): OrderListRow[] => {
    if (filteredOrders.length === 0) {
      return [];
    }

    const groups: Order[][] = [];
    for (const order of filteredOrders) {
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup[0].timeslotId === order.timeslotId) {
        lastGroup.push(order);
      } else {
        groups.push([order]);
      }
    }

    const rows: OrderListRow[] = [];
    groups.forEach((group, groupIndex) => {
      if (groupIndex > 0) {
        rows.push({ type: "separator", key: `sep-${group[0].timeslotId}-${groupIndex}` });
      }
      for (let i = 0; i < group.length; i += 2) {
        rows.push({
          type: "orders",
          key: `row-${group[i].id}`,
          left: group[i],
          right: group[i + 1],
        });
      }
    });
    return rows;
  }, [filteredOrders]);

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedOrderId) ?? null,
    [orders, selectedOrderId],
  );

  const detailsModalOpen = selectedOrderId != null;

  const maxSelectedBoxes = useMemo(() => {
    if (!selectedOrder) {
      return 2;
    }
    return Math.max(selectedOrder.meals.length, 1);
  }, [selectedOrder]);

  const selectableBoxes = useMemo(() => {
    const byId = new Map<string, Box>();
    for (const box of availableBoxes) {
      byId.set(box.id, box);
    }
    for (const id of selectedBoxIds) {
      if (!byId.has(id)) {
        byId.set(id, {
          id,
          status: "checked-out",
          customerId: null,
          customerName: null,
          dateOut: null,
        });
      }
    }
    const selectedSet = new Set(selectedBoxIds);
    const selected: Box[] = [];
    const rest: Box[] = [];
    for (const box of byId.values()) {
      if (selectedSet.has(box.id)) {
        selected.push(box);
      } else {
        rest.push(box);
      }
    }
    return [...selected, ...rest];
  }, [availableBoxes, selectedBoxIds]);

  const filteredAvailableBoxes = useMemo(() => {
    const query = boxSearch.trim().toLowerCase();
    if (!query) {
      return selectableBoxes;
    }

    return selectableBoxes.filter((box) => {
      const id = box.id.toLowerCase();
      const bareId = id.replace(/^box-/, "");
      return id.includes(query) || bareId.includes(query);
    });
  }, [boxSearch, selectableBoxes]);

  const displayedAvailableBoxes = useMemo(
    () => filteredAvailableBoxes.slice(0, 9),
    [filteredAvailableBoxes],
  );

  const dateKey = formatDateLabel(selectedDate);
  const formatAddonLabel = useCallback(
    (addon: string) => addonLabelFromMeal(addon, dayMeal),
    [dayMeal],
  );

  useEffect(() => {
    const rawDate = Array.isArray(dateParam) ? dateParam[0] : dateParam;
    if (!rawDate) {
      return;
    }

    const nextDate = parseDateKey(rawDate);
    if (!nextDate) {
      return;
    }

    setSelectedDate(nextDate);
    setSelectedTimeslotId(null);
    setSelectedStoreLocationId(null);
    setSelectedStatus(null);
    setSelectedOrderId(null);
    setCustomerSearch("");
  }, [dateParam]);

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
      const [response, mealsResponse] = await Promise.all([
        dispatch(
          getOrders({
            from: dateKey,
            to: dateKey,
            timeslotId: selectedTimeslotId ?? undefined,
            storeLocationId: selectedStoreLocationId ?? undefined,
          }),
        ).unwrap(),
        dispatch(getDailyMeals({ from: dateKey, to: dateKey })).unwrap(),
      ]);

      const nextOrders = sortOrdersByTimeslot(response.data, timeslotsRef.current);
      setOrders(nextOrders);
      setDayMeal(mealsResponse.data.find((meal) => meal.date === dateKey) ?? null);
      setSelectedOrderId((prev) => {
        if (prev && nextOrders.some((order) => order.id === prev)) {
          return prev;
        }
        return null;
      });
    } catch {
      setOrders([]);
      setDayMeal(null);
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

  // Re-sort locally when timeslots arrive so we don't refetch (and flicker Export).
  useEffect(() => {
    setOrders((prev) => {
      if (prev.length === 0 || timeslots.length === 0) {
        return prev;
      }
      return sortOrdersByTimeslot(prev, timeslots);
    });
  }, [timeslots]);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        await loadSettings();
        await loadOrders();
      })();
    }, [loadSettings, loadOrders]),
  );

  useEffect(() => {
    if (!selectedOrderId) {
      setAvailableBoxes([]);
      return;
    }
    void loadAvailableBoxes();
  }, [selectedOrderId, loadAvailableBoxes]);

  useEffect(() => {
    setBoxSearch("");
    if (!selectedOrderId) {
      setSelectedBoxIds([]);
      return;
    }
    const order = orders.find((item) => item.id === selectedOrderId);
    if (order?.status === "picked") {
      setSelectedBoxIds([...(order.pickedBoxIds ?? [])]);
      return;
    }
    setSelectedBoxIds([]);
    // Only re-init when opening a different order — not when the list refreshes mid-edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- orders intentionally omitted
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

  const selectStatus = (status: string | null) => {
    if (isSubmitting) {
      return;
    }
    setSelectedStatus(status);
  };

  const closeDetailsModal = () => {
    if (isSubmitting) {
      return;
    }
    setBoxMismatchConfirmOpen(false);
    setSelectedOrderId(null);
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

  const applyPickedOrderUpdate = (
    orderId: string,
    updated: Order,
    fallbackBoxIds: string[],
  ) => {
    setOrders((prev) =>
      prev.map((order) =>
        order.id === orderId
          ? {
              ...order,
              ...updated,
              status: "picked",
              pickedBoxIds: updated.pickedBoxIds ?? fallbackBoxIds,
            }
          : order,
      ),
    );
    setSelectedBoxIds([]);
    setSelectedOrderId(null);
  };

  const performGiveSubmit = async () => {
    if (isSubmitting || !selectedOrder) {
      return;
    }

    if (selectedOrder.status !== "confirmed" && selectedOrder.status !== "picked") {
      Alert.alert("Unavailable", "Only confirmed or picked orders can update boxes.");
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

    const nextBoxIds = selectedBoxIds.map((id) => normalizeBoxId(id)).filter(Boolean);
    if (nextBoxIds.length === 0) {
      Alert.alert("No box selected", "Please select at least one box.");
      return;
    }

    const isUpdate = selectedOrder.status === "picked";
    const previousBoxIds = (selectedOrder.pickedBoxIds ?? []).map((id) => normalizeBoxId(id));
    const previousSet = new Set(previousBoxIds);
    const nextSet = new Set(nextBoxIds);
    const toCheckIn = previousBoxIds.filter((id) => !nextSet.has(id));
    const toCheckOut = nextBoxIds.filter((id) => !previousSet.has(id));

    if (isUpdate && toCheckIn.length === 0 && toCheckOut.length === 0) {
      setSelectedOrderId(null);
      return;
    }

    setIsSubmitting(true);
    setSubmitMode(isUpdate ? "update" : "checkout");

    try {
      const checkoutDateIso = selectedDate.toISOString();
      const errors: string[] = [];

      for (const id of toCheckIn) {
        try {
          await dispatch(checkinBox({ boxId: id })).unwrap();
        } catch (error) {
          errors.push(`Check-in ${id.replace("BOX-", "")}: ${getErrorMessage(error)}`);
        }
      }

      for (const id of toCheckOut) {
        try {
          await dispatch(
            checkoutBox({
              boxId: id,
              customerName,
              checkoutDate: checkoutDateIso,
            }),
          ).unwrap();
        } catch (error) {
          errors.push(`Check-out ${id.replace("BOX-", "")}: ${getErrorMessage(error)}`);
        }
      }

      void loadAvailableBoxes();

      if (errors.length > 0) {
        Alert.alert("Box update error", errors.join("\n"));
        return;
      }

      try {
        const pickedResponse = await dispatch(
          markOrderPicked({
            customerId: selectedOrder.customerId,
            date: selectedOrder.date,
            orderId: selectedOrder.id,
            boxIds: nextBoxIds,
          }),
        ).unwrap();
        applyPickedOrderUpdate(selectedOrder.id, pickedResponse.data, nextBoxIds);
      } catch (error) {
        Alert.alert(
          "Partial success",
          `Box transactions were applied, but updating the order failed: ${getErrorMessage(error)}`,
        );
      }
    } finally {
      setIsSubmitting(false);
      setSubmitMode(null);
    }
  };

  const handleGiveSubmit = () => {
    if (isSubmitting || !selectedOrder) {
      return;
    }

    if (selectedOrder.status !== "confirmed" && selectedOrder.status !== "picked") {
      Alert.alert("Unavailable", "Only confirmed or picked orders can update boxes.");
      return;
    }

    if (selectedBoxIds.length === 0) {
      Alert.alert("No box selected", "Please select at least one box.");
      return;
    }

    const mealCount = selectedOrder.meals.length;
    if (selectedBoxIds.length !== mealCount) {
      setBoxMismatchConfirmOpen(true);
      return;
    }

    void performGiveSubmit();
  };

  const confirmBoxMismatchSubmit = () => {
    setBoxMismatchConfirmOpen(false);
    void performGiveSubmit();
  };

  const handleCancelOrder = () => {
    if (isSubmitting || !selectedOrder) {
      return;
    }

    if (selectedOrder.status !== "confirmed") {
      Alert.alert("Unavailable", "Only active orders can be cancelled.");
      return;
    }

    const customerName = selectedOrder.customerName?.trim() || "this customer";

    Alert.alert(
      "Cancel order",
      `Cancel the order for ${customerName}? Inventory will be released.`,
      [
        { text: "Keep order", style: "cancel" },
        {
          text: "Cancel order",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setIsSubmitting(true);
              setSubmitMode("cancel");
              try {
                await dispatch(
                  cancelOrderForCustomer({
                    customerId: selectedOrder.customerId,
                    date: selectedOrder.date,
                    orderId: selectedOrder.id,
                  }),
                ).unwrap();
                setOrders((prev) =>
                  prev.map((order) =>
                    order.id === selectedOrder.id
                      ? { ...order, status: "cancelled" }
                      : order,
                  ),
                );
                setSelectedBoxIds([]);
                setSelectedOrderId(null);
              } catch (error) {
                Alert.alert("Cancel failed", getErrorMessage(error));
              } finally {
                setIsSubmitting(false);
                setSubmitMode(null);
              }
            })();
          },
        },
      ],
    );
  };

  const resolveTimeslotLabel = useCallback(
    (timeslotId: string) => timeslots.find((slot) => slot.id === timeslotId)?.label ?? timeslotId,
    [timeslots],
  );

  const resolveLocationLabel = useCallback(
    (storeLocationId: string) => storeLocationNames[storeLocationId] ?? storeLocationId,
    [storeLocationNames],
  );

  const handleExportOrders = useCallback(async () => {
    if (exportDisabledRef.current) {
      return;
    }

    if (filteredOrders.length === 0) {
      Alert.alert("Nothing to export", "There are no orders matching the current filters.");
      return;
    }

    setIsExporting(true);
    try {
      const csv = buildOrdersCsv(filteredOrders, {
        resolveTimeslotLabel,
        resolveLocationLabel,
        resolveDailyMeal: () => dayMeal,
      });

      const cacheDir = FileSystem.cacheDirectory;
      if (!cacheDir) {
        throw new Error("Cache directory is unavailable on this device.");
      }

      const fileUri = `${cacheDir}orders-${dateKey}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csv, {
        encoding: "utf8",
      });

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert(
          "Export ready",
          "CSV was created, but sharing is unavailable on this device.",
        );
        return;
      }

      await Sharing.shareAsync(fileUri, {
        mimeType: "text/csv",
        dialogTitle: `Export orders for ${dateKey}`,
        UTI: "public.comma-separated-values-text",
      });
    } catch (error) {
      Alert.alert("Unable to export", getErrorMessage(error));
    } finally {
      setIsExporting(false);
    }
  }, [dateKey, dayMeal, filteredOrders, resolveLocationLabel, resolveTimeslotLabel]);

  handleExportOrdersRef.current = handleExportOrders;
  exportDisabledRef.current = isExporting || listLoading;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <HeaderActionsWithCreate
          label="Create"
          route="/(auth)/create-order"
          onExport={() => {
            void handleExportOrdersRef.current();
          }}
        />
      ),
    });
  }, [navigation]);

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.container}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoidingView}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View pointerEvents={isSubmitting ? "none" : "auto"} style={styles.mainContent}>
            <View style={styles.filterPanel}>
              <ScrollView
                style={styles.filterCard}
                contentContainerStyle={styles.filterCardContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.filterField}>
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

                <View style={styles.filterField}>
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

                <View style={styles.filterField}>
                  <Text style={styles.label}>Status</Text>
                  <View style={styles.chipWrap}>
                    {ORDER_STATUS_FILTERS.map((filter) => {
                      const isActive = selectedStatus === filter.key;
                      return (
                        <Pressable
                          key={filter.label}
                          disabled={isSubmitting}
                          style={[
                            styles.timeslotChip,
                            isActive ? styles.timeslotChipActive : undefined,
                          ]}
                          onPress={() => selectStatus(filter.key)}
                        >
                          <Text
                            style={[
                              styles.timeslotChipText,
                              isActive ? styles.timeslotChipTextActive : undefined,
                            ]}
                          >
                            {filter.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.filterField}>
                  <Text style={styles.label}>Pickup Timeslot</Text>
                  <View style={styles.chipWrap}>
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
                  </View>
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
              </ScrollView>
            </View>

            <View style={styles.listCard}>
              <View style={styles.listHeaderRow}>
                <Text style={styles.sectionTitle}>
                  Orders ({filteredOrders.length})
                </Text>
                <ClearableTextInput
                  containerStyle={styles.customerSearchWrap}
                  value={customerSearch}
                  onChangeText={setCustomerSearch}
                  editable={!isSubmitting}
                  placeholder="Name / phone"
                  placeholderTextColor="#7A8F87"
                  style={[styles.input, styles.customerSearchInput]}
                />
              </View>
              <FlatList
                data={orderListRows}
                keyExtractor={(item) => item.key}
                contentContainerStyle={styles.listContent}
                keyboardShouldPersistTaps="handled"
                initialNumToRender={16}
                maxToRenderPerBatch={16}
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
                        {customerSearch.trim() || selectedStatus
                          ? "No orders match the current filters."
                          : `No customers ordered on this day${
                              selectedTimeslotId ? " for the selected timeslot" : ""
                            }.`}
                      </Text>
                    </View>
                  )
                }
                renderItem={({ item: row }) => {
                  if (row.type === "separator") {
                    return <View style={styles.timeslotSeparator} />;
                  }

                  const renderOrderCard = (order: Order) => {
                    const isSelected = selectedOrderId === order.id;
                    return (
                      <Pressable
                        style={[styles.orderItem, isSelected ? styles.selectedItem : null]}
                        onPress={() => setSelectedOrderId(order.id)}
                      >
                        <View style={styles.orderIdentity}>
                          <View style={styles.orderNameRow}>
                            {order.status === "picked" ? (
                              <Ionicons name="checkmark-circle" size={18} color="#0D7A4E" />
                            ) : order.status === "cancelled" ? (
                              <Ionicons name="close-circle" size={18} color="#B42318" />
                            ) : null}
                            <Text style={styles.orderName} numberOfLines={1}>
                              {order.customerName || "Unknown customer"}
                            </Text>
                            <Text style={styles.orderSub} numberOfLines={1}>
                              {order.customerPhone || "No phone"}
                            </Text>
                            {order.status === "picked" && order.pickedBoxIds.length > 0 ? (
                              <Text
                                style={[styles.orderSub, styles.orderPickedBoxes]}
                                numberOfLines={1}
                              >
                                Boxes:{" "}
                                {order.pickedBoxIds.map((id) => id.replace("BOX-", "")).join(", ")}
                              </Text>
                            ) : null}
                          </View>
                          <Text style={styles.orderSub} numberOfLines={2}>
                            {resolveLocationLabel(order.storeLocationId)} ·{" "}
                            {resolveTimeslotLabel(order.timeslotId)} · {order.meals.length} meal
                            {order.meals.length === 1 ? "" : "s"} ·{" "}
                            {formatCurrency(order.totalAmount)}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  };

                  return (
                    <View style={styles.orderColumnWrapper}>
                      {renderOrderCard(row.left)}
                      {row.right ? renderOrderCard(row.right) : <View style={styles.orderItemSpacer} />}
                    </View>
                  );
                }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>

      <Modal
        visible={detailsModalOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={closeDetailsModal}
      >
        <SafeAreaView edges={["top", "left", "right", "bottom"]} style={styles.detailsModalSafe}>
          <KeyboardAvoidingView
            style={styles.keyboardAvoidingView}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <View style={styles.detailsModalHeader}>
              <Text style={styles.sectionTitle}>Order Details</Text>
              <Pressable
                disabled={isSubmitting}
                hitSlop={8}
                style={styles.detailsModalClose}
                onPress={closeDetailsModal}
              >
                <Ionicons name="close" size={22} color="#0B3D2E" />
              </Pressable>
            </View>

            {selectedOrder ? (
              <View style={styles.detailsModalBody}>
                <ScrollView
                  style={styles.detailsScroll}
                  contentContainerStyle={styles.detailsBody}
                  showsVerticalScrollIndicator
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                  nestedScrollEnabled
                >
                    <View style={styles.identityBlock}>
                      <View style={styles.panelNameRow}>
                        {selectedOrder.status === "picked" ? (
                          <Ionicons name="checkmark-circle" size={20} color="#0D7A4E" />
                        ) : selectedOrder.status === "cancelled" ? (
                          <Ionicons name="close-circle" size={20} color="#B42318" />
                        ) : null}
                        <Text style={styles.panelName} numberOfLines={1}>
                          {selectedOrder.customerName || "Unknown customer"}
                        </Text>
                        <Text style={styles.identitySubText} numberOfLines={1}>
                          {selectedOrder.customerPhone || "No phone"}
                        </Text>
                        <View
                          style={[
                            styles.statusBadge,
                            selectedOrder.status === "picked"
                              ? styles.statusBadgePicked
                              : selectedOrder.status === "cancelled"
                                ? styles.statusBadgeCancelled
                                : styles.statusBadgeConfirmed,
                          ]}
                        >
                          <Text style={styles.statusBadgeText}>
                            {formatOrderStatus(selectedOrder.status)}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.identitySubText}>
                        {resolveLocationLabel(selectedOrder.storeLocationId)} ·{" "}
                        {resolveTimeslotLabel(selectedOrder.timeslotId)} ·{" "}
                        {formatCurrency(selectedOrder.totalAmount)}
                      </Text>
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

                    {selectedOrder.footnote ? (
                      <View style={styles.footnoteBlock}>
                        <Text style={styles.label}>Footnote</Text>
                        <Text style={styles.footnoteText}>{selectedOrder.footnote}</Text>
                      </View>
                    ) : null}

                    {selectedOrder.status === "confirmed" || selectedOrder.status === "picked" ? (
                      <View style={styles.giveBoxSection}>
                        <View style={styles.labelRow}>
                          <Text style={styles.label}>
                            {selectedOrder.status === "picked" ? "Update Box" : "Give Box"} (
                            {selectedBoxIds.length}/{maxSelectedBoxes})
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
                                <View style={styles.boxChipGrid}>
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
                                </View>
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
                    ) : (
                      <View style={styles.statusNotice}>
                        <Text style={styles.statusNoticeText}>
                          This order is {formatOrderStatus(selectedOrder.status).toLowerCase()}.
                          Box handoff and cancel are unavailable.
                        </Text>
                      </View>
                    )}
                </ScrollView>

                {selectedOrder.status === "confirmed" ? (
                  <View style={styles.actionButtons}>
                    <Pressable
                      disabled={isSubmitting}
                      style={[
                        styles.cancelButton,
                        isSubmitting ? styles.submitButtonDisabled : undefined,
                      ]}
                      onPress={handleCancelOrder}
                    >
                      <Text style={styles.cancelButtonText}>Cancel Order</Text>
                    </Pressable>
                    <Pressable
                      disabled={isSubmitting}
                      style={[
                        styles.submitButton,
                        styles.submitButtonFlex,
                        isSubmitting ? styles.submitButtonDisabled : undefined,
                      ]}
                      onPress={handleGiveSubmit}
                    >
                      <Text style={styles.submitButtonText}>Confirm Give Box</Text>
                    </Pressable>
                  </View>
                ) : selectedOrder.status === "picked" ? (
                  <View style={styles.actionButtons}>
                    <Pressable
                      disabled={isSubmitting}
                      style={[
                        styles.submitButton,
                        styles.submitButtonFlex,
                        isSubmitting ? styles.submitButtonDisabled : undefined,
                      ]}
                      onPress={handleGiveSubmit}
                    >
                      <Text style={styles.submitButtonText}>Update Boxes</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            ) : (
              <View style={styles.detailsEmptyState}>
                <Text style={styles.detailsEmptyText}>Order not found.</Text>
              </View>
            )}

            {isSubmitting ? (
              <View style={styles.loadingOverlay}>
                <View style={styles.loadingCard}>
                  <ActivityIndicator size="large" color="#0D7A4E" />
                  <Text style={styles.loadingOverlayTitle}>
                    {submitMode === "cancel"
                      ? "Cancelling order..."
                      : submitMode === "update"
                        ? "Updating boxes..."
                        : "Processing check-out..."}
                  </Text>
                  <Text style={styles.loadingOverlayText}>
                    {submitMode === "cancel"
                      ? "Please wait while the order is cancelled."
                      : submitMode === "update"
                        ? "Checking in removed boxes and checking out new ones."
                        : "Please wait until all selected boxes are updated."}
                  </Text>
                </View>
              </View>
            ) : null}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

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

      <Modal
        transparent
        visible={boxMismatchConfirmOpen}
        animationType="fade"
        onRequestClose={() => {
          if (!isSubmitting) {
            setBoxMismatchConfirmOpen(false);
          }
        }}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            disabled={isSubmitting}
            onPress={() => setBoxMismatchConfirmOpen(false)}
          />
          <View style={styles.confirmModalCard}>
            <Text style={styles.modalTitle}>Box count mismatch</Text>
            <Text style={styles.confirmModalText}>
              You selected {selectedBoxIds.length} box
              {selectedBoxIds.length === 1 ? "" : "es"}, but this order has{" "}
              {selectedOrder?.meals.length ?? 0} meal
              {(selectedOrder?.meals.length ?? 0) === 1 ? "" : "s"}. Continue anyway?
            </Text>
            <View style={styles.confirmModalActions}>
              <Pressable
                disabled={isSubmitting}
                style={[styles.confirmModalButton, styles.confirmModalCancelButton]}
                onPress={() => setBoxMismatchConfirmOpen(false)}
              >
                <Text style={styles.confirmModalCancelText}>Go Back</Text>
              </Pressable>
              <Pressable
                disabled={isSubmitting}
                style={[
                  styles.confirmModalButton,
                  styles.confirmModalContinueButton,
                  isSubmitting ? styles.submitButtonDisabled : undefined,
                ]}
                onPress={confirmBoxMismatchSubmit}
              >
                <Text style={styles.confirmModalContinueText}>Continue</Text>
              </Pressable>
            </View>
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
  filterPanel: {
    width: "30%",
    flexShrink: 0,
  },
  filterCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DDEBE6",
  },
  filterCardContent: {
    padding: 14,
    gap: 12,
  },
  filterField: {
    gap: 6,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
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
  confirmModalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  confirmModalText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#39584F",
  },
  confirmModalActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  confirmModalButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  confirmModalCancelButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#C6D6D0",
  },
  confirmModalCancelText: {
    color: "#39584F",
    fontWeight: "700",
    fontSize: 14,
  },
  confirmModalContinueButton: {
    backgroundColor: "#0D7A4E",
  },
  confirmModalContinueText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  listCard: {
    flex: 1,
    minWidth: 0,
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
    minWidth: 0,
  },
  customerSearchInput: {
    paddingVertical: 8,
  },
  listContent: {
    paddingBottom: 8,
    flexGrow: 1,
  },
  orderColumnWrapper: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  timeslotSeparator: {
    height: 1,
    backgroundColor: "#D0D5D3",
    marginVertical: 10,
    marginHorizontal: 2,
  },
  orderItemSpacer: {
    width: "48.5%",
  },
  detailsModalSafe: {
    flex: 1,
    backgroundColor: "#F5F8F7",
  },
  detailsModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  detailsModalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E8F6EF",
  },
  detailsModalBody: {
    flex: 1,
    minHeight: 0,
  },
  detailsScroll: {
    flex: 1,
    marginTop: 6,
    paddingHorizontal: 16,
  },
  detailsBody: {
    paddingBottom: 24,
    gap: 10,
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
    width: "48.5%",
    borderWidth: 1,
    borderColor: "#E2EEE9",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    backgroundColor: "#FAFCFB",
    alignSelf: "flex-start",
  },
  selectedItem: {
    borderColor: "#0D7A4E",
    backgroundColor: "#E8F6EF",
  },
  orderIdentity: {
    gap: 3,
  },
  orderNameRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
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
    flexShrink: 1,
  },
  orderPickedBoxes: {
    color: "#0D7A4E",
    fontWeight: "600",
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
  footnoteBlock: {
    gap: 4,
  },
  footnoteText: {
    fontSize: 13,
    color: "#1E2A26",
    lineHeight: 18,
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
    minHeight: 120,
    borderWidth: 1,
    borderColor: "#E2EEE9",
    borderRadius: 10,
    backgroundColor: "#FAFCFB",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  boxesEmptyState: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 24,
  },
  boxChipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    padding: 6,
    alignSelf: "stretch",
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
  actionButtons: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  submitButtonFlex: {
    flex: 1,
    marginTop: 0,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#C45C5C",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#B42318",
    fontWeight: "700",
    fontSize: 14,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusBadgeConfirmed: {
    backgroundColor: "#E0F2EA",
  },
  statusBadgePicked: {
    backgroundColor: "#DBEAFE",
  },
  statusBadgeCancelled: {
    backgroundColor: "#FEE4E2",
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#0B3D2E",
  },
  statusNotice: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#E2EEE9",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#FAFCFB",
  },
  statusNoticeText: {
    fontSize: 13,
    color: "#60726A",
    lineHeight: 18,
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
