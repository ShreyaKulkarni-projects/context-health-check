export interface PanelSettings {
  contextWindow: number;
  apiKeyEnabled: boolean;
  apiKey: string;
}

const DEFAULTS: PanelSettings = {
  contextWindow: 200_000,
  apiKeyEnabled: false,
  apiKey: "",
};

const STORAGE_KEY = "context-health-settings";

export async function loadSettings(): Promise<PanelSettings> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return { ...DEFAULTS, ...(stored[STORAGE_KEY] ?? {}) };
}

export async function saveSettings(partial: Partial<PanelSettings>): Promise<PanelSettings> {
  const current = await loadSettings();
  const next = { ...current, ...partial };
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  return next;
}
