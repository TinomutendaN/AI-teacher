import Constants, { ExecutionEnvironment } from "expo-constants";
import { useRouter } from "expo-router";
import type { ComponentType } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Expo Go doesn't include Stream's native WebRTC module, so importing the
// Stream SDK there crashes the app at startup (Expo Router loads every route
// file on boot). We only load the real lesson screen in a development build.
const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export default function LessonRoute() {
  if (isExpoGo) {
    return <ExpoGoNotice />;
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const LessonScreen: ComponentType = require("@/components/LessonScreen").default;
  return <LessonScreen />;
}

function ExpoGoNotice() {
  const router = useRouter();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#ffffff" }}>
      <View className="flex-1 items-center justify-center gap-4 px-6">
        <Text className="h3 text-center text-text-primary">
          Lessons need a development build
        </Text>
        <Text className="body-md text-center text-text-secondary">
          Video lessons use native modules that Expo Go doesn&apos;t include.
          Run the app in a development build to start this lesson.
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.8}
          className="mt-2 rounded-2xl bg-lingua-purple px-8 py-4"
        >
          <Text className="body-md font-semibold text-white">Go back</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
