import {
  clearAllDatabaseData,
  exportDatabaseSnapshot,
  importDatabaseSnapshot,
} from "@/database/appDatabase";
import { ROOT_PASSWORD } from "@/constants/auth";
import { useAppData } from "@/store/AppDataContext";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Stack } from "expo-router";
import { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from "react-native";

const DATABASE_FILE_PREFIX = "LocaBoxTracker_";
const IMPORT_MIME_TYPES = [
  "application/octet-stream",
  "application/x-sqlite3",
  "application/vnd.sqlite3",
  "application/x-sqlite-db",
  "*/*",
];

const formatTimestamp = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const hours = String(value.getHours()).padStart(2, "0");
  const minutes = String(value.getMinutes()).padStart(2, "0");
  const seconds = String(value.getSeconds()).padStart(2, "0");

  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
};

const buildDatabaseFileName = () => `${DATABASE_FILE_PREFIX}${formatTimestamp(new Date())}.db`;

const isCancelError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes("cancel");
};

const confirmOverwriteImport = () =>
  new Promise<boolean>((resolve) => {
    Alert.alert(
      "Overwrite current data?",
      "Importing a backup will replace the app's current database data.",
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => resolve(false),
        },
        {
          text: "Import",
          style: "destructive",
          onPress: () => resolve(true),
        },
      ],
      {
        cancelable: true,
        onDismiss: () => resolve(false),
      },
    );
  });

