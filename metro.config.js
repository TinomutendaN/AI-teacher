const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativewind } = require("nativewind/metro");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

const nativewindConfig = withNativewind(config, { input: "./global.css" });

// NativeWind (react-native-css) redirects every `react-native` import to its own
// wrapper. That wrapper doesn't re-export `AssetRegistry` yet (added in RN 0.88),
// which `expo-asset` needs to load fonts/images. Let expo-asset import the real
// `react-native` until react-native-css catches up.
const nativewindResolve = nativewindConfig.resolver.resolveRequest;
const expoAssetDir = `${path.sep}node_modules${path.sep}expo-asset${path.sep}`;

nativewindConfig.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === "react-native" &&
    context.originModulePath.includes(expoAssetDir)
  ) {
    return context.resolveRequest(context, moduleName, platform);
  }
  return nativewindResolve(context, moduleName, platform);
};

module.exports = nativewindConfig;
