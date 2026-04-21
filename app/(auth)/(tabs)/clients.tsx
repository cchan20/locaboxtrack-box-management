import { useAppData } from "@/store/AppDataContext";
import { useAuth } from "@/store/AuthContext";
import { ROOT_PASSWORD } from "@/constants/auth";
import { fetchTransactionsByCustomerId } from "@/database/appDatabase";
import { TransactionHistoryItem } from "@/types/app";
import { TransactionHistoryModal } from "@/ui/TransactionHistoryModal";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  Text,
  TextInput,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ClientsScreen() {
  const router = useRouter();
  const { customers, boxes, isReady, refreshData, setCustomerRiskStatus, setCustomerCreditCount, deleteCustomerById } = useAppData();
  const { loginUser } = useAuth();
  const { width } = useWindowDimensions();
  const [search, setSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [isEditingCredit, setIsEditingCredit] = useState(false);
  const [creditDraft, setCreditDraft] = useState(1);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeletingCustomer, setIsDeletingCustomer] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deletePasswordError, setDeletePasswordError] = useState<string | null>(null);
  const [isDeletePasswordHidden, setIsDeletePasswordHidden] = useState(true);
  const [transactionsModalOpen, setTransactionsModalOpen] = useState(false);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [transactions, setTransactions] = useState<TransactionHistoryItem[]>([]);
  const statCardWidth = width < 950 ? "48.5%" : "31.5%";

  const sortByRemainingCredit = (a: typeof customers[number], b: typeof customers[number]) => {
    const remainingA = a.creditCount - a.currentTaken;
    const remainingB = b.creditCount - b.currentTaken;
    if (remainingA !== remainingB) return remainingA - remainingB;
    return a.name.localeCompare(b.name);
  };

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return [...customers].sort(sortByRemainingCredit);
    }

    return customers
      .filter(
        (customer) =>
          customer.name.toLowerCase().includes(query) ||
          customer.phone.includes(query) ||
          customer.email.toLowerCase().includes(query),
      )
      .sort(sortByRemainingCredit);
  }, [customers, search]);

  useFocusEffect(
    useCallback(() => {
      if (isReady) {
        refreshData();
      }
    }, [isReady, refreshData]),
  );

  const selectedClient = useMemo(
    () => (selectedClientId ? customers.find((c) => c.id === selectedClientId) ?? null : null),
    [customers, selectedClientId],
  );

  const checkedOutBoxes = useMemo(() => {
    if (!selectedClient) {
      return [];
    }

    return boxes
      .filter((box) => box.status === "checked-out" && box.customerId === selectedClient.id)
      .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' }));
  }, [boxes, selectedClient]);

  useEffect(() => {
    setIsEditingCredit(false);
    setCreditDraft(1);
  }, [selectedClientId]);

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setDeletePassword("");
    setDeletePasswordError(null);
    setIsDeletePasswordHidden(true);
  };

  const openCreateClient = () => {
    router.push("/(auth)/create-client");
  };

  const openEditClient = () => {
    if (!selectedClient) {
      return;
    }

    router.push({
      pathname: "/(auth)/create-client",
      params: { customerId: selectedClient.id },
    });
  };

  const openClientDetails = (clientId: string) => setSelectedClientId(clientId);

  const openTransactions = async () => {
    if (!selectedClient) {
      return;
    }

    setTransactionsModalOpen(true);
    setTransactionsLoading(true);

    try {
      const items = await fetchTransactionsByCustomerId(selectedClient.id);
      setTransactions(items);
    } finally {
      setTransactionsLoading(false);
    }
  };

  const updateRiskStatus = async (riskStatus: "low" | "medium" | "high") => {
    if (!selectedClient) {
      return;
    }

    const result = await setCustomerRiskStatus(selectedClient.id, riskStatus);
    Alert.alert(result.ok ? "Success" : "Error", result.message);
  };

  const openChangeCredit = () => {
    if (!selectedClient) {
      return;
    }

    setCreditDraft(Math.max(1, selectedClient.creditCount));
    setIsEditingCredit(true);
  };

  const updateCreditCount = async () => {
    if (!selectedClient) {
      return;
    }

    if (!Number.isFinite(creditDraft) || creditDraft < 1) {
      Alert.alert("Invalid credit", "Credit must be at least 1.");
      return;
    }

    const result = await setCustomerCreditCount(selectedClient.id, creditDraft);
    if (!result.ok) {
      Alert.alert("Error", result.message);
      return;
    }

    setIsEditingCredit(false);
  };

  const openDeleteCustomerConfirm = () => {
    if (!selectedClient) {
      return;
    }

    const hasLinkedBox = boxes.some((box) => box.customerId === selectedClient.id);

    if (hasLinkedBox) {
      Alert.alert("Cannot delete customer", "This customer is currently linked to one or more boxes.");
      return;
    }

    setDeletePassword("");
    setDeletePasswordError(null);
    setIsDeletePasswordHidden(true);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteCustomer = async () => {
    if (!selectedClient || isDeletingCustomer) {
      return;
    }

    const normalizedDeletePassword = deletePassword.trim();

    if (!normalizedDeletePassword) {
      setDeletePasswordError("Root password is required.");
      return;
    }

    if (normalizedDeletePassword !== ROOT_PASSWORD) {
      setDeletePasswordError("Incorrect root password.");
      return;
    }

    setDeletePasswordError(null);

    setIsDeletingCustomer(true);

    try {
      const result = await deleteCustomerById(selectedClient.id);

      if (!result.ok) {
        Alert.alert("Error", result.message);
        return;
      }

      closeDeleteModal();
      setSelectedClientId(null);
      Alert.alert("Success", result.message);
    } finally {
      setIsDeletingCustomer(false);
    }
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
          <Text style={styles.emptyTitle}>No matching clients</Text>
          <Text style={styles.emptyText}>Try a different keyword.</Text>
        </View>
      );
    }

    return (
      <Pressable style={styles.emptyState} onPress={openCreateClient}>
        <Ionicons name="person-add-outline" size={36} color="#0D7A4E" />
        <Text style={styles.emptyTitle}>No clients yet</Text>
        <Text style={styles.emptyText}>
          Tap here to create your first client.
        </Text>
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
          {!isReady ? (
            <Text style={styles.loadingText}>Initializing database...</Text>
          ) : null}

          <View style={styles.mainContent}>
            <View style={styles.leftColumn}>
              <View style={styles.filterCard}>
                <Text style={styles.sectionTitle}>Search</Text>
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search name, phone, email"
                  placeholderTextColor={"#7A8F87"}
                  style={styles.input}
                />
              </View>

              <View style={styles.listCard}>
                <FlatList
                  data={filtered}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.listContent}
                  keyboardShouldPersistTaps="handled"
                  ListEmptyComponent={renderEmptyState}
                  renderItem={({ item }) => (
                    <Pressable
                      style={[styles.clientItem, selectedClientId === item.id ? styles.selectedItem : null]}
                      onPress={() => openClientDetails(item.id)}
                    >
                      <View style={styles.clientIdentityRow}>
                        <View>
                          <View style={styles.clientNameRow}>
                            <Text style={styles.clientName}>{item.name}</Text>
                            {item.riskStatus === "medium" ? <View style={[styles.riskDot, styles.mediumDot]} /> : null}
                            {item.riskStatus === "high" ? <View style={[styles.riskDot, styles.highDot]} /> : null}
                          </View>
                          <Text style={styles.clientSub}>{item.phone}</Text>
                          <Text style={styles.clientSub}>{item.email}</Text>
                        </View>
                      </View>
                      <View style={styles.itemRightWrap}>
                        <View
                          style={[
                            styles.balanceTag,
                            item.currentTaken > item.creditCount ? styles.balanceTagOverLimit : null,
                          ]}
                        >
                          <Text
                            style={[
                              styles.balanceText,
                              item.currentTaken > item.creditCount ? styles.balanceTextOverLimit : null,
                            ]}
                          >
                            {item.currentTaken} / {item.creditCount}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color="#7A8F87" />
                      </View>
                    </Pressable>
                  )}
                />
              </View>
            </View>

            <View style={styles.detailsCard}>
              <View style={styles.detailsTitleRow}>
                <Text style={styles.sectionTitle}>Customer Details</Text>
                {selectedClient ? (
                  <Pressable style={styles.editCustomerButton} onPress={openEditClient}>
                    <Text style={styles.editCustomerButtonText}>Edit</Text>
                  </Pressable>
                ) : null}
              </View>

              <ScrollView
                style={styles.detailsScroll}
                contentContainerStyle={styles.detailsBody}
                showsVerticalScrollIndicator={false}
              >
                {!selectedClient ? (
                  <View style={styles.detailsEmptyState}>
                    <Ionicons name="information-circle-outline" size={30} color="#7A8F87" />
                    <Text style={styles.detailsEmptyText}>Select a client to view details.</Text>
                  </View>
                ) : (
                  <>
                  {selectedClient.currentTaken > selectedClient.creditCount ? (
                    <View style={styles.creditWarningBanner}>
                      <Text style={styles.creditWarningText}>Credit limit exceeded.</Text>
                    </View>
                  ) : null}
                  <View style={styles.clientIdentityBlock}>
                    <View style={styles.panelNameRow}>
                      <Text style={styles.panelName}>{selectedClient.name}</Text>
                      <View style={styles.clientStatusTags}>
                        <View
                          style={[
                            styles.riskTag,
                            selectedClient.riskStatus === "low"
                              ? styles.riskTagLow
                              : selectedClient.riskStatus === "medium"
                                ? styles.riskTagMedium
                                : styles.riskTagHigh,
                          ]}
                        >
                          <Text
                            style={[
                              styles.riskTagText,
                              selectedClient.riskStatus === "low"
                                ? styles.riskTagTextLow
                                : selectedClient.riskStatus === "medium"
                                  ? styles.riskTagTextMedium
                                  : styles.riskTagTextHigh,
                            ]}
                          >
                            {selectedClient.riskStatus === "low"
                              ? "Low Risk"
                              : selectedClient.riskStatus === "medium"
                                ? "Medium Risk"
                                : "High Risk"}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.creditTag,
                            selectedClient.currentTaken > selectedClient.creditCount
                              ? styles.creditTagOverLimit
                              : styles.creditTagNormal,
                          ]}
                        >
                          <Text
                            style={[
                              styles.creditTagText,
                              selectedClient.currentTaken > selectedClient.creditCount
                                ? styles.creditTagTextOverLimit
                                : styles.creditTagTextNormal,
                            ]}
                          >
                            {selectedClient.currentTaken} / {selectedClient.creditCount}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <Text style={styles.identitySubText}>{selectedClient.phone}</Text>
                    <Text style={styles.identitySubText}>{selectedClient.email}</Text>
                  </View>

                  <Pressable style={styles.historyButton} onPress={openTransactions}>
                    <Ionicons name="receipt-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.historyButtonText}>View Transactions</Text>
                  </Pressable>

                  <View style={styles.statsRow}>
                    <View style={[styles.statCard, { width: statCardWidth }]}>
                      <Text style={styles.statLabel}>Total Taken</Text>
                      <Text style={[styles.statValue, styles.takenValue]}>{selectedClient.totalTaken}</Text>
                    </View>

                    <View style={[styles.statCard, { width: statCardWidth }]}>
                      <Text style={styles.statLabel}>Total Returned</Text>
                      <Text style={[styles.statValue, styles.returnedValue]}>{selectedClient.totalReturned}</Text>
                    </View>

                    <View style={[styles.statCard, { width: statCardWidth }]}>
                      <Text style={styles.statLabel}>Late Returns</Text>
                      <Text style={[styles.statValue, styles.lateValue]}>{selectedClient.lateReturns}</Text>
                    </View>
                  </View>

                  <View style={styles.panelRow}>
                    <Text style={styles.panelLabel}>Checked-out Boxes</Text>
                    <View style={styles.boxTagWrap}>
                      {checkedOutBoxes.length === 0 ? (
                        <Text style={styles.boxEmptyText}>No boxes currently checked out.</Text>
                      ) : (
                        checkedOutBoxes.map((box) => (
                          <View key={box.id} style={styles.boxTag}>
                            <Text style={styles.boxTagText}>{box.id}</Text>
                          </View>
                        ))
                      )}
                    </View>
                  </View>

                  <View style={styles.riskActionsSection}>
                    {selectedClient.riskStatus === "low" ? (
                      <Pressable
                        style={[styles.riskActionButton, styles.mediumRiskActionButton]}
                        onPress={() => updateRiskStatus("medium")}
                      >
                        <Text style={styles.riskActionButtonText}>Change to Medium Risk</Text>
                      </Pressable>
                    ) : null}

                    {selectedClient.riskStatus === "medium" ? (
                      <View style={styles.riskTwoButtonsRow}>
                        <Pressable
                          style={[styles.riskActionButton, styles.lowRiskActionButton]}
                          onPress={() => updateRiskStatus("low")}
                        >
                          <Text style={styles.riskActionButtonText}>Change to Low Risk</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.riskActionButton, styles.highRiskActionButton]}
                          onPress={() => updateRiskStatus("high")}
                        >
                          <Text style={styles.riskActionButtonText}>Change to High Risk</Text>
                        </Pressable>
                      </View>
                    ) : null}

                    {selectedClient.riskStatus === "high" ? (
                      <Pressable
                        style={[styles.riskActionButton, styles.mediumRiskActionButton]}
                        onPress={() => updateRiskStatus("medium")}
                      >
                        <Text style={styles.riskActionButtonText}>Change to Medium Risk</Text>
                      </Pressable>
                    ) : null}

                    <Pressable style={[styles.riskActionButton, styles.creditActionButton]} onPress={openChangeCredit}>
                      <Text style={styles.riskActionButtonText}>Change Credit</Text>
                    </Pressable>

                    {loginUser?.type === "root" ? (
                      <Pressable style={[styles.riskActionButton, styles.deleteCustomerActionButton]} onPress={openDeleteCustomerConfirm}>
                        <Text style={styles.riskActionButtonText}>Delete Customer</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  </>
                )}
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>

      <TransactionHistoryModal
        visible={transactionsModalOpen}
        title={selectedClient ? `${selectedClient.name} Transactions` : "Client Transactions"}
        context="client"
        transactions={transactions}
        isLoading={transactionsLoading}
        onClose={() => setTransactionsModalOpen(false)}
      />

      <Modal
        visible={isDeleteModalOpen}
        animationType="fade"
        transparent
        onRequestClose={closeDeleteModal}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <KeyboardAvoidingView
            style={styles.modalKeyboardAvoidingView}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <View style={styles.creditModalOverlay}>
              <View style={styles.creditModalCard}>
                <Text style={styles.creditModalTitle}>Delete Customer</Text>
                <Text style={styles.deleteModalText}>
                  Are you sure you want to delete {selectedClient?.name ?? "this customer"}? This action cannot be undone.
                </Text>

                <Text style={styles.creditEditorLabel}>Root Password</Text>
                <View style={styles.passwordFieldWrap}>
                  <TextInput
                    value={deletePassword}
                    onChangeText={(value) => {
                      setDeletePassword(value);
                      if (deletePasswordError) {
                        setDeletePasswordError(null);
                      }
                    }}
                    placeholder="Enter root password"
                    placeholderTextColor="#6B7D76"
                    secureTextEntry={isDeletePasswordHidden}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isDeletingCustomer}
                    style={[
                      styles.input,
                      styles.modalInput,
                      deletePasswordError ? styles.inputError : null,
                    ]}
                  />
                  <Pressable
                    onPress={() => setIsDeletePasswordHidden((current) => !current)}
                    style={styles.passwordToggleButton}
                    disabled={isDeletingCustomer}
                    accessibilityRole="button"
                    accessibilityLabel={isDeletePasswordHidden ? "Show password" : "Hide password"}
                  >
                    <Ionicons
                      name={isDeletePasswordHidden ? "eye-outline" : "eye-off-outline"}
                      size={19}
                      color="#0E6045"
                    />
                  </Pressable>
                </View>
                {deletePasswordError ? <Text style={styles.deleteModalErrorText}>{deletePasswordError}</Text> : null}

                <View style={styles.creditEditorActionsRow}>
                  <Pressable
                    style={[styles.creditEditorButton, styles.creditEditorCancelButton]}
                    onPress={closeDeleteModal}
                    disabled={isDeletingCustomer}
                  >
                    <Text style={styles.creditEditorCancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.creditEditorButton, styles.deleteModalConfirmButton]}
                    onPress={confirmDeleteCustomer}
                    disabled={isDeletingCustomer}
                  >
                    <Text style={styles.creditEditorSaveText}>
                      {isDeletingCustomer ? "Deleting..." : "Confirm Delete"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={isEditingCredit}
        animationType="fade"
        transparent
        onRequestClose={() => setIsEditingCredit(false)}
      >
        <View style={styles.creditModalOverlay}>
          <View style={styles.creditModalCard}>
            <Text style={styles.creditModalTitle}>Change Credit</Text>
            <Text style={styles.creditEditorLabel}>Credit Count</Text>

            <View style={styles.creditStepperRow}>
              <Pressable
                style={styles.creditStepperButton}
                onPress={() => setCreditDraft((prev) => Math.max(1, prev - 1))}
              >
                <Text style={styles.creditStepperButtonText}>-</Text>
              </Pressable>
              <Text style={styles.creditStepperValue}>{creditDraft}</Text>
              <Pressable style={styles.creditStepperButton} onPress={() => setCreditDraft((prev) => prev + 1)}>
                <Text style={styles.creditStepperButtonText}>+</Text>
              </Pressable>
            </View>

            <View style={styles.creditEditorActionsRow}>
              <Pressable
                style={[styles.creditEditorButton, styles.creditEditorCancelButton]}
                onPress={() => setIsEditingCredit(false)}
              >
                <Text style={styles.creditEditorCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.creditEditorButton, styles.creditEditorSaveButton]}
                onPress={updateCreditCount}
              >
                <Text style={styles.creditEditorSaveText}>Save Credit</Text>
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
  detailsCard: {
    flex: 0.95,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DDEBE6",
    padding: 14,
  },
  detailsTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  editCustomerButton: {
    borderWidth: 1,
    borderColor: "#A9C8BA",
    backgroundColor: "#EDF7F3",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  editCustomerButtonText: {
    color: "#0E6045",
    fontSize: 12,
    fontWeight: "700",
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
  clientIdentityBlock: {
    marginBottom: 10,
  },
  creditWarningBanner: {
    marginBottom: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ECA5A5",
    backgroundColor: "#FFE9E9",
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  creditWarningText: {
    color: "#A61F1F",
    fontWeight: "700",
    fontSize: 12,
  },
  panelNameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  clientStatusTags: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 6,
  },
  panelName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0D4A37",
    marginBottom: 3,
  },
  riskTag: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  riskTagLow: {
    backgroundColor: "#E7F4EE",
    borderColor: "#C4E0D2",
  },
  riskTagMedium: {
    backgroundColor: "#FFF3D6",
    borderColor: "#F2D08A",
  },
  riskTagHigh: {
    backgroundColor: "#FDE9E9",
    borderColor: "#F1B5B5",
  },
  riskTagText: {
    fontSize: 12,
    fontWeight: "700",
  },
  riskTagTextLow: {
    color: "#0D7A4E",
  },
  riskTagTextMedium: {
    color: "#9A6A00",
  },
  riskTagTextHigh: {
    color: "#BD2323",
  },
  creditTag: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  creditTagNormal: {
    backgroundColor: "#E8F4EC",
    borderColor: "#CBE4D5",
  },
  creditTagOverLimit: {
    backgroundColor: "#FEE3E3",
    borderColor: "#F4B1B1",
  },
  creditTagText: {
    fontSize: 12,
    fontWeight: "700",
  },
  creditTagTextNormal: {
    color: "#0B5D44",
  },
  creditTagTextOverLimit: {
    color: "#B91C1C",
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
    fontSize: 20,
    fontWeight: "800",
  },
  takenValue: {
    color: "#1C5AA6",
  },
  returnedValue: {
    color: "#0D7A4E",
  },
  lateValue: {
    color: "#BD2323",
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
  boxTagWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  boxTag: {
    backgroundColor: "#E7F4EE",
    borderWidth: 1,
    borderColor: "#C4E0D2",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  boxTagText: {
    color: "#0B5D44",
    fontSize: 12,
    fontWeight: "700",
  },
  boxEmptyText: {
    color: "#5D746A",
    fontSize: 13,
  },
  riskActionsSection: {
    marginTop: 14,
    gap: 8,
  },
  riskTwoButtonsRow: {
    flexDirection: "row",
    gap: 8,
  },
  riskActionButton: {
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  lowRiskActionButton: {
    backgroundColor: "#0D7A4E",
  },
  mediumRiskActionButton: {
    backgroundColor: "#C48700",
  },
  highRiskActionButton: {
    backgroundColor: "#BD2323",
  },
  riskActionButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },
  creditActionButton: {
    backgroundColor: "#2F6EA3",
  },
  deleteCustomerActionButton: {
    backgroundColor: "#BD2323",
  },
  creditModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(16, 35, 28, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modalKeyboardAvoidingView: {
    flex: 1,
  },
  creditModalCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D8E6E0",
    backgroundColor: "#F9FCFB",
    padding: 14,
  },
  creditModalTitle: {
    color: "#0D4A37",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 10,
  },
  creditEditorLabel: {
    color: "#35574A",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },
  passwordFieldWrap: {
    position: "relative",
  },
  passwordToggleButton: {
    position: "absolute",
    right: 10,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  modalInput: {
    paddingRight: 44,
  },
  creditStepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  creditStepperButton: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#BCD3C9",
    backgroundColor: "#FFFFFF",
  },
  creditStepperButtonText: {
    color: "#1D4F3E",
    fontSize: 22,
    lineHeight: 22,
    fontWeight: "800",
  },
  creditStepperValue: {
    minWidth: 72,
    textAlign: "center",
    fontSize: 24,
    fontWeight: "800",
    color: "#0D4A37",
  },
  creditEditorActionsRow: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
  },
  creditEditorButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  creditEditorCancelButton: {
    backgroundColor: "#E8EFEC",
  },
  creditEditorSaveButton: {
    backgroundColor: "#0D7A4E",
  },
  creditEditorCancelText: {
    color: "#35574A",
    fontWeight: "700",
    fontSize: 13,
  },
  creditEditorSaveText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },
  deleteModalText: {
    color: "#35574A",
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  deleteModalErrorText: {
    color: "#D93025",
    fontSize: 12,
    marginTop: 6,
  },
  deleteModalConfirmButton: {
    backgroundColor: "#BD2323",
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
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#C7D8D1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    color: "#1F1F1F",
  },
  inputError: {
    borderColor: "#D93025",
  },
  listContent: {
    paddingTop: 2,
    paddingBottom: 0,
    gap: 8,
  },
  emptyState: {
    marginTop: 8,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#BFD7CE",
    borderRadius: 12,
    paddingVertical: 26,
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
  clientItem: {
    borderWidth: 1,
    borderColor: "#DDEBE6",
    borderRadius: 10,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  clientIdentityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  riskDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  mediumDot: {
    backgroundColor: "#C48700",
  },
  highDot: {
    backgroundColor: "#BD2323",
  },
  selectedItem: {
    borderColor: "#9ECAB6",
    backgroundColor: "#F2FAF7",
  },
  itemRightWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  clientName: {
    fontWeight: "700",
    color: "#0D4A37",
    fontSize: 15,
  },
  clientNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  clientSub: {
    color: "#5F756C",
    fontSize: 12,
    marginTop: 2,
  },
  balanceTag: {
    minWidth: 32,
    minHeight: 32,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E7F4EE",
    borderWidth: 1,
    borderColor: "#C4E0D2",
    paddingHorizontal: 8,
  },
  balanceTagOverLimit: {
    backgroundColor: "#FEE3E3",
    borderColor: "#F4B1B1",
  },
  balanceText: {
    color: "#0B5D44",
    fontWeight: "700",
  },
  balanceTextOverLimit: {
    color: "#B91C1C",
  },
  loadingText: {
    color: "#2D5A4B",
    fontWeight: "600",
    backgroundColor: "#E6F2ED",
    borderRadius: 10,
    padding: 10,
  },
});
