import { analyze, KPI_GLOSSARY, type AnalysisResult, type Recommendation } from "@context-health/core";
import { parseTranscript, type ParsedTurn } from "./parseTranscript.js";

// ---------- KPI glossary (hover explanation; the note line below each value
// stays the live computed number, set in runAnalysis()) ----------
const KPI_INFO_IDS: Record<(typeof KPI_GLOSSARY)[number]["key"], { info: string; tile: string }> = {
  peakUsage: { info: "kpiUsageInfo", tile: "kpiUsageTile" },
  bloat: { info: "kpiBloatInfo", tile: "kpiBloatTile" },
  redundant: { info: "kpiRedundantInfo", tile: "kpiRedundantTile" },
  turns: { info: "kpiTurnsInfo", tile: "kpiTurnsTile" },
};
KPI_GLOSSARY.forEach((entry) => {
  const ids = KPI_INFO_IDS[entry.key];
  const title = `${entry.oneLiner}. ${entry.detail}`;
  const info = document.getElementById(ids.info);
  const tile = document.getElementById(ids.tile);
  if (info) info.title = title;
  if (tile) tile.title = title;
});

// ---------- Theme ----------
const root = document.documentElement;
const themeToggle = document.getElementById("themeToggle") as HTMLButtonElement;
function applyThemeLabel() {
  const isDark = root.getAttribute("data-theme") === "dark";
  themeToggle.textContent = isDark ? "☀️ Light mode" : "🌙 Dark mode";
}
themeToggle.addEventListener("click", () => {
  const cur = root.getAttribute("data-theme");
  root.setAttribute("data-theme", cur === "dark" ? "light" : "dark");
  applyThemeLabel();
});
applyThemeLabel();

// ---------- Context window select ----------
const modelSelect = document.getElementById("modelSelect") as HTMLSelectElement;
const customField = document.getElementById("customWindowField") as HTMLElement;
const customInput = document.getElementById("customWindowInput") as HTMLInputElement;
modelSelect.addEventListener("change", () => {
  customField.style.display = modelSelect.value === "custom" ? "block" : "none";
});
function currentWindowSize(): number {
  if (modelSelect.value === "custom") {
    const v = parseInt(customInput.value, 10);
    return Number.isFinite(v) && v > 0 ? v : 200000;
  }
  return parseInt(modelSelect.value, 10);
}

// ---------- Demo transcript ----------
const DEMO: [string, string][] = [
  ["Human", "Hey — can you help me clean up our onboarding docs repo? I'll paste the main file."],
  ["Assistant", "Sure, paste it over and I'll take a look at structure, dead links, and anything out of date."],
  [
    "Human",
    "[PASTED FILE: onboarding.md — 1400 lines]\n" +
      "## Setup\nStep 1: clone the repo.\nStep 2: install deps with npm install.\nStep 3: copy .env.example to .env.\n".repeat(40),
  ],
  [
    "Assistant",
    "Got it. A few things stand out: the Step 3 env instructions are duplicated three times with slightly different variable names, there's a broken link to the old Confluence space, and the Node version pinned in Step 2 is EOL. Want me to rewrite the whole doc or just patch those three things?",
  ],
  ["Human", "Rewrite the whole thing, and here's our style guide too."],
  [
    "Human",
    "[PASTED FILE: style-guide.md — 900 lines]\n" +
      "Voice: friendly, second person. Headings: sentence case. Code blocks: always fenced with language tag.\n".repeat(35),
  ],
  [
    "Assistant",
    "Thanks — I'll follow the style guide. Here's a first pass at the rewritten onboarding doc, restructured into Prereqs / Setup / First Run / Troubleshooting.",
  ],
  ["Human", "This is good but I realize I sent you the wrong onboarding file earlier, here's the real one, sorry."],
  [
    "Human",
    "[PASTED FILE: onboarding.md — 1400 lines]\n" +
      "## Setup\nStep 1: clone the repo.\nStep 2: install deps with npm install.\nStep 3: copy .env.example to .env.\n".repeat(40),
  ],
  [
    "Assistant",
    "No problem — this actually looks identical to the version you pasted earlier, so my rewrite above should already cover it. Let me know if anything differs and I'll adjust.",
  ],
  ["Human", "Can you also add a section on our release process?"],
  ["Assistant", "Sure — do you have a doc for that, or should I draft one from what you've told me about your CI setup so far?"],
  ["Human", "Draft one, keep it short."],
  [
    "Assistant",
    "Here's a short Release Process section: tag main, CI builds and runs the test suite, a maintainer approves the release PR, then it auto-deploys to staging before a manual promote to prod.",
  ],
  ["Human", "One more thing — paste in our whole API reference so you can cross-link it from the doc."],
  [
    "Human",
    "[PASTED FILE: api-reference.md — 3000 lines]\n" +
      "### GET /v1/users\nReturns a paginated list of users.\nParameters: limit, cursor.\nResponse: 200 OK with a users array.\n".repeat(90),
  ],
  [
    "Assistant",
    "Cross-linked the relevant endpoints from the API reference into the Troubleshooting and First Run sections. Given how large the reference file is, want me to just link out to it going forward instead of re-reading the whole thing each time?",
  ],
  ["Human", "Yeah good call. Last thing — can you summarize everything we've decided so far into a changelog entry?"],
  [
    "Assistant",
    "Here's the changelog entry: rewrote onboarding.md for clarity and to remove duplicated env instructions, fixed the broken Confluence link, updated the pinned Node version, added a new Release Process section, and linked out to the API reference instead of duplicating it.",
  ],
];
function demoText(): string {
  return DEMO.map((t) => t[0] + ": " + t[1]).join("\n\n");
}
document.getElementById("loadDemo")!.addEventListener("click", () => {
  (document.getElementById("transcript") as HTMLTextAreaElement).value = demoText();
  modelSelect.value = "200000";
  customField.style.display = "none";
  runAnalysis();
});
document.getElementById("clearBtn")!.addEventListener("click", () => {
  (document.getElementById("transcript") as HTMLTextAreaElement).value = "";
  document.getElementById("results")!.classList.remove("show");
});

