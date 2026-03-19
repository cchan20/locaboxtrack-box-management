import { AppDataProvider } from "@/store/AppDataContext";
import { AuthProvider } from "@/store/AuthContext";
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { Stack } from "expo-router";
import { openDatabaseSync, SQLiteProvider } from "expo-sqlite";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";

import migrations from "@/drizzle/migrations/migrations";
import { Suspense } from "react";
import { ActivityIndicator } from "react-native";
export const DATABASE_NAME = "lms.db";

export default function RootLayout() {
  const expoDb = openDatabaseSync(DATABASE_NAME);
  const db = drizzle(expoDb);
  const { success, error } = useMigrations(db, migrations);

  console.log("Migration status:", { success, error });
  

  return (
    <Suspense fallback={<ActivityIndicator size="large" />}>
      <SQLiteProvider
        databaseName={DATABASE_NAME}
        options={{ enableChangeListener: true }}
        useSuspense
      >
        <AuthProvider>
          <AppDataProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(unauth)" />
              <Stack.Screen name="(auth)" />
            </Stack>
          </AppDataProvider>
        </AuthProvider>
      </SQLiteProvider>
    </Suspense>
  );
}
