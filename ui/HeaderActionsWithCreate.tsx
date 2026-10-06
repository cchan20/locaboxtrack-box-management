import { Ionicons } from "@expo/vector-icons";
import { HeaderOverflowMenu } from "@/ui/HeaderOverflowMenu";
import { useAuth } from "@/store/useAuth";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

type CreateRoute = "/(auth)/create-box" | "/(auth)/create-order";

type HeaderActionsWithCreateProps = {
  label: string;
  route: CreateRoute;
  adminOnly?: boolean;
  onExport?: () => void;
  exportDisabled?: boolean;
};

export function HeaderActionsWithCreate({
  label,
  route,
  adminOnly = false,
  onExport,
  exportDisabled = false,
}: HeaderActionsWithCreateProps) {
  const router = useRouter();
  const { isAdmin } = useAuth();

  if (adminOnly && !isAdmin) {
    return <HeaderOverflowMenu />;
  }

  return (
    <View style={styles.headerActionsWrap}>
      {onExport ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Export orders CSV"
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
      <Pressable style={styles.headerActionButton} onPress={() => router.push(route)}>
        <Ionicons name="add" size={16} color="#FFFFFF" />
        <Text style={styles.headerActionButtonText}>{label}</Text>
      </Pressable>
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
