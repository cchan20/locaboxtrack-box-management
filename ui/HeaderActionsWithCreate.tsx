import { Ionicons } from "@expo/vector-icons";
import { HeaderOverflowMenu } from "@/ui/HeaderOverflowMenu";
import { useAuth } from "@/store/useAuth";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

type CreateRoute = "/(auth)/create-order";

type HeaderActionsWithCreateProps = {
  label?: string;
  route?: CreateRoute;
  adminOnly?: boolean;
  onExport?: () => void;
  exportDisabled?: boolean;
  onImport?: () => void;
  importDisabled?: boolean;
};

export function HeaderActionsWithCreate({
  label,
  route,
  adminOnly = false,
  onExport,
  exportDisabled = false,
  onImport,
  importDisabled = false,
}: HeaderActionsWithCreateProps) {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const canCreate = Boolean(label && route) && (!adminOnly || isAdmin);

  if (!canCreate && !onExport && !onImport) {
    return <HeaderOverflowMenu />;
  }

  return (
    <View style={styles.headerActionsWrap}>
      {onImport ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Import CSV"
          disabled={importDisabled}
          style={[
            styles.headerActionButton,
            importDisabled ? styles.headerActionButtonDisabled : undefined,
          ]}
          onPress={onImport}
        >
          <Ionicons name="cloud-upload-outline" size={16} color="#FFFFFF" />
          <Text style={styles.headerActionButtonText}>Import</Text>
        </Pressable>
      ) : null}
      {onExport ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Export CSV"
          disabled={exportDisabled}
          style={[
            styles.headerActionButton,
            exportDisabled ? styles.headerActionButtonDisabled : undefined,
          ]}
          onPress={onExport}
        >
          <Ionicons name="download-outline" size={16} color="#FFFFFF" />
          <Text style={styles.headerActionButtonText}>Export</Text>
        </Pressable>
      ) : null}
      {canCreate && route ? (
        <Pressable style={styles.headerActionButton} onPress={() => router.push(route)}>
          <Ionicons name="add" size={16} color="#FFFFFF" />
          <Text style={styles.headerActionButtonText}>{label}</Text>
        </Pressable>
      ) : null}
      <HeaderOverflowMenu />
    </View>
  );
}

const styles = StyleSheet.create({
  headerActionsWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 2,
  },
  headerActionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.45)",
    marginRight: 2,
  },
  headerActionButtonDisabled: {
    opacity: 0.45,
  },
  headerActionButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    marginLeft: 4,
  },
});
