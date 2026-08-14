import type { ConversationTurn, SiteAdapter } from "./types.js";

/**
 * NOTE ON SELECTORS: `[data-testid="user-message"]` for user turns is a
 * commonly-referenced, semantics-driven hook on claude.ai; assistant turns
 * are matched by the rendered-markdown wrapper class Anthropic uses for
 * Claude's own responses. As with the ChatGPT adapter, this is verified
 * against the live site before ship, and the structural fallback covers the
 * case where either hook stops matching after a redesign.
 */
const USER_MESSAGE_SELECTOR = "[data-testid='user-message']";
const ASSISTANT_MESSAGE_SELECTOR = "[data-testid='conversation-turn'] .font-claude-message, .font-claude-message";
const SCROLL_CONTAINER_SELECTORS = [
  "[data-testid='conversation-turn']",
  "main",
];

function extractViaAttribute(container: Element): ConversationTurn[] {
  const userNodes = Array.from(container.querySelectorAll<HTMLElement>(USER_MESSAGE_SELECTOR)).map((node) => ({
    node,
    speaker: "user" as const,
  }));
  const assistantNodes = Array.from(container.querySelectorAll<HTMLElement>(ASSISTANT_MESSAGE_SELECTOR)).map(
    (node) => ({ node, speaker: "assistant" as const }),
  );

  const all = [...userNodes, ...assistantNodes].sort((a, b) => {
    const pos = a.node.compareDocumentPosition(b.node);
    return pos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
  });

  return all
    .map(({ node, speaker }) => ({ speaker, text: (node.textContent ?? "").trim() }))
    .filter((t) => t.text.length > 0);
}

/**
 * Structural fallback: alternating message blocks inside the main scroll
 * container, starting with the user, when the attribute hooks find nothing.
 */
function extractViaStructure(container: Element): ConversationTurn[] {
  const root = container.closest("main") ?? container;
  const blocks = Array.from(root.querySelectorAll<HTMLElement>(":scope > div > div")).filter(
    (el) => (el.textContent ?? "").trim().length > 20,
  );
  return blocks.map((el, i) => ({
    speaker: i % 2 === 0 ? "user" : "assistant",
    text: (el.textContent ?? "").trim(),
  }));
}

export const claudeAdapter: SiteAdapter = {
  matches(url) {
    return /^https:\/\/claude\.ai\//.test(url);
  },

  getConversationContainer() {
    for (const selector of SCROLL_CONTAINER_SELECTORS) {
      const el = document.querySelector(selector);
      if (el) return document.querySelector("main") ?? el;
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
        onChange(claudeAdapter.extractTurns(container));
      }, 400);
    });
    observer.observe(container, { childList: true, subtree: true, characterData: true });
    return () => {
      if (debounceHandle) clearTimeout(debounceHandle);
      observer.disconnect();
    };
  },
};
