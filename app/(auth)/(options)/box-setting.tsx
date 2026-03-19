import {
  addPrefix,
  deletePrefix,
  fetchPrefixes,
  initializeDatabase,
  RunningNoControlRow,
} from "@/database/appDatabase";
import { useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export default function BoxSettingScreen() {
  const [items, setItems] = useState<RunningNoControlRow[]>([]);
  const [prefix, setPrefix] = useState("");
  const [isReady, setIsReady] = useState(false);

  const loadPrefixes = async () => {
    const rows = await fetchPrefixes();
    setItems(rows);
  };

  useEffect(() => {
    const boot = async () => {
      await initializeDatabase();
      await loadPrefixes();
      setIsReady(true);
    };

    boot();
  }, []);

  const handleAdd = async () => {
    const value = prefix.trim().toUpperCase();

    if (!value) {
      Alert.alert("Missing prefix", "Please enter a prefix.");
      return;
    }

    try {
      await addPrefix(value);
      setPrefix("");
      await loadPrefixes();
    } catch {
      Alert.alert("Unable to add", "Prefix may already exist.");
    }
  };

  const handleDelete = (item: RunningNoControlRow) => {
    Alert.alert("Delete Prefix", `Delete prefix ${item.id}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deletePrefix(item.id);
          await loadPrefixes();
        },
      },
    ]);
  };

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.container}>
      {!isReady ? <Text style={styles.loadingText}>Loading prefixes...</Text> : null}

      <View style={styles.panelRow}>
        <View style={[styles.card, styles.leftCard]}>
          <Text style={styles.title}>Box Setting</Text>
          <Text style={styles.subtitle}>Manage prefix list from running_no_control table.</Text>

          <View style={styles.addRow}>
            <TextInput
              value={prefix}
              onChangeText={setPrefix}
              placeholder="Prefix (e.g. BOX, CRT)"
              autoCapitalize="characters"
              style={styles.input}
            />
            <Pressable style={styles.addButton} onPress={handleAdd}>
              <Text style={styles.addButtonText}>Add</Text>
            </Pressable>
          </View>
        </View>

        <View style={[styles.card, styles.rightCard]}>
          <Text style={styles.title}>Prefix List</Text>

          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <View style={styles.row}>
                <View>
                  <Text style={styles.prefixText}>{item.id}</Text>
                  <Text style={styles.numberText}>Current Number: {item.current_number}</Text>
                </View>
                <Pressable style={styles.deleteButton} onPress={() => handleDelete(item)}>
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </Pressable>
              </View>
            )}
            ListEmptyComponent={<Text style={styles.emptyText}>No prefixes found.</Text>}
          />
        </View>
      </View>
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
  panelRow: {
    flex: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 0,
  },
  loadingText: {
    color: "#2D5A4B",
    fontWeight: "600",
    backgroundColor: "#E6F2ED",
    borderRadius: 10,
    padding: 10,
  },
  card: {
    borderWidth: 1,
    borderColor: "#DDEBE6",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    padding: 16,
  },
  leftCard: {
    width: "38%",
  },
  rightCard: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0B3D2E",
  },
  subtitle: {
    marginTop: 8,
    color: "#577066",
    fontSize: 14,
  },
  addRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#C7D8D1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
  },
  addButton: {
    backgroundColor: "#0D7A4E",
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  addButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  listContent: {
    marginTop: 10,
    gap: 8,
    paddingBottom: 12,
    flexGrow: 1,
  },
  list: {
    flex: 1,
  },
  row: {
    borderWidth: 1,
    borderColor: "#DDEBE6",
    borderRadius: 10,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  prefixText: {
    fontWeight: "700",
    color: "#0D4A37",
    fontSize: 15,
  },
  numberText: {
    marginTop: 2,
    color: "#577066",
    fontSize: 12,
  },
  deleteButton: {
    borderWidth: 1,
    borderColor: "#EBC2BE",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "#FCECEA",
  },
  deleteButtonText: {
    color: "#B42318",
    fontWeight: "700",
  },
  emptyText: {
    marginTop: 8,
    color: "#6E7C76",
  },
});