export default function ImportExportScreen() {
  const { refreshData } = useAppData();
  const { width } = useWindowDimensions();
  const isTwoColumn = width >= 860;
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [lastExportName, setLastExportName] = useState<string | null>(null);
  const [lastExportUri, setLastExportUri] = useState<string | null>(null);
  const [lastImportName, setLastImportName] = useState<string | null>(null);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [clearPassword, setClearPassword] = useState("");
  const [clearPasswordError, setClearPasswordError] = useState<string | null>(null);
  const [isClearPasswordHidden, setIsClearPasswordHidden] = useState(true);
  const [isClearingData, setIsClearingData] = useState(false);

  const closeClearModal = () => {
    setIsClearModalOpen(false);
    setClearPassword("");
    setClearPasswordError(null);
    setIsClearPasswordHidden(true);
  };

  const handleExportDatabase = async () => {
    try {
      setIsExporting(true);

      const snapshot = await exportDatabaseSnapshot();
      const fileName = buildDatabaseFileName();
      const exportFile = new File(Paths.cache, fileName);

      exportFile.create({ overwrite: true });
      exportFile.write(snapshot);

      if (!(await Sharing.isAvailableAsync())) {
        throw new Error("Sharing is not available on this device.");
      }

      await Sharing.shareAsync(exportFile.uri, {
        dialogTitle: "Save database backup",
        mimeType: "application/x-sqlite3",
      });

      setLastExportName(fileName);
      setLastExportUri(exportFile.uri);

      Alert.alert("Export complete", `Database backup is ready: ${fileName}`);
    } catch (error) {
      if (isCancelError(error)) {
        return;
      }

      const message = error instanceof Error ? error.message : "Unable to export the current database.";
      Alert.alert("Export failed", message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportDatabase = async () => {
    try {
      setIsImporting(true);

      const selectedFile = await DocumentPicker.getDocumentAsync({
        type: IMPORT_MIME_TYPES,
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (selectedFile.canceled || !selectedFile.assets[0]) {
        return;
      }

      const asset = selectedFile.assets[0];
      const selectedName = asset.name ?? new File(asset.uri).name;

      if (!selectedName.startsWith(DATABASE_FILE_PREFIX)) {
        Alert.alert(
          "Invalid backup file",
          `Please select a database file that starts with ${DATABASE_FILE_PREFIX}.`,
        );
        return;
      }

      const shouldProceed = await confirmOverwriteImport();

      if (!shouldProceed) {
        return;
      }

      const selectedBytes = await new File(asset.uri).bytes();
      await importDatabaseSnapshot(selectedBytes);
      await refreshData();

      setLastImportName(selectedName);

      Alert.alert("Import complete", `${selectedName} has replaced the current app database.`);
    } catch (error) {
      if (isCancelError(error)) {
        return;
      }

      const message = error instanceof Error ? error.message : "Unable to import the selected database.";
      Alert.alert("Import failed", message);
    } finally {
      setIsImporting(false);
    }
  };

  const openClearAllDataModal = () => {
    setClearPassword("");
    setClearPasswordError(null);
    setIsClearPasswordHidden(true);
    setIsClearModalOpen(true);
  };

  const handleClearAllData = async () => {
    const normalizedPassword = clearPassword.trim();

    if (isClearingData) {
      return;
    }

    if (!normalizedPassword) {
      setClearPasswordError("Root password is required.");
      return;
    }

    if (normalizedPassword !== ROOT_PASSWORD) {
      setClearPasswordError("Incorrect root password.");
      return;
    }

    try {
      setClearPasswordError(null);
      setIsClearingData(true);

      await clearAllDatabaseData();
      await refreshData();

      closeClearModal();
      Alert.alert("Data cleared", "All database data has been permanently removed.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to clear the current database.";
      Alert.alert("Clear failed", message);
    } finally {
      setIsClearingData(false);
    }
  };

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.container}>
      <Stack.Screen
        options={{
          title: "Import/Export Data",
        }}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.title}>Database Backup</Text>
          <Text style={styles.subtitle}>
            Export the current database to a local file or import a previous LocaBoxTracker backup.
          </Text>
        </View>

        <View style={[styles.sectionGrid, isTwoColumn ? styles.sectionGridTwoColumn : undefined]}>
          <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconWrap}>
              <Ionicons name="download-outline" size={20} color="#0D7A4E" />
            </View>
            <View style={styles.sectionCopy}>
              <Text style={styles.sectionTitle}>Export Current Database</Text>
              <Text style={styles.sectionDescription}>
                Generate a backup file, then choose where to save it from the share sheet.
              </Text>
            </View>
          </View>

          <Pressable
            style={[styles.actionButton, isExporting ? styles.actionButtonDisabled : undefined]}
            onPress={handleExportDatabase}
            disabled={isExporting}
          >
            <Text style={styles.actionButtonText}>{isExporting ? "Exporting..." : "Export Database"}</Text>
          </Pressable>

          <Text style={styles.noteText}>File name format: {DATABASE_FILE_PREFIX}YYYYMMDD_HHMMSS.db</Text>
          {lastExportName ? <Text style={styles.resultText}>Last export: {lastExportName}</Text> : null}
          {lastExportUri ? <Text style={styles.uriText}>{lastExportUri}</Text> : null}
          </View>

          <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconWrap, styles.importIconWrap]}>
              <Ionicons name="cloud-upload-outline" size={20} color="#8A4B00" />
            </View>
            <View style={styles.sectionCopy}>
              <Text style={styles.sectionTitle}>Import Database Backup</Text>
              <Text style={styles.sectionDescription}>
                Select a backup file that starts with {DATABASE_FILE_PREFIX} and overwrite the current app data.
              </Text>
            </View>
          </View>

          <Pressable
            style={[styles.importButton, isImporting ? styles.importButtonDisabled : undefined]}
            onPress={handleImportDatabase}
            disabled={isImporting}
          >
            <Text style={styles.importButtonText}>{isImporting ? "Importing..." : "Import Database"}</Text>
          </Pressable>

          <Text style={styles.warningText}>
            Import replaces the current database, including boxes, customers, transactions, users, and prefixes.
          </Text>
          {lastImportName ? <Text style={styles.resultText}>Last imported: {lastImportName}</Text> : null}
          </View>
        </View>

        <View style={[styles.card, styles.dangerCard]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconWrap, styles.dangerIconWrap]}>
              <Ionicons name="trash-outline" size={20} color="#B42318" />
            </View>
            <View style={styles.sectionCopy}>
              <Text style={styles.sectionTitle}>Permanent Clear All Data</Text>
              <Text style={styles.sectionDescription}>
                Permanently remove all boxes, customers, transactions, users, and prefixes from this device.
              </Text>
            </View>
          </View>

          <Pressable
            style={[styles.clearButton, isClearingData ? styles.actionButtonDisabled : undefined]}
            onPress={openClearAllDataModal}
            disabled={isClearingData}
          >
            <Text style={styles.clearButtonText}>Permanently Clear All Data</Text>
          </Pressable>

          <Text style={styles.dangerText}>
            This action cannot be undone. Root password confirmation is required before the database is wiped.
          </Text>
        </View>
      </ScrollView>

      <Modal
        visible={isClearModalOpen}
        transparent
        animationType="fade"
        onRequestClose={closeClearModal}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <KeyboardAvoidingView
            style={styles.modalKeyboardAvoidingView}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>Permanently Clear All Data</Text>
                <Text style={styles.modalText}>
                  Enter the root password to permanently delete all database data on this device. This cannot be undone.
                </Text>

                <Text style={styles.inputLabel}>Root Password</Text>
                <View style={styles.passwordFieldWrap}>
                  <TextInput
                    value={clearPassword}
                    onChangeText={(value) => {
                      setClearPassword(value);
                      if (clearPasswordError) {
                        setClearPasswordError(null);
                      }
                    }}
                    placeholder="Enter root password"
                    placeholderTextColor="#6B7D76"
                    secureTextEntry={isClearPasswordHidden}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isClearingData}
                    style={[
                      styles.textInput,
                      styles.modalInput,
                      clearPasswordError ? styles.inputError : null,
                    ]}
                  />
                  <Pressable
                    onPress={() => setIsClearPasswordHidden((current) => !current)}
                    style={styles.passwordToggleButton}
                    disabled={isClearingData}
                    accessibilityRole="button"
                    accessibilityLabel={isClearPasswordHidden ? "Show password" : "Hide password"}
                  >
                    <Ionicons
                      name={isClearPasswordHidden ? "eye-outline" : "eye-off-outline"}
                      size={19}
                      color="#0E6045"
                    />
                  </Pressable>
                </View>
                {clearPasswordError ? <Text style={styles.errorText}>{clearPasswordError}</Text> : null}

                <View style={styles.modalActionsRow}>
                  <Pressable
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={closeClearModal}
                    disabled={isClearingData}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.modalButton, styles.confirmClearButton]}
                    onPress={handleClearAllData}
                    disabled={isClearingData}
                  >
                    <Text style={styles.confirmClearButtonText}>
                      {isClearingData ? "Clearing..." : "Clear All Data"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
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
  content: {
    gap: 12,
    paddingBottom: 24,
  },
  heroCard: {
    borderWidth: 1,
    borderColor: "#DDEBE6",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    padding: 16,
  },
  card: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#DDEBE6",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    padding: 16,
    gap: 12,
  },
  sectionGrid: {
    gap: 12,
  },
  sectionGridTwoColumn: {
    flexDirection: "row",
    alignItems: "stretch",
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
    lineHeight: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  sectionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#E7F5EE",
    alignItems: "center",
    justifyContent: "center",
  },
  importIconWrap: {
    backgroundColor: "#FFF2DE",
  },
  dangerIconWrap: {
    backgroundColor: "#FDEAE7",
  },
  sectionCopy: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0B3D2E",
  },
  sectionDescription: {
    marginTop: 4,
    color: "#577066",
    fontSize: 13,
    lineHeight: 19,
  },
  actionButton: {
    backgroundColor: "#0D7A4E",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  actionButtonDisabled: {
    opacity: 0.7,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
  },
  importButton: {
    backgroundColor: "#A65B00",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  importButtonDisabled: {
    opacity: 0.7,
  },
  importButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
  },
  clearButton: {
    backgroundColor: "#B42318",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  clearButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
  },
  noteText: {
    color: "#577066",
    fontSize: 12,
    lineHeight: 18,
  },
  warningText: {
    color: "#8A4B00",
    fontSize: 12,
    lineHeight: 18,
  },
  resultText: {
    color: "#0D4A37",
    fontSize: 13,
    fontWeight: "600",
  },
  uriText: {
    color: "#6F827B",
    fontSize: 12,
    lineHeight: 18,
  },
  dangerCard: {
    borderColor: "#F2C9C3",
    backgroundColor: "#FFF8F7",
  },
  dangerText: {
    color: "#9F2D20",
    fontSize: 12,
    lineHeight: 18,
  },
  modalKeyboardAvoidingView: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(16, 35, 28, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E7D4D1",
    backgroundColor: "#FFFDFC",
    padding: 16,
  },
  modalTitle: {
    color: "#0D4A37",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 10,
  },
  modalText: {
    color: "#35574A",
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  inputLabel: {
    color: "#35574A",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },
  passwordFieldWrap: {
    position: "relative",
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#C7D8D1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    color: "#1F1F1F",
  },
  modalInput: {
    paddingRight: 44,
  },
  passwordToggleButton: {
    position: "absolute",
    right: 10,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  inputError: {
    borderColor: "#D93025",
  },
  errorText: {
    color: "#D93025",
    fontSize: 12,
    marginTop: 6,
  },
  modalActionsRow: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
  },
  modalButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    backgroundColor: "#E8EFEC",
  },
  cancelButtonText: {
    color: "#35574A",
    fontWeight: "700",
    fontSize: 13,
  },
  confirmClearButton: {
    backgroundColor: "#B42318",
  },
  confirmClearButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },
});
