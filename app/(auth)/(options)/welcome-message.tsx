import { useAppDispatch } from "@/store/hooks";
import {
  getGlobalSettings,
  updateOrderWhatsappNumber,
  updateWelcomeMessage,
} from "@/store/slices/settingsSlice";
import { ClearableTextInput } from "@/ui/ClearableTextInput";
import { getErrorMessage } from "@/utils/apiError";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  Alert,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const MAX_WELCOME_MESSAGE_LENGTH = 500;

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

export default function WelcomeMessageScreen() {
  const dispatch = useAppDispatch();
  const [message, setMessage] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [savedWhatsappNumber, setSavedWhatsappNumber] = useState("");
  const [isFetching, setIsFetching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const loadSettings = useCallback(async () => {
    setIsFetching(true);
    try {
      const response = await dispatch(getGlobalSettings()).unwrap();
      const nextMessage = response.data.welcomeMessage ?? "";
      const nextWhatsapp = digitsOnly(response.data.orderWhatsappNumber ?? "");
      setMessage(nextMessage);
      setSavedMessage(nextMessage);
      setWhatsappNumber(nextWhatsapp);
      setSavedWhatsappNumber(nextWhatsapp);
    } catch {
      setMessage("");
      setSavedMessage("");
      setWhatsappNumber("");
      setSavedWhatsappNumber("");
    } finally {
      setIsFetching(false);
    }
  }, [dispatch]);

  useFocusEffect(
    useCallback(() => {
      void loadSettings();
    }, [loadSettings]),
  );

  const handleSave = async () => {
    const nextMessage = message.trim();
    const nextWhatsapp = digitsOnly(whatsappNumber);

    if (nextMessage.length > MAX_WELCOME_MESSAGE_LENGTH) {
      Alert.alert(
        "Message too long",
        `Please keep the general message within ${MAX_WELCOME_MESSAGE_LENGTH} characters.`,
      );
      return;
    }

    if (!nextWhatsapp) {
      Alert.alert("Missing WhatsApp number", "Please enter a WhatsApp number.");
      return;
    }

    setIsSaving(true);
    try {
      const messageDirty = nextMessage !== savedMessage.trim();
      const whatsappDirty = nextWhatsapp !== savedWhatsappNumber;

      if (messageDirty) {
        const response = await dispatch(updateWelcomeMessage(nextMessage)).unwrap();
        const saved = response.data.welcomeMessage ?? "";
        setMessage(saved);
        setSavedMessage(saved);
      }

      if (whatsappDirty) {
        const response = await dispatch(updateOrderWhatsappNumber(nextWhatsapp)).unwrap();
        const saved = digitsOnly(response.data.orderWhatsappNumber ?? "");
        setWhatsappNumber(saved);
        setSavedWhatsappNumber(saved);
      }
    } catch (error) {
      Alert.alert("Unable to save", getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const dirty =
    message.trim() !== savedMessage.trim() ||
    digitsOnly(whatsappNumber) !== savedWhatsappNumber;

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.container}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.dismissArea}>
          {isFetching ? (
            <Text style={styles.loadingText}>Loading general message...</Text>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.title}>General Message</Text>
            <Text style={styles.subtitle}>
              Shown at the top of the web order page, centered above Weekly Pre-Orders.
              Leave empty to hide it.
            </Text>

            <ClearableTextInput
              value={message}
              onChangeText={setMessage}
              placeholder="e.g. Welcome back — place your weekly pre-order below."
              multiline
              maxLength={MAX_WELCOME_MESSAGE_LENGTH}
              style={styles.input}
              blurOnSubmit
            />
            <Text style={styles.counter}>
              {message.trim().length}/{MAX_WELCOME_MESSAGE_LENGTH}
            </Text>

            <Text style={styles.fieldLabel}>WhatsApp Number</Text>
            <Text style={styles.fieldHint}>
              Used for “Contact via WhatsApp” on the web order page. Digits only, include
              country code (e.g. 85291234567).
            </Text>
            <ClearableTextInput
              value={whatsappNumber}
              onChangeText={(text) => setWhatsappNumber(digitsOnly(text))}
              placeholder="e.g. 85291234567"
              keyboardType="number-pad"
              maxLength={20}
              style={styles.whatsappInput}
            />

            <Pressable
              style={[styles.saveButton, (!dirty || isSaving) && styles.saveButtonDisabled]}
              onPress={() => {
                Keyboard.dismiss();
                void handleSave();
              }}
              disabled={!dirty || isSaving}
            >
              <Text style={styles.saveButtonText}>{isSaving ? "Saving..." : "Save"}</Text>
            </Pressable>
          </View>
        </View>
      </TouchableWithoutFeedback>
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
  dismissArea: {
    flex: 1,
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
  input: {
    marginTop: 16,
    minHeight: 120,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: "#C7D8D1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    fontSize: 15,
    color: "#1A2A24",
  },
  counter: {
    marginTop: 8,
    textAlign: "right",
    color: "#6E7C76",
    fontSize: 12,
  },
  fieldLabel: {
    marginTop: 20,
    fontSize: 16,
    fontWeight: "700",
    color: "#0B3D2E",
  },
  fieldHint: {
    marginTop: 6,
    color: "#577066",
    fontSize: 13,
  },
  whatsappInput: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#C7D8D1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    fontSize: 15,
    color: "#1A2A24",
  },
  saveButton: {
    marginTop: 16,
    backgroundColor: "#0D7A4E",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
});
