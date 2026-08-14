import { ConversationAnalyzer, type AnalysisResult, type Recommendation } from "@context-health/core";
import { parseTranscript } from "@context-health/web-demo/parseTranscript";
import type { ContentMessage } from "../content-script.js";
import type { ConversationTurn } from "../adapters/types.js";
import { loadSettings, saveSettings, type PanelSettings } from "./settings.js";

// ---------- Theme ----------
const root = document.documentElement;
const themeToggle = document.getElementById("themeToggle") as HTMLButtonElement;
function applyThemeLabel() {
  const isDark = root.getAttribute("data-theme") === "dark";
  themeToggle.textContent = isDark ? "☀️" : "🌙";
}
themeToggle.addEventListener("click", () => {
  const cur = root.getAttribute("data-theme");
  root.setAttribute("data-theme", cur === "dark" ? "light" : "dark");
  applyThemeLabel();
});
applyThemeLabel();

// ---------- Settings ----------
const settingsToggle = document.getElementById("settingsToggle") as HTMLButtonElement;
const settingsPanel = document.getElementById("settingsPanel") as HTMLElement;
const modelSelect = document.getElementById("modelSelect") as HTMLSelectElement;
const customWindowField = document.getElementById("customWindowField") as HTMLElement;
const customWindowInput = document.getElementById("customWindowInput") as HTMLInputElement;
const apiKeyToggle = document.getElementById("apiKeyToggle") as HTMLInputElement;
const apiKeyField = document.getElementById("apiKeyField") as HTMLElement;
const apiKeyInput = document.getElementById("apiKeyInput") as HTMLInputElement;

settingsToggle.addEventListener("click", () => settingsPanel.classList.toggle("show"));

let settings: PanelSettings;

async function initSettings() {
  settings = await loadSettings();
  if ([200000, 1000000, 128000, 400000].includes(settings.contextWindow)) {
    modelSelect.value = String(settings.contextWindow);
  } else {
    modelSelect.value = "custom";
    customWindowField.style.display = "block";
    customWindowInput.value = String(settings.contextWindow);
  }
  apiKeyToggle.checked = settings.apiKeyEnabled;
  apiKeyField.style.display = settings.apiKeyEnabled ? "block" : "none";
  apiKeyInput.value = settings.apiKey;
}

modelSelect.addEventListener("change", async () => {
  customWindowField.style.display = modelSelect.value === "custom" ? "block" : "none";
  const contextWindow = modelSelect.value === "custom" ? parseInt(customWindowInput.value, 10) : parseInt(modelSelect.value, 10);
  settings = await saveSettings({ contextWindow });
  resetAndRescore();
});
customWindowInput.addEventListener("change", async () => {
  const v = parseInt(customWindowInput.value, 10);
  if (Number.isFinite(v) && v > 0) {
    settings = await saveSettings({ contextWindow: v });
    resetAndRescore();
  }
});
apiKeyToggle.addEventListener("change", async () => {
  apiKeyField.style.display = apiKeyToggle.checked ? "block" : "none";
  settings = await saveSettings({ apiKeyEnabled: apiKeyToggle.checked });
});
apiKeyInput.addEventListener("change", async () => {
  settings = await saveSettings({ apiKey: apiKeyInput.value });
});

// ---------- Analyzer state ----------
// Fast path: when the incoming snapshot is the previous turns array plus new
// turns appended (the overwhelmingly common case in a live chat), only the
// new turns go through addTurn() — O(1) work per new turn, not a re-scan of
// the whole transcript. Slow path: if anything in the existing history
// changed (an in-place edit, or the debounced snapshot caught the final
// turn mid-stream and its text differs from what we last saw), reset and
// replay everything. Still far cheaper than doing this on every raw
// MutationObserver callback, since content-script.ts already debounces
// those to one snapshot per 400ms.
let analyzer = new ConversationAnalyzer({ contextWindow: 200_000 });
let lastTurns: ConversationTurn[] = [];

function turnsEqual(a: ConversationTurn, b: ConversationTurn): boolean {
  return a.speaker === b.speaker && a.text === b.text;
}

