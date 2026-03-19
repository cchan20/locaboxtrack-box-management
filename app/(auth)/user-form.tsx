import {
  createUser,
  deleteUser,
  fetchUserById,
  initializeDatabase,
  updateUser,
} from "@/database/appDatabase";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Alert,
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

export default function UserFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const editingUserId = useMemo(() => {
    if (!params.id) {
      return null;
    }

    const parsed = Number(params.id);
    return Number.isFinite(parsed) ? parsed : null;
  }, [params.id]);

  const [isReady, setIsReady] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState("active");
  const [isPasswordHidden, setIsPasswordHidden] = useState(true);

  const isEditMode = editingUserId !== null;

  useEffect(() => {
    const boot = async () => {
      await initializeDatabase();

      if (editingUserId) {
        const user = await fetchUserById(editingUserId);

        if (!user) {
          Alert.alert("Not found", "User not found.", [
            { text: "OK", onPress: () => router.back() },
          ]);
          return;
        }

        setUsername(user.username);
        setName(user.name);
        setStatus(user.status);
      }

      setIsReady(true);
    };

    boot();
  }, [editingUserId, router]);

  const handleSave = async () => {
    const normalizedUsername = username.trim();
    const normalizedName = name.trim();
    const normalizedPassword = password.trim();
    const normalizedConfirmPassword = confirmPassword.trim();

    if (!normalizedUsername || !normalizedName) {
      Alert.alert("Missing info", "Username and name are required.");
      return;
    }

    if (!isEditMode && !normalizedPassword) {
      Alert.alert("Missing info", "Password is required for new user.");
      return;
    }

    if (!isEditMode && normalizedPassword !== normalizedConfirmPassword) {
      Alert.alert("Password mismatch", "Password and confirm password must match.");
      return;
    }

    if (isEditMode && !normalizedPassword && normalizedConfirmPassword) {
      Alert.alert("Missing info", "Enter a new password before confirm password.");
      return;
    }

    if (isEditMode && normalizedPassword && normalizedPassword !== normalizedConfirmPassword) {
      Alert.alert("Password mismatch", "Password and confirm password must match.");
      return;
    }

    try {
      if (editingUserId) {
        await updateUser(editingUserId, {
          username: normalizedUsername,
          name: normalizedName,
          status,
          password: normalizedPassword || undefined,
        });
      } else {
        console.log("Creating user with:", { normalizedUsername, normalizedName, status });
        
        await createUser({
          username: normalizedUsername,
          password: normalizedPassword,
          name: normalizedName,
          status,
        });
        console.log("User created successfully");
        
      }

      router.back();
    } catch {
      Alert.alert("Error", "Unable to save user. Username might already exist.");
    }
  };

  const handleDelete = () => {
    if (!editingUserId) {
      return;
    }

    Alert.alert("Delete User", `Delete ${username}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteUser(editingUserId);
          router.back();
        },
      },
    ]);
  };

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.container}>
      <Stack.Screen
        options={{
          title: isEditMode ? "Update User" : "Create User",
        }}
      />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 72 : 0}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            style={styles.formScroll}
            contentContainerStyle={styles.formScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.card}>
              {!isReady ? <Text style={styles.loadingText}>Loading user...</Text> : null}

          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder="Username"
            placeholderTextColor="#6B7D76"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />

          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Display name"
            placeholderTextColor="#6B7D76"
            style={styles.input}
          />

          <View style={styles.passwordWrap}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder={isEditMode ? "Password (optional to keep current)" : "Password"}
              placeholderTextColor="#6B7D76"
              secureTextEntry={isPasswordHidden}
              style={[styles.input, styles.passwordInput]}
            />
            <Pressable
              onPress={() => setIsPasswordHidden((current) => !current)}
              style={styles.passwordToggleButton}
            >
              <Ionicons name={isPasswordHidden ? "eye-outline" : "eye-off-outline"} size={19} color="#0E6045" />
            </Pressable>
          </View>

          <View style={styles.passwordWrap}>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder={isEditMode ? "Confirm Password (only if changing)" : "Confirm Password"}
              placeholderTextColor="#6B7D76"
              secureTextEntry={isPasswordHidden}
              style={[styles.input, styles.passwordInput]}
            />
          </View>

          <View style={styles.segmentRow}>
            <Text style={styles.segmentLabel}>Status</Text>
            <View style={styles.segmentButtons}>
              <Pressable
                onPress={() => setStatus("active")}
                style={[styles.segmentButton, status === "active" ? styles.segmentButtonActive : undefined]}
              >
                <Text
                  style={[
                    styles.segmentButtonText,
                    status === "active" ? styles.segmentButtonTextActive : undefined,
                  ]}
                >
                  Active
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setStatus("inactive")}
                style={[styles.segmentButton, status === "inactive" ? styles.segmentButtonActive : undefined]}
              >
                <Text
                  style={[
                    styles.segmentButtonText,
                    status === "inactive" ? styles.segmentButtonTextActive : undefined,
                  ]}
                >
                  Inactive
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.formActions}>
            <Pressable style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>{isEditMode ? "Update User" : "Create User"}</Text>
            </Pressable>
            {/* <Pressable style={styles.cancelButton} onPress={() => router.back()}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable> */}
          </View>

              {isEditMode ? (
                <Pressable style={styles.deleteButton} onPress={handleDelete}>
                  <Text style={styles.deleteButtonText}>Delete User</Text>
                </Pressable>
              ) : null}
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
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
  formScroll: {
    flex: 1,
  },
  formScrollContent: {
    paddingBottom: 16,
  },
  loadingText: {
    color: "#2D5A4B",
    fontWeight: "600",
    backgroundColor: "#E6F2ED",
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  card: {
    borderWidth: 1,
    borderColor: "#DDEBE6",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    padding: 16,
  },
  input: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#C7D8D1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    color: "#1E2A26",
    fontSize: 15,
  },
  passwordWrap: {
    position: "relative",
  },
  passwordInput: {
    paddingRight: 42,
  },
  passwordToggleButton: {
    position: "absolute",
    right: 10,
    top: 20,
  },
  segmentRow: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  segmentLabel: {
    fontWeight: "600",
    color: "#36584D",
  },
  segmentButtons: {
    flexDirection: "row",
    gap: 8,
  },
  segmentButton: {
    borderWidth: 1,
    borderColor: "#C3D9CF",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#F8FCFA",
  },
  segmentButtonActive: {
    backgroundColor: "#0D7A4E",
    borderColor: "#0D7A4E",
  },
  segmentButtonText: {
    color: "#1F5041",
    fontSize: 13,
    fontWeight: "600",
  },
  segmentButtonTextActive: {
    color: "#FFFFFF",
  },
  formActions: {
    marginTop: 14,
    flexDirection: "row",
    gap: 8,
  },
  saveButton: {
    flex: 1,
    backgroundColor: "#0D7A4E",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: "#CBD8D3",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  cancelButtonText: {
    color: "#3F5951",
    fontWeight: "700",
  },
  deleteButton: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#EBC2BE",
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
    backgroundColor: "#FCECEA",
  },
  deleteButtonText: {
    color: "#B42318",
    fontWeight: "700",
  },
});
