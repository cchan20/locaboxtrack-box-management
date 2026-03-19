import { useAuth } from "@/store/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function LoginScreen() {
  const router = useRouter();
  const { login, loginError } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordHidden, setIsPasswordHidden] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showValidationError, setShowValidationError] = useState(false);

  const handleLogin = async () => {
    const normalizedUsername = username.trim();
    const normalizedPassword = password.trim();

    if (!normalizedUsername || !normalizedPassword) {
      setShowValidationError(true);
      return;
    }

    setShowValidationError(false);
    setIsSubmitting(true);

    try {
      console.log("Attempting login with:", {
        normalizedUsername,
        normalizedPassword: normalizedPassword ? "******" : "",
      });

      const ok = await login(normalizedUsername, normalizedPassword);

      if (ok) {
        router.replace("/(auth)/(tabs)/dashboard");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasError = showValidationError || loginError;

  return (
    <Pressable style={styles.container} onPress={Keyboard.dismiss}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.card}>
            <Text style={styles.title}>LocaBoxTrack Secure</Text>
            <Text style={styles.subtitle}>
              Login with root or user account credentials
            </Text>

            <TextInput
              value={username}
              onChangeText={(value) => {
                setUsername(value);
                if (showValidationError) {
                  setShowValidationError(false);
                }
              }}
              style={[styles.input, hasError ? styles.inputError : undefined]}
              placeholder="Username"
              placeholderTextColor="#7C7C7C"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              editable={!isSubmitting}
              returnKeyType="next"
            />

            <View style={styles.passwordWrap}>
              <TextInput
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  if (showValidationError) {
                    setShowValidationError(false);
                  }
                }}
                style={[
                  styles.input,
                  styles.passwordInput,
                  hasError ? styles.inputError : undefined,
                ]}
                secureTextEntry={isPasswordHidden}
                placeholder="Enter password"
                placeholderTextColor="#7C7C7C"
                editable={!isSubmitting}
                onSubmitEditing={handleLogin}
                returnKeyType="done"
              />
              <Pressable
                onPress={() => setIsPasswordHidden((current) => !current)}
                style={styles.passwordToggleButton}
                disabled={isSubmitting}
                accessibilityRole="button"
                accessibilityLabel={!isPasswordHidden ? "Show password" : "Hide password"}
              >
                <Ionicons
                  name={!isPasswordHidden ? "eye-outline" : "eye-off-outline"}
                  size={20}
                  style={styles.passwordToggleIcon}
                />
              </Pressable>
            </View>

            {showValidationError ? (
              <Text style={styles.errorText}>
                Username and password are required.
              </Text>
            ) : null}
            {!showValidationError && loginError ? (
              <Text style={styles.errorText}>
                Invalid credentials or inactive user account.
              </Text>
            ) : null}

            <Pressable
              style={[
                styles.loginButton,
                isSubmitting ? styles.loginButtonDisabled : undefined,
              ]}
              onPress={handleLogin}
              disabled={isSubmitting}
            >
              <Text style={styles.loginButtonText}>
                {isSubmitting ? "Checking..." : "Access System"}
              </Text>
            </Pressable>

            <Text style={styles.hintText}>Root account: username root</Text>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: "#0B3D2E",
    alignItems: "center",
  },
  keyboardView: {
    flex: 1,
    justifyContent: "flex-start",
    padding: 20,
    paddingTop: 36,
  },
  card: {
    // maxWidth: 800,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0B3D2E",
  },
  subtitle: {
    fontSize: 14,
    color: "#4A4A4A",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#C6C6C6",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: "#1F1F1F",
  },
  passwordWrap: {
    position: "relative",
  },
  passwordInput: {
    paddingRight: 52,
  },
  passwordToggleButton: {
    position: "absolute",
    right: 10,
    top: 8,
    bottom: 8,
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  passwordToggleIcon: {
    color: "#0D7A4E",
  },
  inputError: {
    borderColor: "#D93025",
  },
  errorText: {
    color: "#D93025",
    fontSize: 12,
  },
  loginButton: {
    backgroundColor: "#0D7A4E",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 8,
  },
  loginButtonDisabled: {
    opacity: 0.75,
  },
  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  hintText: {
    marginTop: 8,
    fontSize: 12,
    color: "#6A6A6A",
    textAlign: "center",
  },
});
