import { LanguageCode, Lesson } from "@/types/learning";

// Free-talk sessions for the AI Teacher tab.
// They reuse the Lesson shape so the existing lesson call screen can run them,
// but they are not part of any unit and award no XP.

export type FreeTalkTopic = { label: string; emoji: string };

export const FREE_TALK_TOPICS: FreeTalkTopic[] = [
  { label: "Your day", emoji: "☀️" },
  { label: "Food", emoji: "🍜" },
  { label: "Travel", emoji: "✈️" },
  { label: "Hobbies", emoji: "🎨" },
];

export type FreeTalkConfig = {
  code: LanguageCode;
  languageName: string;
  teacherName: string;
  introMessage: string;
  // Starter messages shown in the Chat tab before the first message
  chatStarters: string[];
};

const FREE_TALK_CONFIGS: FreeTalkConfig[] = [
  {
    code: "es",
    languageName: "Spanish",
    teacherName: "Luna",
    introMessage: "¡Hola! I'm Luna — let's just chat in Spanish today, no pressure!",
    chatStarters: ["¡Hola! ¿Cómo estás?", "Me llamo…", "¿Qué te gusta comer?"],
  },
  {
    code: "fr",
    languageName: "French",
    teacherName: "Claire",
    introMessage: "Bonjour ! I'm Claire — let's have a relaxed chat in French!",
    chatStarters: ["Bonjour ! Ça va ?", "Je m'appelle…", "Qu'est-ce que tu aimes faire ?"],
  },
  {
    code: "ja",
    languageName: "Japanese",
    teacherName: "Yuki",
    introMessage: "こんにちは! I'm Yuki — let's have a fun little chat in Japanese!",
    chatStarters: ["こんにちは！お元気ですか？", "わたしの なまえは…", "すきな たべものは なんですか？"],
  },
  {
    code: "de",
    languageName: "German",
    teacherName: "Max",
    introMessage: "Hallo! I'm Max — let's have an easy chat in German today!",
    chatStarters: ["Hallo! Wie geht's?", "Ich heiße…", "Was machst du gern?"],
  },
];

function createFreeTalk({
  code,
  languageName,
  teacherName,
  introMessage,
}: FreeTalkConfig): Lesson {
  const topics = FREE_TALK_TOPICS.map((t) => t.label.toLowerCase());

  return {
    id: getFreeTalkId(code),
    unitId: "free-talk",
    title: "Free conversation",
    description: `Practice speaking ${languageName} about anything`,
    icon: "💬",
    xpReward: 0,
    goals: [
      { description: `Hold a simple conversation in ${languageName}`, xpReward: 0 },
    ],
    vocabulary: [],
    phrases: [],
    activities: [],
    aiTeacherPrompt: {
      systemPrompt:
        `You're ${teacherName}, a friendly ${languageName} conversation partner in a real back-and-forth voice chat with a beginner. ` +
        `This is free conversation practice, not a structured lesson. Chat about everyday topics like ${topics.join(", ")}, or whatever the student brings up. ` +
        `Speak mostly simple ${languageName}, and add a short English hint when a word is likely new. ` +
        `If the student makes a mistake, gently repeat the corrected sentence once, then keep the conversation going. ` +
        `Keep every reply to one or two short sentences and end with ONE simple question. ` +
        `Your turn ENDS at the question mark — stop there and wait for the student. Never role-play the student's answer.`,
      introMessage,
      topics,
    },
  };
}

export const FREE_TALKS: Lesson[] = FREE_TALK_CONFIGS.map(createFreeTalk);

export function getFreeTalkId(code: LanguageCode): string {
  return `${code}-free-talk`;
}

export function getTeacherName(code: LanguageCode | null): string {
  return FREE_TALK_CONFIGS.find((c) => c.code === code)?.teacherName ?? "Your teacher";
}

export function hasFreeTalk(code: LanguageCode | null): boolean {
  return FREE_TALK_CONFIGS.some((c) => c.code === code);
}

export function getFreeTalkConfig(
  code: LanguageCode | null
): FreeTalkConfig | undefined {
  return FREE_TALK_CONFIGS.find((c) => c.code === code);
}
