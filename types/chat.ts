export type ChatRole = "user" | "assistant";

export interface ChatCorrection {
  corrected: string;
  explanation: string;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  // Assistant only: English translation of the reply
  translation?: string;
  // Assistant only: short replies the student could send next
  suggestions?: string[];
  // Assistant only (role-play): true when the student reached the scenario goal
  goalComplete?: boolean;
  // User only: fix for a mistake in this message
  correction?: ChatCorrection;
}

// Shape returned by POST /api/chat
export interface ChatApiResponse {
  reply: string;
  translation: string;
  correction: ChatCorrection | null;
  suggestions: string[];
  goalComplete: boolean;
}

// A role-play situation for the Chat tab (see data/scenarios.ts)
export interface Scenario {
  id: string;
  emoji: string;
  title: string;
  // Shown to the student: what they need to achieve
  goal: string;
  // Prompt-only fields: who the AI plays and where the scene happens
  tutorRole: string;
  setting: string;
  xpReward: number;
}
