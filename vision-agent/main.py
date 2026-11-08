import asyncio
import os
from typing import Awaitable, Callable, Optional

from dotenv import load_dotenv

# Load Stream keys from the parent repo .env
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
# Local .env adds OPENAI_API_KEY and can override any key
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"), override=True)

from getstream.models import MemberRequest  # noqa: E402
from openai.types.realtime.realtime_transcription_session_audio_input_turn_detection_param import ServerVad  # noqa: E402
from vision_agents.core import Agent, AgentLauncher, User, Runner  # noqa: E402
from vision_agents.core.instructions import Instructions  # noqa: E402
from vision_agents.plugins import getstream, openai  # noqa: E402

AGENT_USER_ID = "ai-teacher"

LANGUAGE_NAMES: dict[str, str] = {
    "es": "Spanish",
    "fr": "French",
    "ja": "Japanese",
    "de": "German",
}

DEFAULT_SYSTEM_PROMPT = (
    "You are a warm, energetic AI language teacher having a real voice conversation with a student. "
    "You operate in exactly two modes and NEVER mix them:\n"
    "TEACHING MODE: Say one word or phrase, its English meaning, and one pronunciation tip. "
    "End with a single question like 'Can you say that?' or 'Give it a try!'. "
    "Your turn is OVER at that question mark. Stop speaking. Output nothing else. "
    "Do NOT imagine what the student will say. Do NOT pre-write your reaction. Just stop.\n"
    "REACTING MODE: You have just received actual speech from the student in this turn. "
    "If they said the word correctly, give one short praise and teach the next word in the same reply. "
    "If it was unclear or wrong, help them and ask them to try again. Stop.\n"
    "ABSOLUTE RULES:\n"
    "- Never say 'Nice job', 'Perfect', 'Great', or any praise unless the student has "
    "ACTUALLY spoken in the current turn and you heard something from them.\n"
    "- Never continue past a question mark. Every question is a hard stop.\n"
    "- Never role-play the student's response or write what you imagine they said.\n"
    "- Keep every reply to one or two short sentences maximum.\n"
    "- Stay strictly within the current lesson's vocabulary."
)

# Lesson prompts from the app describe WHAT to teach. These rules describe HOW to
# take turns, so they are appended to every prompt (lesson or default).
TURN_TAKING_RULES = (
    "VOICE CONVERSATION RULES:\n"
    "- Keep every reply to one or two short sentences.\n"
    "- Every question you ask ends your turn. Stop and wait for the student.\n"
    "- Never pretend the student answered. Only react to speech you actually heard.\n"
    "- If you did not understand the student, kindly ask them to repeat.\n"
    "WHEN TO MOVE ON (VERY IMPORTANT) - judge every attempt as exactly one of these:\n"
    "1. CORRECT - you clearly heard the right word, with good pronunciation (a light accent is fine). "
    "Praise them in a few words and move on to the next word in that same reply. "
    "Never ask them to repeat a word they already said correctly.\n"
    "2. UNCLEAR - it was mumbled, cut off, too quiet, or you are not sure what they said. "
    "Do NOT count it as correct. Ask them to say it again, a little slower or louder. "
    "Give unclear attempts 2 to 3 more chances.\n"
    "3. WRONG - you heard them, but the word or pronunciation was wrong. Do NOT move on. "
    "Say what was off, model the word again (break it into syllables if it helps) and ask them to try again. "
    "Keep practicing the same word as long as they are still getting it wrong. "
    "Use a different tip each time.\n"
    "- Only after about 5 attempts in a row without getting it right: encourage them warmly, "
    "say you will come back to it, and move on.\n"
    "- Reacting to an attempt the student ACTUALLY made and then teaching the next word in the same "
    "reply is allowed and expected. This is not the same as imagining the student's answer."
)

# How often (seconds) partial captions are pushed to the app. OpenAI sends many
# tiny deltas per second; sending each one as a Stream event would flood the API.
PARTIAL_FLUSH_INTERVAL = 0.25

TranscriptCallback = Callable[[str, str, str, bool], None]


