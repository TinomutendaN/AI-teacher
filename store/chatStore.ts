import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { ChatMessage } from "@/types/chat";
import { LanguageCode } from "@/types/learning";

const MAX_STORED_MESSAGES = 100;

// Each conversation has its own key:
//   "es"       → free chat in Spanish
//   "es:cafe"  → the café role-play in Spanish
export function getChatKey(
  language: LanguageCode,
  scenarioId: string | null
): string {
  return scenarioId ? `${language}:${scenarioId}` : language;
}

interface ChatState {
  chats: Record<string, ChatMessage[]>;
  addMessage: (key: string, message: ChatMessage) => void;
  updateMessage: (key: string, id: string, changes: Partial<ChatMessage>) => void;
  clearChat: (key: string) => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      chats: {},
      addMessage: (key, message) =>
        set((state) => ({
          chats: {
            ...state.chats,
            [key]: [...(state.chats[key] ?? []), message].slice(
              -MAX_STORED_MESSAGES
            ),
          },
        })),
      updateMessage: (key, id, changes) =>
        set((state) => ({
          chats: {
            ...state.chats,
            [key]: (state.chats[key] ?? []).map((m) =>
              m.id === id ? { ...m, ...changes } : m
            ),
          },
        })),
      clearChat: (key) =>
        set((state) => ({ chats: { ...state.chats, [key]: [] } })),
    }),
    {
      name: "chat-storage",
      storage: createJSONStorage(() => AsyncStorage),
      // v0 stored free chats as `messagesByLanguage`; keep them when upgrading
      version: 1,
      migrate: (persisted, version) => {
        const old = persisted as {
          messagesByLanguage?: Record<string, ChatMessage[]>;
        };
        if (version === 0) {
          return { chats: old.messagesByLanguage ?? {} };
        }
        return persisted as { chats: Record<string, ChatMessage[]> };
      },
    }
  )
);
