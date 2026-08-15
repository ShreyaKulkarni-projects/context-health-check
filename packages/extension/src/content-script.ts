import { claudeAdapter } from "./adapters/claude.js";
import { chatgptAdapter } from "./adapters/chatgpt.js";
import type { ConversationTurn, SiteAdapter } from "./adapters/types.js";

export type ContentMessage =
  | { type: "turns"; turns: ConversationTurn[] }
  | { type: "detection-failed" };

const adapters: SiteAdapter[] = [claudeAdapter, chatgptAdapter];

function findAdapter(): SiteAdapter | undefined {
  return adapters.find((a) => a.matches(window.location.href));
}

function send(message: ContentMessage) {
  chrome.runtime.sendMessage(message).catch(() => {
    // No listener yet (side panel not open) - safe to ignore.
  });
}

function start() {
  const adapter = findAdapter();
  if (!adapter) return;

  const container = adapter.getConversationContainer();
  if (!container) {
    send({ type: "detection-failed" });
    return;
  }

  const initialTurns = adapter.extractTurns(container);
  if (initialTurns.length === 0) {
    send({ type: "detection-failed" });
  } else {
    send({ type: "turns", turns: initialTurns });
  }

  adapter.observe(container, (turns) => {
    if (turns.length === 0) {
      send({ type: "detection-failed" });
    } else {
      send({ type: "turns", turns });
    }
  });
}

// The side panel can also ask for a fresh read (e.g. right after it opens).
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "request-turns") {
    const adapter = findAdapter();
    const container = adapter?.getConversationContainer();
    if (adapter && container) {
      const turns = adapter.extractTurns(container);
      sendResponse(turns.length > 0 ? { type: "turns", turns } : { type: "detection-failed" });
    } else {
      sendResponse({ type: "detection-failed" });
    }
  }
  return true;
});

start();
