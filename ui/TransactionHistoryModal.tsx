import { TransactionHistoryItem } from "@/types/app";
import { Ionicons } from "@expo/vector-icons";
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";

type TransactionHistoryModalProps = {
  visible: boolean;
  title: string;
  context: "client" | "box";
  transactions: TransactionHistoryItem[];
  isLoading: boolean;
  onClose: () => void;
};

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString();
}

export function TransactionHistoryModal({
  visible,
  title,
  context,
  transactions,
  isLoading,
  onClose,
}: TransactionHistoryModalProps) {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>Latest transactions first</Text>
            </View>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={18} color="#36584D" />
            </Pressable>
          </View>

          {isLoading ? (
            <View style={styles.emptyState}>
              <Ionicons name="time-outline" size={28} color="#7A8F87" />
              <Text style={styles.emptyTitle}>Loading transactions...</Text>
            </View>
          ) : (
            <FlatList
              data={transactions}
              keyExtractor={(item) => `${item.id}`}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              showsVerticalScrollIndicator
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Ionicons name="receipt-outline" size={28} color="#7A8F87" />
                  <Text style={styles.emptyTitle}>No transactions found</Text>
                  <Text style={styles.emptyText}>There is no recorded history for this item yet.</Text>
                </View>
              }
              renderItem={({ item }) => (
                <View style={styles.itemCardCompact}>
                  <View style={styles.itemHeader}>
                    <View style={styles.leftMeta}>
                      <Text style={styles.metaLabel}>{context === "box" ? "Customer" : "Box"}</Text>
                      <Text style={styles.metaValue} numberOfLines={1}>
                        {context === "box" ? item.customerName ?? item.customerId : item.boxId}
                      </Text>
                    </View>

                    <View style={styles.headerRightCol}>
                      <View
                        style={[
                          styles.typeTag,
                          item.type === "checkout" ? styles.checkoutTag : styles.returnTag,
                        ]}
                      >
                        <Text
                          style={[
                            styles.typeText,
                            item.type === "checkout" ? styles.checkoutText : styles.returnText,
                          ]}
                        >
                          {item.type === "checkout" ? "Check-out" : "Check-in"}
                        </Text>
                      </View>
                      <Text style={styles.dateText}>{formatDate(item.date)}</Text>
                    </View>
                  </View>
                </View>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.28)",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    width: "92%",
    maxHeight: "86%",
    alignSelf: "center",
    gap: 10,
  },
  list: {
    flexGrow: 0,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0B3D2E",
  },
  subtitle: {
    marginTop: 2,
    color: "#5D746A",
    fontSize: 12,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF4F1",
  },
  listContent: {
    paddingBottom: 8,
    gap: 8,
  },
  itemCardCompact: {
    borderWidth: 1,
    borderColor: "#DDEBE6",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  leftMeta: {
    flex: 1,
    gap: 2,
  },
  headerRightCol: {
    alignItems: "flex-end",
    gap: 4,
  },
  typeTag: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  checkoutTag: {
    backgroundColor: "#E8F0FB",
    borderColor: "#C8DBF4",
  },
  returnTag: {
    backgroundColor: "#E7F4EE",
    borderColor: "#C4E0D2",
  },
  typeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  checkoutText: {
    color: "#285D9E",
  },
  returnText: {
    color: "#0B5D44",
  },
  dateText: {
    color: "#5C7269",
    fontSize: 11,
  },
  metaLabel: {
    color: "#5C7269",
    fontSize: 11,
  },
  metaValue: {
    color: "#1E2A26",
    fontSize: 14,
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 28,
    gap: 6,
  },
  emptyTitle: {
    color: "#0D4A37",
    fontSize: 15,
    fontWeight: "700",
  },
  emptyText: {
    color: "#5D746A",
    fontSize: 13,
    textAlign: "center",
  },
});