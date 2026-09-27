import { CUSTOMER_PAGE_SIZE } from "@/constants/config";
import { useAppDispatch } from "@/store/hooks";
import { getCustomers } from "@/store/slices/customerSlice";
import { getDailyMeals } from "@/store/slices/dailyMealSlice";
import {
  getAvailability,
  upsertOrderForCustomer,
} from "@/store/slices/orderSlice";
import { getGlobalSettings } from "@/store/slices/settingsSlice";
import {
  Customer,
  DailyMeal,
  DayAvailability,
  StoreLocation,
  Timeslot,
  WeekDay,
} from "@/types/app";
import { getErrorMessage } from "@/utils/apiError";
import {
  MAX_MEALS_PER_ORDER,
  WEEK_DAYS,
  addonsFromDailyMeal,
  availabilityByDay,
  datesByDay,
  firstOrderableDay,
  formatCurrency,
  getCurrentWeekRange,
  mealsByDay,
  orderCost,
} from "@/utils/orderWeek";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type DraftMeal = { addons: string[] };

type OrderDraft = {
  slot: string;
  location: string;
  meals: DraftMeal[];
};

export default function CreateOrderScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();

  const [step, setStep] = useState<1 | 2>(1);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const listRequestIdRef = useRef(0);

  const [catalogLoading, setCatalogLoading] = useState(false);
  const [timeslots, setTimeslots] = useState<Timeslot[]>([]);
  const [storeLocations, setStoreLocations] = useState<StoreLocation[]>([]);
  const [meals, setMeals] = useState<Partial<Record<WeekDay, DailyMeal>>>({});
  const [availability, setAvailability] = useState<
    Partial<Record<WeekDay, DayAvailability>>
  >({});
  const [weekDates] = useState(() => datesByDay());
  const [activeDay, setActiveDay] = useState<WeekDay>(() =>
    firstOrderableDay(datesByDay()),
  );
  const [draft, setDraft] = useState<OrderDraft | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  useEffect(() => {
    void loadCustomerPage(1, false);
  }, [loadCustomerPage]);

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    try {
      const { from, to } = getCurrentWeekRange();
      const [settingsRes, mealsRes, availRes] = await Promise.all([
        dispatch(getGlobalSettings()).unwrap(),
        dispatch(getDailyMeals({ from, to })).unwrap(),
        dispatch(getAvailability({ from, to })).unwrap(),
      ]);
      setTimeslots(settingsRes.data.timeslots ?? []);
      setStoreLocations(settingsRes.data.storeLocations ?? []);
      setMeals(mealsByDay(mealsRes.data));
      setAvailability(availabilityByDay(availRes.data));
      setActiveDay(firstOrderableDay(weekDates));
      setDraft(null);
    } catch (error) {
      Alert.alert("Unable to load menu", getErrorMessage(error));
    } finally {
      setCatalogLoading(false);
    }
  }, [dispatch, weekDates]);

  const loadMoreCustomers = () => {
    if (!hasMore || listLoading || loadingMore) {
      return;
    }
    void loadCustomerPage(page + 1, true);
  };

  const goToStep2 = () => {
    if (!selectedCustomer) {
      Alert.alert("Select customer", "Please choose a customer first.");
      return;
    }
    setStep(2);
    void loadCatalog();
  };

  const activeMeal = meals[activeDay];
  const activeAddons = activeMeal ? addonsFromDailyMeal(activeMeal) : [];
  const dayAvail = availability[activeDay];
  const dayCap = dayAvail?.basicBox.original ?? activeMeal?.basicBoxInventory ?? 0;
  const dayRemaining = dayAvail?.basicBox.remaining ?? 0;

  const getSlotAvail = (slotId: string) => {
    const server =
      availability[activeDay]?.timeslots.find((t) => t.timeslotId === slotId)
        ?.remaining ?? 0;
    const draftMeals = draft?.slot === slotId ? draft.meals.length : 0;
    return server - draftMeals;
  };

  const getSlotCap = (slotId: string) =>
    availability[activeDay]?.timeslots.find((t) => t.timeslotId === slotId)
      ?.original ??
    timeslots.find((s) => s.id === slotId)?.capacity ??
    0;

  const dayTotal = useMemo(() => {
    if (!draft || !activeMeal) {
      return 0;
    }
    return orderCost(activeMeal.basicBoxPrice, draft.meals, activeAddons);
  }, [activeAddons, activeMeal, draft]);

  const startDraft = () => {
    setDraft({
      slot: "",
      location: "",
      meals: [{ addons: [] }],
    });
  };

  const updateDraft = (next: OrderDraft | null) => {
    setDraft(next);
  };

  const handlePlaceOrder = async () => {
    if (!selectedCustomer || !draft) {
      return;
    }
    if (!weekDates[activeDay]) {
      Alert.alert("Invalid day", "Could not resolve the order date.");
      return;
    }
    if (!activeMeal) {
      Alert.alert("No menu", "A meal must be published for this day.");
      return;
    }
    if (!draft.slot || !draft.location || draft.meals.length === 0) {
      Alert.alert(
        "Incomplete order",
        "Please select a timeslot, pickup location, and at least one meal.",
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await dispatch(
        upsertOrderForCustomer({
          customerId: selectedCustomer.id,
          date: weekDates[activeDay],
          payload: {
            timeslotId: draft.slot,
            storeLocationId: draft.location,
            meals: draft.meals.map((m) => ({ addons: [...m.addons] })),
          },
        }),
      ).unwrap();

      Alert.alert("Success", "Order created successfully.", [
        {
          text: "OK",
          onPress: () => router.replace("/(auth)/(tabs)/orders"),
        },
      ]);
    } catch (error) {
      Alert.alert("Unable to create order", getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderCustomerEmpty = () => {
    if (listLoading) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color="#0D7A4E" />
        </View>
      );
    }

    return (
      <View style={styles.emptyState}>
        <Ionicons name="people-outline" size={36} color="#0D7A4E" />
        <Text style={styles.emptyTitle}>
          {search.trim() ? "No matching customers" : "No customers yet"}
        </Text>
        <Text style={styles.emptyText}>
          {search.trim()
            ? "Try a different keyword."
            : "Customers will appear here once available."}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.container}>
      <Stack.Screen options={{ title: "Create Order" }} />

      <View style={styles.stepBar}>
        <View style={[styles.stepChip, step === 1 ? styles.stepChipActive : undefined]}>
          <Text style={[styles.stepChipText, step === 1 ? styles.stepChipTextActive : undefined]}>
            1. Customer
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color="#7A8F87" />
        <View style={[styles.stepChip, step === 2 ? styles.stepChipActive : undefined]}>
          <Text style={[styles.stepChipText, step === 2 ? styles.stepChipTextActive : undefined]}>
            2. Order
          </Text>
        </View>
      </View>

      {step === 1 ? (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Select Customer</Text>
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search name, phone, email"
                placeholderTextColor="#7A8F87"
                style={styles.input}
              />
            </View>

            <View style={[styles.card, styles.listCard]}>
              <FlatList
                data={customers}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                keyboardShouldPersistTaps="handled"
                onEndReached={loadMoreCustomers}
                onEndReachedThreshold={0.4}
                ListEmptyComponent={renderCustomerEmpty}
                ListFooterComponent={
                  loadingMore ? (
                    <View style={styles.listFooter}>
                      <ActivityIndicator size="small" color="#0D7A4E" />
                    </View>
                  ) : null
                }
                renderItem={({ item }) => {
                  const selected = selectedCustomer?.id === item.id;
                  return (
                    <Pressable
                      style={[styles.customerItem, selected ? styles.customerItemSelected : null]}
                      onPress={() => setSelectedCustomer(item)}
                    >
                      <View style={styles.flex}>
                        <Text style={styles.customerName}>{item.name}</Text>
                        <Text style={styles.customerSub}>{item.phone}</Text>
                        {item.email ? (
                          <Text style={styles.customerSub}>{item.email}</Text>
                        ) : null}
                      </View>
                      {selected ? (
                        <Ionicons name="checkmark-circle" size={22} color="#0D7A4E" />
                      ) : (
                        <Ionicons name="ellipse-outline" size={22} color="#C7D8D1" />
                      )}
                    </Pressable>
                  );
                }}
              />
            </View>

            <View style={styles.footerBar}>
              {selectedCustomer ? (
                <Text style={styles.footerHint} numberOfLines={1}>
                  Selected: {selectedCustomer.name}
                </Text>
              ) : (
                <Text style={styles.footerHint}>Select a customer to continue</Text>
              )}
              <Pressable
                style={[
                  styles.primaryButton,
                  !selectedCustomer ? styles.primaryButtonDisabled : undefined,
                ]}
                disabled={!selectedCustomer}
                onPress={goToStep2}
              >
                <Text style={styles.primaryButtonText}>Next</Text>
                <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.selectedBanner}>
            <Pressable style={styles.backStepButton} onPress={() => setStep(1)}>
              <Ionicons name="arrow-back" size={16} color="#0D7A4E" />
              <Text style={styles.backStepText}>Change</Text>
            </Pressable>
            <Text style={styles.selectedBannerText} numberOfLines={1}>
              {selectedCustomer?.name}
            </Text>
          </View>

          {catalogLoading ? (
            <View style={styles.catalogLoading}>
              <ActivityIndicator size="large" color="#0D7A4E" />
              <Text style={styles.catalogLoadingText}>Loading this week's menu…</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.flex}
              contentContainerStyle={styles.step2Content}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.dayRow}>
                {WEEK_DAYS.map((day) => {
                  const active = activeDay === day;
                  return (
                    <Pressable
                      key={day}
                      style={[styles.dayChip, active ? styles.dayChipActive : undefined]}
                      onPress={() => {
                        setActiveDay(day);
                        setDraft(null);
                      }}
                    >
                      <Text
                        style={[
                          styles.dayChipText,
                          active ? styles.dayChipTextActive : undefined,
                        ]}
                      >
                        {day.slice(0, 3)}
                      </Text>
                      <Text
                        style={[
                          styles.dayChipDate,
                          active ? styles.dayChipTextActive : undefined,
                        ]}
                      >
                        {weekDates[day]?.slice(5)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.card}>
                {activeMeal &&
                (activeMeal.dishesName ||
                  activeMeal.dishesDescription ||
                  activeMeal.dishesIngredients) ? (
                  <View style={styles.menuBlock}>
                    {activeMeal.dishesName ? (
                      <Text style={styles.menuTitle}>{activeMeal.dishesName}</Text>
                    ) : null}
                    {activeMeal.dishesDescription ? (
                      <Text style={styles.menuBody}>{activeMeal.dishesDescription}</Text>
                    ) : null}
                    {activeMeal.dishesIngredients ? (
                      <Text style={styles.menuIngredients}>
                        {activeMeal.dishesIngredients}
                      </Text>
                    ) : null}
                  </View>
                ) : (
                  <View style={styles.menuBlock}>
                    <Text style={styles.mutedText}>
                      No meal menu published for {activeDay}.
                    </Text>
                  </View>
                )}

                <View style={styles.dayMetaRow}>
                  <Text style={styles.sectionTitle}>{activeDay}</Text>
                  <Text style={styles.availBadge}>
                    {Math.max(dayRemaining - (draft?.meals.length ?? 0), 0)} of {dayCap} left
                  </Text>
                </View>

                {!activeMeal ? (
                  <View style={styles.emptyState}>
                    <Ionicons name="restaurant-outline" size={36} color="#C7D8D1" />
                    <Text style={styles.emptyText}>
                      Ordering is unavailable until a meal is published.
                    </Text>
                  </View>
                ) : !draft ? (
                  <View style={styles.emptyState}>
                    <Ionicons name="cart-outline" size={36} color="#C7D8D1" />
                    <Text style={styles.emptyText}>No order draft for {activeDay}</Text>
                    {dayRemaining <= 0 ? (
                      <Text style={styles.errorText}>This day is fully booked.</Text>
                    ) : (
                      <Pressable style={styles.primaryButton} onPress={startDraft}>
                        <Text style={styles.primaryButtonText}>+ Add {activeDay} Order</Text>
                      </Pressable>
                    )}
                  </View>
                ) : (
                  <View style={styles.draftBlock}>
                    <Text style={styles.label}>Pick-up Time Slot</Text>
                    <View style={styles.optionList}>
                      {timeslots.map((slot) => {
                        const avail = getSlotAvail(slot.id);
                        const cap = getSlotCap(slot.id);
                        const full = avail <= 0 && draft.slot !== slot.id;
                        const selected = draft.slot === slot.id;
                        return (
                          <Pressable
                            key={slot.id}
                            disabled={full}
                            style={[
                              styles.optionItem,
                              selected ? styles.optionItemSelected : undefined,
                              full ? styles.optionItemDisabled : undefined,
                            ]}
                            onPress={() => updateDraft({ ...draft, slot: slot.id })}
                          >
                            <Text
                              style={[
                                styles.optionItemText,
                                selected ? styles.optionItemTextSelected : undefined,
                              ]}
                            >
                              {slot.label}
                            </Text>
                            <Text style={styles.optionItemSub}>
                              {avail} of {cap}
                              {full ? " — FULL" : ""}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    <Text style={styles.label}>Pick-up Location</Text>
                    <View style={styles.optionList}>
                      {storeLocations.map((loc) => {
                        const selected = draft.location === loc.id;
                        return (
                          <Pressable
                            key={loc.id}
                            style={[
                              styles.optionItem,
                              selected ? styles.optionItemSelected : undefined,
                            ]}
                            onPress={() => updateDraft({ ...draft, location: loc.id })}
                          >
                            <Text
                              style={[
                                styles.optionItemText,
                                selected ? styles.optionItemTextSelected : undefined,
                              ]}
                            >
                              {loc.name}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    {draft.meals.map((meal, mi) => (
                      <View key={`meal-${mi}`} style={styles.mealCard}>
                        <View style={styles.mealHeader}>
                          <Text style={styles.mealTitle}>
                            Meal {mi + 1}{" "}
                            <Text style={styles.mealBase}>
                              (base {formatCurrency(activeMeal.basicBoxPrice)})
                            </Text>
                          </Text>
                          <View style={styles.mealHeaderRight}>
                            <Text style={styles.mealPrice}>
                              {formatCurrency(
                                activeMeal.basicBoxPrice +
                                  meal.addons.reduce(
                                    (sum, id) =>
                                      sum +
                                      (activeAddons.find((a) => a.id === id)?.price ?? 0),
                                    0,
                                  ),
                              )}
                            </Text>
                            {mi > 0 ? (
                              <Pressable
                                onPress={() =>
                                  updateDraft({
                                    ...draft,
                                    meals: draft.meals.filter((_, i) => i !== mi),
                                  })
                                }
                              >
                                <Ionicons name="close" size={18} color="#C0392B" />
                              </Pressable>
                            ) : null}
                          </View>
                        </View>
                        <View style={styles.addonRow}>
                          {activeAddons.map((addon) => {
                            const on = meal.addons.includes(addon.id);
                            return (
                              <Pressable
                                key={addon.id}
                                style={[
                                  styles.addonChip,
                                  on ? styles.addonChipActive : undefined,
                                ]}
                                onPress={() => {
                                  const newAddons = on
                                    ? meal.addons.filter((x) => x !== addon.id)
                                    : [...meal.addons, addon.id];
                                  updateDraft({
                                    ...draft,
                                    meals: draft.meals.map((m, i) =>
                                      i === mi ? { addons: newAddons } : m,
                                    ),
                                  });
                                }}
                              >
                                <Text
                                  style={[
                                    styles.addonChipText,
                                    on ? styles.addonChipTextActive : undefined,
                                  ]}
                                >
                                  {on ? "✓ " : "+"}
                                  {addon.label} +{formatCurrency(addon.price)}
                                </Text>
                              </Pressable>
                            );
                          })}
                          {activeAddons.length === 0 ? (
                            <Text style={styles.mutedText}>No extras for this meal.</Text>
                          ) : null}
                        </View>
                      </View>
                    ))}

                    {draft.meals.length < MAX_MEALS_PER_ORDER ? (
                      <Pressable
                        style={styles.addMealButton}
                        onPress={() =>
                          updateDraft({
                            ...draft,
                            meals: [...draft.meals, { addons: [] }],
                          })
                        }
                      >
                        <Text style={styles.addMealButtonText}>
                          + Add 2nd Meal (base{" "}
                          {formatCurrency(activeMeal.basicBoxPrice)})
                        </Text>
                      </Pressable>
                    ) : null}

                    <View style={styles.totalRow}>
                      <Text style={styles.totalLabel}>Day total</Text>
                      <Text style={styles.totalValue}>{formatCurrency(dayTotal)}</Text>
                    </View>
                  </View>
                )}
              </View>
            </ScrollView>
          )}

          <View style={styles.footerBar}>
            <Pressable
              style={styles.secondaryButton}
              disabled={isSubmitting}
              onPress={() => setStep(1)}
            >
              <Text style={styles.secondaryButtonText}>Back</Text>
            </Pressable>
            <Pressable
              style={[
                styles.primaryButton,
                styles.flex,
                !draft || !draft.slot || !draft.location || isSubmitting || catalogLoading
                  ? styles.primaryButtonDisabled
                  : undefined,
              ]}
              disabled={
                !draft ||
                !draft.slot ||
                !draft.location ||
                isSubmitting ||
                catalogLoading
              }
              onPress={() => void handlePlaceOrder()}
            >
              <Text style={styles.primaryButtonText}>
                {isSubmitting ? "Creating..." : "Place Order"}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F8F7",
    padding: 16,
  },
  flex: {
    flex: 1,
  },
  stepBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  stepChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#E6F2ED",
  },
  stepChipActive: {
    backgroundColor: "#0D7A4E",
  },
  stepChipText: {
    color: "#35554A",
    fontSize: 13,
    fontWeight: "700",
  },
  stepChipTextActive: {
    color: "#FFFFFF",
  },
  card: {
    borderWidth: 1,
    borderColor: "#DDEBE6",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    padding: 14,
    marginBottom: 12,
  },
  listCard: {
    flex: 1,
    paddingBottom: 4,
    marginBottom: 8,
  },
  sectionTitle: {
    color: "#0B3D2E",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: "#C7D8D1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    color: "#1E2A26",
    fontSize: 15,
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 8,
  },
  listFooter: {
    paddingVertical: 12,
    alignItems: "center",
  },
  customerItem: {
    borderWidth: 1,
    borderColor: "#DDEBE6",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  customerItemSelected: {
    borderColor: "#0D7A4E",
    backgroundColor: "#EAF7F1",
  },
  customerName: {
    color: "#1E2A26",
    fontWeight: "700",
    fontSize: 15,
  },
  customerSub: {
    color: "#5C7269",
    fontSize: 12,
    marginTop: 2,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 36,
    gap: 8,
  },
  emptyTitle: {
    color: "#0B3D2E",
    fontWeight: "700",
    fontSize: 15,
  },
  emptyText: {
    color: "#6E7C76",
    fontSize: 13,
    textAlign: "center",
  },
  errorText: {
    color: "#C0392B",
    fontWeight: "600",
    fontSize: 13,
  },
  footerBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 8,
  },
  footerHint: {
    flex: 1,
    color: "#5C7269",
    fontSize: 13,
  },
  primaryButton: {
    backgroundColor: "#0D7A4E",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#C7D8D1",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#FFFFFF",
  },
  secondaryButtonText: {
    color: "#35554A",
    fontWeight: "700",
    fontSize: 15,
  },
  selectedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
    backgroundColor: "#EAF7F1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#C7E6D6",
  },
  backStepButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  backStepText: {
    color: "#0D7A4E",
    fontWeight: "700",
    fontSize: 13,
  },
  selectedBannerText: {
    flex: 1,
    color: "#0B3D2E",
    fontWeight: "700",
    fontSize: 14,
  },
  catalogLoading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  catalogLoadingText: {
    color: "#35554A",
    fontSize: 14,
  },
  step2Content: {
    paddingBottom: 16,
  },
  dayRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 12,
  },
  dayChip: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#DDEBE6",
    backgroundColor: "#FFFFFF",
    paddingVertical: 8,
    alignItems: "center",
  },
  dayChipActive: {
    backgroundColor: "#0D7A4E",
    borderColor: "#0D7A4E",
  },
  dayChipText: {
    color: "#35554A",
    fontWeight: "700",
    fontSize: 13,
  },
  dayChipDate: {
    color: "#7A8F87",
    fontSize: 11,
    marginTop: 2,
  },
  dayChipTextActive: {
    color: "#FFFFFF",
  },
  menuBlock: {
    borderBottomWidth: 1,
    borderBottomColor: "#EEF4F1",
    paddingBottom: 12,
    marginBottom: 12,
    gap: 6,
  },
  menuTitle: {
    color: "#1E2A26",
    fontWeight: "700",
    fontSize: 16,
  },
  menuBody: {
    color: "#4A5F57",
    fontSize: 13,
    lineHeight: 18,
  },
  menuIngredients: {
    color: "#7A8F87",
    fontSize: 12,
    fontStyle: "italic",
  },
  mutedText: {
    color: "#7A8F87",
    fontSize: 13,
  },
  dayMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  availBadge: {
    color: "#5C7269",
    fontSize: 11,
    backgroundColor: "#F0F5F3",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  draftBlock: {
    gap: 4,
  },
  label: {
    color: "#35554A",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 10,
    marginBottom: 6,
  },
  optionList: {
    gap: 6,
  },
  optionItem: {
    borderWidth: 1,
    borderColor: "#DDEBE6",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
  },
  optionItemSelected: {
    borderColor: "#0D7A4E",
    backgroundColor: "#EAF7F1",
  },
  optionItemDisabled: {
    opacity: 0.45,
  },
  optionItemText: {
    color: "#1E2A26",
    fontWeight: "600",
    fontSize: 14,
  },
  optionItemTextSelected: {
    color: "#0B3D2E",
  },
  optionItemSub: {
    color: "#7A8F87",
    fontSize: 11,
    marginTop: 2,
  },
  mealCard: {
    borderWidth: 1,
    borderColor: "#DDEBE6",
    borderRadius: 10,
    padding: 12,
    backgroundColor: "#F8FBFA",
    marginTop: 10,
  },
  mealHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  mealHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  mealTitle: {
    color: "#1E2A26",
    fontWeight: "700",
    fontSize: 14,
  },
  mealBase: {
    color: "#7A8F87",
    fontWeight: "400",
    fontSize: 12,
  },
  mealPrice: {
    color: "#0D7A4E",
    fontWeight: "700",
    fontSize: 14,
  },
  addonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  addonChip: {
    borderWidth: 1,
    borderColor: "#C7D8D1",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#FFFFFF",
  },
  addonChipActive: {
    borderColor: "#0D7A4E",
    backgroundColor: "#DFF3E9",
  },
  addonChipText: {
    color: "#5C7269",
    fontSize: 12,
  },
  addonChipTextActive: {
    color: "#0B5D44",
    fontWeight: "700",
  },
  addMealButton: {
    marginTop: 10,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#C7D8D1",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  addMealButtonText: {
    color: "#5C7269",
    fontSize: 13,
    fontWeight: "600",
  },
  totalRow: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#EEF4F1",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: {
    color: "#5C7269",
    fontSize: 14,
  },
  totalValue: {
    color: "#0D7A4E",
    fontWeight: "800",
    fontSize: 18,
  },
});