class TeacherRealtime(openai.Realtime):
    """openai.Realtime plus live transcript callbacks.

    vision-agents 0.6.0 only reports transcripts once a sentence is finished, so
    we read OpenAI's raw delta events here to get word-by-word captions.
    on_transcript(item_id, speaker, full_text_so_far, is_final)
    """

    on_transcript: Optional[TranscriptCallback] = None

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._texts: dict[str, str] = {}

    def _report(self, item_id: str, speaker: str, delta: str = "", final_text: Optional[str] = None) -> None:
        if not self.on_transcript or not item_id:
            return
        if final_text is not None:
            text = final_text or self._texts.get(item_id, "")
            self._texts.pop(item_id, None)
            self.on_transcript(item_id, speaker, text, True)
        else:
            text = self._texts.get(item_id, "") + delta
            self._texts[item_id] = text
            self.on_transcript(item_id, speaker, text, False)

    async def _handle_openai_event(self, event: dict) -> None:
        et = event.get("type")
        item_id = event.get("item_id", "")

        if et in ("response.output_audio_transcript.delta", "response.audio_transcript.delta"):
            self._report(item_id, "agent", delta=event.get("delta", ""))
        elif et in ("response.output_audio_transcript.done", "response.audio_transcript.done"):
            self._report(item_id, "agent", final_text=event.get("transcript", ""))
        elif et == "conversation.item.input_audio_transcription.delta":
            self._report(item_id, "user", delta=event.get("delta", ""))
        elif et == "conversation.item.input_audio_transcription.completed":
            self._report(item_id, "user", final_text=event.get("transcript", ""))

        await super()._handle_openai_event(event)


class TranscriptRelay:
    """Forwards transcripts to the mobile app as Stream custom events.

    Final transcripts are sent right away. Partial ones are batched and sent at
    most every PARTIAL_FLUSH_INTERVAL seconds. Sending never blocks the audio
    pipeline because it runs in background tasks.
    """

    def __init__(self, send: Callable[[dict], Awaitable[None]]):
        self._send = send
        self._pending: dict[str, dict] = {}
        self._flush_task: Optional[asyncio.Task] = None

    def push(self, item_id: str, speaker: str, text: str, final: bool) -> None:
        payload = {"type": "transcript", "id": item_id, "speaker": speaker, "text": text, "final": final}
        if final:
            self._pending.pop(item_id, None)
            asyncio.create_task(self._safe_send(payload))
            return
        self._pending[item_id] = payload
        if self._flush_task is None or self._flush_task.done():
            self._flush_task = asyncio.create_task(self._flush_later())

    async def _flush_later(self) -> None:
        await asyncio.sleep(PARTIAL_FLUSH_INTERVAL)
        pending, self._pending = self._pending, {}
        for payload in pending.values():
            await self._safe_send(payload)

    async def _safe_send(self, payload: dict) -> None:
        try:
            await self._send(payload)
        except Exception as e:
            print(f"[agent] send_custom_event error: {e}")


def _require_env(var_name: str) -> None:
    if not os.getenv(var_name):
        raise RuntimeError(f"Missing required environment variable: {var_name}")

def _language_name_from_call_id(call_id: str) -> Optional[str]:
    # call_id format: lesson-{langCode}-lesson-{n}-{userId}
    parts = call_id.split("-")
    if len(parts) >= 2 and parts[0] == "lesson":
        return LANGUAGE_NAMES.get(parts[1])
    return None


def _set_transcription_hint(llm: openai.Realtime, language_name: str, custom: dict) -> None:
    # vocabulary items arrive as "word: translation" - keep only the word
    words = [str(v).split(":")[0].strip() for v in custom.get("vocabulary") or []]
    words += [str(p).strip() for p in custom.get("phrases") or []]

    hint = (
        f"An English-speaking student is practicing {language_name} with a teacher. "
        f"They speak English and repeat short {language_name} words and phrases."
    )
    if words:
        hint += " Words they may say: " + ", ".join(words) + "."

    transcription = llm.realtime_session["audio"]["input"]["transcription"]
    transcription["prompt"] = hint


