import { useAuth } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { images } from "@/constants/images";
import { colors } from "@/constants/theme";
import { getFreeTalkConfig } from "@/data/conversations";
import { LANGUAGES } from "@/data/languages";
import { getScenario, SCENARIOS } from "@/data/scenarios";
import { posthog } from "@/lib/posthog";
import { getChatKey, useChatStore } from "@/store/chatStore";
import { useLanguageStore } from "@/store/languageStore";
import { useLearningStore } from "@/store/learningStore";
import { ChatApiResponse, ChatMessage } from "@/types/chat";

// Stable empty array so we don't create a new one every render
const NO_MESSAGES: ChatMessage[] = [];

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isCompleted(messages: ChatMessage[] | undefined): boolean {
  return !!messages?.some((m) => m.goalComplete);
}

export default function ChatScreen() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { selectedLanguage } = useLanguageStore();
  const language = LANGUAGES.find((l) => l.code === selectedLanguage);
  const config = getFreeTalkConfig(selectedLanguage);

  const chats = useChatStore((s) => s.chats);
  const addMessage = useChatStore((s) => s.addMessage);
  const updateMessage = useChatStore((s) => s.updateMessage);
  const clearChat = useChatStore((s) => s.clearChat);
  const addXP = useLearningStore((s) => s.addXP);

  // null = free chat, otherwise the id of the active role-play scenario
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  // Which conversation is waiting for a reply / has failed (so switching scenarios stays correct)
  const [sendingKey, setSendingKey] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  useEffect(() => {
    posthog.capture("chat_viewed");
  }, []);

  if (!language || !config) {
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
            Pick a language first so your tutor knows what to write in.
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

  const code = language.code;
  const teacherName = config.teacherName;
  const scenario = getScenario(scenarioId);
  const chatKey = getChatKey(code, scenarioId);
  const messages = chats[chatKey] ?? NO_MESSAGES;
  const isSending = sendingKey === chatKey;
  const hasError = errorKey === chatKey;

  // Ask the API for the tutor's next message.
  // userMessageId is null when asking a role-play to open the scene.
  async function requestReply(
    key: string,
    activeScenarioId: string | null,
    history: ChatMessage[],
    userMessageId: string | null
  ) {
    setSendingKey(key);
    setErrorKey(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          language: code,
          scenarioId: activeScenarioId ?? undefined,
          messages: history.map(({ role, content }) => ({ role, content })),
        }),
      });
      if (!res.ok) throw new Error(`Chat request failed (${res.status})`);

      const data: ChatApiResponse = await res.json();

      if (data.correction && userMessageId) {
        updateMessage(key, userMessageId, { correction: data.correction });
      }

      // Award XP only the first time this scenario is completed
      const activeScenario = getScenario(activeScenarioId);
      const firstCompletion =
        data.goalComplete && !!activeScenario && !isCompleted(history);
      if (firstCompletion && activeScenario) {
        addXP(activeScenario.xpReward);
        posthog.capture("chat_scenario_completed", {
          scenario_id: activeScenario.id,
          language_code: code,
        });
      }

      addMessage(key, {
        id: createId(),
        role: "assistant",
        content: data.reply,
        translation: data.translation,
        suggestions: data.suggestions,
        goalComplete: firstCompletion,
      });
    } catch (err) {
      console.error("[chat] reply failed:", err);
      setErrorKey(key);
    } finally {
      setSendingKey((current) => (current === key ? null : current));
    }
  }

  function handleSelectScenario(id: string | null) {
    setScenarioId(id);
    setInput("");

    // A role-play with no history starts with the tutor's opening line
    const key = getChatKey(code, id);
    const isEmpty = (chats[key] ?? []).length === 0;
    if (id && isEmpty && sendingKey !== key) {
      posthog.capture("chat_scenario_started", { scenario_id: id, language_code: code });
      requestReply(key, id, [], null);
    }
  }

  function handleSend() {
    const text = input.trim();
    if (!text || isSending) return;

    const userMessage: ChatMessage = { id: createId(), role: "user", content: text };
    addMessage(chatKey, userMessage);
    setInput("");
    posthog.capture("chat_message_sent", {
      language_code: code,
      scenario_id: scenarioId,
    });
    requestReply(chatKey, scenarioId, [...messages, userMessage], userMessage.id);
  }

  function handleRetry() {
    const last = messages[messages.length - 1];
    if (last?.role === "user") {
      requestReply(chatKey, scenarioId, messages, last.id);
    } else if (messages.length === 0 && scenarioId) {
      requestReply(chatKey, scenarioId, [], null);
    }
  }

  function handleClear() {
    Alert.alert(
      scenario ? "Restart this scene?" : "Start over?",
      "This clears the messages in this conversation.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => {
            clearChat(chatKey);
            setErrorKey(null);
            if (scenarioId) requestReply(chatKey, scenarioId, [], null);
          },
        },
      ]
    );
  }

  // Chips above the input: starters for a new free chat, otherwise the tutor's latest suggestions
  const lastMessage = messages[messages.length - 1];
  const chips =
    messages.length === 0 && !scenario
      ? config.chatStarters
      : lastMessage?.role === "assistant"
        ? (lastMessage.suggestions ?? [])
        : [];

  const canSend = input.trim().length > 0 && !isSending;

  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: colors.neutral.background }}
    >
      {/* ── Header ── */}
      <View className="flex-row items-center px-5 pt-3 pb-3">
        <View className="w-11 h-11 rounded-full bg-[#F4F2FF] items-center justify-center overflow-hidden">
          <Image
            source={images.mascotWelcome}
            className="w-10 h-10"
            resizeMode="contain"
          />
        </View>
        <View className="flex-1 ml-3">
          <Text className="font-poppins-semibold text-base text-text-primary">
            {teacherName}
          </Text>
          <View className="flex-row items-center gap-1.5">
            <View className="w-2 h-2 rounded-full bg-success" />
            <Text className="font-poppins text-xs text-text-secondary">
              {scenario ? `Role-play · ${scenario.title}` : `AI tutor · ${language.name}`}
            </Text>
          </View>
        </View>
        {messages.length > 0 && (
          <TouchableOpacity
            onPress={handleClear}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name="refresh"
              size={22}
              color={colors.neutral.textSecondary}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Scenario cards ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.rowNoGrow}
        contentContainerStyle={styles.scenarioRowContent}
      >
        <ScenarioCard
          emoji="💬"
          title="Free chat"
          selected={scenarioId === null}
          onPress={() => handleSelectScenario(null)}
        />
        {SCENARIOS.map((s) => (
          <ScenarioCard
            key={s.id}
            emoji={s.emoji}
            title={s.title}
            selected={scenarioId === s.id}
            completed={isCompleted(chats[getChatKey(code, s.id)])}
            onPress={() => handleSelectScenario(s.id)}
          />
        ))}
      </ScrollView>

      {/* ── Goal banner (role-play only) ── */}
      {scenario && (
        <View className="flex-row items-start gap-2 bg-[#FFF5E8] rounded-xl mx-4 mb-1 px-3 py-2">
          <Text className="text-sm">🎯</Text>
          <Text className="flex-1 font-poppins text-xs leading-[18px] text-text-primary">
            <Text className="font-poppins-semibold">Goal: </Text>
            {scenario.goal}
          </Text>
        </View>
      )}

      <View className="h-px bg-border" />

      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        {/* ── Messages ── */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => (
            <MessageBubble message={item} xpReward={scenario?.xpReward ?? 0} />
          )}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() =>
            listRef.current?.scrollToEnd({ animated: true })
          }
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            isSending ? undefined : scenario ? (
              <View className="flex-1 items-center justify-center px-6">
                <Text className="text-[56px] mb-2">{scenario.emoji}</Text>
                <Text className="h3 text-center mb-1">{scenario.title}</Text>
                <Text className="body-md text-text-secondary text-center mb-5">
                  {teacherName} will play the other person. Stay in{" "}
                  {language.name} and reach your goal!
                </Text>
                <TouchableOpacity
                  onPress={handleRetry}
                  activeOpacity={0.85}
                  className="rounded-2xl bg-lingua-purple px-8 py-3"
                >
                  <Text className="font-poppins-semibold text-[15px] text-white">
                    Start scene
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View className="flex-1 items-center justify-center px-6">
                <Image
                  source={images.mascotWelcome}
                  className="w-36 h-36 mb-3"
                  resizeMode="contain"
                />
                <Text className="h3 text-center mb-1">Chat with {teacherName}</Text>
                <Text className="body-md text-text-secondary text-center">
                  Write in {language.name}. {teacherName} will reply and gently
                  fix your mistakes. Or pick a role-play above!
                </Text>
              </View>
            )
          }
          ListFooterComponent={
            <>
              {isSending && (
                <View className="flex-row items-center self-start gap-2 bg-surface rounded-[20px] rounded-bl-md px-4 py-3 mt-2">
                  <ActivityIndicator size="small" color={colors.primary.purple} />
                  <Text className="font-poppins text-[13px] text-text-secondary">
                    {teacherName} is typing…
                  </Text>
                </View>
              )}
              {hasError && !isSending && (
                <TouchableOpacity
                  onPress={handleRetry}
                  activeOpacity={0.8}
                  className="flex-row items-center self-center gap-1.5 mt-3"
                >
                  <Ionicons name="refresh-outline" size={16} color={colors.semantic.error} />
                  <Text className="font-poppins-medium text-[13px] text-error">
                    {teacherName} couldn&apos;t reply. Tap to retry
                  </Text>
                </TouchableOpacity>
              )}
            </>
          }
        />

        {/* ── Suggestion chips ── */}
        {chips.length > 0 && !isSending && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={styles.rowNoGrow}
            contentContainerStyle={styles.chipsContent}
          >
            {chips.map((chip) => (
              <TouchableOpacity
                key={chip}
                onPress={() => setInput(chip)}
                activeOpacity={0.8}
                className="bg-[#F4F2FF] rounded-full px-4 py-2"
              >
                <Text className="font-poppins-medium text-[13px] text-lingua-purple">
                  {chip}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* ── Input ── */}
        <View className="flex-row items-end gap-2 px-4 pt-2 pb-3">
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={`Write in ${language.name}…`}
            placeholderTextColor={colors.neutral.textSecondary}
            multiline
            maxLength={500}
            style={styles.input}
            underlineColorAndroid="transparent"
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!canSend}
            activeOpacity={0.85}
            className={`w-12 h-12 rounded-full items-center justify-center ${
              canSend ? "bg-lingua-purple" : "bg-border"
            }`}
            testID="chat-send-button"
          >
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ScenarioCard({
  emoji,
  title,
  selected,
  completed = false,
  onPress,
}: {
  emoji: string;
  title: string;
  selected: boolean;
  completed?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      className={`w-[112px] rounded-2xl border-2 px-3 py-2.5 ${
        selected ? "border-lingua-purple bg-[#F4F2FF]" : "border-border bg-white"
      }`}
    >
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-xl">{emoji}</Text>
        {completed && (
          <View className="w-[18px] h-[18px] rounded-full bg-success items-center justify-center">
            <Ionicons name="checkmark" size={12} color="#fff" />
          </View>
        )}
      </View>
      <Text
        numberOfLines={2}
        className={`font-poppins-semibold text-xs leading-4 ${
          selected ? "text-lingua-purple" : "text-text-primary"
        }`}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
}

function MessageBubble({
  message,
  xpReward,
}: {
  message: ChatMessage;
  xpReward: number;
}) {
  const [showTranslation, setShowTranslation] = useState(false);

  if (message.role === "user") {
    return (
      <View className="self-end items-end max-w-[80%] mb-3">
        <View className="bg-lingua-purple rounded-[20px] rounded-br-md px-4 py-3">
          <Text className="font-poppins text-[15px] leading-[22px] text-white">
            {message.content}
          </Text>
        </View>
        {message.correction && (
          <View className="bg-[#FFF5E8] rounded-2xl px-3 py-2 mt-1.5">
            <Text className="font-poppins-semibold text-[13px] text-text-primary">
              ✏️ {message.correction.corrected}
            </Text>
            <Text className="font-poppins text-xs text-text-secondary mt-0.5">
              {message.correction.explanation}
            </Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View className="mb-3">
      <View className="self-start items-start max-w-[85%]">
        <View className="bg-surface rounded-[20px] rounded-bl-md px-4 py-3">
          <Text className="font-poppins text-[15px] leading-[22px] text-text-primary">
            {message.content}
          </Text>
          {showTranslation && !!message.translation && (
            <Text className="font-poppins text-[13px] leading-5 text-text-secondary mt-1.5">
              {message.translation}
            </Text>
          )}
        </View>
        {!!message.translation && (
          <TouchableOpacity
            onPress={() => setShowTranslation((v) => !v)}
            activeOpacity={0.7}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Text className="font-poppins-medium text-xs text-lingua-blue mt-1 ml-1">
              {showTranslation ? "Hide translation" : "Translate"}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {message.goalComplete && (
        <View className="flex-row items-center gap-3 bg-[#E9F9F0] border border-success rounded-2xl px-4 py-3 mt-3">
          <Text className="text-2xl">🎉</Text>
          <View className="flex-1">
            <Text className="font-poppins-semibold text-sm text-text-primary">
              Scenario complete!
            </Text>
            <Text className="font-poppins text-xs text-text-secondary">
              You reached your goal{xpReward > 0 ? ` · +${xpReward} XP` : ""}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ScrollView/FlatList content styles and TextInput must stay in StyleSheet (see AGENTS.md)
const styles = StyleSheet.create({
  // Horizontal ScrollViews grow by default — stop them stealing space from the list
  rowNoGrow: {
    flexGrow: 0,
  },
  scenarioRowContent: {
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  listContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  chipsContent: {
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    paddingHorizontal: 16,
    paddingTop: 13,
    paddingBottom: 13,
    borderRadius: 24,
    backgroundColor: colors.neutral.surface,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    fontFamily: "Poppins-Regular",
    fontSize: 15,
    color: colors.neutral.textPrimary,
  },
});