// ---------- Rendering ----------
const svg = document.getElementById("chartSvg") as unknown as SVGSVGElement;
const tooltip = document.getElementById("tooltip") as HTMLElement;
const SVG_NS = "http://www.w3.org/2000/svg";

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const e = document.createElementNS(SVG_NS, tag) as SVGElementTagNameMap[K];
  for (const k in attrs) e.setAttribute(k, String(attrs[k]));
  return e;
}

function fmtTokens(v: number): string {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1) + "M";
  if (v >= 1000) return Math.round(v / 1000) + "K";
  return Math.round(v).toString();
}

function renderChart(turns: ParsedTurn[], analyzed: AnalysisResult, windowSize: number) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  const W = 900,
    H = 260,
    padL = 44,
    padR = 12,
    padT = 12,
    padB = 28;
  const plotW = W - padL - padR,
    plotH = H - padT - padB;

  const cumulative = analyzed.turns.map((t) => t.cumulativeTokens);
  const maxTokens = Math.max(windowSize, cumulative[cumulative.length - 1] || 1);
  const n = turns.length;

  const xAt = (i: number) => padL + (n <= 1 ? plotW / 2 : (plotW * i) / (n - 1));
  const yAt = (v: number) => padT + plotH - (plotH * v) / maxTokens;

  const zoneDefs = [
    { from: 0, to: 0.5, css: "var(--good-wash)" },
    { from: 0.5, to: 0.75, css: "var(--warning-wash)" },
    { from: 0.75, to: 0.9, css: "var(--serious-wash)" },
    { from: 0.9, to: Math.max(1, maxTokens / windowSize), css: "var(--critical-wash)" },
  ];
  zoneDefs.forEach((z) => {
    const v0 = z.from * windowSize,
      v1 = z.to * windowSize;
    const y1 = yAt(v1),
      y0 = yAt(v0);
    if (y0 - y1 < 0.5) return;
    svg.appendChild(el("rect", { x: padL, y: y1, width: plotW, height: Math.max(0, y0 - y1), fill: z.css }));
  });

  [0, 0.25, 0.5, 0.75, 1].forEach((frac) => {
    const v = frac * maxTokens;
    const y = yAt(v);
    svg.appendChild(el("line", { x1: padL, x2: padL + plotW, y1: y, y2: y, stroke: "var(--gridline)", "stroke-width": 1 }));
    const label = el("text", { x: padL - 8, y: y + 3, "text-anchor": "end", "font-size": 10, fill: "var(--text-muted)" });
    label.textContent = fmtTokens(v);
    svg.appendChild(label);
  });

  svg.appendChild(el("line", { x1: padL, x2: padL + plotW, y1: padT + plotH, y2: padT + plotH, stroke: "var(--baseline)", "stroke-width": 1 }));

  if (n === 0) return;

  let pathD = "M " + xAt(0) + " " + yAt(0);
  for (let i = 0; i < n; i++) pathD += " L " + xAt(i) + " " + yAt(cumulative[i]);
  const areaD = pathD + " L " + xAt(n - 1) + " " + yAt(0) + " Z";
  svg.appendChild(el("path", { d: areaD, fill: "var(--series-blue)", opacity: 0.1 }));
  svg.appendChild(el("path", { d: pathD, fill: "none", stroke: "var(--series-blue)", "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }));

  const hitGroup = el("g", {});
  turns.forEach((t, i) => {
    const cx = xAt(i),
      cy = yAt(cumulative[i]);
    const dot = el("circle", { cx, cy, r: 4, fill: "var(--series-blue)", stroke: "var(--surface-1)", "stroke-width": 2 });
    const hit = el("circle", { cx, cy, r: 14, fill: "transparent", "data-idx": i });
    (hit as unknown as HTMLElement).style.cursor = "pointer";
    hitGroup.appendChild(dot);
    hitGroup.appendChild(hit);

    const analyzedTurn = analyzed.turns[i];
    hit.addEventListener("pointerenter", () => showTooltip(i, t, analyzedTurn, cumulative[i], windowSize, cx, cy));
    hit.addEventListener("pointermove", () => showTooltip(i, t, analyzedTurn, cumulative[i], windowSize, cx, cy));
    hit.addEventListener("pointerleave", hideTooltip);
  });
  svg.appendChild(hitGroup);
}

function showTooltip(
  i: number,
  turn: ParsedTurn,
  analyzedTurn: AnalysisResult["turns"][number],
  cumTokens: number,
  windowSize: number,
  cx: number,
  cy: number,
) {
  const wrap = document.querySelector(".chart-svg-wrap") as HTMLElement;
  const rect = svg.getBoundingClientRect();
  const wrapRect = wrap.getBoundingClientRect();
  const scaleX = rect.width / 900,
    scaleY = rect.height / 260;
  const left = rect.left - wrapRect.left + cx * scaleX;
  const top = rect.top - wrapRect.top + cy * scaleY;
  tooltip.style.left = left + "px";
  tooltip.style.top = top + "px";
  const pct = (cumTokens / windowSize) * 100;
  tooltip.innerHTML = "";
  const valEl = document.createElement("div");
  valEl.className = "t-val";
  valEl.textContent = "Turn " + (i + 1) + " — " + turn.label;
  const subEl = document.createElement("div");
  subEl.className = "t-sub";
  subEl.textContent =
    "+" + fmtTokens(analyzedTurn.tokens) + " tokens this turn · " + fmtTokens(cumTokens) + " cumulative (" + pct.toFixed(0) + "% of window)" + (analyzedTurn.bloat ? " · bloat turn" : "");
  tooltip.appendChild(valEl);
  tooltip.appendChild(subEl);
  tooltip.style.opacity = "1";
}
function hideTooltip() {
  tooltip.style.opacity = "0";
}

// ---------- Recommendations ----------
const ICONS: Record<Recommendation["icon"], string> = {
  clock: "⏱",
  broom: "🧹",
  loop: "🔁",
  note: "📝",
  check: "✓",
};

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
    desc.textContent = r.description; // app-authored, not user input, but textContent stays the safe default
    body.appendChild(title);
    body.appendChild(desc);
    item.appendChild(icon);
    item.appendChild(body);
    list.appendChild(item);
  });
}

