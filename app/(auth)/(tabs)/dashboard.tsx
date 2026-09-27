import { useAppDispatch } from "@/store/hooks";
import { getCheckedOutBoxDetails } from "@/store/slices/boxSlice";
import { getDashboardStats } from "@/store/slices/dashboardSlice";
import { getOrders } from "@/store/slices/orderSlice";
import { getGlobalSettings } from "@/store/slices/settingsSlice";
import { getTransactionsSince } from "@/store/slices/transactionSlice";
import {
  CheckedOutBoxDetails,
  DashboardStats,
  Order,
  Timeslot,
} from "@/types/app";
import { getDaysOut } from "@/utils/dates";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, {
  DateTimePickerChangeEvent,
} from "@react-native-community/datetimepicker";
import * as echarts from "echarts/core";
import { BarChart } from "echarts/charts";
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from "echarts/components";
import { SkiaChart, SkiaRenderer } from "@wuba/react-native-echarts";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

echarts.use([
  SkiaRenderer,
  BarChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
]);

const CHART_HEIGHT = 260;
const ACTIVITY_DAYS = 14;

const EMPTY_STATS: DashboardStats = {
  totalBoxes: 0,
  availableCount: 0,
  safeCount: 0,
  unavailableCount: 0,
  checkedOutCount: 0,
  warningCount: 0,
  overdueCount: 0,
};

const ADDON_LABELS: Record<string, string> = {
  xl: "Extra Large",
  pro: "Extra Protein",
  veg: "Extra Veggie",
  soup: "Extra Soup",
};

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

type DashboardTab = "boxes" | "orders";
type OrderScopeTab = "overall" | string;

type WeekDay = {
  key: string;
  label: string;
  shortLabel: string;
  date: Date;
};

type MealCombinationCount = {
  key: string;
  label: string;
  count: number;
};

function formatDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function buildWeekdays(anchor = new Date()): WeekDay[] {
  const today = startOfDay(anchor);
  const dayOfWeek = today.getDay(); // 0=Sun ... 6=Sat
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);

  return Array.from({ length: 5 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const dayName = DAY_NAMES[date.getDay()];
    return {
      key: formatDateKey(date),
      label: dayName,
      shortLabel: dayName.slice(0, 3),
      date,
    };
  });
}

function defaultWeekdayKey(weekDays: WeekDay[], anchor = new Date()) {
  const todayKey = formatDateKey(startOfDay(anchor));
  const todayMatch = weekDays.find((day) => day.key === todayKey);
  if (todayMatch) {
    return todayMatch.key;
  }
  return weekDays[weekDays.length - 1]?.key ?? todayKey;
}

function formatWeekRange(weekDays: WeekDay[]) {
  if (weekDays.length === 0) {
    return "";
  }
  const first = weekDays[0].date;
  const last = weekDays[weekDays.length - 1].date;
  const fmt = (value: Date) =>
    `${value.getMonth() + 1}/${value.getDate()}/${value.getFullYear()}`;
  return `${fmt(first)} – ${fmt(last)}`;
}

function formatAddonLabel(addon: string) {
  return ADDON_LABELS[addon] ?? addon;
}

function formatCurrency(amount: number) {
  return `$${amount.toFixed(2)}`;
}

function mealCount(orders: Order[]) {
  return orders.reduce((sum, order) => sum + order.meals.length, 0);
}

function mealCombinationKey(addons: string[]) {
  return [...addons]
    .map((addon) => addon.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join("|");
}

function mealCombinationLabel(addons: string[]) {
  if (addons.length === 0) {
    return "Basic Meal";
  }
  return `Basic Meal + ${[...addons].sort().map(formatAddonLabel).join(" + ")}`;
}

function countMealCombinations(orders: Order[]): MealCombinationCount[] {
  const counts = new Map<string, MealCombinationCount>();

  for (const order of orders) {
    for (const meal of order.meals) {
      const key = mealCombinationKey(meal.addons);
      const existing = counts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(key, {
          key,
          label: mealCombinationLabel(meal.addons),
          count: 1,
        });
      }
    }
  }

  return Array.from(counts.values()).sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label),
  );
}

