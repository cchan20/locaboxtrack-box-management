import { useAppDispatch } from "@/store/hooks";
import {
  createCustomer,
  getCustomerById,
  updateCustomer,
} from "@/store/slices/customerSlice";
import { getErrorMessage } from "@/utils/apiError";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";

export default function CreateClientScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const params = useLocalSearchParams<{ customerId?: string }>();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const editingCustomerId = useMemo(() => {
    if (!params.customerId) {
      return null;
    }

    return String(params.customerId);
  }, [params.customerId]);

  const isEditMode = editingCustomerId !== null;

  useEffect(() => {
    if (!editingCustomerId) {
      return;
    }

    let cancelled = false;

    const loadCustomer = async () => {
      try {
        const response = await dispatch(getCustomerById(editingCustomerId)).unwrap();
        if (cancelled) {
          return;
        }

        setName(response.data.name);
        setPhone(response.data.phone);
        setEmail(response.data.email === "-" ? "" : response.data.email);
      } catch {
        if (!cancelled) {
          Alert.alert("Not found", "Customer not found.");
        }
      }
    };

    void loadCustomer();
    return () => {
      cancelled = true;
    };
  }, [dispatch, editingCustomerId]);

  const handleCreateClient = async () => {
    const normalizedName = name.trim();
    const normalizedPhone = phone.trim();
    const normalizedEmail = email.trim();

    if (!normalizedName || !normalizedPhone) {
      Alert.alert("Missing info", "Name and phone are required.");
      return;
    }

    try {
      if (isEditMode) {
        if (!editingCustomerId) {
          Alert.alert("Unable to update client", "Missing customer information.");
          return;
        }

        await dispatch(
          updateCustomer({
            id: editingCustomerId,
            name: normalizedName,
            phone: normalizedPhone,
            email: normalizedEmail || "-",
          }),
        ).unwrap();
      } else {
        await dispatch(
          createCustomer({
            name: normalizedName,
            phone: normalizedPhone,
            email: normalizedEmail || "-",
          }),
        ).unwrap();
      }

      router.back();
    } catch (error) {
      Alert.alert(
        isEditMode ? "Unable to update client" : "Unable to create client",
        getErrorMessage(error),
      );
    }
  };

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.container}>
      <Stack.Screen
        options={{
          title: isEditMode ? "Update Client" : "Create Client",
        }}
      />
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Client Info</Text>

            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Name"
              placeholderTextColor="#6B7D76"
              style={styles.input}
            />
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="Phone"
              placeholderTextColor="#6B7D76"
              keyboardType="number-pad"
              style={styles.input}
            />
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email (optional)"
              placeholderTextColor="#6B7D76"
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
            />

            <Pressable style={styles.createButton} onPress={handleCreateClient}>
              <Text style={styles.createButtonText}>
                {isEditMode ? "Update Client" : "Create Client"}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
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
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#DDEBE6",
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0B3D2E",
    marginBottom: 2,
  },
  input: {
    borderWidth: 1,
    borderColor: "#C7D8D1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    color: "#1E2A26",
  },
  createButton: {
    marginTop: 4,
    backgroundColor: "#0D7A4E",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  createButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
});
