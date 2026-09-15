/**
 * Expo config. Overrides root-owned app.json plugins so SQLite/sharing
 * packages are not linked after the API migration.
 */
module.exports = ({ config }) => {
  const plugins = (config.plugins ?? []).filter((plugin) => {
    const name = Array.isArray(plugin) ? plugin[0] : plugin;
    return !["expo-sqlite", "expo-sharing", "expo-file-system"].includes(name);
  });

  return {
    ...config,
    plugins,
  };
};
