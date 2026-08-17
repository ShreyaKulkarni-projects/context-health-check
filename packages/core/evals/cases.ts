import type { ConversationTurn, GradeKey, RiskZoneKey } from "../src/types.js";

/**
 * Business-level expectations for one eval case. Deliberately looser than a
 * unit test's exact-value assertions - these check that the engine's overall
 * judgment on a realistic conversation shape is right, not that an internal
 * constant hasn't moved by one.
 */
export interface EvalExpectation {
  scoreRange?: [number, number];
  grade?: GradeKey;
  riskZone?: RiskZoneKey;
  minBloatRatio?: number;
  maxBloatRatio?: number;
  redundantPairCount?: number;
  firedRecommendationIds?: string[];
  notFiredRecommendationIds?: string[];
}

export interface EvalCase {
  id: string;
  description: string;
  contextWindow?: number;
  turns: ConversationTurn[];
  expect: EvalExpectation;
}

function repeat(text: string, times: number): string {
  return (text + " ").repeat(times);
}

export const EVAL_CASES: EvalCase[] = [
  {
    id: "healthy-short-chat",
    description: "An ordinary short back-and-forth with no large pastes - should score high and stay in good shape.",
    turns: [
      { speaker: "user", text: "Can you help me write a regex for matching email addresses?" },
      {
        speaker: "assistant",
        text: "Sure, here's a reasonable one: /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/ - it's not RFC-perfect but covers real-world cases.",
      },
      { speaker: "user", text: "Nice, that works. Can you explain the parts?" },
      {
        speaker: "assistant",
        text: "^[^\\s@]+ matches one or more non-space, non-@ characters at the start (the local part). @ matches the literal @. [^\\s@]+\\. matches the domain up to a dot. [^\\s@]+$ matches the TLD.",
      },
    ],
    expect: {
      scoreRange: [90, 100],
      grade: "good",
      riskZone: "good",
      maxBloatRatio: 0.1,
      redundantPairCount: 0,
      firedRecommendationIds: ["good-shape"],
    },
  },
  {
    id: "single-large-file-paste",
    description: "One big config dump early on, otherwise a normal conversation - should flag bloat but not redundancy.",
    turns: [
      { speaker: "user", text: "Can you review this nginx config?" },
      { speaker: "assistant", text: "Sure, paste it over." },
      { speaker: "user", text: repeat("server { listen 80; location / { proxy_pass http://localhost:3000; } }", 150) },
      {
        speaker: "assistant",
        text: "This looks like a fairly standard reverse proxy config. One thing I'd flag: no gzip compression configured, and no upstream health checks.",
      },
      { speaker: "user", text: "Good catch, can you add gzip?" },
      { speaker: "assistant", text: "Added gzip on with common mime types. Let me know if you want brotli too." },
    ],
    expect: {
      minBloatRatio: 0.35,
      redundantPairCount: 0,
      firedRecommendationIds: ["high-bloat"],
      notFiredRecommendationIds: ["redundant-pastes", "high-usage"],
    },
  },
  {
    id: "accidental-duplicate-paste",
    description: "The same large file pasted twice by accident - should flag redundancy specifically.",
    turns: [
      { speaker: "user", text: "Here's our onboarding doc, can you clean it up?" },
      { speaker: "user", text: repeat("Step 1: clone the repo. Step 2: install deps. Step 3: copy env file.", 130) },
      { speaker: "assistant", text: "Got it, I'll restructure this into clearer sections." },
      { speaker: "user", text: "Wait sorry, wrong version, here's the real one" },
      { speaker: "user", text: repeat("Step 1: clone the repo. Step 2: install deps. Step 3: copy env file.", 130) },
      { speaker: "assistant", text: "Thanks - this looks identical to what you sent before, so my restructuring above should still apply." },
    ],
    expect: {
      redundantPairCount: 1,
      firedRecommendationIds: ["redundant-pastes"],
    },
  },
  {
    id: "distinct-large-pastes-no-false-positive",
    description: "Two different large pastes (not duplicates) - the redundancy detector must not false-positive just because both are big.",
    turns: [
      { speaker: "user", text: "Here's our release process doc" },
      { speaker: "user", text: repeat("Tag main, run CI, deploy to staging, get sign-off, promote to prod.", 130) },
      { speaker: "assistant", text: "Thanks, noted." },
      { speaker: "user", text: "And here's our incident response doc" },
      { speaker: "user", text: repeat("Page the on-call engineer, open an incident channel, update the status page.", 130) },
      { speaker: "assistant", text: "Got both, they're clearly different processes." },
    ],
    expect: {
      redundantPairCount: 0,
      notFiredRecommendationIds: ["redundant-pastes"],
    },
  },
  {
    id: "near-full-context-window",
    description:
      "A conversation that has consumed almost the entire (small) context window - should trigger high-usage and land in the critical risk zone. " +
      "Grade only reaches \"serious\" here, not \"critical\": usagePenalty caps at 40, so window overflow alone can't push the score below 40 " +
      "without added bloat/redundancy - riskZone (raw % used) and grade (capped score) are deliberately different signals.",
    contextWindow: 8000,
    turns: [
      {
        speaker: "user",
        text: repeat(
          "Long running research thread content about a wide ranging technical investigation into a production incident with many contributing factors.",
          400,
        ),
      },
      {
        speaker: "assistant",
        text: repeat(
          "Detailed technical analysis and proposed remediation steps for the described incident, covering rollback plans and monitoring gaps.",
          250,
        ),
      },
    ],
    expect: {
      riskZone: "critical",
      grade: "serious",
      firedRecommendationIds: ["high-usage"],
    },
  },
  {
    id: "long-dialogue-no-bloat",
    description: "Many short turns of genuine back-and-forth, no big pastes - should suggest compaction, not clearing.",
    turns: Array.from({ length: 20 }, (_, i) => ({
      speaker: (i % 2 === 0 ? "user" : "assistant") as ConversationTurn["speaker"],
      text: `Turn ${i + 1}: a short, ordinary message continuing the discussion about the project's architecture and next steps.`,
    })),
    expect: {
      firedRecommendationIds: ["consider-compaction"],
      maxBloatRatio: 0.35,
    },
  },
  {
    id: "kitchen-sink-everything-fires",
    description: "High usage, heavy bloat, and a redundant pair together - all three should fire, in priority order.",
    contextWindow: 6000,
    turns: [
      { speaker: "user", text: "Let's start a new investigation." },
      { speaker: "assistant", text: "Sure, go ahead." },
      { speaker: "user", text: repeat("Large upfront context dump describing the full system architecture in detail.", 200) },
      { speaker: "assistant", text: "Got it, that's a lot of context - noted." },
      { speaker: "user", text: "One more thing to add." },
      { speaker: "assistant", text: "Sure, go ahead." },
      { speaker: "user", text: repeat("Large upfront context dump describing the full system architecture in detail.", 200) },
      { speaker: "assistant", text: "This is the same content you sent before." },
    ],
    expect: {
      riskZone: "critical",
      minBloatRatio: 0.35,
      redundantPairCount: 1,
      firedRecommendationIds: ["high-usage", "high-bloat", "redundant-pastes"],
    },
  },
  {
    id: "empty-conversation",
    description: "No turns at all - should be a perfect score with the good-shape fallback, not an error.",
    turns: [],
    expect: {
      scoreRange: [100, 100],
      grade: "good",
      firedRecommendationIds: ["good-shape"],
    },
  },
];
