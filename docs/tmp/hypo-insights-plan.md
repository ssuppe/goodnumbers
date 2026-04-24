# Plan: Advanced Profile-Aware Hypoglycemia Insights (v3)

## Objective
Implement a "Clinical Diagnostic" engine for hypoglycemia clusters, using OpenAPS-inspired math (IOB, COB, BGI) to provide the AI with high-signal "Ground Truth" about why a pattern is occurring.

## 1. The Math Layer
We will implement decay models for both "fuel" (carbs) and "brakes" (insulin):
- **IOB (Insulin On Board)**: Exponential decay based on user's `DIA` (Duration of Insulin Action).
- **COB (Carbs On Board)**: Linear or exponential decay based on a standard absorption window (e.g., 3-4 hours).
- **BGI (Blood Glucose Impact)**: The expected drop calculated as `-InsulinActivity * ISF`.

## 2. The Diagnostic Layer (Refined)
For each low event, we analyze the relationship between IOB and COB in the 3-hour lookback window:

| Finding | Indicators | Clinical Meaning |
| :--- | :--- | :--- |
| **Insulin Stacking** | High IOB + **Low COB** | Insulin was pushed (manual or loop) when there was no food left to buffer it. |
| **Carb Mismatch** | High IOB + **High COB** | Insulin was given for a meal, but the dose was too high or the timing was too early (insulin outpaced carbs). |
| **Basal/Sens Drift** | **Low IOB** + Low COB | Lows occurring on "empty" system. Suggests basal is too high or exercise increased sensitivity. |
| **Overtreated High** | High Rise (Deviation) followed by Crash | A "rebound" pattern where a high was aggressively corrected, leading to a low. |

## 3. Implementation Steps

### Phase 1: Engine Updates (`backend/src/lib/insights/cluster.ts`)
- [ ] Implement `calculateExponentialIOB(insulin, minsAgo, dia)`.
- [ ] Implement `calculateCOB(carbs, minsAgo, absorptionTime)`.
- [ ] Update `generateHypoInsights` to calculate the **IOB/COB Balance** at the start of each low.
- [ ] Aggregate findings across the cluster (e.g., "60% of these lows occur when IOB is high but COB is nearly zero").

### Phase 2: Worker Integration (`backend/src/worker.ts`)
- [ ] Ensure `profiles` are passed to `generateClusterInsights`.

### Phase 3: AI Prompt Update (`backend/src/lib/ai/prompts.ts`)
- [ ] Feed these IOB/COB ratios to the AI so it can say things like: *"I noticed these lows happen after your lunch insulin has finished its peak work, but before your next meal."*

## Benefits
- **Differentiates Timing vs. Dose**: COB tracking allows us to tell the user if they bolused too *much* or just too *early*.
- **Handles SMBs & Loops**: Loops are essentially "dynamic bolusers"—by looking at the IOB/COB balance, we can see if the loop was tricked by a sensor error or a missing carb entry.
