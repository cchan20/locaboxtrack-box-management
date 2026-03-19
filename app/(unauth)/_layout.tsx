import { Stack } from "expo-router";

export default function UnauthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: "none" }}>
      <Stack.Screen name="login" />
    </Stack>
  );
}
