# GoodNumbers Clinical Specification & Safety Thresholds

This document serves as the single source of truth for all medical thresholds, target ranges, and insight generation logic within the GoodNumbers system.

## 1. Core Clinical Thresholds

These values are the basis for the `InsightGenerator` classes located in `backend/src/lib/insights/`.

- **TBR_LIMIT (Time Below Range):** `0.04` (4%) - _Absolute safety threshold._
- **TIR_TARGET (Time in Range):** `0.70` (70%) - _Standard clinical stability target._
- **TITR_ADVANCED_GOAL (Time in Tight Range):** `0.40` (40%) - _Optimization goal._
- **Hypoglycemia Boundary:** `< 70 mg/dL`
- **Hyperglycemia Boundary:** `> 180 mg/dL`

## 2. Insight Generation Hierarchy

The system evaluates user data in a strict, safety-first order:

1.  **Safety First (Hypoglycemia):** Is Time Below Range > 4%? If yes, always issue a `SERIOUS` or `CRITICAL` warning, regardless of a "good" average or GMI.
2.  **Stability Second (Time in Range):** Is Time in Range > 70%?
3.  **Optimization Third (Tight Range):** Are they achieving flat lines within 70-140 mg/dL?

## 3. Insight Priorities

- `CRITICAL`: Urgent medical safety (e.g., TBR >= 10% or Average < 70 mg/dL).
- `SERIOUS`: Elevated risk requiring immediate attention (e.g., TBR between 4% and 10%).
- `IMPORTANT`: Major clinical milestones or warnings (e.g., Hitting TIR targets).
- `INFO`: General optimization advice.
