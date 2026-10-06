import { useAppDispatch } from "@/store/hooks";
import {
  createPrefix,
  deletePrefix,
  getPrefixes,
} from "@/store/slices/prefixSlice";
import { RunningNoControl } from "@/types/app";
import { ClearableTextInput } from "@/ui/ClearableTextInput";
import { getErrorMessage } from "@/utils/apiError";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function BoxSettingScreen() {
  const dispatch = useAppDispatch();
  const [items, setItems] = useState<RunningNoControl[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [prefix, setPrefix] = useState("");

  const loadPrefixes = useCallback(async () => {
    setIsFetching(true);
    try {
      const response = await dispatch(getPrefixes()).unwrap();
      setItems(response.data);
    } catch {
      setItems([]);
    } finally {
      setIsFetching(false);
    }
  }, [dispatch]);

  useFocusEffect(
    useCallback(() => {
      void loadPrefixes();
    }, [loadPrefixes]),
  );

  const handleAdd = async () => {
    const value = prefix.trim().toUpperCase();

    if (!value) {
      Alert.alert("Missing prefix", "Please enter a prefix.");
      return;
    }

    try {
      await dispatch(createPrefix({ prefix: value })).unwrap();
      setPrefix("");
      await loadPrefixes();
    } catch (error) {
      Alert.alert("Unable to add", getErrorMessage(error, "Prefix may already exist."));
    }
  };

  const handleDelete = (item: RunningNoControl) => {
    Alert.alert("Delete Prefix", `Delete prefix ${item.id}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await dispatch(deletePrefix(item.id)).unwrap();
            await loadPrefixes();
          } catch (error) {
            Alert.alert("Unable to delete", getErrorMessage(error));
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.container}>
      {isFetching && items.length === 0 ? (
        <Text style={styles.loadingText}>Loading prefixes...</Text>
      ) : null}

      <View style={styles.panelRow}>
        <View style={[styles.card, styles.leftCard]}>
          <Text style={styles.title}>Box Setting</Text>
          <Text style={styles.subtitle}>Manage box ID prefixes and running numbers.</Text>

          <View style={styles.addRow}>
            <ClearableTextInput
              value={prefix}
              onChangeText={setPrefix}
              placeholder="Prefix (e.g. BOX, CRT)"
              autoCapitalize="characters"
              style={styles.input}
              containerStyle={styles.inputGrow}
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
                  <Text style={styles.numberText}>Current Number: {item.currentNumber}</Text>
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
  inputGrow: {
    flex: 1,
  },
  input: {
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
