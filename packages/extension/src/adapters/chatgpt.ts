import type { ConversationTurn, SiteAdapter } from "./types.js";

/**
 * NOTE ON SELECTORS: chosen from ChatGPT's long-standing, widely-documented
 * `data-message-author-role` attribute (present on every message turn for
 * years across chatgpt.com/chat.openai.com), not from a single-page guess.
 * Still: React SPA class names and wrapper structure drift, so this is
 * verified against the live site before ship (see repo commit history) and
 * falls back to the structural heuristic below if the attribute hook ever
 * stops matching.
 */
const MESSAGE_SELECTOR = "[data-message-author-role]";
const SCROLL_CONTAINER_SELECTORS = [
  "main [role='presentation']",
  "#thread",
  "main",
];

function roleToSpeaker(role: string | null): ConversationTurn["speaker"] {
  return role === "assistant" ? "assistant" : "user";
}

function extractViaAttribute(container: Element): ConversationTurn[] {
  const nodes = Array.from(container.querySelectorAll<HTMLElement>(MESSAGE_SELECTOR));
  return nodes
    .map((node) => ({
      speaker: roleToSpeaker(node.getAttribute("data-message-author-role")),
      text: (node.textContent ?? "").trim(),
    }))
    .filter((t) => t.text.length > 0);
}

/**
 * Structural fallback: if the attribute hook finds nothing (site markup
 * changed), assume alternating message blocks inside the main scroll
 * container, starting with the user.
 */
function extractViaStructure(container: Element): ConversationTurn[] {
  const blocks = Array.from(container.children).filter((el) => (el.textContent ?? "").trim().length > 20);
  return blocks.map((el, i) => ({
    speaker: i % 2 === 0 ? "user" : "assistant",
    text: (el.textContent ?? "").trim(),
  }));
}

export const chatgptAdapter: SiteAdapter = {
  matches(url) {
    return /^https:\/\/(chatgpt\.com|chat\.openai\.com)\//.test(url);
  },

  getConversationContainer() {
    for (const selector of SCROLL_CONTAINER_SELECTORS) {
      const el = document.querySelector(selector);
      if (el) return el;
    }
    return null;
  },

  extractTurns(container) {
    const viaAttribute = extractViaAttribute(container);
    if (viaAttribute.length > 0) return viaAttribute;
    return extractViaStructure(container);
  },

  observe(container, onChange) {
    let debounceHandle: ReturnType<typeof setTimeout> | undefined;
    const observer = new MutationObserver(() => {
      if (debounceHandle) clearTimeout(debounceHandle);
      debounceHandle = setTimeout(() => {
        onChange(chatgptAdapter.extractTurns(container));
      }, 400);
    });
    observer.observe(container, { childList: true, subtree: true, characterData: true });
    return () => {
      if (debounceHandle) clearTimeout(debounceHandle);
      observer.disconnect();
    };
  },
};
