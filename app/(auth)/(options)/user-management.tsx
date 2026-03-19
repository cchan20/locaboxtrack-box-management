import {
  fetchUsers,
  initializeDatabase,
  UserRow,
} from "@/database/appDatabase";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function UserManagementScreen() {
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [isReady, setIsReady] = useState(false);

  const loadUsers = useCallback(async () => {
    const rows = await fetchUsers();
    setUsers(rows);
  }, []);

  useEffect(() => {
    const boot = async () => {
      await initializeDatabase();
      await loadUsers();
      setIsReady(true);
    };

    boot();
  }, [loadUsers]);

  useFocusEffect(
    useCallback(() => {
      if (!isReady) {
        return;
      }

      loadUsers();
    }, [isReady, loadUsers]),
  );

  const openCreate = () => {
    router.push("/(auth)/user-form");
  };

  const openEdit = (userId: number) => {
    router.push({ pathname: "/(auth)/user-form", params: { id: String(userId) } });
  };

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.container}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <TouchableOpacity
              onPress={openCreate}
              accessibilityRole="button"
              accessibilityLabel="Create user"
              style={styles.headerAction}
            >
              <Ionicons name="person-add" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          ),
        }}
      />

      {!isReady ? <Text style={styles.loadingText}>Loading users...</Text> : null}

      <View style={styles.card}>
        <Text style={styles.title}>User List</Text>
        {!users.length && isReady ? (
          <Pressable style={styles.emptyState} onPress={openCreate}>
            <Ionicons name="person-add" size={34} color="#0D7A4E" />
            <Text style={styles.emptyTitle}>No users yet</Text>
            <Text style={styles.emptyText}>Tap to create your first user account.</Text>
          </Pressable>
        ) : null}
        <FlatList
          data={users}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Pressable style={styles.listRow} onPress={() => openEdit(item.id)}>
              <View style={styles.listInfo}>
                <Text style={styles.userName}>{item.name}</Text>
                <Text style={styles.userMeta}>@{item.username}</Text>
                <Text style={styles.userMeta}>Status: {item.status}</Text>
              </View>

              <Ionicons name="chevron-forward" size={18} color="#7A8F87" />
            </Pressable>
          )}
        />
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
  card: {
    borderWidth: 1,
    borderColor: "#DDEBE6",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    padding: 16,
  },
  loadingText: {
    color: "#2D5A4B",
    fontWeight: "600",
    backgroundColor: "#E6F2ED",
    borderRadius: 10,
    padding: 10,
  },
  headerAction: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0B3D2E",
  },
  emptyState: {
    marginTop: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#BFD7CE",
    borderRadius: 12,
    paddingVertical: 24,
    alignItems: "center",
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
  listContent: {
    marginTop: 10,
    gap: 8,
    paddingBottom: 8,
  },
  listRow: {
    borderWidth: 1,
    borderColor: "#DDEBE6",
    borderRadius: 10,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  listInfo: {
    flex: 1,
    paddingRight: 8,
  },
  userName: {
    fontWeight: "700",
    color: "#0D4A37",
  },
  userMeta: {
    marginTop: 2,
    fontSize: 13,
    color: "#577066",
  },
});
