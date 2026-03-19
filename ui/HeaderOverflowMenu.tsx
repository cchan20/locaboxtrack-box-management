import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/store/AuthContext";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";

type MenuOption = {
  key: string;
  label: string;
  route?: "/(auth)/(options)/user-management" | "/(auth)/(options)/import-export" | "/(auth)/(options)/box-setting";
  isLogout?: boolean;
};

const MENU_OPTIONS: MenuOption[] = [
  { key: "user-management", label: "User Management", route: "/(auth)/(options)/user-management" },
  { key: "import-export", label: "Import/Export Data", route: "/(auth)/(options)/import-export" },
  { key: "box-setting", label: "Box Setting", route: "/(auth)/(options)/box-setting" },
  { key: "logout", label: "Logout", isLogout: true },
];

export function HeaderOverflowMenu() {
  const router = useRouter();
  const { loginUser, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const isRootUser = loginUser?.type === "root";
  const visibleOptions = isRootUser
    ? MENU_OPTIONS
    : MENU_OPTIONS.filter((option) => option.isLogout);

  const handlePressOption = (option: MenuOption) => {
    setOpen(false);

    if (option.isLogout) {
      Alert.alert("Confirm Logout", "Are you sure you want to logout?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          style: "destructive",
          onPress: () => {
            logout();
            router.replace("/(unauth)/login");
          },
        },
      ]);
      return;
    }

    if (option.route) {
      router.push(option.route);
    }
  };

  return (
    <View>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="More options"
        onPress={() => setOpen(true)}
        style={styles.iconButton}
      >
        <Ionicons name="ellipsis-vertical" size={20} color="#FFFFFF" />
      </TouchableOpacity>

      <Modal
        transparent
        visible={open}
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.menuContainer}>
            {visibleOptions.map((option) => (
              <TouchableOpacity
                key={option.key}
                onPress={() => handlePressOption(option)}
                style={styles.menuItem}
              >
                <Text style={[styles.menuText, option.isLogout ? styles.logoutText : undefined]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 4,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.2)",
  },
  menuContainer: {
    marginTop: 86,
    marginRight: 12,
    marginLeft: "auto",
    width: 220,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 6,
    shadowColor: "#000000",
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  menuItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  menuText: {
    color: "#1A2A24",
    fontSize: 15,
    fontWeight: "500",
  },
  logoutText: {
    color: "#B42318",
    fontWeight: "700",
  },
});