async def create_agent(**kwargs) -> Agent:
    return Agent(
        edge=getstream.Edge(),
        llm=TeacherRealtime(
            # server_vad fires on raw audio energy (~100 ms after mic opens) rather
            # than waiting for semantic speech intent detection (~500 ms+).
            # This means the agent stops speaking almost immediately when the user
            # presses the push-and-hold mic button, before they have said a word.
            realtime_session={
                "type": "realtime",
                "audio": {
                    "input": {
                        # gpt-4o-transcribe is more accurate than the mini model on short,
                        # accented, mixed-language speech like a student repeating words.
                        # The lesson-specific `prompt` is added in join_call.
                        "transcription": {"model": "gpt-4o-transcribe"},
                        # Cleans up close-up phone mic audio before it is transcribed
                        "noise_reduction": {"type": "near_field"},
                        "turn_detection": ServerVad(
                            type="server_vad",
                            threshold=0.4,         # low enough to catch ambient noise on mic open
                            prefix_padding_ms=200,  # capture brief audio before speech onset
                            silence_duration_ms=400, # commit turn after 400 ms of silence
                            interrupt_response=True, # stop agent audio the moment VAD fires
                        ),
                    }
                },
            }
        ),
        agent_user=User(name="AI Teacher", id=AGENT_USER_ID),
        instructions=DEFAULT_SYSTEM_PROMPT,
    )


async def join_call(agent: Agent, call_type: str, call_id: str, **kwargs) -> None:
    call = await agent.create_call(call_type, call_id)

    # Read lesson context packed into the call's custom data by the mobile app
    custom: dict = {}
    try:
        resp = await call.get()
        custom = resp.data.call.custom or {}
    except Exception as e:
        print(f"[agent] Warning: could not fetch call custom data: {e}")

    system_prompt  = custom.get("system_prompt") or DEFAULT_SYSTEM_PROMPT
    intro_message  = custom.get("intro_message")
    language_code  = custom.get("language") or ""
    lesson_title   = custom.get("lesson_title") or ""
    language_name  = LANGUAGE_NAMES.get(language_code) or _language_name_from_call_id(call_id) or "language"

    # Apply lesson-specific instructions before joining so the Realtime LLM receives them
    agent.instructions = Instructions(input_text=f"{system_prompt}\n\n{TURN_TAKING_RULES}")

    # Tell the transcriber what the student is likely to say, so short foreign
    # words like "zwei" or "buenos días" are not misheard as random English.
    # Must run before agent.join(), because the session config is sent on connect.
    if isinstance(agent.llm, TeacherRealtime):
        _set_transcription_hint(agent.llm, language_name, custom)

    # Grant admin role + go live so the agent can publish audio
    try:
        await call.update_call_members(
            update_members=[MemberRequest(user_id=AGENT_USER_ID, role="admin")]
        )
    except Exception as e:
        print(f"[agent] Warning: could not set admin role: {e}")

    try:
        await call.go_live()
    except Exception as e:
        print(f"[agent] Warning: go_live failed (expected for default call type): {e}")

    # Stream live captions (teacher + student) to the app as custom events
    relay = TranscriptRelay(agent.send_custom_event)
    if isinstance(agent.llm, TeacherRealtime):
        agent.llm.on_transcript = relay.push

    async with agent.join(call):
        # Wait for the student to join (returns immediately if already present)
        await agent.wait_for_participant(timeout=60.0)

        if intro_message:
            context_parts = [f"A student just joined your {language_name} lesson"]
            if lesson_title:
                context_parts[0] += f" — '{lesson_title}'"
            context_parts[0] += "."
            context_parts.append(
                f"Deliver this greeting and NOTHING else: \"{intro_message}\" "
                f"After the greeting, ask the student one simple question to get them talking — "
                f"for example 'Are you ready to get started?' or 'Have you learned any {language_name} before?' "
                f"Then STOP and wait for the student's reply before teaching anything."
            )
            await agent.simple_response(" ".join(context_parts))
        else:
            await agent.simple_response(
                f"A student just joined your {language_name} lesson. "
                f"Greet them warmly and ask one short question — like 'Ready to learn some {language_name}?' "
                f"Then STOP and wait for their reply before you teach anything."
            )

        await agent.finish()


if __name__ == "__main__":
    _require_env("STREAM_API_KEY")
    _require_env("STREAM_API_SECRET")
    _require_env("OPENAI_API_KEY")

    Runner(AgentLauncher(create_agent=create_agent, join_call=join_call)).cli()
