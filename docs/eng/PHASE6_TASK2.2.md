# GoodNumbers Average Glucose Insight — `todo.md`

## TL;DR

Implement a clinically-grounded "Average Glucose" insight generator that contextualizes mean glucose with hypoglycemia exposure (Time Below Range) to prevent the "Flaw of Averages," utilizing a strict Safety > Stability > Optimization hierarchy.

## Invariants (do not change)

1.  **No Medical Advice**: Insights must frame observations as data points for discussion with a doctor (e.g., "Ask your doctor," not "Lower your basal").
2.  **Safety Primacy**: Hypoglycemia warnings (Safety) must **always** override stability or optimization praise.
3.  **Sanitization**: Output strings must be free of HTML/Markdown injection vectors (strict text only).
4.  **Unit Consistency**: All glucose values in text must respect the user's `preferred_units` (mg/dL vs mmol/L).

## Assumptions & Scope

- **Assumption**: The `AnalysisResult` object passed to the generator contains `avgGlucose` (number), `lowPercentage` (number), `highPercentage` (number), and `timeInRange` (number).
- **Assumption**: `lowPercentage` represents Time Below Range (TBR) defined as < 70 mg/dL.
- **Assumption**: `GlucoseUnits` enum and `u()` helper function are available in `@/utils/text` or similar path.
- **Scope**:
  - **In**: New TypeScript module in `backend/src/lib/insights/`.
  - **Out**: Integration into the main aggregation pipeline.
  - **Out of Scope**: Frontend UI changes (existing components render generic `Insight` objects).

## Objectives

1.  **Clinical Accuracy**: Correctly categorize 100% of inputs into one of 5 defined clinical states (Critical Low, Masked Low, Elevated, Standard, Optimal).
2.  **Safe Contextualization**: Zero instances where a user with TBR > 4% receives a "Success" or "Optimal" message without qualification.
3.  **Test Coverage**: 100% branch coverage including boundary values (e.g., exactly 4.0% TBR, exactly 70 mg/dL).

## Risks & Mitigations

- **Risk**: "Flaw of Averages" – praising a user for a 100 mg/dL average when they are actually swinging between 40 and 160.
  - _Mitigation_: The **Masked Hypoglycemia** state (State B) explicitly traps this condition (Avg < 140 && TBR > 4%) and flags it as CRITICAL.
- **Risk**: User alarm fatigue from "Critical" alerts on marginally low days.
  - _Mitigation_: Softened, supportive language ("GoodNumbers" voice) defined in the spec, avoiding clinical jargon like "physiological floor."

## Method Outline

1.  **Mechanism**: Implement a factory function `createAvgGlucoseInsight` implementing the `InsightGenerator` interface.
2.  **Logic Flow**:
    - IF `avg < 70`: **State A (Critical Low)**
    - ELSE IF `avg < 140` AND `TBR > 4%`: **State B (Masked Low)**
    - ELSE IF `avg > 180`: **State C (Elevated)**
    - ELSE IF `avg 140-180` AND `TBR <= 4%`: **State D (Standard)**
    - ELSE (`avg 70-140` AND `TBR <= 4%`): **State E (Optimal)**
3.  **Trade-offs**: We use fixed clinical thresholds (70/140/180 mg/dL) rather than user-specific profile targets for _general_ insights to ensure safety baselines are met regardless of aggressive user settings.

## Implementation Notes

- **Path**: `backend/src/lib/insights/average-glucose.ts`
- **Dependencies**:
  - `@/types/nightscout.d` (Interfaces)
  - `../../oref0-autotune/gn-constants` (Constants: `GLUCOSE_RANGES`)
  - `@/utils/text` (Formatter `u()`)
- **Thresholds**:
  - `TBR_LIMIT`: 4.0 (percentage)
  - `HYPO_LIMIT`: 70 mg/dL
  - `TIGHT_LIMIT`: 140 mg/dL
  - `HIGH_LIMIT`: 180 mg/dL
- **API Contract**:
  ```typescript
  export function createAvgGlucoseInsight(
    analysis: AnalysisResult,
    units: GlucoseUnits,
  ): InsightGenerator;
  ```

## Acceptance Gates

