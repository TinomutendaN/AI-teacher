import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { images } from "@/constants/images";
import { colors } from "@/constants/theme";
import {
  FREE_TALK_TOPICS,
  getFreeTalkId,
  getTeacherName,
  hasFreeTalk,
} from "@/data/conversations";
import { LANGUAGES } from "@/data/languages";
import { posthog } from "@/lib/posthog";
import { useLanguageStore } from "@/store/languageStore";

const HOW_IT_WORKS = [
  { icon: "call" as const, text: "Tap Start talking to call your teacher" },
  { icon: "mic" as const, text: "Hold the mic button while you speak" },
  { icon: "chatbubbles" as const, text: "Read live captions of the conversation" },
];

export default function AITeacherScreen() {
  const router = useRouter();
  const { selectedLanguage } = useLanguageStore();

  const language = LANGUAGES.find((l) => l.code === selectedLanguage);
  const teacherName = getTeacherName(selectedLanguage);

  useEffect(() => {
    posthog.capture("ai_teacher_viewed");
  }, []);

  if (!language || !hasFreeTalk(language.code)) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: colors.neutral.background }}
      >
        <View className="flex-1 items-center justify-center px-8">
          <Image
            source={images.mascotWelcome}
            className="w-40 h-40 mb-4"
            resizeMode="contain"
          />
          <Text className="h3 text-center mb-2">No language selected</Text>
          <Text className="body-md text-text-secondary text-center mb-6">
            Pick a language first so your AI teacher knows what to speak.
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/language-select")}
            activeOpacity={0.85}
            className="rounded-2xl bg-lingua-purple px-8 py-4"
          >
            <Text className="font-poppins-semibold text-[15px] text-white">
              Choose a language
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  function handleStart() {
    if (!language) return;
    posthog.capture("ai_teacher_conversation_started", {
      language_code: language.code,
    });
    router.push(`/lesson/${getFreeTalkId(language.code)}`);
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.neutral.background }}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Header ── */}
        <View className="flex-row items-center justify-between mb-5">
          <Text className="h2">AI Teacher</Text>
          <View className="flex-row items-center gap-2 bg-surface rounded-full py-1.5 pl-1.5 pr-3">
            <Image
              source={{ uri: language.flag }}
              className="w-6 h-6 rounded-full"
            />
            <Text className="font-poppins-medium text-[13px] text-text-primary">
              {language.name}
            </Text>
          </View>
        </View>

        {/* ── Teacher card ── */}
        <View className="bg-[#F4F2FF] rounded-[24px] items-center px-5 pt-6 pb-5 mb-6">
          <Image
            source={images.mascotWelcome}
            className="w-[180px] h-[180px]"
            resizeMode="contain"
          />
          <Text className="font-poppins-bold text-[22px] text-text-primary mt-2">
            {teacherName}
          </Text>
          <Text className="font-poppins text-[13px] text-text-secondary mb-3">
            Your {language.name} conversation partner
          </Text>
          <View className="flex-row items-center gap-1.5 bg-white rounded-full px-3 py-1">
            <View className="w-2 h-2 rounded-full bg-success" />
            <Text className="font-poppins-medium text-xs text-success">
              Ready to chat
            </Text>
          </View>
        </View>

        {/* ── Topics ── */}
        <Text className="font-poppins-semibold text-[17px] text-text-primary mb-3">
          Things to talk about
        </Text>
        <View className="flex-row flex-wrap gap-2 mb-6">
          {FREE_TALK_TOPICS.map((topic) => (
            <View
              key={topic.label}
              className="flex-row items-center gap-1.5 bg-white border border-border rounded-full px-4 py-2"
            >
              <Text className="text-sm">{topic.emoji}</Text>
              <Text className="font-poppins-medium text-[13px] text-text-primary">
                {topic.label}
              </Text>
            </View>
          ))}
        </View>

        {/* ── How it works ── */}
        <Text className="font-poppins-semibold text-[17px] text-text-primary mb-3">
          How it works
        </Text>
        <View
          className="bg-white rounded-[20px] border border-border mb-6 overflow-hidden"
          style={styles.cardShadow}
        >
          {HOW_IT_WORKS.map((step, index) => (
            <View key={step.text}>
              {index > 0 && <View className="h-px bg-border mx-4" />}
              <View className="flex-row items-center px-4 py-[14px]">
                <View className="w-10 h-10 rounded-xl items-center justify-center bg-[#EDE9FE]">
                  <Ionicons
                    name={step.icon}
                    size={18}
                    color={colors.primary.purple}
                  />
                </View>
                <Text className="flex-1 ml-3 font-poppins text-[13px] text-text-primary">
                  {step.text}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── Start button ── */}
        <TouchableOpacity
          onPress={handleStart}
          activeOpacity={0.85}
          className="flex-row items-center justify-center gap-2 bg-lingua-purple rounded-2xl py-4"
          style={styles.buttonShadow}
          testID="ai-teacher-start-button"
        >
          <Ionicons name="mic" size={20} color="#fff" />
          <Text className="font-poppins-semibold text-base text-white">
            Start talking
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ScrollView.contentContainerStyle and shadows (iOS/Android) must stay in StyleSheet
const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
  },
  cardShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  buttonShadow: {
    shadowColor: colors.primary.purple,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
});
