import { useAuth } from "@/store/useAuth";
import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";

const ADMIN_ONLY_ROUTES = new Set([
  "user-management",
  "user-form",
  "store-location",
  "pickup-timeslot",
  "welcome-message",
  "menu",
]);

export default function AuthLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { isAuthenticated, isAdmin } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/(unauth)/login");
      return;
    }

    const activeRoute = segments[segments.length - 1];

    if (activeRoute && ADMIN_ONLY_ROUTES.has(activeRoute) && !isAdmin) {
      router.replace("/(auth)/(tabs)/dashboard");
    }
  }, [isAuthenticated, isAdmin, router, segments]);

  return (
    <Stack screenOptions={{ headerShown: false, animation: "none" }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="(options)/user-management"
        options={{
          headerShown: true,
          title: "User Management",
          headerStyle: { backgroundColor: "#6E4331" },
          headerTintColor: "#FFFFFF",
        }}
      />
      <Stack.Screen
        name="user-form"
        options={{
          headerShown: true,
          title: "Create User",
          headerStyle: { backgroundColor: "#6E4331" },
          headerTintColor: "#FFFFFF",
        }}
      />
      <Stack.Screen
        name="(options)/store-location"
        options={{
          headerShown: true,
          title: "Store Location",
          headerStyle: { backgroundColor: "#6E4331" },
          headerTintColor: "#FFFFFF",
        }}
      />
      <Stack.Screen
        name="(options)/pickup-timeslot"
        options={{
          headerShown: true,
          title: "Pickup Timeslot",
          headerStyle: { backgroundColor: "#6E4331" },
          headerTintColor: "#FFFFFF",
        }}
      />
      <Stack.Screen
        name="(options)/welcome-message"
        options={{
          headerShown: true,
          title: "General",
          headerStyle: { backgroundColor: "#6E4331" },
          headerTintColor: "#FFFFFF",
        }}
      />
      <Stack.Screen
        name="(options)/menu"
        options={{
          headerShown: true,
          title: "Menu",
          headerStyle: { backgroundColor: "#6E4331" },
          headerTintColor: "#FFFFFF",
        }}
      />
      <Stack.Screen
        name="create-order"
        options={{
          headerShown: true,
          title: "Create Order",
          headerStyle: { backgroundColor: "#6E4331" },
          headerTintColor: "#FFFFFF",
        }}
      />
    </Stack>
  );
}