- [ ] **State A**: Input `{ avg: 65, tbr: 5% }` returns Priority `CRITICAL` + Warning text.
- [ ] **State B**: Input `{ avg: 110, tbr: 10% }` returns Priority `CRITICAL` + "Hidden Lows" text.
- [ ] **State E**: Input `{ avg: 110, tbr: 2% }` returns Priority `ALWAYS_INCLUDE` + "Optimal" text.
- [ ] **Formatting**: All numbers in text match the provided `units` argument.

## "Make-sure-you" Checklist

- [ ] Use `u()` helper for **all** glucose values in strings to handle mmol/L conversion automatically.
- [ ] verify `lowPercentage` in `AnalysisResult` is 0-100 scale or 0-1 scale. **Assume 0-100** based on prompt context (string says `${lowPercentage}%`).
- [ ] Ensure `Priority` is imported from types, not hardcoded strings.

## Project Hygiene Prep

1.  **Branch**: `feat/average-glucose-insight`
2.  **Issue**: Link to `PHASE6_TASK2.2`
3.  **Test Setup**: Ensure `vitest` is running in watch mode on `backend/tests/unit`.

## In-depth Test Plan

### Unit Testing (`backend/tests/unit/insights/average-glucose.test.ts`)

- **Framework**: Vitest
- **Strategy**: Table-driven tests covering the State Matrix.

| Case ID | Avg Glucose | TBR (%) | Expected State   | Expected Priority | Key Phrase         |
| :------ | :---------- | :------ | :--------------- | :---------------- | :----------------- |
| **T1**  | 65          | 8       | A (Critical Low) | CRITICAL          | "dangerously low"  |
| **T2**  | 120         | 15      | B (Masked Low)   | CRITICAL          | "hiding a problem" |
| **T3**  | 250         | 0       | C (Elevated)     | ALWAYS_INCLUDE    | "higher than"      |
| **T4**  | 160         | 2       | D (Standard)     | ALWAYS_INCLUDE    | "solid result"     |
| **T5**  | 110         | 1       | E (Optimal)      | ALWAYS_INCLUDE    | "fantastic"        |
| **T6**  | 140         | 4.0     | D (Standard)     | ALWAYS_INCLUDE    | Boundary Check     |
| **T7**  | 140         | 4.1     | ? (Check logic)  | ?                 | Boundary Check     |

### Property-Based Testing

- **Property**: "If TBR > 4% AND Avg < 140, Priority MUST be CRITICAL."
- **Generator**: Random `avg` (40-400), Random `tbr` (0-100).
- **Invariant Check**: `assert(result.priority === Priority.CRITICAL)` whenever inputs satisfy the condition.

### Metamorphic Testing

- **Transformation**: Increase `TBR` significantly while keeping `avg` constant (physiologically unlikely but mathematically possible in inputs).
- **Relation**: The Insight Priority should **never decrease** (e.g., from CRITICAL to INFO) as risk factors (TBR) increase.

## In-depth Engineering Plan

### Step 1: Interface & Skeleton

- Create `backend/src/lib/insights/average-glucose.ts`.
- Import dependencies.
- Define `createAvgGlucoseInsight` skeleton.
- Define constants (`TBR_THRESHOLD = 4`, `HYPO_LIMIT = 70`, etc.).

### Step 2: Implementation (TDD)

- **Cycle 1 (State A & B - Safety)**:
  - Write test T1 & T2.
  - Implement logic for `avg < 70` and `avg < 140 && tbr > 4`.
  - Verify texts match the "Softened" copy from design.
- **Cycle 2 (State C, D, E - Standard)**:
  - Write tests T3, T4, T5.
  - Implement remaining `else if` blocks.
- **Cycle 3 (Formatting)**:
  - Write test checking `mmol/L` output.
  - Ensure `u()` is applied to `[AVG_VALUE]`.

### Step 3: Integration

- Open `backend/src/lib/insights/aggregate.ts` (or wherever the main insight loop exists).
- Import `createAvgGlucoseInsight`.
- Add to the array of generators:
  ```typescript
  const generators = [
    // ... existing
    createAvgGlucoseInsight(analysis, user.preferredUnits),
  ];
  ```

### Step 4: Verification

- Run `npm run test:backend:ai`.
- Manual check: Verify `backend/src/worker.ts` builds without type errors.