function ingestTurns(turns: ConversationTurn[]) {
  const isPureAppend = turns.length >= lastTurns.length && lastTurns.every((t, i) => turnsEqual(t, turns[i]));

  if (isPureAppend) {
    for (let i = lastTurns.length; i < turns.length; i++) analyzer.addTurn(turns[i]);
  } else {
    analyzer.reset();
    for (const t of turns) analyzer.addTurn(t);
  }
  lastTurns = turns;
  render(analyzer.getResult());
}

function resetAndRescore() {
  analyzer = new ConversationAnalyzer({ contextWindow: settings.contextWindow });
  const previous = lastTurns;
  lastTurns = [];
  ingestTurns(previous);
}

// ---------- Rendering ----------
const ICONS: Record<Recommendation["icon"], string> = {
  clock: "⏱",
  broom: "🧹",
  loop: "🔁",
  note: "📝",
  check: "✓",
};

function fmtPct(v: number): string {
  return Math.min(999, Math.round(v)) + "%";
}

function renderRecommendations(recommendations: Recommendation[]) {
  const list = document.getElementById("recList")!;
  list.innerHTML = "";
  recommendations.forEach((r) => {
    const item = document.createElement("div");
    item.className = "rec-item";
    const icon = document.createElement("div");
    icon.className = "rec-icon";
    icon.style.background = r.colorVar;
    icon.textContent = ICONS[r.icon];
    const body = document.createElement("div");
    body.className = "rec-body";
    const title = document.createElement("div");
    title.className = "rec-title";
    title.textContent = r.title;
    const desc = document.createElement("div");
    desc.className = "rec-desc";
    desc.textContent = r.description;
    body.appendChild(title);
    body.appendChild(desc);
    item.appendChild(icon);
    item.appendChild(body);
    list.appendChild(item);
  });
}

const SVG_NS = "http://www.w3.org/2000/svg";
function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const e = document.createElementNS(SVG_NS, tag) as SVGElementTagNameMap[K];
  for (const k in attrs) e.setAttribute(k, String(attrs[k]));
  return e;
}

