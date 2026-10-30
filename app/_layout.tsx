import { persistor, store } from "@/store";
import { Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";

function PersistLoading() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0B5D44",
      }}
    >
      <ActivityIndicator size="large" color="#D8F6E8" />
    </View>
  );
}

export default function RootLayout() {
  return (
    <Provider store={store}>
      <PersistGate loading={<PersistLoading />} persistor={persistor}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(unauth)" />
          <Stack.Screen name="(auth)" />
        </Stack>
      </PersistGate>
    </Provider>
  );
}