// ---------- Main analysis ----------
function describeScore(result: AnalysisResult): string {
  const pct = Math.round(result.peakUsagePct);
  switch (result.score.grade.key) {
    case "good":
      return `This conversation is well within budget — ${pct}% of the context window used, low bloat, no redundant pastes.`;
    case "warning":
      return `Getting there — ${pct}% of the window used. Worth tidying up before it compounds.`;
    case "serious":
      return `Context is working against you here — ${Math.round(result.bloatRatio * 100)}% bloat and ${pct}% window usage. Recall is likely already degrading.`;
    default:
      return `This conversation is deep into rot risk — ${pct}% of the window used. Start a fresh session before continuing.`;
  }
}

function runAnalysis() {
  const raw = (document.getElementById("transcript") as HTMLTextAreaElement).value;
  const emptyNote = document.getElementById("emptyNote")!;
  if (!raw || !raw.trim()) {
    emptyNote.classList.add("show");
    return;
  }
  emptyNote.classList.remove("show");

  const windowSize = currentWindowSize();
  const parsed = parseTranscript(raw);
  const turns = parsed.turns;
  const result = analyze(turns, { contextWindow: windowSize });

  document.getElementById("scoreNum")!.textContent = String(result.score.score);
  (document.getElementById("scoreNum") as HTMLElement).style.color = result.score.grade.colorVar;
  const dot = document.querySelector("#scoreLabel .dot") as HTMLElement;
  dot.style.background = result.score.grade.colorVar;
  (document.getElementById("scoreLabel") as HTMLElement).style.background = `color-mix(in srgb, ${result.score.grade.colorVar} 16%, transparent)`;
  document.getElementById("scoreLabelText")!.textContent = result.score.grade.label;
  (document.getElementById("meterFill") as HTMLElement).style.width = result.score.score + "%";
  (document.getElementById("meterFill") as HTMLElement).style.background = result.score.grade.colorVar;
  document.getElementById("scoreDesc")!.textContent = describeScore(result);

  document.getElementById("kpiUsage")!.textContent = Math.min(999, Math.round(result.peakUsagePct)) + "%";
  document.getElementById("kpiUsageNote")!.textContent = fmtTokens(result.totalTokens) + " est. tokens of " + fmtTokens(windowSize);
  document.getElementById("kpiBloat")!.textContent = Math.round(result.bloatRatio * 100) + "%";
  document.getElementById("kpiBloatNote")!.textContent = result.bloatCount + " turn(s) over ~" + fmtTokens(result.bloatThreshold);
  document.getElementById("kpiRedundant")!.textContent = String(result.redundantPairs.length);
  document.getElementById("kpiTurns")!.textContent = String(turns.length);
  document.getElementById("kpiTurnsNote")!.textContent = parsed.sawLabels ? "labeled turns detected" : "unlabeled blocks (approximate)";

  renderChart(turns, result, windowSize);
  renderRecommendations(result.recommendations);

  document.getElementById("shareScore")!.textContent = String(result.score.score);
  (document.getElementById("shareScore") as HTMLElement).style.color = result.score.grade.colorVar;
  document.getElementById("shareTitle")!.textContent = `${result.score.grade.label} — ${result.score.score}/100`;
  document.getElementById("shareSub")!.textContent = `${Math.round(result.bloatRatio * 100)}% bloat · ${Math.round(result.peakUsagePct)}% of context window used`;

  document.getElementById("results")!.classList.add("show");
  document.getElementById("results")!.scrollIntoView({ behavior: "smooth", block: "start" });
}

