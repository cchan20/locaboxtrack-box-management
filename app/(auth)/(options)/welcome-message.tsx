import { API_BASE_URL } from "@/constants/config";
import { useAppDispatch } from "@/store/hooks";
import {
  deleteWelcomeImage,
  getGlobalSettings,
  updateMaxMealsPerOrder,
  updateOrderWhatsappNumber,
  updateWelcomeMessage,
  uploadWelcomeImage,
  type WelcomeImageUpload,
} from "@/store/slices/settingsSlice";
import { ClearableTextInput } from "@/ui/ClearableTextInput";
import { getErrorMessage } from "@/utils/apiError";
import {
  DEFAULT_MAX_MEALS_PER_ORDER,
  MAX_MEALS_PER_ORDER_CAP,
  effectiveMaxMealsPerOrder,
} from "@/utils/orderWeek";
import * as DocumentPicker from "expo-document-picker";
import { Image } from "expo-image";
import * as FileSystem from "expo-file-system/legacy";
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const MAX_WELCOME_MESSAGE_LENGTH = 500;
const MAX_WELCOME_IMAGE_BYTES = 2 * 1024 * 1024;

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function guessMimeType(name: string, fallback?: string | null): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (fallback?.startsWith("image/")) return fallback;
  return "image/jpeg";
}

