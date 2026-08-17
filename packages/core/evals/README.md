# Evals

A separate layer of testing from `test/` - not "does `computeScore(50, 0.2, 1)` return the right number" (that's what the Vitest suite already covers exhaustively), but "given a *realistic conversation shape*, does the engine's overall judgment make sense."

## Why this exists, separately from unit tests

Unit tests catch regressions in individual functions. They don't catch the case where every function is individually correct but the *combination* produces a bad real-world call - e.g. a threshold that's technically right but never fires on conversations that actually look like this. Evals close that gap: each case is a plausible conversation (a file paste, an accidental re-send, a long back-and-forth, a near-full window) with an expected *outcome* - a score range, a risk zone, which recommendations should or shouldn't fire - rather than an expected internal value.

This is also the harness that caught a real miscalibration in its own test data while it was being built: an eval case assumed pure context-window overflow alone would push the grade to "Critical," but `usagePenalty` caps at 40, so overflow alone can only reach "At risk" - a bloat or redundancy penalty has to stack on top to reach "Critical." `riskZone` (raw % of window used) and `grade` (the capped score) are deliberately different signals for exactly this reason. That's now documented in [`cases.ts`](./cases.ts) instead of being a surprise.

## Running it

```bash
npm run eval -w @context-health/core
```

Prints a pass/fail line per case, and a summary count. Exits non-zero if anything fails, so it's CI-gated (`.github/workflows/ci.yml` runs it right after the unit test suite).

## Adding a case

Add an entry to [`cases.ts`](./cases.ts): a realistic `turns` array plus an `expect` block of loose, business-level assertions (`scoreRange`, `grade`, `riskZone`, bloat/redundancy bounds, which recommendation IDs should or shouldn't be present). Prefer ranges and "did X fire" checks over exact-value assertions - that's what makes this a different tool from the unit tests, not a duplicate of them.
