import type { Grade, RiskZone, ScoreBreakdown } from "./types.js";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function riskZoneFor(peakUsagePct: number): RiskZone {
  if (peakUsagePct < 50) return { key: "good", colorVar: "var(--status-good)" };
  if (peakUsagePct < 75) return { key: "warning", colorVar: "var(--status-warning)" };
  if (peakUsagePct < 90) return { key: "serious", colorVar: "var(--status-serious)" };
  return { key: "critical", colorVar: "var(--status-critical)" };
}

function gradeFor(score: number): Grade {
  if (score >= 85) return { key: "good", label: "Healthy", colorVar: "var(--status-good)" };
  if (score >= 65) return { key: "warning", label: "Keep an eye on it", colorVar: "var(--status-warning)" };
  if (score >= 40) return { key: "serious", label: "At risk", colorVar: "var(--status-serious)" };
  return { key: "critical", label: "Critical", colorVar: "var(--status-critical)" };
}

export function computeScore(
  peakUsagePct: number,
  bloatRatio: number,
  redundantPairCount: number,
): ScoreBreakdown {
  const usagePenalty = clamp(peakUsagePct - 50, 0, 50) * 0.8; // max 40
  const bloatPenalty = bloatRatio * 30; // max 30
  const redundancyPenalty = Math.min(redundantPairCount * 8, 24);
  const score = Math.round(clamp(100 - usagePenalty - bloatPenalty - redundancyPenalty, 0, 100));
  return {
    score,
    grade: gradeFor(score),
    usagePenalty,
    bloatPenalty,
    redundancyPenalty,
  };
}
