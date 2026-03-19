import { useAppData } from "@/store/AppDataContext";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import * as XLSX from "xlsx";
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

type ParsedImportRow = {
  externalId: string;
  email?: string;
  phone: string;
  name: string;
};

const IMPORT_MIME_TYPES = [
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

const toCellText = (value: unknown): string => {
  if (value == null) {
    return "";
  }

  return String(value).trim();
};

const extractExternalId = (rawValue: unknown): string => {
  const text = toCellText(rawValue);

  if (!text) {
    return "";
  }

  const parts = text.split("_").map((part) => part.trim()).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : text;
};

const isHeaderRow = (row: unknown[]): boolean => {
  const first = toCellText(row[0]).toLowerCase();
  const second = toCellText(row[1]).toLowerCase();
  const third = toCellText(row[2]).toLowerCase();
  const fourth = toCellText(row[3]).toLowerCase();

  return first === "id" && second === "email" && third === "phone" && fourth === "name";
};

const parseImportRows = (sheet: XLSX.WorkSheet): ParsedImportRow[] => {
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  });

  return rawRows
    .filter((row) => row.slice(0, 4).some((value) => toCellText(value) !== ""))
    .filter((row, index) => (index === 0 ? !isHeaderRow(row) : true))
    .map((row) => {
      const externalId = extractExternalId(row[0]);
      const email = toCellText(row[1]);
      const phone = toCellText(row[2]);
      const name = toCellText(row[3]);

      return {
        externalId,
        email: email || undefined,
        phone,
        name,
      };
    })
    .filter((row) => row.externalId && row.phone && row.name);
};

export default function CreateClientScreen() {
  const router = useRouter();
  const { addCustomer, importCustomers } = useAppData();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  const handleCreateClient = async () => {
    const result = await addCustomer(name, phone, email);

    if (result.ok) {
      router.back();
      return;
    }

    Alert.alert("Unable to create client", result.message);
  };

  const handleImportClient = async () => {
    try {
      setIsImporting(true);

      const result = await DocumentPicker.getDocumentAsync({
        type: IMPORT_MIME_TYPES,
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets[0]) {
        return;
      }

      const asset = result.assets[0];
      const fileBase64 = await new File(asset.uri).base64();

      if (!fileBase64) {
        throw new Error("Unable to read the selected file.");
      }

      const workbook = XLSX.read(fileBase64, { type: "base64" });
      const firstSheetName = workbook.SheetNames[0];

      if (!firstSheetName) {
        Alert.alert("Import failed 2", "The selected file does not contain any sheets or rows.");
        return;
      }

      const parsedRows = parseImportRows(workbook.Sheets[firstSheetName]);

      if (parsedRows.length === 0) {
        Alert.alert(
          "Import failed 3",
          "No valid rows found. Make sure the first four columns are id, email, phone, and name.",
        );
        return;
      }

      const importResult = await importCustomers(parsedRows);
      Alert.alert("Import complete", importResult.message);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to import the selected file.";
      Alert.alert("Import failed 1", message);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.container}>
      <Stack.Screen
        options={{
          title: "Create Client",
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
          <Text style={styles.createButtonText}>Create Client</Text>
        </Pressable>

        <Pressable style={styles.importButton} onPress={handleImportClient}>
          <Text style={styles.importButtonText}>{isImporting ? "Importing..." : "Import Client"}</Text>
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
  importButton: {
    borderWidth: 1,
    borderColor: "#BFD7CE",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#EEF7F3",
  },
  importButtonText: {
    color: "#0E6045",
    fontWeight: "700",
  },
});
