export interface ConversationTurn {
  speaker: "user" | "assistant";
  text: string;
}

export interface SiteAdapter {
  matches(url: string): boolean;
  getConversationContainer(): Element | null;
  extractTurns(container: Element): ConversationTurn[];
  /** Returns a cleanup function that stops observing. */
  observe(container: Element, onChange: (turns: ConversationTurn[]) => void): () => void;
}