function renderChart(result: AnalysisResult) {
  const svg = document.getElementById("chartSvg") as unknown as SVGSVGElement;
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  const W = 320,
    H = 120,
    padL = 30,
    padR = 6,
    padT = 6,
    padB = 6;
  const plotW = W - padL - padR,
    plotH = H - padT - padB;
  const n = result.turns.length;
  const maxTokens = Math.max(result.contextWindow, result.totalTokens || 1);

  const xAt = (i: number) => padL + (n <= 1 ? plotW / 2 : (plotW * i) / (n - 1));
  const yAt = (v: number) => padT + plotH - (plotH * v) / maxTokens;

  const zoneDefs = [
    { from: 0, to: 0.5, css: "var(--good-wash)" },
    { from: 0.5, to: 0.75, css: "var(--warning-wash)" },
    { from: 0.75, to: 0.9, css: "var(--serious-wash)" },
    { from: 0.9, to: Math.max(1, maxTokens / result.contextWindow), css: "var(--critical-wash)" },
  ];
  zoneDefs.forEach((z) => {
    const v0 = z.from * result.contextWindow,
      v1 = z.to * result.contextWindow;
    const y1 = yAt(v1),
      y0 = yAt(v0);
    if (y0 - y1 < 0.5) return;
    svg.appendChild(svgEl("rect", { x: padL, y: y1, width: plotW, height: Math.max(0, y0 - y1), fill: z.css }));
  });

  svg.appendChild(svgEl("line", { x1: padL, x2: padL + plotW, y1: padT + plotH, y2: padT + plotH, stroke: "var(--baseline)", "stroke-width": 1 }));

  if (n === 0) return;

  let pathD = "M " + xAt(0) + " " + yAt(0);
  for (let i = 0; i < n; i++) pathD += " L " + xAt(i) + " " + yAt(result.turns[i].cumulativeTokens);
  svg.appendChild(svgEl("path", { d: pathD, fill: "none", stroke: "var(--series-blue)", "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }));
}

function render(result: AnalysisResult) {
  document.getElementById("scoreNum")!.textContent = String(result.score.score);
  (document.getElementById("scoreNum") as HTMLElement).style.color = result.score.grade.colorVar;
  const dot = document.querySelector("#scoreLabel .dot") as HTMLElement;
  dot.style.background = result.score.grade.colorVar;
  (document.getElementById("scoreLabel") as HTMLElement).style.background = `color-mix(in srgb, ${result.score.grade.colorVar} 16%, transparent)`;
  document.getElementById("scoreLabelText")!.textContent = result.score.grade.label;
  (document.getElementById("meterFill") as HTMLElement).style.width = result.score.score + "%";
  (document.getElementById("meterFill") as HTMLElement).style.background = result.score.grade.colorVar;
  document.getElementById("scoreDesc")!.textContent =
    result.turns.length === 0
      ? "Open a conversation on claude.ai or chatgpt.com to see its context health."
      : `${fmtPct(result.peakUsagePct)} of the context window used, ${Math.round(result.bloatRatio * 100)}% bloat.`;

  document.getElementById("kpiUsage")!.textContent = fmtPct(result.peakUsagePct);
  document.getElementById("kpiBloat")!.textContent = Math.round(result.bloatRatio * 100) + "%";
  document.getElementById("kpiRedundant")!.textContent = String(result.redundantPairs.length);
  document.getElementById("kpiTurns")!.textContent = String(result.turns.length);

  renderChart(result);
  renderRecommendations(result.recommendations);
}

// ---------- Live detection vs paste-box fallback ----------
const liveView = document.getElementById("liveView") as HTMLElement;
const pasteBox = document.getElementById("pasteBox") as HTMLElement;
const statusLine = document.getElementById("statusLine") as HTMLElement;
const statusText = document.getElementById("statusText") as HTMLElement;

function showFallback() {
  liveView.style.display = "none";
  pasteBox.style.display = "block";
  statusLine.classList.add("fallback");
  statusText.textContent = "Automatic detection unavailable — paste your conversation below.";
}

function showLive() {
  liveView.style.display = "block";
  pasteBox.style.display = "none";
  statusLine.classList.remove("fallback");
  statusText.textContent = "Watching this conversation…";
}

document.getElementById("analyzePasteBtn")!.addEventListener("click", () => {
  const raw = (document.getElementById("transcript") as HTMLTextAreaElement).value;
  if (!raw.trim()) return;
  const parsed = parseTranscript(raw);
  analyzer = new ConversationAnalyzer({ contextWindow: settings.contextWindow });
  lastTurns = [];
  for (const t of parsed.turns) analyzer.addTurn({ speaker: t.speaker, text: t.text });
  lastTurns = parsed.turns.map((t) => ({ speaker: t.speaker, text: t.text }));
  render(analyzer.getResult());
});

chrome.runtime.onMessage.addListener((message: ContentMessage) => {
  if (message?.type === "turns") {
    showLive();
    ingestTurns(message.turns);
  } else if (message?.type === "detection-failed") {
    showFallback();
  }
});

async function requestInitialTurns() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    chrome.tabs.sendMessage(tab.id, { type: "request-turns" }, (response: ContentMessage | undefined) => {
      if (chrome.runtime.lastError || !response) return; // content script not injected on this page — stay on empty live view
      if (response.type === "turns") {
        showLive();
        ingestTurns(response.turns);
      } else if (response.type === "detection-failed") {
        showFallback();
      }
    });
  } catch {
    // Panel opened without an active supported tab — leave the empty live view showing.
  }
}

initSettings().then(() => {
  analyzer = new ConversationAnalyzer({ contextWindow: settings.contextWindow });
  requestInitialTurns();
});

chrome.tabs.onActivated.addListener(() => requestInitialTurns());
chrome.tabs.onUpdated.addListener((_id, changeInfo) => {
  if (changeInfo.status === "complete") requestInitialTurns();
});
