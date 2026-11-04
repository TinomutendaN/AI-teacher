import { getFreeTalkConfig } from "@/data/conversations";
import { getScenario } from "@/data/scenarios";
import { requireClerkUser } from "@/lib/clerk-server";
import {
  ChatApiResponse,
  ChatCorrection,
  ChatRole,
  Scenario,
} from "@/types/chat";
import { LanguageCode } from "@/types/learning";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini";
const MAX_HISTORY = 20; // only send the most recent messages to keep requests small
const MAX_MESSAGE_LENGTH = 500;

// Sent (server-side only) when a role-play chat is empty, so the tutor opens the scene
const SCENARIO_OPENER =
  "(The student just walked into the scene. Say your first line in character to start the role-play. Set correction to null.)";

type IncomingMessage = { role: ChatRole; content: string };

function buildSystemPrompt(
  teacherName: string,
  languageName: string,
  scenario?: Scenario
): string {
  const lines = [
    `You are ${teacherName}, a friendly ${languageName} tutor chatting by text with a beginner (CEFR A1–A2).`,
    `Reply in simple ${languageName}: one to three short sentences, then ask ONE easy question to keep the chat going.`,
    `If the student writes in English, answer briefly in ${languageName} and encourage them to try in ${languageName}.`,
    `If the student's last message has a spelling, grammar, or word-choice mistake, provide a correction. Ignore missing accents and punctuation-only issues.`,
    `Respond ONLY with a JSON object with exactly these keys:`,
    `"reply": your message in ${languageName}.`,
    `"translation": the English translation of "reply".`,
    `"correction": null if the last student message is fine, otherwise {"corrected": the full corrected sentence in ${languageName}, "explanation": one short sentence in English}.`,
    `"suggestions": an array of 3 short, simple replies (in ${languageName}) the student could send next.`,
    `"goalComplete": always false unless a role-play goal is given below.`,
  ];

  if (scenario) {
    lines.push(
      "",
      `ROLE-PLAY MODE — this overrides the tutor persona above for "reply":`,
      `You are playing ${scenario.tutorRole} in ${scenario.setting}, in a ${languageName}-speaking country.`,
      `The student's goal: ${scenario.goal}`,
      `Stay in character in "reply" — speak only as your character would, in simple ${languageName}, and never lecture.`,
      `Do all teaching through "correction"; it is shown separately from the scene.`,
      `Guide the scene so the student can reach their goal, one small step per turn.`,
      `Set "goalComplete" to true only in the turn where the student has achieved the whole goal; then wrap up the scene warmly in character.`
    );
  }

  return lines.join("\n");
}

function isValidMessage(m: unknown): m is IncomingMessage {
  if (typeof m !== "object" || m === null) return false;
  const { role, content } = m as Record<string, unknown>;
  return (
    (role === "user" || role === "assistant") &&
    typeof content === "string" &&
    content.trim().length > 0
  );
}

// The model's JSON is untrusted — normalise it into a safe ChatApiResponse
function parseModelOutput(raw: string): ChatApiResponse | null {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof data.reply !== "string" || !data.reply.trim()) return null;

  let correction: ChatCorrection | null = null;
  const c = data.correction as Record<string, unknown> | null | undefined;
  if (c && typeof c.corrected === "string" && typeof c.explanation === "string") {
    correction = { corrected: c.corrected, explanation: c.explanation };
  }

  const suggestions = Array.isArray(data.suggestions)
    ? data.suggestions.filter((s): s is string => typeof s === "string").slice(0, 3)
    : [];

  return {
    reply: data.reply,
    translation: typeof data.translation === "string" ? data.translation : "",
    correction,
    suggestions,
    goalComplete: data.goalComplete === true,
  };
}

export async function POST(request: Request): Promise<Response> {
  const auth = await requireClerkUser(request);
  if (auth.error) return auth.error;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "OpenAI not configured" }, { status: 500 });
  }

  let body: { language?: LanguageCode; scenarioId?: string; messages?: unknown[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const config = getFreeTalkConfig(body.language ?? null);
  if (!config) {
    return Response.json({ error: "Unsupported language" }, { status: 400 });
  }

  // Only known scenario ids are accepted — the prompt text always comes from the server
  const scenario = getScenario(body.scenarioId);
  if (body.scenarioId && !scenario) {
    return Response.json({ error: "Unknown scenario" }, { status: 400 });
  }

  const messages = (body.messages ?? [])
    .filter(isValidMessage)
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_LENGTH) }));

  // An empty role-play chat asks the tutor to open the scene
  if (scenario && messages.length === 0) {
    messages.push({ role: "user", content: SCENARIO_OPENER });
  }

  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return Response.json(
      { error: "The last message must be from the user" },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        response_format: { type: "json_object" },
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content: buildSystemPrompt(
              config.teacherName,
              config.languageName,
              scenario
            ),
          },
          ...messages,
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[chat] OpenAI returned ${res.status}: ${text}`);
      return Response.json({ error: "AI tutor request failed" }, { status: 502 });
    }

    const data = await res.json();
    const content: unknown = data?.choices?.[0]?.message?.content;
    const parsed = typeof content === "string" ? parseModelOutput(content) : null;

    if (!parsed) {
      console.error("[chat] Could not parse model output:", content);
      return Response.json({ error: "AI tutor gave an invalid reply" }, { status: 502 });
    }

    // Free chat has no goal, whatever the model says
    if (!scenario) parsed.goalComplete = false;

    return Response.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[chat] Failed to reach OpenAI: ${message}`);
    return Response.json({ error: "Cannot reach AI tutor" }, { status: 503 });
  }
}
