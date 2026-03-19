import { useAppData } from "@/store/AppDataContext";
import { BoxStatus } from "@/types/app";
import { fetchTransactionsByBoxId } from "@/database/appDatabase";
import { TransactionHistoryItem } from "@/types/app";
import { TransactionHistoryModal } from "@/ui/TransactionHistoryModal";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
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
  const { boxes, getDaysOut, isReady, refreshData, setBoxAvailability } = useAppData();
  const { width } = useWindowDimensions();
  const [search, setSearch] = useState("");
  const [statusFilters, setStatusFilters] = useState<BoxStatus[]>(["available", "checked-out"]);
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
  const [transactionsModalOpen, setTransactionsModalOpen] = useState(false);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [transactions, setTransactions] = useState<TransactionHistoryItem[]>([]);
  const statCardWidth = width < 950 ? "48.5%" : "31.5%";

  const filteredBoxes = useMemo(() => {
    const query = search.trim().toLowerCase();
    const sorted = [...boxes]
      .filter((box) => statusFilters.includes(box.status))
      .sort((a, b) => a.id.localeCompare(b.id));

    if (!query) {
      return sorted;
    }

    return sorted.filter((box) => box.id.toLowerCase().includes(query));
  }, [boxes, search, statusFilters]);

  const selectedBox = useMemo(
    () => (selectedBoxId ? boxes.find((box) => box.id === selectedBoxId) ?? null : null),
    [boxes, selectedBoxId],
  );

  useFocusEffect(
    useCallback(() => {
      if (isReady) {
        refreshData();
      }
    }, [isReady, refreshData]),
  );

  const openCreateBox = () => {
    router.push("/(auth)/create-box");
  };

  const openBoxDetails = (boxId: string) => setSelectedBoxId(boxId);

  const openTransactions = async () => {
    if (!selectedBox) {
      return;
    }

    setTransactionsModalOpen(true);
    setTransactionsLoading(true);

    try {
      const items = await fetchTransactionsByBoxId(selectedBox.id);
      setTransactions(items);
    } finally {
      setTransactionsLoading(false);
    }
  };

  const toggleAvailability = async () => {
    if (!selectedBox) {
      return;
    }

    const nextStatus = selectedBox.status === "unavailable" ? "available" : "unavailable";
    await setBoxAvailability(selectedBox.id, nextStatus);
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

    if (!isReady) {
      return null;
    }

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
      <Pressable style={styles.emptyState} onPress={openCreateBox}>
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
          {!isReady ? <Text style={styles.loadingText}>Initializing database...</Text> : null}

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
                  placeholder="Search box id"
                  placeholderTextColor={"#7A8F87"}
                  style={styles.input}
                />
              </View>

              <View style={styles.listCard}>
                <FlatList
                  data={filteredBoxes}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.listContent}
                  keyboardShouldPersistTaps="handled"
                  ListEmptyComponent={renderEmptyState}
                  renderItem={({ item }) => {
                    const daysOut = getDaysOut(item.dateOut);
                    const isWarning = item.status === "checked-out" && daysOut > 7 && daysOut <= 14;
                    const isOverdue = item.status === "checked-out" && daysOut > 14;

                    return (
                      <Pressable
                        style={[styles.row, selectedBoxId === item.id ? styles.selectedRow : null]}
                        onPress={() => openBoxDetails(item.id)}
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
        onClose={() => setTransactionsModalOpen(false)}
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
