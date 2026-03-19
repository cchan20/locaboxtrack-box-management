import { useAuth } from "@/store/AuthContext";
import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";

const ROOT_ONLY_ROUTES = new Set(["user-management", "user-form", "import-export", "box-setting"]);

export default function AuthLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { isAuthenticated, loginUser } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/(unauth)/login");
      return;
    }

    const activeRoute = segments[segments.length - 1];

    if (activeRoute && ROOT_ONLY_ROUTES.has(activeRoute) && loginUser?.type !== "root") {
      router.replace("/(auth)/(tabs)/dashboard");
    }
  }, [isAuthenticated, loginUser?.type, router, segments]);

  return (
    <Stack screenOptions={{ headerShown: false, animation: "none" }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="(options)/user-management"
        options={{
          headerShown: true,
          title: "User Management",
          headerStyle: { backgroundColor: "#0B5D44" },
          headerTintColor: "#FFFFFF",
        }}
      />
      <Stack.Screen
        name="user-form"
        options={{
          headerShown: true,
          title: "Create User",
          headerStyle: { backgroundColor: "#0B5D44" },
          headerTintColor: "#FFFFFF",
        }}
      />
      <Stack.Screen
        name="(options)/import-export"
        options={{
          headerShown: true,
          title: "Import/Export Data",
          headerStyle: { backgroundColor: "#0B5D44" },
          headerTintColor: "#FFFFFF",
        }}
      />
      <Stack.Screen
        name="(options)/box-setting"
        options={{
          headerShown: true,
          title: "Box Setting",
          headerStyle: { backgroundColor: "#0B5D44" },
          headerTintColor: "#FFFFFF",
        }}
      />
      <Stack.Screen
        name="create-box"
        options={{
          headerShown: true,
          title: "Create Box",
          headerStyle: { backgroundColor: "#0B5D44" },
          headerTintColor: "#FFFFFF",
        }}
      />
      <Stack.Screen
        name="create-client"
        options={{
          headerShown: true,
          title: "Create Client",
          headerStyle: { backgroundColor: "#0B5D44" },
          headerTintColor: "#FFFFFF",
        }}
      />
    </Stack>
  );
}
