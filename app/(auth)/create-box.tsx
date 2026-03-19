import {
  createBoxesFromPrefix,
  fetchPrefixes,
  initializeDatabase,
  RunningNoControlRow,
} from "@/database/appDatabase";
import { useAppData } from "@/store/AppDataContext";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";

export default function CreateBoxScreen() {
  const router = useRouter();
  const { refreshData } = useAppData();

  const [prefixes, setPrefixes] = useState<RunningNoControlRow[]>([]);
  const [selectedPrefixId, setSelectedPrefixId] = useState("");
  const [quantityText, setQuantityText] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedPrefix = useMemo(
    () => prefixes.find((item) => item.id === selectedPrefixId) ?? null,
    [prefixes, selectedPrefixId],
  );

  useEffect(() => {
    const boot = async () => {
      await initializeDatabase();
      const rows = await fetchPrefixes();
      setPrefixes(rows);
      setSelectedPrefixId(rows[0]?.id ?? "");
      setIsReady(true);
    };

    boot();
  }, []);

  const handleCreate = async () => {
    const quantity = Number(quantityText.trim());

    if (!selectedPrefixId) {
      Alert.alert("Select prefix", "Please choose a box prefix first.");
      return;
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      Alert.alert("Invalid quantity", "Please enter a valid number of boxes.");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await createBoxesFromPrefix(selectedPrefixId, quantity);
      await refreshData();

      Alert.alert(
        "Success",
        `${result.createdCount} box(es) created. ${selectedPrefixId} current number is now ${result.lastNumber}.`,
        [{ text: "OK", onPress: () => router.back() }],
      );
    } catch {
      Alert.alert(
        "Unable to create boxes",
        "Creation failed. Prefix may be missing, or generated IDs may already exist.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.container}>
      <Stack.Screen
        options={{
          title: "Create Box",
        }}
      />
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          {!isReady ? <Text style={styles.loadingText}>Loading box prefixes...</Text> : null}

          <View style={styles.card}>
        <Text style={styles.label}>Box Prefix</Text>
        <Pressable style={styles.selectorButton} onPress={() => setPickerOpen(true)}>
          <View>
            <Text style={styles.selectorTitle}>{selectedPrefix?.id || "Select a prefix"}</Text>
            <Text style={styles.selectorSubtext}>
              Current Number: {selectedPrefix?.current_number ?? "-"}
            </Text>
          </View>
          <Ionicons name="chevron-down" size={18} color="#42685D" />
        </Pressable>

        <Text style={styles.label}>Number of Boxes</Text>
        <TextInput
          value={quantityText}
          onChangeText={setQuantityText}
          placeholder="e.g. 10"
          placeholderTextColor="#6B7D76"
          keyboardType="number-pad"
          style={styles.input}
        />

        <Pressable
          style={[styles.createButton, isSubmitting ? styles.createButtonDisabled : undefined]}
          onPress={handleCreate}
          disabled={isSubmitting}
        >
          <Text style={styles.createButtonText}>{isSubmitting ? "Creating..." : "Create Boxes"}</Text>
        </Pressable>
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>

      <Modal
        transparent
        visible={pickerOpen}
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setPickerOpen(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Box Prefix</Text>
            {prefixes.map((item) => (
              <Pressable
                key={item.id}
                style={styles.modalItem}
                onPress={() => {
                  setSelectedPrefixId(item.id);
                  setPickerOpen(false);
                }}
              >
                <Text style={styles.modalItemTitle}>{item.id}</Text>
                <Text style={styles.modalItemSub}>Current Number: {item.current_number}</Text>
              </Pressable>
            ))}
            {!prefixes.length ? <Text style={styles.emptyText}>No box prefixes found.</Text> : null}
          </View>
        </Pressable>
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
  keyboardView: {
    flex: 1,
  },
  loadingText: {
    color: "#2D5A4B",
    fontWeight: "600",
    backgroundColor: "#E6F2ED",
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  card: {
    borderWidth: 1,
    borderColor: "#DDEBE6",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    padding: 16,
  },
  label: {
    color: "#35554A",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 10,
    marginBottom: 6,
  },
  selectorButton: {
    borderWidth: 1,
    borderColor: "#C7D8D1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  selectorTitle: {
    color: "#1E2A26",
    fontWeight: "700",
    fontSize: 15,
  },
  selectorSubtext: {
    marginTop: 2,
    color: "#5C7269",
    fontSize: 12,
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
  createButton: {
    marginTop: 16,
    backgroundColor: "#0D7A4E",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  createButtonDisabled: {
    opacity: 0.75,
  },
  createButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.25)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    maxHeight: "75%",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0B3D2E",
    marginBottom: 10,
  },
  modalItem: {
    borderWidth: 1,
    borderColor: "#DDEBE6",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  modalItemTitle: {
    color: "#1E2A26",
    fontWeight: "700",
  },
  modalItemSub: {
    marginTop: 2,
    color: "#5C7269",
    fontSize: 12,
  },
  emptyText: {
    color: "#6E7C76",
    fontSize: 13,
  },
});
