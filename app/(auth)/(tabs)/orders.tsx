import { useAppDispatch } from "@/store/hooks";
import { checkinBox, checkoutBox, getAvailableBoxes } from "@/store/slices/boxSlice";
import { getDailyMeals } from "@/store/slices/dailyMealSlice";
import {
  cancelOrderForCustomer,
  getOrders,
  markOrderPaid,
  markOrderCollected,
  markOrderUnpaid,
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
  collected: "Collected",
  cancelled: "Cancelled",
};

const ORDER_PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: "Not Paid",
  paid: "Paid",
};

const ORDER_STATUS_FILTERS = [
  { key: "confirmed", label: "Confirmed" },
  { key: "collected", label: "Collected" },
  { key: "cancelled", label: "Cancelled" },
] as const;

const ORDER_PAYMENT_STATUS_FILTERS = [
  { key: "unpaid", label: "Not Paid" },
  { key: "paid", label: "Paid" },
] as const;

type OrderListRow =
  | { type: "orders"; key: string; orders: Order[] }
  | { type: "separator"; key: string };

const ORDER_LIST_COLUMNS = 3;

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

function formatPaymentStatus(status: string) {
  return ORDER_PAYMENT_STATUS_LABELS[status] ?? status;
}

function isOrderPaid(order: Order) {
  return order.paymentStatus === "paid";
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
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedPaymentStatuses, setSelectedPaymentStatuses] = useState<string[]>([]);

  const [availableBoxes, setAvailableBoxes] = useState<Box[]>([]);
  const [boxSearch, setBoxSearch] = useState("");
  const [selectedBoxIds, setSelectedBoxIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMode, setSubmitMode] = useState<
    "checkout" | "update" | "cancel" | "paid" | "unpaid" | null
  >(null);
  const [boxesLoading, setBoxesLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [boxMismatchConfirmOpen, setBoxMismatchConfirmOpen] = useState(false);
  const timeslotsRef = useRef(timeslots);
  timeslotsRef.current = timeslots;
  const handleExportOrdersRef = useRef<() => Promise<void>>(async () => {});
  const exportDisabledRef = useRef(false);

  const filteredOrders = useMemo(() => {
    const query = customerSearch.trim().toLowerCase();
    const statusSet =
      selectedStatuses.length > 0 ? new Set(selectedStatuses) : null;
    const paymentStatusSet =
      selectedPaymentStatuses.length > 0 ? new Set(selectedPaymentStatuses) : null;

    return orders.filter((order) => {
      if (statusSet && !statusSet.has(order.status)) {
        return false;
      }
      const paymentStatus = isOrderPaid(order) ? "paid" : "unpaid";
      if (paymentStatusSet && !paymentStatusSet.has(paymentStatus)) {
        return false;
      }
      if (!query) {
        return true;
      }
      const name = (order.customerName ?? "").toLowerCase();
      const phone = (order.customerPhone ?? "").toLowerCase();
      return name.includes(query) || phone.includes(query);
    });
  }, [customerSearch, orders, selectedPaymentStatuses, selectedStatuses]);

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
      for (let i = 0; i < group.length; i += ORDER_LIST_COLUMNS) {
        rows.push({
          type: "orders",
          key: `row-${group[i].id}`,
          orders: group.slice(i, i + ORDER_LIST_COLUMNS),
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
    setSelectedStatuses([]);
    setSelectedPaymentStatuses([]);
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
    if (order?.status === "collected") {
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

  const shiftSelectedDate = (days: number) => {
    if (isSubmitting) {
      return;
    }
    setSelectedDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + days);
      return next;
    });
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

  const toggleStatusFilter = (status: string | null) => {
    if (isSubmitting) {
      return;
    }
    if (status === null) {
      setSelectedStatuses([]);
      return;
    }
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((item) => item !== status) : [...prev, status],
    );
  };

  const togglePaymentStatusFilter = (paymentStatus: string | null) => {
    if (isSubmitting) {
      return;
    }
    if (paymentStatus === null) {
      setSelectedPaymentStatuses([]);
      return;
    }
    setSelectedPaymentStatuses((prev) =>
      prev.includes(paymentStatus)
        ? prev.filter((item) => item !== paymentStatus)
        : [...prev, paymentStatus],
    );
  };

  const handleRefreshOrders = () => {
    if (isSubmitting || listLoading) {
      return;
    }
    void loadOrders();
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

  const applyCollectedOrderUpdate = (
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
              status: "collected",
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

    if (selectedOrder.status !== "confirmed" && selectedOrder.status !== "collected") {
      Alert.alert("Unavailable", "Only confirmed or collected orders can update boxes.");
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

    const isUpdate = selectedOrder.status === "collected";
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
          markOrderCollected({
            customerId: selectedOrder.customerId,
            date: selectedOrder.date,
            orderId: selectedOrder.id,
            boxIds: nextBoxIds,
          }),
        ).unwrap();

        let updatedOrder = {
          ...pickedResponse.data,
          paymentStatus: pickedResponse.data.paymentStatus ?? selectedOrder.paymentStatus,
        };

        // Initial checkout (confirmed → collected) also marks the order as paid.
        if (!isUpdate && !isOrderPaid(updatedOrder)) {
          try {
            const paidResponse = await dispatch(
              markOrderPaid({
                customerId: selectedOrder.customerId,
                date: selectedOrder.date,
                orderId: selectedOrder.id,
              }),
            ).unwrap();
            updatedOrder = {
              ...updatedOrder,
              ...paidResponse.data,
              paymentStatus: "paid",
            };
          } catch (error) {
            applyCollectedOrderUpdate(selectedOrder.id, updatedOrder, nextBoxIds);
            Alert.alert(
              "Partial success",
              `Order was checked out, but marking payment as paid failed: ${getErrorMessage(error)}`,
            );
            return;
          }
        }

        applyCollectedOrderUpdate(selectedOrder.id, updatedOrder, nextBoxIds);
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

    if (selectedOrder.status !== "confirmed" && selectedOrder.status !== "collected") {
      Alert.alert("Unavailable", "Only confirmed or collected orders can update boxes.");
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

  const handleMarkOrderPaid = () => {
    if (isSubmitting || !selectedOrder) {
      return;
    }

    if (isOrderPaid(selectedOrder)) {
      return;
    }

    if (selectedOrder.status === "cancelled") {
      Alert.alert("Unavailable", "Cancelled orders cannot be marked as paid.");
      return;
    }

    void (async () => {
      setIsSubmitting(true);
      setSubmitMode("paid");
      try {
        const paidResponse = await dispatch(
          markOrderPaid({
            customerId: selectedOrder.customerId,
            date: selectedOrder.date,
            orderId: selectedOrder.id,
          }),
        ).unwrap();
        setOrders((prev) =>
          prev.map((order) =>
            order.id === selectedOrder.id
              ? { ...order, ...paidResponse.data, paymentStatus: "paid" }
              : order,
          ),
        );
      } catch (error) {
        Alert.alert("Update failed", getErrorMessage(error));
      } finally {
        setIsSubmitting(false);
        setSubmitMode(null);
      }
    })();
  };

  const handleMarkOrderUnpaid = () => {
    if (isSubmitting || !selectedOrder) {
      return;
    }

    if (!isOrderPaid(selectedOrder)) {
      return;
    }

    if (selectedOrder.status === "cancelled") {
      Alert.alert("Unavailable", "Cancelled orders cannot update payment status.");
      return;
    }

    const customerName = selectedOrder.customerName?.trim() || "this customer";

    Alert.alert("Mark as not paid", `Mark the order for ${customerName} as not paid?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Mark as not paid",
        onPress: () => {
          void (async () => {
            setIsSubmitting(true);
            setSubmitMode("unpaid");
            try {
              const unpaidResponse = await dispatch(
                markOrderUnpaid({
                  customerId: selectedOrder.customerId,
                  date: selectedOrder.date,
                  orderId: selectedOrder.id,
                }),
              ).unwrap();
              setOrders((prev) =>
                prev.map((order) =>
                  order.id === selectedOrder.id
                    ? { ...order, ...unpaidResponse.data, paymentStatus: "unpaid" }
                    : order,
                ),
              );
            } catch (error) {
              Alert.alert("Update failed", getErrorMessage(error));
            } finally {
              setIsSubmitting(false);
              setSubmitMode(null);
            }
          })();
        },
      },
    ]);
  };

  const resolveTimeslotLabel = useCallback(
    (timeslotId: string) => timeslots.find((slot) => slot.id === timeslotId)?.label ?? timeslotId,
    [timeslots],
  );

  const resolveLocationLabel = useCallback(
    (storeLocationId: string) =>
      storeLocationNames[storeLocationId] ?? "(Location Deleted)",
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
                  <View style={styles.dateSelectorRow}>
                    <Pressable
                      disabled={isSubmitting}
                      hitSlop={8}
                      style={styles.dateArrowButton}
                      onPress={() => shiftSelectedDate(-1)}
                    >
                      <Ionicons name="chevron-back" size={18} color="#42685D" />
                    </Pressable>
                    <Pressable
                      disabled={isSubmitting}
                      style={styles.dateSelector}
                      onPress={() => setShowDatePicker(true)}
                    >
                      <Text style={styles.dateSelectorText}>{dateKey}</Text>
                      <Ionicons name="calendar-outline" size={16} color="#42685D" />
                    </Pressable>
                    <Pressable
                      disabled={isSubmitting}
                      hitSlop={8}
                      style={styles.dateArrowButton}
                      onPress={() => shiftSelectedDate(1)}
                    >
                      <Ionicons name="chevron-forward" size={18} color="#42685D" />
                    </Pressable>
                  </View>
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
                    <Pressable
                      disabled={isSubmitting}
                      style={[
                        styles.timeslotChip,
                        selectedStatuses.length === 0 ? styles.timeslotChipActive : undefined,
                      ]}
                      onPress={() => toggleStatusFilter(null)}
                    >
                      <Text
                        style={[
                          styles.timeslotChipText,
                          selectedStatuses.length === 0
                            ? styles.timeslotChipTextActive
                            : undefined,
                        ]}
                      >
                        All
                      </Text>
                    </Pressable>
                    {ORDER_STATUS_FILTERS.map((filter) => {
                      const isActive = selectedStatuses.includes(filter.key);
                      return (
                        <Pressable
                          key={filter.key}
                          disabled={isSubmitting}
                          style={[
                            styles.timeslotChip,
                            isActive ? styles.timeslotChipActive : undefined,
                          ]}
                          onPress={() => toggleStatusFilter(filter.key)}
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
                  <Text style={styles.label}>Payment</Text>
                  <View style={styles.chipWrap}>
                    <Pressable
                      disabled={isSubmitting}
                      style={[
                        styles.timeslotChip,
                        selectedPaymentStatuses.length === 0
                          ? styles.timeslotChipActive
                          : undefined,
                      ]}
                      onPress={() => togglePaymentStatusFilter(null)}
                    >
                      <Text
                        style={[
                          styles.timeslotChipText,
                          selectedPaymentStatuses.length === 0
                            ? styles.timeslotChipTextActive
                            : undefined,
                        ]}
                      >
                        All
                      </Text>
                    </Pressable>
                    {ORDER_PAYMENT_STATUS_FILTERS.map((filter) => {
                      const isActive = selectedPaymentStatuses.includes(filter.key);
                      return (
                        <Pressable
                          key={filter.key}
                          disabled={isSubmitting}
                          style={[
                            styles.timeslotChip,
                            isActive ? styles.timeslotChipActive : undefined,
                          ]}
                          onPress={() => togglePaymentStatusFilter(filter.key)}
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
                <Pressable
                  disabled={isSubmitting || listLoading}
                  hitSlop={8}
                  style={styles.refreshButton}
                  onPress={handleRefreshOrders}
                >
                  {listLoading ? (
                    <ActivityIndicator size="small" color="#42685D" />
                  ) : (
                    <Ionicons name="refresh" size={18} color="#42685D" />
                  )}
                </Pressable>
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
                        {customerSearch.trim() ||
                        selectedStatuses.length > 0 ||
                        selectedPaymentStatuses.length > 0
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
                            {order.status === "collected" ? (
                              <Ionicons name="checkmark-circle" size={18} color="#0D7A4E" />
                            ) : order.status === "cancelled" ? (
                              <Ionicons name="close-circle" size={18} color="#B42318" />
                            ) : null}
                            {isOrderPaid(order) ? (
                              <Text style={styles.paidDollarIcon}>$</Text>
                            ) : null}
                            <Text style={styles.orderName} numberOfLines={1}>
                              {order.customerName || "Unknown customer"}
                            </Text>
                            <Text style={styles.orderSub} numberOfLines={1}>
                              {order.customerPhone || "No phone"}
                            </Text>
                            {order.status === "collected" && order.pickedBoxIds.length > 0 ? (
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
                            {resolveLocationLabel(order.storeLocationId)} · {order.meals.length}{" "}
                            meal{order.meals.length === 1 ? "" : "s"}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  };

                  const fillers = Math.max(0, ORDER_LIST_COLUMNS - row.orders.length);
                  return (
                    <View style={styles.orderColumnWrapper}>
                      {row.orders.map((order) => (
                        <View key={order.id} style={styles.orderItemSlot}>
                          {renderOrderCard(order)}
                        </View>
                      ))}
                      {Array.from({ length: fillers }, (_, index) => (
                        <View key={`spacer-${row.key}-${index}`} style={styles.orderItemSpacer} />
                      ))}
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
              <Text style={styles.detailsModalTitle}>Order Details</Text>
              <Pressable
                disabled={isSubmitting}
                hitSlop={8}
                style={styles.detailsModalClose}
                onPress={closeDetailsModal}
              >
                <Ionicons name="close" size={26} color="#0B3D2E" />
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
                        {selectedOrder.status === "collected" ? (
                          <Ionicons name="checkmark-circle" size={24} color="#0D7A4E" />
                        ) : selectedOrder.status === "cancelled" ? (
                          <Ionicons name="close-circle" size={24} color="#B42318" />
                        ) : null}
                        {isOrderPaid(selectedOrder) ? (
                          <Text style={[styles.paidDollarIcon, styles.paidDollarIconLarge]}>$</Text>
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
                            selectedOrder.status === "collected"
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
                        <View
                          style={[
                            styles.statusBadge,
                            isOrderPaid(selectedOrder)
                              ? styles.paymentBadgePaid
                              : styles.paymentBadgeUnpaid,
                          ]}
                        >
                          <Text style={styles.statusBadgeText}>
                            {formatPaymentStatus(
                              isOrderPaid(selectedOrder) ? "paid" : "unpaid",
                            )}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.identitySubText}>
                        {resolveLocationLabel(selectedOrder.storeLocationId)} ·{" "}
                        {resolveTimeslotLabel(selectedOrder.timeslotId)} ·{" "}
                        <Text style={styles.identityPrice}>
                          {formatCurrency(selectedOrder.totalAmount)}
                        </Text>
                      </Text>
                    </View>

                    <View style={styles.mealsWrap}>
                      {selectedOrder.meals.map((meal, index) => (
                        <View key={`${selectedOrder.id}-meal-${index}`} style={styles.mealCard}>
                          <Text style={styles.mealTitle}>LocaBox {index + 1}</Text>
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
                        <Text style={styles.detailsLabel}>Footnote</Text>
                        <Text style={styles.footnoteText}>{selectedOrder.footnote}</Text>
                      </View>
                    ) : null}

                    {selectedOrder.status === "confirmed" || selectedOrder.status === "collected" ? (
                      <View style={styles.giveBoxSection}>
                        <View style={styles.labelRow}>
                          <Text style={styles.detailsLabel}>
                            {selectedOrder.status === "collected" ? "Update Box" : "Give Box"} (
                            {selectedBoxIds.length}/{maxSelectedBoxes})
                          </Text>
                          {selectedBoxIds.length > 0 ? (
                            <Pressable disabled={isSubmitting} onPress={() => setSelectedBoxIds([])}>
                              <Text style={styles.clearAllText}>Clear All</Text>
                            </Pressable>
                          ) : null}
                        </View>

                        <View style={styles.selectedAndSearchRow}>
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
                        </View>

                        <View style={styles.boxSearchWorkArea}>
                          <View style={styles.boxSearchLeft}>
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
                                        <Ionicons name="backspace-outline" size={22} color="#0B3D2E" />
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

                {selectedOrder.status === "confirmed" ||
                selectedOrder.status === "collected" ||
                selectedOrder.status !== "cancelled" ? (
                  <View style={styles.actionButtons}>
                    {selectedOrder.status === "confirmed" ? (
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
                    ) : null}
                    {selectedOrder.status !== "cancelled" ? (
                      isOrderPaid(selectedOrder) ? (
                        <Pressable
                          disabled={isSubmitting}
                          style={[
                            styles.unpaidButton,
                            styles.submitButtonFlex,
                            isSubmitting ? styles.submitButtonDisabled : undefined,
                          ]}
                          onPress={handleMarkOrderUnpaid}
                        >
                          <Text style={styles.unpaidButtonText}>Mark as Not Paid</Text>
                        </Pressable>
                      ) : (
                        <Pressable
                          disabled={isSubmitting}
                          style={[
                            styles.paidButton,
                            styles.submitButtonFlex,
                            isSubmitting ? styles.submitButtonDisabled : undefined,
                          ]}
                          onPress={handleMarkOrderPaid}
                        >
                          <Text style={styles.paidButtonText}>Mark as Paid</Text>
                        </Pressable>
                      )
                    ) : null}
                    {selectedOrder.status === "confirmed" ? (
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
                    ) : selectedOrder.status === "collected" ? (
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
                    ) : null}
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
                      : submitMode === "paid" || submitMode === "unpaid"
                        ? "Updating payment..."
                        : submitMode === "update"
                          ? "Updating boxes..."
                          : "Processing check-out..."}
                  </Text>
                  <Text style={styles.loadingOverlayText}>
                    {submitMode === "cancel"
                      ? "Please wait while the order is cancelled."
                      : submitMode === "paid" || submitMode === "unpaid"
                        ? "Please wait while payment status is updated."
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
    width: "22%",
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
  refreshButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#C6D6D0",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
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
    alignItems: "flex-start",
  },
  orderItemSlot: {
    flex: 1,
    minWidth: 0,
  },
  timeslotSeparator: {
    height: 1,
    backgroundColor: "#D0D5D3",
    marginVertical: 10,
    marginHorizontal: 2,
  },
  orderItemSpacer: {
    flex: 1,
    minWidth: 0,
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
  dateSelectorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dateArrowButton: {
    width: 34,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#C6D6D0",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  dateSelector: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: "#C6D6D0",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 4,
  },
  dateSelectorText: {
    flexShrink: 1,
    color: "#1E2A26",
    fontWeight: "600",
    fontSize: 13,
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
    width: "100%",
    borderWidth: 1,
    borderColor: "#E2EEE9",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginBottom: 8,
    backgroundColor: "#FAFCFB",
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
  paidDollarIcon: {
    fontSize: 16,
    fontWeight: "800",
    color: "#B45309",
    lineHeight: 18,
  },
  paidDollarIconLarge: {
    fontSize: 24,
    lineHeight: 26,
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
    fontSize: 16,
    color: "#7A8F87",
    textAlign: "center",
  },
  detailsModalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0B3D2E",
  },
  detailsLabel: {
    fontSize: 16,
    color: "#39584F",
    fontWeight: "600",
  },
  identityBlock: {
    gap: 4,
  },
  panelNameRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    flexWrap: "wrap",
  },
  panelName: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0B3D2E",
    flexShrink: 1,
  },
  identitySubText: {
    fontSize: 16,
    color: "#60726A",
  },
  identityPrice: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0B3D2E",
  },
  mealsWrap: {
    flexDirection: "row",
    gap: 8,
  },
  footnoteBlock: {
    gap: 4,
  },
  footnoteText: {
    fontSize: 16,
    color: "#1E2A26",
    lineHeight: 22,
  },
  mealCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E2EEE9",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#FAFCFB",
    gap: 6,
  },
  mealTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0B3D2E",
  },
  mealAddonEmpty: {
    fontSize: 15,
    color: "#7A8F87",
  },
  addonWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  addonTag: {
    backgroundColor: "#E0F2EA",
    borderWidth: 1,
    borderColor: "#A8D8C0",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  addonTagText: {
    color: "#0B5D44",
    fontWeight: "700",
    fontSize: 14,
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
    fontSize: 15,
    fontWeight: "600",
    color: "#0D7A4E",
  },
  selectedAndSearchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  selectedBoxesArea: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: "#C6D6D0",
    borderRadius: 10,
    backgroundColor: "#FAFCFB",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    minWidth: 0,
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
    width: 180,
    flexShrink: 0,
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
    height: 44,
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
    width: 180,
    gap: 6,
    flexShrink: 0,
  },
  numpadRow: {
    flexDirection: "row",
    gap: 6,
    height: 58,
  },
  numpadKey: {
    flex: 1,
    height: 58,
    borderRadius: 10,
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
    fontSize: 20,
    fontWeight: "700",
    color: "#0B3D2E",
  },
  numpadKeyActionText: {
    fontSize: 16,
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
    fontSize: 15,
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
    fontSize: 15,
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
    fontSize: 15,
    color: "#39584F",
    fontWeight: "600",
  },
  boxChipGridArea: {
    minHeight: 160,
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
    gap: 8,
    padding: 8,
    alignSelf: "stretch",
  },
  boxChip: {
    width: "30%",
    minWidth: 64,
    borderWidth: 1,
    borderColor: "#C6D6D0",
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 6,
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
    fontSize: 16,
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
    fontSize: 16,
  },
  paidButton: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#B45309",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  paidButtonText: {
    color: "#B45309",
    fontWeight: "700",
    fontSize: 16,
  },
  unpaidButton: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#6B7280",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  unpaidButtonText: {
    color: "#4B5563",
    fontWeight: "700",
    fontSize: 16,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
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
  paymentBadgePaid: {
    backgroundColor: "#FEF3C7",
  },
  paymentBadgeUnpaid: {
    backgroundColor: "#F3F4F6",
  },
  statusBadgeText: {
    fontSize: 13,
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
    fontSize: 16,
    color: "#60726A",
    lineHeight: 22,
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
