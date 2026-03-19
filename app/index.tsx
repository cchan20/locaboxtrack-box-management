import { useAuth } from "@/store/AuthContext";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Index() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isAuthenticated) {
        router.replace("/(auth)/(tabs)/dashboard");
        return;
      }

      router.replace("/(unauth)/login");
    }, 1600);

    return () => clearTimeout(timer);
  }, [isAuthenticated, router]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.brandWrap}>
        <Text style={styles.brandName}>LocaBoxTrack</Text>
        <Text style={styles.brandSub}>Box Management</Text>
      </View>
      <ActivityIndicator size="large" color="#D8F6E8" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B5D44",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
  },
  brandWrap: {
    alignItems: "center",
  },
  brandName: {
    color: "#FFFFFF",
    fontSize: 38,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  brandSub: {
    color: "#D5F2E5",
    fontSize: 14,
    marginTop: 6,
  },
});
