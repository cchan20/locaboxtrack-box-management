/** Normalizes scanned/typed box ids to the storage format used by the API. */
export const normalizeBoxId = (value: string): string => {
  const text = value.trim().toUpperCase();

  if (!text) {
    return "";
  }

  if (text.startsWith("BOX-")) {
    return text;
  }

  // Alphanumeric prefixes (e.g. "L-1") are returned as-is
  if (/[A-Z]/.test(text)) {
    return text;
  }

  const numeric = text.replace(/\D/g, "");

  if (!numeric) {
    return text;
  }

  return `BOX-${numeric.padStart(3, "0")}`;
};