export default function DashboardScreen() {
  const dispatch = useAppDispatch();
  const { width } = useWindowDimensions();
  const metricsColumns = width >= 900 ? 4 : 2;
  const metricCardWidth = metricsColumns === 4 ? "23.5%" : "48.5%";
  const chartWidth = width - 32;

  const [activeTab, setActiveTab] = useState<DashboardTab>("orders");
  const [detailsModalType, setDetailsModalType] = useState<
    "total-out" | "safe" | "warning" | "overdue" | null
  >(null);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>(EMPTY_STATS);
  const [checkedOutBoxes, setCheckedOutBoxes] = useState<CheckedOutBoxDetails[]>([]);
  const chartRef = useRef<any>(null);
  const [chartData, setChartData] = useState<{
    dates: string[];
    checkouts: number[];
    checkins: number[];
  }>({ dates: [], checkouts: [], checkins: [] });

  const weekAnchor = useMemo(() => startOfDay(new Date()), []);
  const [selectedWeekDate, setSelectedWeekDate] = useState(weekAnchor);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const weekDays = useMemo(
    () => buildWeekdays(selectedWeekDate),
    [selectedWeekDate],
  );
  const [selectedDayKey, setSelectedDayKey] = useState(
    () => defaultWeekdayKey(weekDays, weekAnchor),
  );
  const [orderScopeTab, setOrderScopeTab] = useState<OrderScopeTab>("overall");
  const [timeslots, setTimeslots] = useState<Timeslot[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const closeDetailsModal = useCallback(() => {
    setDetailsModalType(null);
  }, []);

  const safeBoxes = useMemo(
    () => checkedOutBoxes.filter((box) => getDaysOut(box.dateOut) <= 7),
    [checkedOutBoxes],
  );

  const warningBoxes = useMemo(
    () =>
      checkedOutBoxes.filter((box) => {
        const daysOut = getDaysOut(box.dateOut);
        return daysOut > 7 && daysOut <= 14;
      }),
    [checkedOutBoxes],
  );

  const overdueBoxes = useMemo(
    () => checkedOutBoxes.filter((box) => getDaysOut(box.dateOut) > 14),
    [checkedOutBoxes],
  );

  const modalTitle =
    detailsModalType === "safe"
      ? "Safe Boxes (0-7 Days)"
      : detailsModalType === "warning"
        ? "Warning Boxes (7-14 Days)"
        : detailsModalType === "overdue"
          ? "Overdue Boxes (>14 Days)"
          : "";

  const modalBoxes =
    detailsModalType === "safe"
      ? safeBoxes
      : detailsModalType === "warning"
        ? warningBoxes
        : detailsModalType === "overdue"
          ? overdueBoxes
          : [];

  const selectedDay = useMemo(
    () => weekDays.find((day) => day.key === selectedDayKey) ?? weekDays[weekDays.length - 1],
    [selectedDayKey, weekDays],
  );

  const dayOrders = useMemo(
    () =>
      orders
        .filter((order) => order.date === selectedDayKey)
        .sort((a, b) =>
          (a.customerName ?? "").localeCompare(b.customerName ?? "", undefined, {
            sensitivity: "base",
          }),
        ),
    [orders, selectedDayKey],
  );

  const scopedOrders = useMemo(() => {
    if (orderScopeTab === "overall") {
      return dayOrders;
    }
    return dayOrders.filter((order) => order.timeslotId === orderScopeTab);
  }, [dayOrders, orderScopeTab]);

  const dayCap = useMemo(
    () => timeslots.reduce((sum, slot) => sum + (slot.capacity || 0), 0),
    [timeslots],
  );

  const scopedCapacity = useMemo(() => {
    if (orderScopeTab === "overall") {
      return dayCap;
    }
    return timeslots.find((slot) => slot.id === orderScopeTab)?.capacity ?? 0;
  }, [dayCap, orderScopeTab, timeslots]);

  const dayTotalMeals = useMemo(() => mealCount(dayOrders), [dayOrders]);
  const dayRemaining = Math.max(dayCap - dayTotalMeals, 0);
  const daySoldRatio = dayCap > 0 ? Math.min(dayTotalMeals / dayCap, 1) : 0;
  const scopedTotalMeals = useMemo(() => mealCount(scopedOrders), [scopedOrders]);
  const scopedSlotsRemaining = Math.max(scopedCapacity - scopedTotalMeals, 0);
  const scopedEstimatedRevenue = useMemo(
    () => scopedOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0),
    [scopedOrders],
  );
  const mealCombinations = useMemo(
    () => countMealCombinations(scopedOrders),
    [scopedOrders],
  );

  const dayMealCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const day of weekDays) {
      counts[day.key] = mealCount(orders.filter((order) => order.date === day.key));
    }
    return counts;
  }, [orders, weekDays]);

  const weekRangeLabel = useMemo(() => formatWeekRange(weekDays), [weekDays]);

  const onWeekDateChange = useCallback(
    (_event: DateTimePickerChangeEvent, selected?: Date) => {
      if (Platform.OS !== "ios") {
        setShowDatePicker(false);
      }

      if (!selected) {
        return;
      }

      const nextDate = startOfDay(selected);
      const nextWeek = buildWeekdays(nextDate);
      setSelectedWeekDate(nextDate);
      setSelectedDayKey(defaultWeekdayKey(nextWeek, nextDate));
      setOrderScopeTab("overall");
    },
    [],
  );

  const renderModalItem = useCallback(
    ({ item }: { item: CheckedOutBoxDetails }) => (
      <View style={styles.modalItem}>
        <View style={styles.modalMetaRow}>
          <Text style={styles.modalMetaLabel}>Box ID</Text>
          <Text style={styles.modalMetaValue}>{item.id}</Text>
        </View>
        <View style={styles.modalMetaRow}>
          <Text style={styles.modalMetaLabel}>Customer Name</Text>
          <Text style={styles.modalMetaValue}>
            {(item.customerName ?? "-") + " / " + (item.customerPhone ?? "-")}
          </Text>
        </View>
        <View style={styles.modalMetaRow}>
          <Text style={styles.modalMetaLabel}>Days Out</Text>
          <Text style={styles.modalMetaValue}>{getDaysOut(item.dateOut)}</Text>
        </View>
      </View>
    ),
    [],
  );

  const loadDashboard = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const since = Date.now() - ACTIVITY_DAYS * 24 * 60 * 60 * 1000;
      const from = weekDays[0]?.key;
      const to = weekDays[weekDays.length - 1]?.key;

      const [statsResponse, checkedOutResponse, transactionsResponse, settingsResponse, ordersResponse] =
        await Promise.all([
          dispatch(getDashboardStats()).unwrap(),
          dispatch(getCheckedOutBoxDetails()).unwrap(),
          dispatch(getTransactionsSince(since)).unwrap(),
          dispatch(getGlobalSettings()).unwrap(),
          from && to
            ? dispatch(getOrders({ from, to })).unwrap()
            : Promise.resolve({ data: [] as Order[] }),
        ]);

      const stats = statsResponse.data;
      const checkedOut = checkedOutResponse.data;
      const transactions = transactionsResponse.data;

      const days = Array.from({ length: ACTIVITY_DAYS }, (_, i) => {
        const d = new Date(Date.now() - (ACTIVITY_DAYS - 1 - i) * 24 * 60 * 60 * 1000);
        return {
          label: `${d.getMonth() + 1}/${d.getDate()}`,
          key: `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`,
        };
      });

      const checkoutMap: Record<string, number> = {};
      const checkinMap: Record<string, number> = {};

      for (const tx of transactions) {
        const d = new Date(tx.date);
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

        if (tx.type === "checkout") {
          checkoutMap[key] = (checkoutMap[key] ?? 0) + 1;
        } else {
          checkinMap[key] = (checkinMap[key] ?? 0) + 1;
        }
      }

      setDashboardStats(stats);
      setCheckedOutBoxes(checkedOut);
      setChartData({
        dates: days.map((d) => d.label),
        checkouts: days.map((d) => checkoutMap[d.key] ?? 0),
        checkins: days.map((d) => checkinMap[d.key] ?? 0),
      });
      setTimeslots(settingsResponse.data.timeslots ?? []);
      setOrders(ordersResponse.data ?? []);
    } catch (error) {
      console.warn("Failed to load dashboard:", error);
    } finally {
      setOrdersLoading(false);
    }
  }, [dispatch, weekDays]);

  useEffect(() => {
    if (
      orderScopeTab !== "overall" &&
      !timeslots.some((slot) => slot.id === orderScopeTab)
    ) {
      setOrderScopeTab("overall");
    }
  }, [orderScopeTab, timeslots]);

  useEffect(() => {
    if (!weekDays.some((day) => day.key === selectedDayKey)) {
      setSelectedDayKey(defaultWeekdayKey(weekDays, selectedWeekDate));
    }
  }, [selectedDayKey, selectedWeekDate, weekDays]);

  useFocusEffect(
    useCallback(() => {
      void loadDashboard();
    }, [loadDashboard]),
  );

  useEffect(() => {
    if (activeTab !== "boxes" || !chartRef.current || chartData.dates.length === 0) {
      return;
    }

    const chart = echarts.init(chartRef.current, "light", {
      renderer: "skia" as any,
      width: chartWidth,
      height: CHART_HEIGHT,
    });

    chart.setOption({
      legend: {
        data: ["Check-out", "Check-in"],
        textStyle: { color: "#43635A", fontSize: 12 },
        top: 0,
      },
      grid: { top: 52, bottom: 8, left: 8, right: 8, containLabel: true },
      xAxis: {
        type: "category",
        data: chartData.dates,
        axisLabel: { color: "#577066", fontSize: 10, rotate: 40 },
        axisLine: { lineStyle: { color: "#DCE9E4" } },
        axisTick: { show: false },
      },
      yAxis: {
        type: "value",
        minInterval: 1,
        axisLabel: { color: "#577066", fontSize: 10 },
        splitLine: { lineStyle: { color: "#E5EFEB" } },
      },
      series: [
        {
          name: "Check-out",
          type: "bar",
          data: chartData.checkouts,
          barMaxWidth: 18,
          label: {
            show: true,
            position: "top",
            color: "#1C5AA6",
            fontSize: 10,
            fontWeight: "700",
          },
          itemStyle: { color: "#1C5AA6", borderRadius: [4, 4, 0, 0] },
        },
        {
          name: "Check-in",
          type: "bar",
          data: chartData.checkins,
          barMaxWidth: 18,
          label: {
            show: true,
            position: "top",
            color: "#0D7A4E",
            fontSize: 10,
            fontWeight: "700",
          },
          itemStyle: { color: "#0D7A4E", borderRadius: [4, 4, 0, 0] },
        },
      ],
    });

    return () => chart.dispose();
  }, [activeTab, chartData, chartWidth]);

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {activeTab === "boxes" ? "LocaBox Tracker" : "Order Overview"}
          </Text>
          <Text
            style={[
              styles.headerMeta,
              activeTab !== "orders" ? styles.headerMetaHidden : null,
            ]}
          >
            {dayTotalMeals} / {dayCap} meals booked
          </Text>
        </View>

        <View style={styles.dashboardTabs}>
          <Pressable
            style={[
              styles.dashboardTab,
              activeTab === "boxes" ? styles.dashboardTabActive : null,
            ]}
            onPress={() => setActiveTab("boxes")}
          >
            <Text
              style={[
                styles.dashboardTabText,
                activeTab === "boxes" ? styles.dashboardTabTextActive : null,
              ]}
            >
              Box Tracker
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.dashboardTab,
              activeTab === "orders" ? styles.dashboardTabActive : null,
            ]}
            onPress={() => setActiveTab("orders")}
          >
            <Text
              style={[
                styles.dashboardTabText,
                activeTab === "orders" ? styles.dashboardTabTextActive : null,
              ]}
            >
              Order Overview
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {activeTab === "boxes" ? (
          <>
            <View style={styles.metricsGrid}>
              <MetricCard
                label="Available"
                value={dashboardStats.availableCount}
                color="#0D7A4E"
                width={metricCardWidth}
              />
              <MetricCard
                label="Safe (0-7)"
                value={dashboardStats.safeCount}
                color="#1C5AA6"
                width={metricCardWidth}
                onPress={() => setDetailsModalType("safe")}
              />
              <MetricCard
                label="Warning (7-14)"
                value={dashboardStats.warningCount}
                color="#C48700"
                width={metricCardWidth}
                onPress={() => setDetailsModalType("warning")}
              />
              <MetricCard
                label="Overdue (>14)"
                value={dashboardStats.overdueCount}
                color="#BD2323"
                width={metricCardWidth}
                onPress={() => setDetailsModalType("overdue")}
              />
            </View>

            <Text style={styles.sectionTitle}>Last 14 Days Activity</Text>
            <View
              style={[
                styles.chartContainer,
                { width: chartWidth, height: CHART_HEIGHT },
              ]}
            >
              <SkiaChart ref={chartRef} />
            </View>
          </>
        ) : (
          <>
            <View style={styles.weekPickerRow}>
              <Text style={styles.weekPickerLabel}>Week</Text>
              <Pressable
                style={styles.dateSelector}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.dateSelectorText}>{weekRangeLabel}</Text>
                <Ionicons name="calendar-outline" size={16} color="#42685D" />
              </Pressable>
            </View>

            {showDatePicker ? (
              <DateTimePicker
                value={selectedWeekDate}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={onWeekDateChange}
              />
            ) : null}

            {Platform.OS === "ios" && showDatePicker ? (
              <Pressable
                style={styles.datePickerDone}
                onPress={() => setShowDatePicker(false)}
              >
                <Text style={styles.datePickerDoneText}>Done</Text>
              </Pressable>
            ) : null}

            <View style={styles.dayTabs}>
              {weekDays.map((day) => {
                const isActive = day.key === selectedDayKey;
                const count = dayMealCounts[day.key] ?? 0;
                return (
                  <Pressable
                    key={day.key}
                    style={[styles.dayTab, isActive ? styles.dayTabActive : null]}
                    onPress={() => {
                      setSelectedDayKey(day.key);
                      setOrderScopeTab("overall");
                    }}
                  >
                    <Text
                      style={[
                        styles.dayTabLabel,
                        isActive ? styles.dayTabLabelActive : null,
                      ]}
                    >
                      {day.shortLabel}
                    </Text>
                    <Text
                      style={[
                        styles.dayTabCount,
                        isActive ? styles.dayTabCountActive : null,
                      ]}
                    >
                      {count}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.inventoryBarCard}>
              <View style={styles.inventoryBarHeader}>
                <Text style={styles.inventoryBarTitle}>Meal Inventory</Text>
                <Text style={styles.inventoryBarMeta}>
                  {dayTotalMeals} sold · {dayRemaining} remaining
                </Text>
              </View>
              <View style={styles.inventoryBarTrack}>
                <View
                  style={[
                    styles.inventoryBarFill,
                    {
                      width: `${daySoldRatio * 100}%`,
                      backgroundColor:
                        daySoldRatio >= 1
                          ? "#BD2323"
                          : daySoldRatio >= 0.8
                            ? "#C48700"
                            : "#0D7A4E",
                    },
                  ]}
                />
              </View>
              <Text style={styles.inventoryBarCaption}>
                {dayTotalMeals} / {dayCap} capacity used
              </Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.scopeTabs}
            >
              <Pressable
                style={[
                  styles.scopeTab,
                  orderScopeTab === "overall" ? styles.scopeTabActive : null,
                ]}
                onPress={() => setOrderScopeTab("overall")}
              >
                <Text
                  style={[
                    styles.scopeTabText,
                    orderScopeTab === "overall" ? styles.scopeTabTextActive : null,
                  ]}
                >
                  Overall
                </Text>
              </Pressable>
              {timeslots.map((slot) => {
                const isActive = orderScopeTab === slot.id;
                return (
                  <Pressable
                    key={slot.id}
                    style={[styles.scopeTab, isActive ? styles.scopeTabActive : null]}
                    onPress={() => setOrderScopeTab(slot.id)}
                  >
                    <Text
                      style={[
                        styles.scopeTabText,
                        isActive ? styles.scopeTabTextActive : null,
                      ]}
                      numberOfLines={1}
                    >
                      {slot.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {ordersLoading ? (
              <View style={styles.loadingState}>
                <ActivityIndicator color="#0D7A4E" />
                <Text style={styles.loadingText}>Loading orders...</Text>
              </View>
            ) : (
              <>
                <Text style={styles.scopeHeading}>
                  {selectedDay?.label}
                  {orderScopeTab === "overall"
                    ? " · Overall"
                    : ` · ${
                        timeslots.find((slot) => slot.id === orderScopeTab)?.label ??
                        "Timeslot"
                      }`}
                </Text>

                <View style={styles.metricsGrid}>
                  <SummaryCard
                    label="Members Ordered"
                    value={String(scopedOrders.length)}
                    width={metricCardWidth}
                  />
                  <SummaryCard
                    label="Total Meals"
                    value={String(scopedTotalMeals)}
                    width={metricCardWidth}
                  />
                  <SummaryCard
                    label="Slots Remaining"
                    value={String(scopedSlotsRemaining)}
                    width={metricCardWidth}
                  />
                  <SummaryCard
                    label="Est. Revenue"
                    value={formatCurrency(scopedEstimatedRevenue)}
                    width={metricCardWidth}
                  />
                </View>

                <View style={styles.combinationCard}>
                  <Text style={styles.combinationTitle}>Meal Combinations</Text>
                  {mealCombinations.length === 0 ? (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyText}>No meals ordered for this view.</Text>
                    </View>
                  ) : (
                    mealCombinations.map((item, index) => (
                      <View
                        key={item.key}
                        style={[
                          styles.combinationRow,
                          index === 0 ? styles.combinationRowFirst : null,
                        ]}
                      >
                        <Text style={styles.combinationLabel}>{item.label}</Text>
                        <Text style={styles.combinationCount}>×{item.count}</Text>
                      </View>
                    ))
                  )}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>

      <Modal
        visible={detailsModalType !== null}
        transparent
        animationType="fade"
        onRequestClose={closeDetailsModal}
        statusBarTranslucent
        hardwareAccelerated
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeDetailsModal} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{modalTitle}</Text>

            {modalBoxes.length === 0 ? (
              <View style={styles.modalEmptyState}>
                <Text style={styles.modalEmptyText}>No boxes found.</Text>
              </View>
            ) : (
              <FlatList
                data={modalBoxes}
                keyExtractor={(item) => item.id}
                style={styles.modalList}
                contentContainerStyle={styles.modalListContent}
                renderItem={renderModalItem}
                initialNumToRender={10}
                maxToRenderPerBatch={10}
                updateCellsBatchingPeriod={50}
                windowSize={7}
                removeClippedSubviews
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
                showsVerticalScrollIndicator
              />
            )}

            <Pressable
              style={styles.modalCloseButton}
              onPress={closeDetailsModal}
            >
              <Text style={styles.modalCloseButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function MetricCard({
  label,
  value,
  color,
  width,
  onPress,
}: {
  label: string;
  value: number;
  color: string;
  width: `${number}%`;
  onPress?: () => void;
}) {
  const Container = onPress ? Pressable : View;

  return (
    <Container
      style={[
        styles.metricCard,
        onPress ? styles.metricCardClickable : null,
        { width },
      ]}
      onPress={onPress}
    >
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
    </Container>
  );
}

function SummaryCard({
  label,
  value,
  width,
}: {
  label: string;
  value: string;
  width: `${number}%`;
}) {
  return (
    <View style={[styles.summaryCard, { width }]}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F8F7",
    padding: 16,
  },
  dashboardTabs: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#DCE9E4",
    padding: 2,
    gap: 2,
    flexShrink: 0,
    marginTop: 2,
  },
  dashboardTab: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  dashboardTabActive: {
    backgroundColor: "#0D7A4E",
  },
  dashboardTabText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#5B7268",
  },
  dashboardTabTextActive: {
    color: "#FFFFFF",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
    gap: 10,
  },
  headerTitleWrap: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0B3D2E",
    lineHeight: 28,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "space-between",
  },
  metricCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#DCE9E4",
  },
  metricCardClickable: {
    borderColor: "#BCD5CA",
  },
  metricLabel: {
    fontSize: 12,
    color: "#43635A",
    fontWeight: "600",
  },
  metricValue: {
    marginTop: 8,
    fontSize: 28,
    fontWeight: "800",
  },
  scrollContent: {
    paddingBottom: 16,
    gap: 12,
  },
  sectionTitle: {
    marginTop: 8,
    marginBottom: -2,
    fontSize: 18,
    fontWeight: "700",
    color: "#0B3D2E",
  },
  chartContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DCE9E4",
    overflow: "hidden",
  },
  headerMeta: {
    fontSize: 12,
    color: "#5B7268",
    fontWeight: "600",
    lineHeight: 16,
  },
  headerMetaHidden: {
    opacity: 0,
  },
  dayTabs: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DCE9E4",
    padding: 4,
    gap: 4,
  },
  dayTab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 10,
  },
  dayTabActive: {
    backgroundColor: "#0D7A4E",
  },
  dayTabLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#5B7268",
  },
  dayTabLabelActive: {
    color: "#FFFFFF",
  },
  dayTabCount: {
    marginTop: 2,
    fontSize: 11,
    color: "#8A9A93",
  },
  dayTabCountActive: {
    color: "#B7E4C7",
  },
  inventoryBarCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DCE9E4",
    padding: 12,
    gap: 8,
  },
  inventoryBarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  inventoryBarTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0B3D2E",
  },
  inventoryBarMeta: {
    fontSize: 12,
    fontWeight: "600",
    color: "#5B7268",
    flexShrink: 1,
    textAlign: "right",
  },
  inventoryBarTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "#E8EFEC",
    overflow: "hidden",
  },
  inventoryBarFill: {
    height: "100%",
    borderRadius: 999,
  },
  inventoryBarCaption: {
    fontSize: 11,
    fontWeight: "600",
    color: "#8A9A93",
  },
  weekPickerRow: {
    gap: 6,
  },
  weekPickerLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#43635A",
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
    gap: 8,
  },
  dateSelectorText: {
    flex: 1,
    color: "#1E2A26",
    fontWeight: "600",
    fontSize: 14,
  },
  datePickerDone: {
    alignSelf: "flex-end",
    backgroundColor: "#E8EFEC",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  datePickerDoneText: {
    color: "#35574A",
    fontWeight: "700",
    fontSize: 13,
  },
  scopeTabs: {
    gap: 8,
    paddingVertical: 2,
  },
  scopeTab: {
    borderWidth: 1,
    borderColor: "#DCE9E4",
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  scopeTabActive: {
    backgroundColor: "#0D7A4E",
    borderColor: "#0D7A4E",
  },
  scopeTabText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#5B7268",
  },
  scopeTabTextActive: {
    color: "#FFFFFF",
  },
  scopeHeading: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0B3D2E",
  },
  loadingState: {
    paddingVertical: 28,
    alignItems: "center",
    gap: 8,
  },
  loadingText: {
    color: "#5B7268",
    fontSize: 13,
  },
  emptyState: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#CFE0D9",
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: "center",
    backgroundColor: "#FAFCFB",
  },
  emptyText: {
    color: "#617870",
    fontSize: 13,
  },
  combinationCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DCE9E4",
    padding: 14,
    gap: 10,
  },
  combinationTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0B3D2E",
  },
  combinationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5EFEB",
    paddingTop: 10,
  },
  combinationRowFirst: {
    borderTopWidth: 0,
    paddingTop: 0,
  },
  combinationLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#13493A",
  },
  combinationCount: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0D7A4E",
  },
  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#DCE9E4",
    alignItems: "center",
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0D7A4E",
  },
  summaryLabel: {
    marginTop: 4,
    fontSize: 12,
    color: "#8A9A93",
    fontWeight: "600",
    textAlign: "center",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.28)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 520,
    maxHeight: "80%",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#DCE9E4",
    padding: 14,
    gap: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0B3D2E",
  },
  modalList: {
    flexGrow: 0,
  },
  modalListContent: {
    gap: 8,
    paddingBottom: 8,
  },
  modalItem: {
    borderWidth: 1,
    borderColor: "#DCE9E4",
    borderRadius: 10,
    padding: 10,
    backgroundColor: "#FAFCFB",
    gap: 4,
  },
  modalMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  modalMetaLabel: {
    color: "#5B7268",
    fontSize: 12,
    fontWeight: "600",
  },
  modalMetaValue: {
    color: "#13493A",
    fontSize: 13,
    fontWeight: "700",
    flexShrink: 1,
    textAlign: "right",
  },
  modalEmptyState: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#CFE0D9",
    borderRadius: 10,
    paddingVertical: 22,
    alignItems: "center",
  },
  modalEmptyText: {
    color: "#617870",
    fontSize: 13,
  },
  modalCloseButton: {
    marginTop: 4,
    backgroundColor: "#E8EFEC",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  modalCloseButtonText: {
    color: "#35574A",
    fontWeight: "700",
    fontSize: 13,
  },
});
