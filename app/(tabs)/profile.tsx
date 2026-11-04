import { useAuth, useUser } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "@/constants/theme";
import { LANGUAGES } from "@/data/languages";
import { UNITS } from "@/data/units";
import { useChatStore } from "@/store/chatStore";
import { useLanguageStore } from "@/store/languageStore";
import { useLearningStore } from "@/store/learningStore";

const DAILY_GOAL_OPTIONS = [10, 20, 30];

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function ProfileScreen() {
  const { user } = useUser();
  const { signOut } = useAuth();
  const { selectedLanguage } = useLanguageStore();
  const { totalXP, dailyGoal, streak, completedLessonIds, setDailyGoal } =
    useLearningStore();
  const chats = useChatStore((s) => s.chats);

  const fullName = user?.fullName ?? user?.firstName ?? "Learner";
  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const joined = user?.createdAt
    ? user.createdAt.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      })
    : null;

  const language = LANGUAGES.find((l) => l.code === selectedLanguage);

  // Lessons for the current language come from its units
  const courseLessonIds = UNITS.filter(
    (u) => u.languageCode === selectedLanguage
  ).flatMap((u) => u.lessonIds);
  const courseCompleted = courseLessonIds.filter((id) =>
    completedLessonIds.includes(id)
  ).length;
  const courseProgress =
    courseLessonIds.length > 0
      ? (courseCompleted / courseLessonIds.length) * 100
      : 0;

  const chatCount = Object.values(chats).filter((m) => m.length > 0).length;

  const stats = [
    {
      id: "streak",
      icon: "flame" as const,
      iconColor: colors.semantic.streak,
      iconBg: "#FFF5E8",
      value: streak,
      label: "Day streak",
    },
    {
      id: "xp",
      icon: "flash" as const,
      iconColor: "#E5A800",
      iconBg: "#FFF9DB",
      value: totalXP,
      label: "Total XP",
    },
    {
      id: "lessons",
      icon: "checkmark-circle" as const,
      iconColor: colors.primary.green,
      iconBg: "#E7F8EF",
      value: completedLessonIds.length,
      label: "Lessons done",
    },
    {
      id: "chats",
      icon: "chatbubbles" as const,
      iconColor: colors.primary.purple,
      iconBg: "#EDE9FE",
      value: chatCount,
      label: "AI chats",
    },
  ];

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.neutral.background }}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Text className="font-poppins-semibold text-[17px] text-text-primary mb-5">
          Profile
        </Text>

        {/* ── Header ── */}
        <View className="items-center mb-6">
          <View>
            {user?.imageUrl ? (
              <Image
                source={{ uri: user.imageUrl }}
                className="w-24 h-24 rounded-full"
              />
            ) : (
              <View className="w-24 h-24 rounded-full bg-lingua-purple items-center justify-center">
                <Text className="font-poppins-bold text-[32px] text-white">
                  {getInitials(fullName)}
                </Text>
              </View>
            )}
            {language && (
              <Image
                source={{ uri: language.flag }}
                className="w-8 h-8 rounded-full border-[3px] border-white absolute bottom-0 right-0"
              />
            )}
          </View>
          <Text className="font-poppins-bold text-[22px] text-text-primary mt-3">
            {fullName}
          </Text>
          {!!email && (
            <Text className="font-poppins text-[13px] text-text-secondary">
              {email}
            </Text>
          )}
          {joined && (
            <Text className="caption mt-1">Joined {joined}</Text>
          )}
        </View>

        {/* ── Stats Grid ── */}
        <View className="flex-row flex-wrap justify-between gap-y-3 mb-6">
          {stats.map((stat) => (
            <View
              key={stat.id}
              className="w-[48.5%] bg-white rounded-[20px] border border-border p-4"
              style={styles.cardShadow}
            >
              <View
                className="w-10 h-10 rounded-xl items-center justify-center mb-3"
                style={{ backgroundColor: stat.iconBg }}
              >
                <Ionicons name={stat.icon} size={20} color={stat.iconColor} />
              </View>
              <Text className="font-poppins-bold text-[22px] text-text-primary leading-7">
                {stat.value}
              </Text>
              <Text className="font-poppins text-xs text-text-secondary">
                {stat.label}
              </Text>
            </View>
          ))}
        </View>

        {/* ── Current Course ── */}
        <Text className="font-poppins-semibold text-[17px] text-text-primary mb-3">
          Current course
        </Text>
        <View
          className="bg-white rounded-[20px] border border-border p-4 mb-6"
          style={styles.cardShadow}
        >
          <View className="flex-row items-center">
            {language ? (
              <Image
                source={{ uri: language.flag }}
                className="w-11 h-11 rounded-full"
              />
            ) : (
              <View className="w-11 h-11 rounded-full bg-surface" />
            )}
            <View className="flex-1 ml-3">
              <Text className="font-poppins-semibold text-sm text-text-primary">
                {language?.name ?? "No language yet"}
              </Text>
              <Text className="font-poppins text-xs text-text-secondary">
                {courseCompleted} / {courseLessonIds.length} lessons
              </Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push("/language-select")}
            >
              <Text className="font-poppins-medium text-[13px] text-lingua-blue">
                Change
              </Text>
            </TouchableOpacity>
          </View>
          <View className="h-2 bg-border rounded mt-4 overflow-hidden">
            <View
              className="h-2 bg-lingua-green rounded"
              style={{
                width: `${Math.round(courseProgress)}%` as `${number}%`,
              }}
            />
          </View>
        </View>

        {/* ── Settings ── */}
        <Text className="font-poppins-semibold text-[17px] text-text-primary mb-3">
          Settings
        </Text>
        <View
          className="bg-white rounded-[20px] border border-border overflow-hidden"
          style={styles.cardShadow}
        >
          <View className="px-4 py-[14px]">
            <View className="flex-row items-center mb-3">
              <View className="w-11 h-11 rounded-xl items-center justify-center bg-[#FFF5E8]">
                <Ionicons
                  name="trophy"
                  size={20}
                  color={colors.semantic.streak}
                />
              </View>
              <View className="flex-1 ml-3">
                <Text className="font-poppins-semibold text-sm text-text-primary">
                  Daily goal
                </Text>
                <Text className="font-poppins text-xs text-text-secondary">
                  XP to earn each day
                </Text>
              </View>
            </View>
            <View className="flex-row gap-2">
              {DAILY_GOAL_OPTIONS.map((goal) => {
                const isActive = goal === dailyGoal;
                return (
                  <TouchableOpacity
                    key={goal}
                    activeOpacity={0.8}
                    onPress={() => setDailyGoal(goal)}
                    className={`flex-1 items-center py-2 rounded-xl border ${
                      isActive
                        ? "bg-lingua-purple border-lingua-purple"
                        : "bg-white border-border"
                    }`}
                  >
                    <Text
                      className={`font-poppins-semibold text-[13px] ${
                        isActive ? "text-white" : "text-text-primary"
                      }`}
                    >
                      {goal} XP
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View className="h-px bg-border mx-4" />

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => signOut()}
            className="flex-row items-center px-4 py-[14px]"
          >
            <View className="w-11 h-11 rounded-xl items-center justify-center bg-[#FEE2E2]">
              <Ionicons
                name="log-out-outline"
                size={20}
                color={colors.semantic.error}
              />
            </View>
            <Text className="flex-1 ml-3 font-poppins-semibold text-sm text-error">
              Sign out
            </Text>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.neutral.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ScrollView.contentContainerStyle and shadow (iOS/Android) must stay in StyleSheet
const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 100,
  },
  cardShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
});