document.getElementById("analyzeBtn")!.addEventListener("click", runAnalysis);

// ---------- Share actions ----------
document.getElementById("copySummary")!.addEventListener("click", () => {
  const score = document.getElementById("scoreNum")!.textContent;
  const grade = document.getElementById("scoreLabelText")!.textContent;
  const bloat = document.getElementById("kpiBloat")!.textContent;
  const usage = document.getElementById("kpiUsage")!.textContent;
  const text = `My AI conversation scored ${score}/100 (${grade}) on Context Health Check — ${bloat} bloat, ${usage} of the context window used. Check yours with Context Health Check.`;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text);
  }
  const btn = document.getElementById("copySummary") as HTMLButtonElement;
  const original = btn.textContent;
  btn.textContent = "Copied ✓";
  setTimeout(() => {
    btn.textContent = original;
  }, 1400);
});

document.getElementById("downloadCard")!.addEventListener("click", () => {
  const target = document.getElementById("shareInner")!;
  const html2canvas = (window as unknown as { html2canvas?: (el: Element, opts: Record<string, unknown>) => Promise<HTMLCanvasElement> }).html2canvas;
  if (typeof html2canvas === "undefined") return;
  html2canvas(target, { backgroundColor: null, scale: 2 }).then((canvas) => {
    const link = document.createElement("a");
    link.download = "context-health-score.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  });
});
