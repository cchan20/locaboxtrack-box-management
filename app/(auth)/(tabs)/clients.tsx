import { CUSTOMER_PAGE_SIZE, TRANSACTION_HISTORY_LIMIT } from "@/constants/config";
import { useAppDispatch } from "@/store/hooks";
import { getCheckedOutBoxes } from "@/store/slices/boxSlice";
import {
  getCustomerById,
  getCustomers,
  resetCustomerTempPassword,
  setCustomerCreditCount,
  setCustomerRiskStatus,
} from "@/store/slices/customerSlice";
import { getTransactionsByCustomer } from "@/store/slices/transactionSlice";
import { Box, Customer, TransactionHistoryItem } from "@/types/app";
import { getErrorMessage } from "@/utils/apiError";
import { ClearableTextInput } from "@/ui/ClearableTextInput";
import { TransactionHistoryModal } from "@/ui/TransactionHistoryModal";
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
  Text,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ClientsScreen() {
  const dispatch = useAppDispatch();
  const { width } = useWindowDimensions();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<Customer | null>(null);
  const [checkedOutBoxes, setCheckedOutBoxes] = useState<Box[]>([]);
  const [isEditingCredit, setIsEditingCredit] = useState(false);
  const [creditDraft, setCreditDraft] = useState(1);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [tempPasswordDraft, setTempPasswordDraft] = useState("");
  const [confirmTempPasswordDraft, setConfirmTempPasswordDraft] = useState("");
  const [isTempPasswordHidden, setIsTempPasswordHidden] = useState(true);
  const [isConfirmTempPasswordHidden, setIsConfirmTempPasswordHidden] = useState(true);
  const [isSavingTempPassword, setIsSavingTempPassword] = useState(false);
  const [transactionsModalOpen, setTransactionsModalOpen] = useState(false);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [transactions, setTransactions] = useState<TransactionHistoryItem[]>([]);
  const listRequestIdRef = useRef(0);
  const statCardWidth = width < 950 ? "48.5%" : "23.5%";

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadCustomerPage = useCallback(
    async (pageToLoad: number, append: boolean) => {
      const requestId = ++listRequestIdRef.current;
      if (append) {
        setLoadingMore(true);
      } else {
        setListLoading(true);
      }

      try {
        const response = await dispatch(
          getCustomers({
            search: debouncedSearch,
            page: pageToLoad,
            limit: CUSTOMER_PAGE_SIZE,
          }),
        ).unwrap();

        if (requestId !== listRequestIdRef.current) {
          return;
        }

        setCustomers((prev) => (append ? [...prev, ...response.data] : response.data));
        setPage(response.page);
        setHasMore(response.hasMore);
      } catch {
        if (requestId !== listRequestIdRef.current) {
          return;
        }
        if (!append) {
          setCustomers([]);
        }
        setHasMore(false);
      } finally {
        if (requestId === listRequestIdRef.current) {
          setListLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [debouncedSearch, dispatch],
  );

  const loadSelectedClientDetails = useCallback(async () => {
    if (!selectedClientId) {
      setSelectedClient(null);
      setCheckedOutBoxes([]);
      return;
    }

    try {
      const [detailResponse, allCheckedOutResponse] = await Promise.all([
        dispatch(getCustomerById(selectedClientId)).unwrap(),
        dispatch(getCheckedOutBoxes("")).unwrap(),
      ]);

      setSelectedClient(detailResponse.data);
      setCheckedOutBoxes(
        allCheckedOutResponse.data.filter((box) => box.customerId === selectedClientId),
      );
    } catch {
      setSelectedClient(null);
      setCheckedOutBoxes([]);
      setSelectedClientId(null);
    }
  }, [dispatch, selectedClientId]);

  // Keep latest details loader in a ref so focus refresh can update details
  // without depending on selectedClientId (which would reset the list).
  const loadSelectedClientDetailsRef = useRef(loadSelectedClientDetails);
  loadSelectedClientDetailsRef.current = loadSelectedClientDetails;

  useFocusEffect(
    useCallback(() => {
      void loadCustomerPage(1, false);
      void loadSelectedClientDetailsRef.current();
    }, [loadCustomerPage]),
  );

  useEffect(() => {
    void loadSelectedClientDetails();
  }, [loadSelectedClientDetails]);

  useEffect(() => {
    setIsEditingCredit(false);
    setCreditDraft(1);
    setIsResettingPassword(false);
    setTempPasswordDraft("");
    setConfirmTempPasswordDraft("");
    setIsTempPasswordHidden(true);
    setIsConfirmTempPasswordHidden(true);
    setIsSavingTempPassword(false);
  }, [selectedClientId]);

  const generateTempPassword = () => {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    let generated = "";
    for (let i = 0; i < 10; i += 1) {
      generated += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    setTempPasswordDraft(generated);
    setConfirmTempPasswordDraft(generated);
    setIsTempPasswordHidden(false);
    setIsConfirmTempPasswordHidden(false);
  };

  const loadMoreCustomers = () => {
    if (!hasMore || listLoading || loadingMore) {
      return;
    }
    void loadCustomerPage(page + 1, true);
  };

  const openClientDetails = (client: Customer) => {
    setSelectedClientId(client.id);
    setSelectedClient(client);
  };

  const openTransactions = async () => {
    if (!selectedClient) {
      return;
    }

    setTransactionsModalOpen(true);
    setTransactionsLoading(true);

    try {
      const response = await dispatch(
        getTransactionsByCustomer({
          customerId: selectedClient.id,
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

  const updateRiskStatus = async (riskStatus: "low" | "medium" | "high") => {
    if (!selectedClient) {
      return;
    }

    try {
      const response = await dispatch(
        setCustomerRiskStatus({
          id: selectedClient.id,
          riskStatus,
        }),
      ).unwrap();
      setSelectedClient(response.data);
      void loadCustomerPage(1, false);
      Alert.alert("Success", "Risk status updated.");
    } catch (error) {
      Alert.alert("Error", getErrorMessage(error));
    }
  };

  const openChangeCredit = () => {
    if (!selectedClient) {
      return;
    }

    setCreditDraft(Math.max(1, selectedClient.creditCount));
    setIsEditingCredit(true);
  };

  const openResetPassword = () => {
    if (!selectedClient) {
      return;
    }

    setTempPasswordDraft("");
    setConfirmTempPasswordDraft("");
    setIsTempPasswordHidden(true);
    setIsConfirmTempPasswordHidden(true);
    setIsResettingPassword(true);
  };

  const closeResetPassword = () => {
    if (isSavingTempPassword) {
      return;
    }
    setIsResettingPassword(false);
    setTempPasswordDraft("");
    setConfirmTempPasswordDraft("");
    setIsTempPasswordHidden(true);
    setIsConfirmTempPasswordHidden(true);
  };

  const submitResetPassword = async () => {
    if (!selectedClient) {
      return;
    }

    const normalizedPassword = tempPasswordDraft.trim();
    const normalizedConfirm = confirmTempPasswordDraft.trim();

    if (normalizedPassword.length < 8) {
      Alert.alert("Invalid password", "Temporary password must be at least 8 characters.");
      return;
    }

    if (normalizedPassword !== normalizedConfirm) {
      Alert.alert("Password mismatch", "Temporary password and confirm password must match.");
      return;
    }

    setIsSavingTempPassword(true);
    try {
      const response = await dispatch(
        resetCustomerTempPassword({
          id: selectedClient.id,
          tempPassword: normalizedPassword,
        }),
      ).unwrap();
      setSelectedClient(response.data);
      void loadCustomerPage(1, false);
      setIsResettingPassword(false);
      setTempPasswordDraft("");
      setConfirmTempPasswordDraft("");
      Alert.alert(
        "Temporary password set",
        `Share this temporary password with ${response.data.name}. They must change it on next web login.\n\n${normalizedPassword}`,
      );
    } catch (error) {
      Alert.alert("Error", getErrorMessage(error));
    } finally {
      setIsSavingTempPassword(false);
    }
  };

  const updateCreditCount = async () => {
    if (!selectedClient) {
      return;
    }

    if (!Number.isFinite(creditDraft) || creditDraft < 1) {
      Alert.alert("Invalid credit", "Credit must be at least 1.");
      return;
    }

    try {
      const response = await dispatch(
        setCustomerCreditCount({
          id: selectedClient.id,
          creditCount: creditDraft,
        }),
      ).unwrap();
      setSelectedClient(response.data);
      void loadCustomerPage(1, false);
      setIsEditingCredit(false);
    } catch (error) {
      Alert.alert("Error", getErrorMessage(error));
    }
  };

  const renderEmptyState = () => {
    const query = search.trim();

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
      <View style={styles.emptyState}>
        <Ionicons name="people-outline" size={36} color="#0D7A4E" />
        <Text style={styles.emptyTitle}>No clients yet</Text>
        <Text style={styles.emptyText}>Customers will appear here once available.</Text>
      </View>
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
                <Text style={styles.sectionTitle}>Search</Text>
                <ClearableTextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search name, phone, email"
                  placeholderTextColor={"#7A8F87"}
                  style={styles.input}
                />
              </View>

              <View style={styles.listCard}>
                <FlatList
                    data={customers}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    keyboardShouldPersistTaps="handled"
                    initialNumToRender={12}
                    maxToRenderPerBatch={12}
                    updateCellsBatchingPeriod={50}
                    windowSize={7}
                    removeClippedSubviews
                    onEndReached={loadMoreCustomers}
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
                    renderItem={({ item }) => (
                      <Pressable
                        style={[styles.clientItem, selectedClientId === item.id ? styles.selectedItem : null]}
                        onPress={() => openClientDetails(item)}
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
                        {selectedClient.mustResetPassword ? (
                          <View style={styles.mustResetTag}>
                            <Text style={styles.mustResetTagText}>Must reset password</Text>
                          </View>
                        ) : null}
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

                    <View style={[styles.statCard, { width: statCardWidth }]}>
                      <Text style={styles.statLabel}>Late Cancels</Text>
                      <Text style={[styles.statValue, styles.lateValue]}>
                        {selectedClient.lateCancelCount}
                      </Text>
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

                    <Pressable
                      style={[styles.riskActionButton, styles.resetPasswordActionButton]}
                      onPress={openResetPassword}
                    >
                      <Text style={styles.riskActionButtonText}>Reset Temporary Password</Text>
                    </Pressable>
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
        onClose={() => {
          setTransactionsModalOpen(false);
          setTransactions([]);
        }}
      />

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

      <Modal
        visible={isResettingPassword}
        animationType="fade"
        transparent
        onRequestClose={closeResetPassword}
      >
        <KeyboardAvoidingView
          style={styles.modalKeyboardAvoidingView}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={styles.creditModalOverlay}>
              <View style={styles.creditModalCard}>
                <Text style={styles.creditModalTitle}>Reset Temporary Password</Text>
                <Text style={styles.resetPasswordHint}>
                  Customer must change this password on next web order login.
                </Text>

                <Text style={styles.creditEditorLabel}>Temporary Password</Text>
                <ClearableTextInput
                  value={tempPasswordDraft}
                  onChangeText={setTempPasswordDraft}
                  placeholder="At least 8 characters"
                  placeholderTextColor="#6B7D76"
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry={isTempPasswordHidden}
                  editable={!isSavingTempPassword}
                  style={styles.input}
                  containerStyle={styles.passwordFieldWrap}
                  endAccessoryWidth={36}
                  endAccessory={
                    <Pressable
                      onPress={() => setIsTempPasswordHidden((current) => !current)}
                      style={styles.passwordToggleButton}
                      accessibilityLabel={isTempPasswordHidden ? "Show password" : "Hide password"}
                    >
                      <Ionicons
                        name={isTempPasswordHidden ? "eye-outline" : "eye-off-outline"}
                        size={19}
                        color="#0E6045"
                      />
                    </Pressable>
                  }
                />

                <Text style={[styles.creditEditorLabel, styles.resetPasswordConfirmLabel]}>
                  Confirm Temporary Password
                </Text>
                <ClearableTextInput
                  value={confirmTempPasswordDraft}
                  onChangeText={setConfirmTempPasswordDraft}
                  placeholder="Re-enter temporary password"
                  placeholderTextColor="#6B7D76"
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry={isConfirmTempPasswordHidden}
                  editable={!isSavingTempPassword}
                  style={styles.input}
                  containerStyle={styles.passwordFieldWrap}
                  endAccessoryWidth={36}
                  endAccessory={
                    <Pressable
                      onPress={() => setIsConfirmTempPasswordHidden((current) => !current)}
                      style={styles.passwordToggleButton}
                      accessibilityLabel={
                        isConfirmTempPasswordHidden ? "Show password" : "Hide password"
                      }
                    >
                      <Ionicons
                        name={isConfirmTempPasswordHidden ? "eye-outline" : "eye-off-outline"}
                        size={19}
                        color="#0E6045"
                      />
                    </Pressable>
                  }
                />

                <Pressable
                  style={styles.generatePasswordButton}
                  onPress={generateTempPassword}
                  disabled={isSavingTempPassword}
                >
                  <Ionicons name="shuffle-outline" size={16} color="#0E6045" />
                  <Text style={styles.generatePasswordButtonText}>Generate password</Text>
                </Pressable>

                <View style={styles.creditEditorActionsRow}>
                  <Pressable
                    style={[styles.creditEditorButton, styles.creditEditorCancelButton]}
                    onPress={closeResetPassword}
                    disabled={isSavingTempPassword}
                  >
                    <Text style={styles.creditEditorCancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.creditEditorButton, styles.creditEditorSaveButton]}
                    onPress={submitResetPassword}
                    disabled={isSavingTempPassword}
                  >
                    {isSavingTempPassword ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.creditEditorSaveText}>Set Password</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
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
  resetPasswordActionButton: {
    backgroundColor: "#1F6F78",
  },
  mustResetTag: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: "#E6F4F5",
    borderWidth: 1,
    borderColor: "#B7D8DC",
  },
  mustResetTagText: {
    color: "#1F6F78",
    fontSize: 11,
    fontWeight: "700",
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
  resetPasswordHint: {
    color: "#577066",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  resetPasswordConfirmLabel: {
    marginTop: 10,
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
  generatePasswordButton: {
    marginTop: 10,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  generatePasswordButtonText: {
    color: "#0E6045",
    fontSize: 13,
    fontWeight: "700",
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
  listFooter: {
    paddingVertical: 12,
    alignItems: "center",
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
