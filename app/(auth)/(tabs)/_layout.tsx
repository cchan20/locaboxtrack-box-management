import { Ionicons } from "@expo/vector-icons";
import { HeaderOverflowMenu } from "@/ui/HeaderOverflowMenu";
import { Tabs, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

type CreateRoute = "/(auth)/create-box" | "/(auth)/create-client";

function HeaderActionsWithCreate({
  label,
  route,
}: {
  label: string;
  route: CreateRoute;
}) {
  const router = useRouter();

  return (
    <View style={styles.headerActionsWrap}>
      <Pressable style={styles.headerCreateButton} onPress={() => router.push(route)}>
        <Ionicons name="add" size={16} color="#FFFFFF" />
        <Text style={styles.headerCreateButtonText}>{label}</Text>
      </Pressable>
      <HeaderOverflowMenu />
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="dashboard"
      screenOptions={{
        headerStyle: { backgroundColor: "#0B5D44" },
        headerTintColor: "#FFFFFF",
        headerRight: () => <HeaderOverflowMenu />,
        tabBarActiveTintColor: "#0D7A4E",
        tabBarInactiveTintColor: "#60726A",
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => <Ionicons name="grid" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="checkout"
        options={{
          title: "Give Box",
          tabBarIcon: ({ color, size }) => <Ionicons name="add-circle" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="checkin"
        options={{
          title: "Return Box",
          tabBarIcon: ({ color, size }) => <Ionicons name="refresh-circle" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          title: "Customers",
          headerRight: () => (
            <HeaderActionsWithCreate label="Create" route="/(auth)/create-client" />
          ),
          tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: "Inventory",
          headerRight: () => (
            <HeaderActionsWithCreate label="Create" route="/(auth)/create-box" />
          ),
          tabBarIcon: ({ color, size }) => <Ionicons name="cube" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerActionsWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 2,
  },
  headerCreateButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.45)",
    marginRight: 2,
  },
  headerCreateButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    marginLeft: 4,
  },
});
