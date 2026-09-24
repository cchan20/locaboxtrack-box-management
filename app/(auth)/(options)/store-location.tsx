import { useAppDispatch } from "@/store/hooks";
import {
  getGlobalSettings,
  updateStoreLocations,
} from "@/store/slices/settingsSlice";
import { StoreLocation } from "@/types/app";
import { getErrorMessage } from "@/utils/apiError";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function StoreLocationScreen() {
  const dispatch = useAppDispatch();
  const [items, setItems] = useState<StoreLocation[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");

  const isEditing = selectedId !== null;

  const resetForm = () => {
    setSelectedId(null);
    setName("");
  };

  const fillForm = (item: StoreLocation) => {
    setSelectedId(item.id);
    setName(item.name);
  };

  const loadLocations = useCallback(async () => {
    setIsFetching(true);
    try {
      const response = await dispatch(getGlobalSettings()).unwrap();
      setItems(response.data.storeLocations);
    } catch {
      setItems([]);
    } finally {
      setIsFetching(false);
    }
  }, [dispatch]);

  useFocusEffect(
    useCallback(() => {
      void loadLocations();
    }, [loadLocations]),
  );

  const persistLocations = async (next: StoreLocation[]) => {
    const response = await dispatch(updateStoreLocations(next)).unwrap();
    setItems(response.data.storeLocations);
  };

  const validateForm = () => {
    const value = name.trim();
    if (!value) {
      Alert.alert("Missing name", "Please enter a store location name.");
      return null;
    }
    return { name: value };
  };

  const handleAdd = async () => {
    const form = validateForm();
    if (!form) {
      return;
    }

    // Omit id so the backend generates it.
    const next: StoreLocation[] = [...items, { id: "", name: form.name }];

    try {
      await persistLocations(next);
      resetForm();
    } catch (error) {
      Alert.alert("Unable to add", getErrorMessage(error, "Failed to save store location."));
    }
  };

  const handleSave = async () => {
    if (!selectedId) {
      return;
    }

    const form = validateForm();
    if (!form) {
      return;
    }

    const next = items.map((loc) =>
      loc.id === selectedId ? { ...loc, name: form.name } : loc,
    );

    try {
      await persistLocations(next);
      resetForm();
    } catch (error) {
      Alert.alert("Unable to save", getErrorMessage(error));
      await loadLocations();
    }
  };

  const handleCancel = () => {
    resetForm();
  };

  const handleSelect = (item: StoreLocation) => {
    if (selectedId === item.id) {
      return;
    }
    fillForm(item);
  };

  const handleDelete = (item: StoreLocation) => {
    Alert.alert("Delete Store Location", `Delete "${item.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await persistLocations(items.filter((loc) => loc.id !== item.id));
            if (selectedId === item.id) {
              resetForm();
            }
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
        <Text style={styles.loadingText}>Loading store locations...</Text>
      ) : null}

      <View style={styles.panelRow}>
        <View style={[styles.card, styles.leftCard]}>
          <Text style={styles.title}>
            {isEditing ? "Edit Store Location" : "New Store Location"}
          </Text>
          <Text style={styles.subtitle}>
            {isEditing
              ? "Update the selected store location, then save or cancel."
              : "Add a pickup store location used for web orders."}
          </Text>

          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Location name (e.g. KLCC)"
            style={[styles.input, styles.stackedInput]}
          />

          {isEditing ? (
            <View style={styles.actionRow}>
              <Pressable style={[styles.cancelButton, styles.actionButton]} onPress={handleCancel}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.addButton, styles.actionButton]} onPress={handleSave}>
                <Text style={styles.addButtonText}>Save</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable style={[styles.addButton, styles.stackedAddButton]} onPress={handleAdd}>
              <Text style={styles.addButtonText}>Add</Text>
            </Pressable>
          )}
        </View>

        <View style={[styles.card, styles.rightCard]}>
          <Text style={styles.title}>Location List</Text>

          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const selected = selectedId === item.id;
              return (
                <Pressable
                  style={[styles.row, selected ? styles.rowSelected : null]}
                  onPress={() => handleSelect(item)}
                >
                  <View style={styles.rowText}>
                    <Text style={styles.primaryText}>{item.name}</Text>
                  </View>
                  <Pressable style={styles.deleteButton} onPress={() => handleDelete(item)}>
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </Pressable>
                </Pressable>
              );
            }}
            ListEmptyComponent={<Text style={styles.emptyText}>No store locations found.</Text>}
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
  stackedInput: {
    marginTop: 12,
    flexGrow: 0,
    flexShrink: 0,
    width: "100%",
  },
  input: {
    borderWidth: 1,
    borderColor: "#C7D8D1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
  },
  actionRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 10,
  },
  actionButton: {
    flex: 1,
  },
  addButton: {
    backgroundColor: "#0D7A4E",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  stackedAddButton: {
    marginTop: 12,
    width: "100%",
  },
  addButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: "#C7D8D1",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  cancelButtonText: {
    color: "#577066",
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
    gap: 12,
    backgroundColor: "#FFFFFF",
  },
  rowSelected: {
    borderColor: "#0D7A4E",
    backgroundColor: "#E6F2ED",
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  primaryText: {
    fontWeight: "700",
    color: "#0D4A37",
    fontSize: 15,
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
