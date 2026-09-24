import { CUSTOMER_PAGE_SIZE } from "@/constants/config";
import { useAppDispatch } from "@/store/hooks";
import {
  checkinBox,
  checkoutBox,
  getAvailableBoxes,
  getCheckedOutBoxes,
} from "@/store/slices/boxSlice";
import { getCustomers } from "@/store/slices/customerSlice";
import { Box, Customer } from "@/types/app";
import { getErrorMessage } from "@/utils/apiError";
import { normalizeBoxId } from "@/utils/boxId";
import { getDaysOut } from "@/utils/dates";
import DateTimePicker, { DateTimePickerChangeEvent } from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
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
  Switch,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type BoxMode = "give" | "return";

export default function CheckoutScreen() {
  const dispatch = useAppDispatch();
  const WALK_IN_CUSTOMER_NAME = "Walk-In User";
  const MAX_SELECTED_BOXES = 10;
  const customerFocusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const customerListRequestIdRef = useRef(0);

  const [mode, setMode] = useState<BoxMode>("give");

  // Shared
  const [boxSearch, setBoxSearch] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionDate, setActionDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Give mode state
  const [selectedBoxIds, setSelectedBoxIds] = useState<string[]>([]);
  const [isWalkIn, setIsWalkIn] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: string; name: string } | null>(null);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [debouncedCustomerSearch, setDebouncedCustomerSearch] = useState("");
  const [availableBoxes, setAvailableBoxes] = useState<Box[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [customerPage, setCustomerPage] = useState(1);
  const [customerHasMore, setCustomerHasMore] = useState(true);
  const [customerListLoading, setCustomerListLoading] = useState(false);
  const [customerLoadingMore, setCustomerLoadingMore] = useState(false);
  const customerSearchRef = useRef<import("react-native").TextInput>(null);

  // Return mode state
  const [selectedBoxes, setSelectedBoxes] = useState<Box[]>([]);
  const [checkedOutBoxes, setCheckedOutBoxes] = useState<Box[]>([]);
  const selectedReturnBoxIds = selectedBoxes.map((box) => box.id);

  useEffect(() => {
    return () => {
      if (customerFocusTimeoutRef.current) {
        clearTimeout(customerFocusTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedCustomerSearch(customerSearch.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [customerSearch]);

  const loadAvailableBoxes = useCallback(async () => {
    try {
      const response = await dispatch(getAvailableBoxes(boxSearch)).unwrap();
      setAvailableBoxes(response.data);
    } catch {
      setAvailableBoxes([]);
    }
  }, [boxSearch, dispatch]);

  const loadCheckedOutBoxes = useCallback(async () => {
    try {
      const response = await dispatch(getCheckedOutBoxes(boxSearch)).unwrap();
      setCheckedOutBoxes(response.data);
    } catch {
      setCheckedOutBoxes([]);
    }
  }, [boxSearch, dispatch]);

  const loadCustomerPage = useCallback(
    async (pageToLoad: number, append: boolean) => {
      const requestId = ++customerListRequestIdRef.current;
      if (append) {
        setCustomerLoadingMore(true);
      } else {
        setCustomerListLoading(true);
      }

      try {
        const response = await dispatch(
          getCustomers({
            search: debouncedCustomerSearch,
            page: pageToLoad,
            limit: CUSTOMER_PAGE_SIZE,
          }),
        ).unwrap();

        if (requestId !== customerListRequestIdRef.current) {
          return;
        }

        setFilteredCustomers((prev) =>
          append ? [...prev, ...response.data] : response.data,
        );
        setCustomerPage(response.page);
        setCustomerHasMore(response.hasMore);
      } catch {
        if (requestId !== customerListRequestIdRef.current) {
          return;
        }
        if (!append) {
          setFilteredCustomers([]);
        }
        setCustomerHasMore(false);
      } finally {
        if (requestId === customerListRequestIdRef.current) {
          setCustomerListLoading(false);
          setCustomerLoadingMore(false);
        }
      }
    },
    [debouncedCustomerSearch, dispatch],
  );

  useFocusEffect(
    useCallback(() => {
      if (mode === "give") {
        void loadAvailableBoxes();
      } else {
        void loadCheckedOutBoxes();
      }
    }, [mode, loadAvailableBoxes, loadCheckedOutBoxes]),
  );

  useEffect(() => {
    if (mode === "give") {
      void loadAvailableBoxes();
    } else {
      void loadCheckedOutBoxes();
    }
  }, [mode, loadAvailableBoxes, loadCheckedOutBoxes]);

  useEffect(() => {
    if (!customerModalOpen) {
      return;
    }

    void loadCustomerPage(1, false);
  }, [customerModalOpen, loadCustomerPage]);

  const switchMode = (nextMode: BoxMode) => {
    if (isSubmitting || nextMode === mode) {
      return;
    }

    setMode(nextMode);
    setBoxSearch("");
    setShowDatePicker(false);
    setActionDate(new Date());
    Keyboard.dismiss();
  };

  const loadMoreCustomers = () => {
    if (!customerHasMore || customerListLoading || customerLoadingMore) {
      return;
    }
    void loadCustomerPage(customerPage + 1, true);
  };

  const formatDateLabel = (value: Date) => {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const onActionDateChange = (_event: DateTimePickerChangeEvent, selected: Date) => {
    if (Platform.OS !== "ios") {
      setShowDatePicker(false);
    }

    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const safeDate = selected > today ? today : selected;
    setActionDate(safeDate);
  };

  const toggleGiveBox = (boxId: string) => {
    if (isSubmitting) {
      return;
    }

    let shouldClearSearch = false;

    setSelectedBoxIds((prev) => {
      if (prev.includes(boxId)) {
        return prev.filter((id) => id !== boxId);
      }

      if (prev.length >= MAX_SELECTED_BOXES) {
        Alert.alert("Selection limit", `You can only check out up to ${MAX_SELECTED_BOXES} boxes at one time.`);
        return prev;
      }

      shouldClearSearch = true;
      return [...prev, boxId];
    });

    if (shouldClearSearch) {
      setBoxSearch("");
      Keyboard.dismiss();
    }
  };

  const removeGiveBox = (boxId: string) => {
    if (isSubmitting) {
      return;
    }

    setSelectedBoxIds((prev) => prev.filter((id) => id !== boxId));
  };

  const toggleReturnBox = (box: Box) => {
    if (isSubmitting) {
      return;
    }

    let shouldClearSearch = false;

    setSelectedBoxes((prev) => {
      if (prev.some((item) => item.id === box.id)) {
        shouldClearSearch = true;
        return prev.filter((item) => item.id !== box.id);
      }

      if (prev.length >= MAX_SELECTED_BOXES) {
        Alert.alert("Selection limit", `You can only check in up to ${MAX_SELECTED_BOXES} boxes at one time.`);
        return prev;
      }

      shouldClearSearch = true;
      return [...prev, box];
    });

    if (shouldClearSearch) {
      setBoxSearch("");
      Keyboard.dismiss();
    }
  };

  const removeReturnBox = (boxId: string) => {
    if (isSubmitting) {
      return;
    }

    setSelectedBoxes((prev) => prev.filter((item) => item.id !== boxId));
  };

  const handleWalkInToggle = (value: boolean) => {
    if (isSubmitting) {
      return;
    }

    setIsWalkIn(value);
    setSelectedCustomer(null);
  };

  const handleGiveSubmit = async () => {
    if (isSubmitting) {
      return;
    }

    if (selectedBoxIds.length === 0) {
      Alert.alert("No box selected", "Please select at least one box.");
      return;
    }

    if (selectedBoxIds.length > MAX_SELECTED_BOXES) {
      Alert.alert("Selection limit", `You can only check out up to ${MAX_SELECTED_BOXES} boxes at one time.`);
      return;
    }

    const name = isWalkIn ? WALK_IN_CUSTOMER_NAME : selectedCustomer?.name ?? "";
    if (!name) {
      Alert.alert("No customer", "Please enter or select a customer.");
      return;
    }

    setIsSubmitting(true);

    try {
      const checkoutDateIso = actionDate.toISOString();
      const results: { ok: boolean; message: string }[] = [];

      for (const id of selectedBoxIds) {
        const boxId = normalizeBoxId(id);
        try {
          await dispatch(
            checkoutBox({
              boxId,
              customerName: name,
              checkoutDate: checkoutDateIso,
            }),
          ).unwrap();
          results.push({ ok: true, message: "" });
        } catch (error) {
          results.push({ ok: false, message: getErrorMessage(error) });
        }
      }

      void loadAvailableBoxes();

      const failed = results.filter((r) => !r.ok);
      if (failed.length === 0) {
        Alert.alert("Success", `${selectedBoxIds.length} box(es) checked out to ${name}.`);
        setSelectedBoxIds([]);
        setSelectedCustomer(null);
      } else {
        Alert.alert("Partial error", failed.map((r) => r.message).join("\n"));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReturnSubmit = async () => {
    if (isSubmitting) {
      return;
    }

    if (selectedReturnBoxIds.length === 0) {
      Alert.alert("No box selected", "Please select at least one box.");
      return;
    }

    if (selectedReturnBoxIds.length > MAX_SELECTED_BOXES) {
      Alert.alert("Selection limit", `You can only check in up to ${MAX_SELECTED_BOXES} boxes at one time.`);
      return;
    }

    setIsSubmitting(true);

    try {
      const checkinDateIso = actionDate.toISOString();
      const results: { ok: boolean; message: string }[] = [];

      for (const boxId of selectedReturnBoxIds) {
        try {
          await dispatch(
            checkinBox({
              boxId: normalizeBoxId(boxId),
              checkinDate: checkinDateIso,
            }),
          ).unwrap();
          results.push({ ok: true, message: "" });
        } catch (error) {
          results.push({ ok: false, message: getErrorMessage(error) });
        }
      }

      void loadCheckedOutBoxes();

      const failed = results.filter((result) => !result.ok);

      if (failed.length === 0) {
        Alert.alert("Success", `${selectedReturnBoxIds.length} box(es) checked in successfully.`);
        setSelectedBoxes([]);
      } else {
        Alert.alert("Partial error", failed.map((result) => result.message).join("\n"));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeCustomerModal = () => {
    setCustomerModalOpen(false);
    setCustomerSearch("");
    setFilteredCustomers([]);
  };

  const isGiveMode = mode === "give";

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.container}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View pointerEvents={isSubmitting ? "none" : "auto"} style={styles.contentWrap}>
            <View style={styles.mainContent}>
              {/* ── LEFT PANEL ── */}
              <ScrollView
                style={styles.leftColumn}
                contentContainerStyle={styles.leftColumnContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.formCard}>
                  <View style={styles.modeSwitchRow}>
                    <Pressable
                      disabled={isSubmitting}
                      style={[
                        styles.modeButton,
                        isGiveMode ? styles.modeButtonActive : undefined,
                      ]}
                      onPress={() => switchMode("give")}
                    >
                      <Text
                        style={[
                          styles.modeButtonText,
                          isGiveMode ? styles.modeButtonTextActive : undefined,
                        ]}
                      >
                        Give Box
                      </Text>
                    </Pressable>
                    <Pressable
                      disabled={isSubmitting}
                      style={[
                        styles.modeButton,
                        !isGiveMode ? styles.modeButtonActive : undefined,
                      ]}
                      onPress={() => switchMode("return")}
                    >
                      <Text
                        style={[
                          styles.modeButtonText,
                          !isGiveMode ? styles.modeButtonTextActive : undefined,
                        ]}
                      >
                        Return Box
                      </Text>
                    </Pressable>
                  </View>

                  {isGiveMode ? (
                    <>
                      <View style={styles.labelRow}>
                        <Text style={styles.label}>Selected Boxes</Text>
                        {selectedBoxIds.length > 0 && (
                          <Pressable disabled={isSubmitting} onPress={() => setSelectedBoxIds([])}>
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
                          selectedBoxIds.map((id) => (
                            <Pressable
                              disabled={isSubmitting}
                              key={id}
                              style={styles.tag}
                              onPress={() => removeGiveBox(id)}
                            >
                              <Text style={styles.tagText}>{id.replace("BOX-", "")}</Text>
                              <Ionicons name="close" size={12} color="#0B5D44" style={styles.tagIcon} />
                            </Pressable>
                          ))
                        )}
                      </ScrollView>

                      <View style={styles.customerHeader}>
                        <Text style={styles.label}>Customer</Text>
                        <View style={styles.walkInRow}>
                          <Text style={styles.walkInLabel}>Walk-in</Text>
                          <Switch
                            disabled={isSubmitting}
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
                          disabled={isSubmitting}
                          style={styles.customerSelector}
                          onPress={() => setCustomerModalOpen(true)}
                        >
                          <Text
                            style={
                              selectedCustomer
                                ? styles.customerSelectorText
                                : styles.customerSelectorPlaceholder
                            }
                          >
                            {selectedCustomer ? selectedCustomer.name : "Tap to select customer"}
                          </Text>
                          <Ionicons name="chevron-down" size={16} color="#42685D" />
                        </Pressable>
                      )}

                      <Text style={styles.label}>Checkout Date</Text>
                      <Pressable
                        disabled={isSubmitting}
                        style={styles.dateSelector}
                        onPress={() => setShowDatePicker(true)}
                      >
                        <Text style={styles.dateSelectorText}>{formatDateLabel(actionDate)}</Text>
                        <Ionicons name="calendar-outline" size={16} color="#42685D" />
                      </Pressable>

                      {showDatePicker ? (
                        <DateTimePicker
                          value={actionDate}
                          mode="date"
                          display={Platform.OS === "ios" ? "spinner" : "default"}
                          maximumDate={new Date()}
                          onValueChange={onActionDateChange}
                          onDismiss={() => setShowDatePicker(false)}
                        />
                      ) : null}

                      <Pressable
                        disabled={isSubmitting}
                        style={[styles.submitButton, isSubmitting ? styles.submitButtonDisabled : undefined]}
                        onPress={handleGiveSubmit}
                      >
                        <Text style={styles.submitButtonText}>Confirm Check-out</Text>
                      </Pressable>
                    </>
                  ) : (
                    <>
                      <View style={styles.labelRow}>
                        <Text style={styles.label}>Selected Boxes</Text>
                        {selectedBoxes.length > 0 && (
                          <Pressable disabled={isSubmitting} onPress={() => setSelectedBoxes([])}>
                            <Text style={styles.clearAllText}>Clear All</Text>
                          </Pressable>
                        )}
                      </View>
                      <ScrollView
                        style={styles.tagScroll}
                        contentContainerStyle={[
                          styles.tagContainer,
                          selectedBoxes.length === 0 ? styles.tagContainerEmpty : undefined,
                        ]}
                        showsVerticalScrollIndicator={selectedBoxes.length > 0}
                        nestedScrollEnabled
                        keyboardShouldPersistTaps="handled"
                      >
                        {selectedBoxes.length === 0 ? (
                          <Text style={styles.tagPlaceholder}>Tap boxes on the right to select</Text>
                        ) : (
                          selectedBoxes.map((box) => {
                            const daysOut = getDaysOut(box.dateOut);
                            const isWarning = daysOut > 7 && daysOut <= 14;
                            const isOverdue = daysOut > 14;

                            return (
                              <Pressable
                                key={box.id}
                                disabled={isSubmitting}
                                style={[
                                  styles.tag,
                                  isWarning ? styles.tagWarning : undefined,
                                  isOverdue ? styles.tagOverdue : undefined,
                                ]}
                                onPress={() => removeReturnBox(box.id)}
                              >
                                <Text
                                  style={[
                                    styles.tagText,
                                    isWarning ? styles.tagTextWarning : undefined,
                                    isOverdue ? styles.tagTextOverdue : undefined,
                                  ]}
                                >
                                  {box.id.replace("BOX-", "")}
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
                      <Pressable
                        disabled={isSubmitting}
                        style={styles.dateSelector}
                        onPress={() => setShowDatePicker(true)}
                      >
                        <Text style={styles.dateSelectorText}>{formatDateLabel(actionDate)}</Text>
                        <Ionicons name="calendar-outline" size={16} color="#42685D" />
                      </Pressable>

                      {showDatePicker ? (
                        <DateTimePicker
                          value={actionDate}
                          mode="date"
                          display={Platform.OS === "ios" ? "spinner" : "default"}
                          maximumDate={new Date()}
                          onValueChange={onActionDateChange}
                          onDismiss={() => setShowDatePicker(false)}
                        />
                      ) : null}

                      <Pressable
                        disabled={isSubmitting}
                        style={[styles.submitButton, isSubmitting ? styles.submitButtonDisabled : undefined]}
                        onPress={handleReturnSubmit}
                      >
                        <Text style={styles.submitButtonText}>Confirm Check-in</Text>
                      </Pressable>
                    </>
                  )}
                </View>
              </ScrollView>

              {/* ── RIGHT PANEL ── */}
              <View style={styles.rightColumn}>
                <View style={styles.searchCard}>
                  <Text style={styles.sectionTitle}>
                    {isGiveMode
                      ? `Available Boxes (${availableBoxes.length})`
                      : `Checked-out Boxes (${checkedOutBoxes.length})`}
                  </Text>
                  <View style={styles.searchInputWrap}>
                    <TextInput
                      value={boxSearch}
                      onChangeText={setBoxSearch}
                      editable={!isSubmitting}
                      placeholder={isGiveMode ? "Search box id" : "Search box id or customer"}
                      placeholderTextColor="#7A8F87"
                      keyboardType="number-pad"
                      style={[styles.input, styles.searchInput]}
                    />
                    {boxSearch ? (
                      <Pressable
                        disabled={isSubmitting}
                        style={styles.clearButton}
                        onPress={() => setBoxSearch("")}
                      >
                        <Ionicons name="close-circle" size={18} color="#7A8F87" />
                      </Pressable>
                    ) : null}
                  </View>
                </View>

                <View style={styles.boxListCard}>
                  {isGiveMode ? (
                    <FlatList
                      key="give-boxes"
                      data={availableBoxes}
                      keyExtractor={(item) => item.id}
                      numColumns={4}
                      contentContainerStyle={styles.boxList}
                      columnWrapperStyle={styles.boxRow}
                      keyboardShouldPersistTaps="handled"
                      initialNumToRender={24}
                      maxToRenderPerBatch={24}
                      windowSize={7}
                      removeClippedSubviews
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
                            disabled={isSubmitting}
                            onPress={() => toggleGiveBox(item.id)}
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
                  ) : (
                    <FlatList
                      key="return-boxes"
                      data={checkedOutBoxes}
                      keyExtractor={(item) => item.id}
                      numColumns={3}
                      contentContainerStyle={styles.returnBoxList}
                      columnWrapperStyle={styles.returnBoxRow}
                      keyboardShouldPersistTaps="handled"
                      initialNumToRender={18}
                      maxToRenderPerBatch={18}
                      windowSize={7}
                      removeClippedSubviews
                      ListEmptyComponent={
                        <View style={styles.emptyState}>
                          <Ionicons name="archive-outline" size={28} color="#7A8F87" />
                          <Text style={styles.emptyText}>No checked-out boxes</Text>
                        </View>
                      }
                      renderItem={({ item }) => {
                        const isSelected = selectedReturnBoxIds.includes(item.id);
                        const daysOut = getDaysOut(item.dateOut);
                        const isWarning = daysOut > 7 && daysOut <= 14;
                        const isOverdue = daysOut > 14;
                        const isAged = isWarning || isOverdue;

                        return (
                          <Pressable
                            disabled={isSubmitting}
                            onPress={() => toggleReturnBox(item)}
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
                  )}
                </View>
              </View>
            </View>
          </View>

          {isSubmitting ? (
            <View style={styles.loadingOverlay}>
              <View style={styles.loadingCard}>
                <ActivityIndicator size="large" color="#0D7A4E" />
                <Text style={styles.loadingOverlayTitle}>
                  {isGiveMode ? "Processing check-out..." : "Processing check-in..."}
                </Text>
                <Text style={styles.loadingOverlayText}>
                  Please wait until all selected boxes are updated.
                </Text>
              </View>
            </View>
          ) : null}
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>

      {/* ── Customer Modal ── */}
      <Modal
        transparent
        visible={customerModalOpen}
        animationType="fade"
        onRequestClose={closeCustomerModal}
        onShow={() => {
          if (customerFocusTimeoutRef.current) {
            clearTimeout(customerFocusTimeoutRef.current);
          }
          customerFocusTimeoutRef.current = setTimeout(() => {
            customerSearchRef.current?.focus();
          }, 100);
        }}
        onDismiss={() => {
          if (customerFocusTimeoutRef.current) {
            clearTimeout(customerFocusTimeoutRef.current);
            customerFocusTimeoutRef.current = null;
          }
        }}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            disabled={isSubmitting}
            style={StyleSheet.absoluteFill}
            onPress={closeCustomerModal}
          />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Customer</Text>
            <View style={styles.searchInputWrap}>
              <TextInput
                ref={customerSearchRef}
                value={customerSearch}
                onChangeText={setCustomerSearch}
                editable={!isSubmitting}
                placeholder="Search name, phone, email"
                placeholderTextColor="#7A8F87"
                style={[styles.input, styles.modalSearch, styles.searchInput]}
              />
              {customerSearch ? (
                <Pressable
                  disabled={isSubmitting}
                  style={styles.clearButton}
                  onPress={() => setCustomerSearch("")}
                >
                  <Ionicons name="close-circle" size={18} color="#7A8F87" />
                </Pressable>
              ) : null}
            </View>
            <FlatList
              style={styles.modalList}
              data={filteredCustomers}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              initialNumToRender={20}
              maxToRenderPerBatch={20}
              windowSize={7}
              removeClippedSubviews
              onEndReached={loadMoreCustomers}
              onEndReachedThreshold={0.4}
              ListEmptyComponent={
                customerListLoading ? (
                  <ActivityIndicator size="small" color="#0D7A4E" style={{ marginTop: 16 }} />
                ) : (
                  <Text style={styles.emptyText}>No customers found.</Text>
                )
              }
              ListFooterComponent={
                customerLoadingMore ? (
                  <ActivityIndicator size="small" color="#0D7A4E" style={{ marginVertical: 12 }} />
                ) : null
              }
              renderItem={({ item: c }) => (
                <Pressable
                  disabled={isSubmitting}
                  style={styles.modalItem}
                  onPress={() => {
                    setSelectedCustomer({ id: c.id, name: c.name });
                    closeCustomerModal();
                  }}
                >
                  <Text style={styles.modalItemName}>
                    {c.name} <Text style={styles.modalItemSub}>({c.phone})</Text>
                  </Text>
                </Pressable>
              )}
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
    gap: 12,
  },
  keyboardView: {
    flex: 1,
  },
  contentWrap: {
    flex: 1,
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
  modeSwitchRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 4,
  },
  modeButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#C6D6D0",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  modeButtonActive: {
    backgroundColor: "#0D7A4E",
    borderColor: "#0D7A4E",
  },
  modeButtonText: {
    color: "#39584F",
    fontWeight: "700",
    fontSize: 13,
  },
  modeButtonTextActive: {
    color: "#FFFFFF",
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
  submitButtonDisabled: {
    opacity: 0.7,
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
  returnBoxList: {
    gap: 8,
    paddingBottom: 8,
  },
  returnBoxRow: {
    justifyContent: "flex-start",
    gap: 8,
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
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(245,248,247,0.78)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingCard: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#DDEBE6",
    paddingHorizontal: 20,
    paddingVertical: 22,
    alignItems: "center",
    gap: 10,
  },
  loadingOverlayTitle: {
    color: "#0B3D2E",
    fontSize: 16,
    fontWeight: "700",
  },
  loadingOverlayText: {
    color: "#527168",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
});