export default function WelcomeMessageScreen() {
  const dispatch = useAppDispatch();
  const [message, setMessage] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [savedWhatsappNumber, setSavedWhatsappNumber] = useState("");
  const [maxMealsPerOrder, setMaxMealsPerOrder] = useState(
    String(DEFAULT_MAX_MEALS_PER_ORDER),
  );
  const [savedMaxMealsPerOrder, setSavedMaxMealsPerOrder] = useState(
    DEFAULT_MAX_MEALS_PER_ORDER,
  );
  const [hasWelcomeImage, setHasWelcomeImage] = useState(false);
  const [welcomeImageUpdatedAt, setWelcomeImageUpdatedAt] = useState(0);
  const [pendingImage, setPendingImage] = useState<WelcomeImageUpload | null>(
    null,
  );
  const [pendingRemove, setPendingRemove] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const loadSettings = useCallback(async () => {
    setIsFetching(true);
    try {
      const response = await dispatch(getGlobalSettings()).unwrap();
      const nextMessage = response.data.welcomeMessage ?? "";
      const nextWhatsapp = digitsOnly(response.data.orderWhatsappNumber ?? "");
      const nextMaxMeals = effectiveMaxMealsPerOrder(
        response.data.maxMealsPerOrder,
      );
      setMessage(nextMessage);
      setSavedMessage(nextMessage);
      setWhatsappNumber(nextWhatsapp);
      setSavedWhatsappNumber(nextWhatsapp);
      setMaxMealsPerOrder(String(nextMaxMeals));
      setSavedMaxMealsPerOrder(nextMaxMeals);
      setHasWelcomeImage(Boolean(response.data.hasWelcomeImage));
      setWelcomeImageUpdatedAt(response.data.welcomeImageUpdatedAt ?? 0);
      setPendingImage(null);
      setPendingRemove(false);
    } catch {
      setMessage("");
      setSavedMessage("");
      setWhatsappNumber("");
      setSavedWhatsappNumber("");
      setMaxMealsPerOrder(String(DEFAULT_MAX_MEALS_PER_ORDER));
      setSavedMaxMealsPerOrder(DEFAULT_MAX_MEALS_PER_ORDER);
      setHasWelcomeImage(false);
      setWelcomeImageUpdatedAt(0);
      setPendingImage(null);
      setPendingRemove(false);
    } finally {
      setIsFetching(false);
    }
  }, [dispatch]);

  useFocusEffect(
    useCallback(() => {
      void loadSettings();
    }, [loadSettings]),
  );

  const remotePreviewUri = useMemo(() => {
    if (!hasWelcomeImage || pendingRemove) return null;
    const version = welcomeImageUpdatedAt || Date.now();
    return `${API_BASE_URL}/api/v1/settings/welcome-image?v=${version}`;
  }, [hasWelcomeImage, pendingRemove, welcomeImageUpdatedAt]);

  const previewUri = pendingImage?.uri ?? remotePreviewUri;

  const handlePickImage = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/jpeg", "image/png", "image/webp", "image/gif"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const info = await FileSystem.getInfoAsync(asset.uri);
      const size =
        typeof asset.size === "number"
          ? asset.size
          : info.exists && "size" in info
            ? info.size
            : 0;

      if (size > MAX_WELCOME_IMAGE_BYTES) {
        Alert.alert(
          "Image too large",
          "Please choose an image that is 2MB or smaller.",
        );
        return;
      }

      const name = asset.name || `welcome-${Date.now()}.jpg`;
      setPendingImage({
        uri: asset.uri,
        name,
        type: guessMimeType(name, asset.mimeType),
      });
      setPendingRemove(false);
    } catch (error) {
      Alert.alert("Unable to pick image", getErrorMessage(error));
    }
  };

  const handleRemoveImage = () => {
    if (pendingImage) {
      setPendingImage(null);
      return;
    }
    if (hasWelcomeImage) {
      setPendingRemove(true);
    }
  };

  const handleSave = async () => {
    const nextMessage = message.trim();
    const nextWhatsapp = digitsOnly(whatsappNumber);
    const parsedMaxMeals = Number.parseInt(maxMealsPerOrder.trim(), 10);

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

    if (
      !Number.isFinite(parsedMaxMeals) ||
      parsedMaxMeals < 1 ||
      parsedMaxMeals > MAX_MEALS_PER_ORDER_CAP
    ) {
      Alert.alert(
        "Invalid meal limit",
        `Max meals per order must be a whole number between 1 and ${MAX_MEALS_PER_ORDER_CAP}.`,
      );
      return;
    }

    setIsSaving(true);
    try {
      const messageDirty = nextMessage !== savedMessage.trim();
      const whatsappDirty = nextWhatsapp !== savedWhatsappNumber;
      const maxMealsDirty = parsedMaxMeals !== savedMaxMealsPerOrder;
      const imageDirty = pendingImage != null || pendingRemove;

      if (messageDirty) {
        const response = await dispatch(updateWelcomeMessage(nextMessage)).unwrap();
        const saved = response.data.welcomeMessage ?? "";
        setMessage(saved);
        setSavedMessage(saved);
      }

      if (whatsappDirty) {
        const response = await dispatch(
          updateOrderWhatsappNumber(nextWhatsapp),
        ).unwrap();
        const saved = digitsOnly(response.data.orderWhatsappNumber ?? "");
        setWhatsappNumber(saved);
        setSavedWhatsappNumber(saved);
      }

      if (maxMealsDirty) {
        const response = await dispatch(
          updateMaxMealsPerOrder(parsedMaxMeals),
        ).unwrap();
        const saved = effectiveMaxMealsPerOrder(response.data.maxMealsPerOrder);
        setMaxMealsPerOrder(String(saved));
        setSavedMaxMealsPerOrder(saved);
      }

      if (imageDirty) {
        if (pendingRemove && !pendingImage) {
          const response = await dispatch(deleteWelcomeImage()).unwrap();
          setHasWelcomeImage(Boolean(response.data.hasWelcomeImage));
          setWelcomeImageUpdatedAt(response.data.welcomeImageUpdatedAt ?? 0);
          setPendingRemove(false);
        } else if (pendingImage) {
          const response = await dispatch(
            uploadWelcomeImage(pendingImage),
          ).unwrap();
          setHasWelcomeImage(Boolean(response.data.hasWelcomeImage));
          setWelcomeImageUpdatedAt(response.data.welcomeImageUpdatedAt ?? 0);
          setPendingImage(null);
          setPendingRemove(false);
        }
      }
    } catch (error) {
      Alert.alert("Unable to save", getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const dirty =
    message.trim() !== savedMessage.trim() ||
    digitsOnly(whatsappNumber) !== savedWhatsappNumber ||
    Number.parseInt(maxMealsPerOrder.trim(), 10) !== savedMaxMealsPerOrder ||
    pendingImage != null ||
    pendingRemove;

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.container}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ScrollView
          style={styles.dismissArea}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {isFetching ? (
            <Text style={styles.loadingText}>Loading general message...</Text>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.title}>General Message</Text>
            <Text style={styles.subtitle}>
              Shown at the top of the web order page, centered above Weekly
              Pre-Orders. Leave empty to hide it.
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

            <Text style={styles.fieldLabel}>Welcome Image</Text>
            <Text style={styles.fieldHint}>
              Optional image shown below the general message on the web order
              page. JPEG, PNG, WebP, or GIF — max 2MB. Only one image is kept.
            </Text>

            {previewUri ? (
              <Image
                source={{ uri: previewUri }}
                style={styles.preview}
                contentFit="contain"
              />
            ) : (
              <View style={styles.previewPlaceholder}>
                <Text style={styles.previewPlaceholderText}>No image set</Text>
              </View>
            )}

            <View style={styles.imageActions}>
              <Pressable
                style={[styles.secondaryButton, isSaving && styles.saveButtonDisabled]}
                onPress={() => {
                  void handlePickImage();
                }}
                disabled={isSaving}
              >
                <Text style={styles.secondaryButtonText}>
                  {previewUri ? "Change Image" : "Choose Image"}
                </Text>
              </Pressable>
              {previewUri ? (
                <Pressable
                  style={[styles.dangerButton, isSaving && styles.saveButtonDisabled]}
                  onPress={handleRemoveImage}
                  disabled={isSaving}
                >
                  <Text style={styles.dangerButtonText}>Remove</Text>
                </Pressable>
              ) : null}
            </View>

            <Text style={styles.fieldLabel}>WhatsApp Number</Text>
            <Text style={styles.fieldHint}>
              Used for “Contact via WhatsApp” on the web order page. Digits only,
              include country code (e.g. 85291234567).
            </Text>
            <ClearableTextInput
              value={whatsappNumber}
              onChangeText={(text) => setWhatsappNumber(digitsOnly(text))}
              placeholder="e.g. 85291234567"
              keyboardType="number-pad"
              maxLength={20}
              style={styles.whatsappInput}
            />

            <Text style={styles.fieldLabel}>Max Meals Per Order</Text>
            <Text style={styles.fieldHint}>
              How many meals a customer can include in one daily order (app and
              web). Allowed range: 1–{MAX_MEALS_PER_ORDER_CAP}.
            </Text>
            <ClearableTextInput
              value={maxMealsPerOrder}
              onChangeText={(text) =>
                setMaxMealsPerOrder(text.replace(/[^\d]/g, "").slice(0, 2))
              }
              placeholder={String(DEFAULT_MAX_MEALS_PER_ORDER)}
              keyboardType="number-pad"
              maxLength={2}
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
              <Text style={styles.saveButtonText}>
                {isSaving ? "Saving..." : "Save"}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
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
  dismissArea: {
    flex: 1,
  },
  scrollContent: {
    gap: 12,
    paddingBottom: 24,
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
  preview: {
    marginTop: 12,
    width: "100%",
    height: 180,
    borderRadius: 10,
    backgroundColor: "#F0F5F3",
    borderWidth: 1,
    borderColor: "#DDEBE6",
  },
  previewPlaceholder: {
    marginTop: 12,
    width: "100%",
    height: 120,
    borderRadius: 10,
    backgroundColor: "#F0F5F3",
    borderWidth: 1,
    borderColor: "#DDEBE6",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  previewPlaceholderText: {
    color: "#6E7C76",
    fontSize: 13,
  },
  imageActions: {
    marginTop: 12,
    flexDirection: "row",
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: "#E6F2ED",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#0B3D2E",
    fontWeight: "700",
  },
  dangerButton: {
    backgroundColor: "#FDECEC",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  dangerButtonText: {
    color: "#B42318",
    fontWeight: "700",
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
