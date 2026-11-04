import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface LearningState {
  xpToday: number;
  totalXP: number;
  dailyGoal: number;
  streak: number;
  completedLessonIds: string[];
  addXP: (amount: number) => void;
  setDailyGoal: (goal: number) => void;
  completeLesson: (lessonId: string) => void;
}

export const useLearningStore = create<LearningState>()(
  persist(
    (set) => ({
      xpToday: 15,
      totalXP: 15,
      dailyGoal: 20,
      streak: 12,
      completedLessonIds: [],
      addXP: (amount) =>
        set((state) => ({
          xpToday: Math.min(state.xpToday + amount, state.dailyGoal),
          // totalXP is never capped — it's the lifetime score shown on Profile
          totalXP: state.totalXP + amount,
        })),
      setDailyGoal: (goal) => set({ dailyGoal: goal }),
      completeLesson: (lessonId) =>
        set((state) => ({
          completedLessonIds: state.completedLessonIds.includes(lessonId)
            ? state.completedLessonIds
            : [...state.completedLessonIds, lessonId],
        })),
    }),
    {
      name: "learning-storage",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
