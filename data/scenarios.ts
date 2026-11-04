import { Scenario } from "@/types/chat";

// Role-play scenarios for the Chat tab.
// They are language-independent: the API combines them with the selected language.
// The app only sends a scenario id to the server, which looks the prompt up here.

export const SCENARIOS: Scenario[] = [
  {
    id: "cafe",
    emoji: "☕",
    title: "Order at a café",
    goal: "Order a drink and something to eat, then ask for the bill.",
    tutorRole: "a cheerful barista working the counter",
    setting: "a busy neighbourhood café in the morning",
    xpReward: 5,
  },
  {
    id: "hotel",
    emoji: "🏨",
    title: "Check into a hotel",
    goal: "Check in, give your name, and ask what time breakfast is.",
    tutorRole: "a polite hotel receptionist",
    setting: "the front desk of a small city-centre hotel",
    xpReward: 5,
  },
  {
    id: "directions",
    emoji: "🧭",
    title: "Ask for directions",
    goal: "Find out how to get to the train station.",
    tutorRole: "a helpful local passer-by",
    setting: "a street corner in the old town; the student is a lost tourist",
    xpReward: 5,
  },
  {
    id: "market",
    emoji: "🛒",
    title: "Shop at the market",
    goal: "Buy some fruit, ask the price, and pay.",
    tutorRole: "a friendly fruit seller at a market stall",
    setting: "an open-air Saturday market",
    xpReward: 5,
  },
];

export function getScenario(id: string | null | undefined): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}
