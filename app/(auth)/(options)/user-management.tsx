import { useAppDispatch } from "@/store/hooks";
import { getUsers } from "@/store/slices/userSlice";
import { User } from "@/types/app";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
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
  const dispatch = useAppDispatch();
  const [users, setUsers] = useState<User[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const loadUsers = useCallback(async () => {
    setIsFetching(true);
    try {
      const response = await dispatch(getUsers()).unwrap();
      setUsers(response.data);
      setIsSuccess(true);
    } catch {
      setUsers([]);
      setIsSuccess(false);
    } finally {
      setIsFetching(false);
    }
  }, [dispatch]);

  useFocusEffect(
    useCallback(() => {
      void loadUsers();
    }, [loadUsers]),
  );

  const openCreate = () => {
    router.push("/(auth)/user-form");
  };

  const openEdit = (userId: string) => {
    router.push({ pathname: "/(auth)/user-form", params: { id: userId } });
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

      {isFetching && !isSuccess ? <Text style={styles.loadingText}>Loading users...</Text> : null}

      <View style={styles.card}>
        <Text style={styles.title}>User List</Text>
        {!users.length && isSuccess ? (
          <Pressable style={styles.emptyState} onPress={openCreate}>
            <Ionicons name="person-add" size={34} color="#8A553E" />
            <Text style={styles.emptyTitle}>No users yet</Text>
            <Text style={styles.emptyText}>Tap to create your first user account.</Text>
          </Pressable>
        ) : null}
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Pressable style={styles.listRow} onPress={() => openEdit(item.id)}>
              <View style={styles.listInfo}>
                <Text style={styles.userName}>{item.name}</Text>
                <Text style={styles.userMeta}>@{item.username}</Text>
                <Text style={styles.userMeta}>
                  Role: {item.role} · Status: {item.status}
                </Text>
              </View>

              <Ionicons name="chevron-forward" size={18} color="#8F7A72" />
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
    backgroundColor: "#F8F4F1",
    padding: 16,
    gap: 12,
  },
  card: {
    borderWidth: 1,
    borderColor: "#E9E0DA",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    padding: 16,
  },
  loadingText: {
    color: "#5E4336",
    fontWeight: "600",
    backgroundColor: "#F0E8E3",
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
    color: "#3F2419",
  },
  emptyState: {
    marginTop: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#D4C8C0",
    borderRadius: 12,
    paddingVertical: 24,
    alignItems: "center",
  },
  emptyTitle: {
    marginTop: 10,
    fontSize: 17,
    fontWeight: "700",
    color: "#5A3425",
  },
  emptyText: {
    marginTop: 4,
    fontSize: 13,
    color: "#74675F",
  },
  listContent: {
    marginTop: 10,
    gap: 8,
    paddingBottom: 8,
  },
  listRow: {
    borderWidth: 1,
    borderColor: "#E9E0DA",
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
    color: "#5A3425",
  },
  userMeta: {
    marginTop: 2,
    fontSize: 13,
    color: "#74675F",
  },
});
