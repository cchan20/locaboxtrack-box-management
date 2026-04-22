import { fetchTransactionsSince } from "@/database/appDatabase";
import { useAppData } from "@/store/AppDataContext";
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
  FlatList,
  Modal,
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

export default function DashboardScreen() {
  const { boxes, customers, dashboardStats, getDaysOut, isReady, refreshData } =
    useAppData();
  const { width } = useWindowDimensions();
  const metricsColumns = width >= 900 ? 4 : 2;
  const metricCardWidth = metricsColumns === 4 ? "23.5%" : "48.5%";
  const chartWidth = width - 32;
  const [detailsModalType, setDetailsModalType] = useState<
    "total-out" | "safe" | "warning" | "overdue" | null
  >(null);

  const chartRef = useRef<any>(null);
  const [chartData, setChartData] = useState<{
    dates: string[];
    checkouts: number[];
    checkins: number[];
  }>({ dates: [], checkouts: [], checkins: [] });

  const closeDetailsModal = useCallback(() => {
    setDetailsModalType(null);
  }, []);

  const checkedOutBoxes = useMemo(
    () =>
      boxes
        .filter((box) => box.status === "checked-out")
        .sort((a, b) =>
          a.id.localeCompare(b.id, undefined, {
            numeric: true,
            sensitivity: "base",
          }),
        ),
    [boxes],
  );

  const safeBoxes = useMemo(
    () => checkedOutBoxes.filter((box) => getDaysOut(box.dateOut) <= 7),
    [checkedOutBoxes, getDaysOut],
  );

  const warningBoxes = useMemo(
    () =>
      checkedOutBoxes.filter((box) => {
        const daysOut = getDaysOut(box.dateOut);
        return daysOut > 7 && daysOut <= 14;
      }),
    [checkedOutBoxes, getDaysOut],
  );

  const overdueBoxes = useMemo(
    () => checkedOutBoxes.filter((box) => getDaysOut(box.dateOut) > 14),
    [checkedOutBoxes, getDaysOut],
  );

  const customerPhoneById = useMemo(
    () =>
      customers.reduce<Record<string, string>>((acc, customer) => {
        acc[customer.id] = customer.phone;
        return acc;
      }, {}),
    [customers],
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

  const renderModalItem = useCallback(
    ({ item }: { item: (typeof modalBoxes)[number] }) => (
      <View style={styles.modalItem}>
        <View style={styles.modalMetaRow}>
          <Text style={styles.modalMetaLabel}>Box ID</Text>
          <Text style={styles.modalMetaValue}>{item.id}</Text>
        </View>
        <View style={styles.modalMetaRow}>
          <Text style={styles.modalMetaLabel}>Customer Name</Text>
          <Text style={styles.modalMetaValue}>
            {(item.customerName ?? "-") + " / " + (item.customerId ? (customerPhoneById[item.customerId] ?? "-") : "-")}
          </Text>
        </View>
        <View style={styles.modalMetaRow}>
          <Text style={styles.modalMetaLabel}>Days Out</Text>
          <Text style={styles.modalMetaValue}>{getDaysOut(item.dateOut)}</Text>
        </View>
      </View>
    ),
    [customerPhoneById, getDaysOut],
  );

  const loadChartData = useCallback(async () => {
    const since = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const transactions = await fetchTransactionsSince(since);
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(Date.now() - (13 - i) * 24 * 60 * 60 * 1000);
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

    setChartData({
      dates: days.map((d) => d.label),
      checkouts: days.map((d) => checkoutMap[d.key] ?? 0),
      checkins: days.map((d) => checkinMap[d.key] ?? 0),
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!isReady) {
        return;
      }

      refreshData();
      loadChartData();
    }, [isReady, loadChartData, refreshData]),
  );

  useEffect(() => {
    if (!chartRef.current || chartData.dates.length === 0) {
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
  }, [chartData, chartWidth]);

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.headerRow}>
          <Text style={styles.title}>LocaBox Tracker</Text>
        </View>

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F8F7",
    padding: 16,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0B3D2E",
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
    paddingBottom: 80,
  },
  sectionTitle: {
    marginTop: 20,
    marginBottom: 10,
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
