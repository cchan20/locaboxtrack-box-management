import { BOX_PAGE_SIZE, TRANSACTION_HISTORY_LIMIT } from "@/constants/config";
import { useAppDispatch } from "@/store/hooks";
import {
  getBoxById,
  getBoxes,
  setBoxAvailability,
} from "@/store/slices/boxSlice";
import { getTransactionsByBox } from "@/store/slices/transactionSlice";
import { useAuth } from "@/store/useAuth";
import { Box, BoxStatus, TransactionHistoryItem } from "@/types/app";
import { getErrorMessage } from "@/utils/apiError";
import { getDaysOut } from "@/utils/dates";
import { TransactionHistoryModal } from "@/ui/TransactionHistoryModal";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function InventoryScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { isAdmin } = useAuth();
  const { width } = useWindowDimensions();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilters, setStatusFilters] = useState<BoxStatus[]>(["available", "checked-out"]);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
  const [selectedBox, setSelectedBox] = useState<Box | null>(null);
  const [transactionsModalOpen, setTransactionsModalOpen] = useState(false);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [transactions, setTransactions] = useState<TransactionHistoryItem[]>([]);
  const listRequestIdRef = useRef(0);
  const pageRef = useRef(1);
  const hasMoreRef = useRef(true);
  const listLoadingRef = useRef(false);
  const loadingMoreRef = useRef(false);
  const statCardWidth = width < 950 ? "48.5%" : "31.5%";

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadBoxPage = useCallback(
    async (pageToLoad: number, append: boolean) => {
      // Append must not bump listRequestIdRef — that cancels an in-flight page-1 refresh
      // (FlatList often fires onEndReached during the first load).
      if (append) {
        if (
          listLoadingRef.current ||
          loadingMoreRef.current ||
          !hasMoreRef.current ||
          pageToLoad !== pageRef.current + 1
        ) {
          return;
        }
        loadingMoreRef.current = true;
        setLoadingMore(true);
      } else {
        const requestId = ++listRequestIdRef.current;
        listLoadingRef.current = true;
        loadingMoreRef.current = false;
        hasMoreRef.current = true;
        pageRef.current = 1;
        setListLoading(true);
        setLoadingMore(false);

        try {
          const response = await dispatch(
            getBoxes({
              status: statusFilters,
              search: debouncedSearch,
              page: pageToLoad,
              limit: BOX_PAGE_SIZE,
            }),
          ).unwrap();

          if (requestId !== listRequestIdRef.current) {
            return;
          }

          setBoxes(response.data);
          pageRef.current = response.page;
          hasMoreRef.current = response.hasMore;
        } catch {
          if (requestId !== listRequestIdRef.current) {
            return;
          }
          setBoxes([]);
          pageRef.current = 1;
          hasMoreRef.current = false;
        } finally {
          if (requestId === listRequestIdRef.current) {
            listLoadingRef.current = false;
            setListLoading(false);
          }
        }
        return;
      }

      const refreshIdAtStart = listRequestIdRef.current;

      try {
        const response = await dispatch(
          getBoxes({
            status: statusFilters,
            search: debouncedSearch,
            page: pageToLoad,
            limit: BOX_PAGE_SIZE,
          }),
        ).unwrap();

        // Drop append results if a full refresh started while we were loading.
        if (refreshIdAtStart !== listRequestIdRef.current) {
          return;
        }

        setBoxes((prev) => [...prev, ...response.data]);
        pageRef.current = response.page;
        hasMoreRef.current = response.hasMore;
      } catch {
        if (refreshIdAtStart !== listRequestIdRef.current) {
          return;
        }
        hasMoreRef.current = false;
      } finally {
        if (refreshIdAtStart === listRequestIdRef.current) {
          loadingMoreRef.current = false;
          setLoadingMore(false);
        }
      }
    },
    [debouncedSearch, dispatch, statusFilters],
  );

  const loadSelectedBoxDetails = useCallback(async () => {
    if (!selectedBoxId) {
      setSelectedBox(null);
      return;
    }

    try {
      const detailResponse = await dispatch(getBoxById(selectedBoxId)).unwrap();
      setSelectedBox(detailResponse.data);
    } catch {
      setSelectedBox(null);
      setSelectedBoxId(null);
    }
  }, [dispatch, selectedBoxId]);

  const loadSelectedBoxDetailsRef = useRef(loadSelectedBoxDetails);
  loadSelectedBoxDetailsRef.current = loadSelectedBoxDetails;

  useFocusEffect(
    useCallback(() => {
      void loadBoxPage(1, false);
      void loadSelectedBoxDetailsRef.current();
    }, [loadBoxPage]),
  );

  useEffect(() => {
    void loadSelectedBoxDetails();
  }, [loadSelectedBoxDetails]);

  const loadMoreBoxes = useCallback(() => {
    if (
      listLoadingRef.current ||
      loadingMoreRef.current ||
      !hasMoreRef.current ||
      boxes.length === 0
    ) {
      return;
    }
    void loadBoxPage(pageRef.current + 1, true);
  }, [boxes.length, loadBoxPage]);

  const openCreateBox = () => {
    router.push("/(auth)/create-box");
  };

  const openBoxDetails = (box: Box) => {
    setSelectedBoxId(box.id);
    setSelectedBox(box);
  };

  const openTransactions = async () => {
    if (!selectedBox) {
      return;
    }

    setTransactionsModalOpen(true);
    setTransactionsLoading(true);

    try {
      const response = await dispatch(
        getTransactionsByBox({
          boxId: selectedBox.id,
          limit: TRANSACTION_HISTORY_LIMIT,
        }),
      ).unwrap();
      setTransactions(response.data);
    } catch {
      setTransactions([]);
    } finally {
      setTransactionsLoading(false);
    }
  };

  const toggleAvailability = async () => {
    if (!selectedBox) {
      return;
    }

    const nextStatus = selectedBox.status === "unavailable" ? "available" : "unavailable";

    try {
      const response = await dispatch(
        setBoxAvailability({
          boxId: selectedBox.id,
          status: nextStatus,
        }),
      ).unwrap();
      setSelectedBox(response.data);
      void loadBoxPage(1, false);
    } catch (error) {
      Alert.alert("Error", getErrorMessage(error));
    }
  };

  const toggleStatusFilter = (status: BoxStatus) => {
    setStatusFilters((current) => {
      if (current.includes(status)) {
        if (current.length === 1) {
          return current;
        }

        return current.filter((item) => item !== status);
      }

      return [...current, status];
    });
  };

  const renderEmptyState = () => {
    const query = search.trim();

    if (query) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="search-outline" size={36} color="#0D7A4E" />
          <Text style={styles.emptyTitle}>No matching boxes</Text>
          <Text style={styles.emptyText}>Try a different keyword.</Text>
        </View>
      );
    }

    return (
      <Pressable style={styles.emptyState} onPress={isAdmin ? openCreateBox : undefined}>
        <Ionicons name="cube-outline" size={36} color="#0D7A4E" />
        <Text style={styles.emptyTitle}>No boxes yet</Text>
        <Text style={styles.emptyText}>Tap here to create your first box.</Text>
      </Pressable>
    );
  };

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.container}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoidingView}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.mainContent}>
            <View style={styles.leftColumn}>
              <View style={styles.filterCard}>
                <View style={styles.filterHeaderRow}>
                  <Text style={styles.sectionTitle}>Search</Text>
                  <View style={styles.filterTabs}>
                    {([
                      { key: "available", label: "Available" },
                      { key: "checked-out", label: "Checked-out" },
                      { key: "unavailable", label: "Unavailable" },
                    ] as const).map((filter) => {
                      const isActive = statusFilters.includes(filter.key);

                      return (
                        <Pressable
                          key={filter.key}
                          style={[styles.filterTab, isActive ? styles.filterTabActive : undefined]}
                          onPress={() => toggleStatusFilter(filter.key)}
                        >
                          <Text
                            style={[
                              styles.filterTabText,
                              isActive ? styles.filterTabTextActive : undefined,
                            ]}
                          >
                            {filter.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search box id or customer"
                  placeholderTextColor={"#7A8F87"}
                  style={styles.input}
                />
              </View>

              <View style={styles.listCard}>
                <FlatList
                  data={boxes}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.listContent}
                  keyboardShouldPersistTaps="handled"
                  initialNumToRender={12}
                  maxToRenderPerBatch={12}
                  updateCellsBatchingPeriod={50}
                  windowSize={7}
                  removeClippedSubviews
                  onEndReached={loadMoreBoxes}
                  onEndReachedThreshold={0.4}
                  ListEmptyComponent={
                    listLoading ? (
                      <View style={styles.emptyState}>
                        <ActivityIndicator size="large" color="#0D7A4E" />
                      </View>
                    ) : (
                      renderEmptyState()
                    )
                  }
                  ListFooterComponent={
                    loadingMore ? (
                      <View style={styles.listFooter}>
                        <ActivityIndicator size="small" color="#0D7A4E" />
                      </View>
                    ) : null
                  }
                  renderItem={({ item }) => {
                    const daysOut = getDaysOut(item.dateOut);
                    const isWarning = item.status === "checked-out" && daysOut > 7 && daysOut <= 14;
                    const isOverdue = item.status === "checked-out" && daysOut > 14;

                    return (
                      <Pressable
                        style={[styles.row, selectedBoxId === item.id ? styles.selectedRow : null]}
                        onPress={() => openBoxDetails(item)}
                      >
                        <View>
                          <Text style={styles.boxId}>{item.id}</Text>
                          <Text style={styles.subText}>{item.customerName ?? "No customer"}</Text>
                        </View>
                        <View style={styles.rowRightWrap}>
                          <View
                            style={[
                              styles.statusTag,
                              item.status === "available"
                                ? styles.availableTag
                                : item.status === "unavailable"
                                  ? styles.unavailableTag
                                  : styles.outTag,
                            ]}
                          >
                            <Text
                              style={[
                                styles.statusText,
                                item.status === "available"
                                  ? styles.availableText
                                  : item.status === "unavailable"
                                    ? styles.unavailableText
                                    : styles.outText,
                              ]}
                            >
                              {item.status}
                            </Text>
                          </View>

                          {isWarning ? (
                            <View style={[styles.statusTag, styles.warningTag]}>
                              <Text style={[styles.statusText, styles.warningText]}>Almost</Text>
                            </View>
                          ) : null}

                          {isOverdue ? (
                            <View style={[styles.statusTag, styles.overdueTag]}>
                              <Text style={[styles.statusText, styles.overdueText]}>Overdue</Text>
                            </View>
                          ) : null}

                          <Ionicons name="chevron-forward" size={18} color="#7A8F87" />
                        </View>
                      </Pressable>
                    );
                  }}
                />
              </View>
            </View>

            <View style={styles.detailsCard}>
              <Text style={styles.sectionTitle}>Box Details</Text>

              <ScrollView
                style={styles.detailsScroll}
                contentContainerStyle={styles.detailsBody}
                showsVerticalScrollIndicator={false}
              >
                {!selectedBox ? (
                  <View style={styles.detailsEmptyState}>
                    <Ionicons name="information-circle-outline" size={30} color="#7A8F87" />
                    <Text style={styles.detailsEmptyText}>Select a box to view details.</Text>
                  </View>
                ) : (
                  <>
                  {(() => {
                    const selectedBoxDaysOut =
                      selectedBox.status === "checked-out" ? getDaysOut(selectedBox.dateOut) : 0;
                    const selectedBoxIsWarning = selectedBoxDaysOut > 7 && selectedBoxDaysOut <= 14;
                    const selectedBoxIsOverdue = selectedBoxDaysOut > 14;

                    return (
                      <>
                  <View style={styles.boxIdentityBlock}>
                    <Text style={styles.panelBoxId}>{selectedBox.id}</Text>
                  </View>

                  <Pressable style={styles.historyButton} onPress={openTransactions}>
                    <Ionicons name="receipt-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.historyButtonText}>View Transactions</Text>
                  </Pressable>

                  {selectedBox.status !== "unavailable" || isAdmin ? (
                  <Pressable
                    style={[
                      styles.availabilityButton,
                      selectedBox.status === "unavailable"
                        ? styles.makeAvailableButton
                        : styles.makeUnavailableButton,
                    ]}
                    onPress={toggleAvailability}
                  >
                    <Ionicons
                      name={selectedBox.status === "unavailable" ? "checkmark-circle-outline" : "ban-outline"}
                      size={16}
                      color="#FFFFFF"
                    />
                    <Text style={styles.availabilityButtonText}>
                      {selectedBox.status === "unavailable" ? "Mark as Available" : "Mark as Unavailable"}
                    </Text>
                  </Pressable>
                  ) : null}

                  <View style={styles.statsRow}>
                    <View style={[styles.statCard, { width: statCardWidth }]}>
                      <Text style={styles.statLabel}>Status</Text>
                      <Text
                        style={[
                          styles.statValue,
                          selectedBox.status === "available"
                            ? styles.availableValue
                            : selectedBox.status === "unavailable"
                              ? styles.unavailableValue
                              : styles.outValue,
                        ]}
                      >
                        {selectedBox.status === "available"
                          ? "Available"
                          : selectedBox.status === "unavailable"
                            ? "Unavailable"
                            : "Checked-out"}
                      </Text>
                    </View>

                    <View style={[styles.statCard, { width: statCardWidth }]}>
                      <Text style={styles.statLabel}>Days Out</Text>
                      <Text style={[styles.statValue, styles.daysValue]}>
                        {selectedBoxDaysOut}
                      </Text>
                    </View>

                    <View style={[styles.statCard, { width: statCardWidth }]}>
                      <Text style={styles.statLabel}>Late Risk</Text>
                      <Text
                        style={[
                          styles.statValue,
                          selectedBoxIsOverdue
                            ? styles.lateValue
                            : selectedBoxIsWarning
                              ? styles.warningValue
                              : styles.safeValue,
                        ]}
                      >
                        {selectedBoxIsOverdue
                          ? "Overdue"
                          : selectedBoxIsWarning
                            ? "Almost"
                            : "Normal"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.panelRow}>
                    <Text style={styles.panelLabel}>Customer</Text>
                    <Text style={styles.panelValue}>{selectedBox.customerName || "-"}</Text>
                  </View>

                  <View style={styles.panelRow}>
                    <Text style={styles.panelLabel}>Date Out</Text>
                    <Text style={styles.panelValue}>
                      {selectedBox.dateOut ? new Date(selectedBox.dateOut).toLocaleDateString() : "-"}
                    </Text>
                  </View>
                      </>
                    );
                  })()}
                  </>
                )}
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>

      <TransactionHistoryModal
        visible={transactionsModalOpen}
        title={selectedBox ? `${selectedBox.id} Transactions` : "Box Transactions"}
        context="box"
        transactions={transactions}
        isLoading={transactionsLoading}
        onClose={() => {
          setTransactionsModalOpen(false);
          setTransactions([]);
        }}
      />
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
  keyboardAvoidingView: {
    flex: 1,
  },
  mainContent: {
    flex: 1,
    flexDirection: "row",
    gap: 12,
  },
  leftColumn: {
    flex: 1.25,
    gap: 12,
  },
  filterCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#DDEBE6",
  },
  listCard: {
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
  filterHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#C7D8D1",
    borderRadius: 10,
    paddingHorizontal: 12,
    // paddingVertical: 10,
  },
  filterTabs: {
    flexDirection: "row",
    gap: 8,
    flexShrink: 1,
  },
  filterTab: {
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#C7D8D1",
    backgroundColor: "#F8FBFA",
  },
  filterTabActive: {
    backgroundColor: "#0D7A4E",
    borderColor: "#0D7A4E",
  },
  filterTabText: {
    color: "#36584D",
    fontSize: 12,
    fontWeight: "700",
  },
  filterTabTextActive: {
    color: "#FFFFFF",
  },
  listContent: {
    paddingTop: 2,
    paddingBottom: 0,
    gap: 8,
  },
  listFooter: {
    paddingVertical: 12,
    alignItems: "center",
  },
  detailsCard: {
    flex: 0.95,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DDEBE6",
    padding: 14,
  },
  detailsEmptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#CFE0D9",
    borderRadius: 10,
    padding: 16,
  },
  detailsEmptyText: {
    marginTop: 8,
    color: "#5D746A",
    fontSize: 13,
    textAlign: "center",
  },
  detailsBody: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  detailsScroll: {
    flex: 1,
  },
  boxIdentityBlock: {
    marginBottom: 10,
  },
  panelBoxId: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0D4A37",
    marginBottom: 3,
  },
  identitySubText: {
    color: "#6B7D76",
    fontSize: 12,
    marginTop: 1,
  },
  historyButton: {
    marginBottom: 12,
    backgroundColor: "#0D7A4E",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  historyButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  availabilityButton: {
    marginBottom: 12,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  makeUnavailableButton: {
    backgroundColor: "#8B5E00",
  },
  makeAvailableButton: {
    backgroundColor: "#0D7A4E",
  },
  availabilityButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  statCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E0ECE7",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  statLabel: {
    color: "#5C7269",
    fontSize: 11,
    fontWeight: "600",
  },
  statValue: {
    marginTop: 6,
    fontSize: 18,
    fontWeight: "800",
  },
  availableValue: {
    color: "#0D7A4E",
  },
  unavailableValue: {
    color: "#8B5E00",
  },
  outValue: {
    color: "#1C5AA6",
  },
  daysValue: {
    color: "#0D4A37",
  },
  lateValue: {
    color: "#BD2323",
  },
  safeValue: {
    color: "#2D7A4E",
  },
  warningValue: {
    color: "#A16F00",
  },
  panelRow: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#EDF4F1",
  },
  panelLabel: {
    color: "#5C7269",
    fontSize: 12,
  },
  panelValue: {
    color: "#1E2A26",
    fontSize: 15,
    fontWeight: "600",
    marginTop: 4,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#DDEBE6",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 12,
  },
  selectedRow: {
    borderColor: "#9ECAB6",
    backgroundColor: "#F2FAF7",
  },
  rowRightWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  boxId: {
    color: "#0E4938",
    fontWeight: "700",
    fontSize: 14,
  },
  subText: {
    marginTop: 2,
    fontSize: 12,
    color: "#60756C",
  },
  statusTag: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  availableTag: {
    backgroundColor: "#E7F4EE",
    borderColor: "#C4E0D2",
  },
  unavailableTag: {
    backgroundColor: "#FFF2D6",
    borderColor: "#E7C27A",
  },
  outTag: {
    backgroundColor: "#E8F0FB",
    borderColor: "#C8DBF4",
  },
  warningTag: {
    backgroundColor: "#FFF6CC",
    borderColor: "#E4C85A",
  },
  overdueTag: {
    backgroundColor: "#FFE0E0",
    borderColor: "#E25A5A",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
  },
  availableText: {
    color: "#0B5D44",
  },
  unavailableText: {
    color: "#8B5E00",
  },
  outText: {
    color: "#285D9E",
  },
  loadingText: {
    color: "#2D5A4B",
    fontWeight: "600",
    backgroundColor: "#E6F2ED",
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  emptyState: {
    marginTop: 8,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#BFD7CE",
    borderRadius: 12,
    paddingVertical: 28,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  emptyTitle: {
    marginTop: 10,
    fontSize: 17,
    fontWeight: "700",
    color: "#0D4A37",
  },
  emptyText: {
    marginTop: 4,
    fontSize: 13,
    color: "#577066",
  },
  warningText: {
    color: "#725300",
  },
  overdueText: {
    color: "#8E1F1F",
  },
});
