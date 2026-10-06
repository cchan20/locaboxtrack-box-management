import { Ionicons } from "@expo/vector-icons";
import { HeaderActionsWithCreate } from "@/ui/HeaderActionsWithCreate";
import { HeaderOverflowMenu } from "@/ui/HeaderOverflowMenu";
import { Tabs } from "expo-router";

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
        name="orders"
        options={{
          title: "Order",
          // headerRight is set from OrdersScreen so Export can use live filters.
          tabBarIcon: ({ color, size }) => <Ionicons name="receipt" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="checkout"
        options={{
          title: "Give/Return Box",
          tabBarIcon: ({ color, size }) => <Ionicons name="swap-horizontal" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          title: "Customers",
          tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: "Inventory",
          headerRight: () => (
            <HeaderActionsWithCreate label="Create" route="/(auth)/create-box" adminOnly />
          ),
          tabBarIcon: ({ color, size }) => <Ionicons name="cube" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
