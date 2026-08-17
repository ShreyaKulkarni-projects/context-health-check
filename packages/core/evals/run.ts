import { analyze } from "../src/analyzer.js";
import { EVAL_CASES, type EvalCase } from "./cases.js";

interface CaseResult {
  id: string;
  description: string;
  passed: boolean;
  failures: string[];
}

function runCase(c: EvalCase): CaseResult {
  const result = analyze(c.turns, { contextWindow: c.contextWindow });
  const failures: string[] = [];
  const e = c.expect;

  if (e.scoreRange) {
    const [min, max] = e.scoreRange;
    if (result.score.score < min || result.score.score > max) {
      failures.push(`score ${result.score.score} not in [${min}, ${max}]`);
    }
  }
  if (e.grade && result.score.grade.key !== e.grade) {
    failures.push(`grade "${result.score.grade.key}" != expected "${e.grade}"`);
  }
  if (e.riskZone && result.riskZone.key !== e.riskZone) {
    failures.push(`riskZone "${result.riskZone.key}" != expected "${e.riskZone}"`);
  }
  if (e.minBloatRatio !== undefined && result.bloatRatio < e.minBloatRatio) {
    failures.push(`bloatRatio ${result.bloatRatio.toFixed(2)} < min ${e.minBloatRatio}`);
  }
  if (e.maxBloatRatio !== undefined && result.bloatRatio > e.maxBloatRatio) {
    failures.push(`bloatRatio ${result.bloatRatio.toFixed(2)} > max ${e.maxBloatRatio}`);
  }
  if (e.redundantPairCount !== undefined && result.redundantPairs.length !== e.redundantPairCount) {
    failures.push(`redundantPairs.length ${result.redundantPairs.length} != expected ${e.redundantPairCount}`);
  }

  const firedIds = result.recommendations.map((r) => r.id);
  for (const id of e.firedRecommendationIds ?? []) {
    if (!firedIds.includes(id as (typeof firedIds)[number])) {
      failures.push(`expected recommendation "${id}" to fire, but it didn't (fired: ${firedIds.join(", ") || "none"})`);
    }
  }
  for (const id of e.notFiredRecommendationIds ?? []) {
    if (firedIds.includes(id as (typeof firedIds)[number])) {
      failures.push(`expected recommendation "${id}" NOT to fire, but it did`);
    }
  }

  return { id: c.id, description: c.description, passed: failures.length === 0, failures };
}

function main() {
  const results = EVAL_CASES.map(runCase);
  const passed = results.filter((r) => r.passed).length;

  console.log(`\nContext Health Check - core scoring evals`);
  console.log("=".repeat(50) + "\n");

  for (const r of results) {
    console.log(`[${r.passed ? "PASS" : "FAIL"}] ${r.id}`);
    if (!r.passed) {
      console.log(`       ${r.description}`);
      for (const f of r.failures) console.log(`       - ${f}`);
    }
  }

  console.log(`\n${passed}/${results.length} cases passed\n`);

  if (passed < results.length) {
    process.exitCode = 1;
  }
}

main();
