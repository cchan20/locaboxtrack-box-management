import { Ionicons } from "@expo/vector-icons";
import { forwardRef, type ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";

const CLEAR_SLOT = 28;
const CLEAR_ICON_SIZE = 18;

type ClearableTextInputProps = TextInputProps & {
  containerStyle?: StyleProp<ViewStyle>;
  /** Optional trailing control (e.g. password visibility toggle). */
  endAccessory?: ReactNode;
  /** Width reserved for endAccessory so the clear button sits to its left. */
  endAccessoryWidth?: number;
};

export const ClearableTextInput = forwardRef<TextInput, ClearableTextInputProps>(
  function ClearableTextInput(
    {
      style,
      value,
      onChangeText,
      containerStyle,
      editable,
      multiline,
      endAccessory,
      endAccessoryWidth = 0,
      ...rest
    },
    ref,
  ) {
    const isEditable = editable !== false;
    const hasValue = typeof value === "string" ? value.length > 0 : Boolean(value);
    const showClear = hasValue && isEditable && typeof onChangeText === "function";
    const accessoryWidth = endAccessory ? endAccessoryWidth || CLEAR_SLOT : 0;
    const rightPadding =
      (showClear ? CLEAR_SLOT : 0) + accessoryWidth > 0
        ? 10 + (showClear ? CLEAR_SLOT : 0) + accessoryWidth
        : undefined;

    return (
      <View style={[styles.wrap, containerStyle]}>
        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          editable={editable}
          multiline={multiline}
          style={[style, rightPadding != null ? { paddingRight: rightPadding } : null] as StyleProp<TextStyle>}
          {...rest}
        />
        {showClear ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear text"
            hitSlop={8}
            style={[
              styles.clearButton,
              multiline ? styles.clearButtonMultiline : null,
              accessoryWidth > 0 ? { right: 8 + accessoryWidth } : null,
            ]}
            onPress={() => onChangeText?.("")}
          >
            <Ionicons name="close-circle" size={CLEAR_ICON_SIZE} color="#7A8F87" />
          </Pressable>
        ) : null}
        {endAccessory}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  wrap: {
    position: "relative",
  },
  clearButton: {
    position: "absolute",
    right: 10,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    zIndex: 1,
  },
  clearButtonMultiline: {
    bottom: undefined,
    top: 10,
    justifyContent: "flex-start",
  },
});
