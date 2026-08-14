import type { ConversationTurn, SiteAdapter } from "./types.js";

/**
 * Selectors verified live against claude.ai (2026-08) by inspecting the real
 * DOM of an actual conversation, not guessed:
 *  - `[data-testid='transcript-list']` is the scrollable container holding
 *    every turn.
 *  - `[data-testid='transcript-row']` wraps exactly one turn (user or
 *    assistant) each.
 *  - A row is a user turn iff it contains `[data-testid='user-message']`
 *    (using that element's own text avoids picking up sibling action-button
 *    labels that the row/article wrapper's textContent otherwise includes).
 *  - Assistant turns render their markdown into a `.font-claude-response`
 *    element, which is absent on user rows and gives exactly the response
 *    text with no chrome around it.
 * Still falls back to the structural heuristic below if any of this stops
 * matching after a redesign - see SHOWCASE.md for why that fallback isn't
 * optional.
 */
const CONTAINER_SELECTOR = "[data-testid='transcript-list']";
const ROW_SELECTOR = "[data-testid='transcript-row']";
const USER_MESSAGE_SELECTOR = "[data-testid='user-message']";
const ASSISTANT_RESPONSE_SELECTOR = ".font-claude-response";

function extractViaAttribute(container: Element): ConversationTurn[] {
  const rows = Array.from(container.querySelectorAll<HTMLElement>(ROW_SELECTOR));
  const turns: ConversationTurn[] = [];
  for (const row of rows) {
    const userMsg = row.querySelector<HTMLElement>(USER_MESSAGE_SELECTOR);
    if (userMsg) {
      const text = (userMsg.textContent ?? "").trim();
      if (text) turns.push({ speaker: "user", text });
      continue;
    }
    const response = row.querySelector<HTMLElement>(ASSISTANT_RESPONSE_SELECTOR);
    if (response) {
      const text = (response.textContent ?? "").trim();
      if (text) turns.push({ speaker: "assistant", text });
    }
  }
  return turns;
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
    return document.querySelector(CONTAINER_SELECTOR) ?? document.querySelector("main");
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
