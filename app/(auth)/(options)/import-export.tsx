import {
  exportDatabaseSnapshot,
  importDatabaseSnapshot,
} from "@/database/appDatabase";
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
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
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
      </ScrollView>
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
});
