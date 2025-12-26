# {{VOYAGER_MEAL_VISUALIZATION}} — `todo.md`

## TL;DR

Enable the visualization of carbohydrate intake (treatments) as a subplot within the `EventClusterCard` by plumbing treatment data from the Journal API down to the `ClusterEventsChart`.

## Invariants (do not change)

1.  **Strict TDD**: Red-Green-Refactor cycle must be followed for all component changes.
2.  **Visualization Consistency**: The carb subplot must align time-wise with the glucose chart (shared X-axis logic).
3.  **Graceful Degradation**: The chart must render correctly without errors if `treatments` are undefined or empty.
4.  **Unit Consistency**: Carb values are always in grams (g) and do not require unit conversion (unlike glucose).

## Assumptions & Scope

- **Assumption**: The `Journal` API response (or the mock data structure) contains or can be extended to contain a list of `treatments` (carbs/insulin).
- **Assumption**: The `Treatment` interface currently defined locally in `ClusterEventsChart.tsx` is the canonical shape for frontend visualization.
- **Scope**:
  - Refactoring `Treatment` type definition.
  - Updating `EventClusterCard` to accept and pass `treatments`.
  - Updating `JournalPage` to supply treatment data.
  - Verifying the rendering of the bar chart subplot.

## Objectives

1.  **Data Plumbing**: Successfully pass `Treatment[]` from `JournalPage` -> `EventClusterCard` -> `ClusterEventsChart`.
2.  **Type Safety**: Centralize the `Treatment` interface to prevent duplication and ensure type safety across components.
3.  **Visual Verification**: Ensure meal bars appear in the correct time slots relative to glucose events.
4.  **Test Coverage**: Achieve 100% unit test coverage for the new prop passing logic.

## Risks & Mitigations

- **Risk**: `treatments` data volume might be large, impacting performance if passed to every card.
  - **Mitigation**: Filter treatments at the `JournalPage` or `EventClusterCard` level to only pass relevant treatments (e.g., +/- 2 hours of cluster window) if performance degrades. _For now, pass all and let Chart filter._
- **Risk**: Timezone mismatches between treatments and glucose events.
  - **Mitigation**: Rely on ISO string normalization (UTC) already present in `ClusterEventsChart`.

## Method Outline

1.  **Type Refactor**: Extract `Treatment` interface to a shared location (`frontend/src/lib/agpUtils.ts` or similar) to allow `EventClusterCard` to import it without circular dependencies.
2.  **Component Update (EventClusterCard)**: Modify props interface and pass-through logic.
3.  **Integration (JournalPage)**: Mock/Fetch data and pass to child components.

## Implementation Notes

- **Shared Type**: Move `interface Treatment` from `ClusterEventsChart.tsx` to `frontend/src/lib/agpUtils.ts`.
- **Props**: `EventClusterCardProps` needs `treatments?: Treatment[]`.
- **Data Flow**:
  ```text
  JournalPage (fetch/mock treatments)
    -> EventClusterCard (prop: treatments)
       -> ClusterEventsChart (prop: treatments)
  ```
- **Mocking**: Since backend might not send treatments yet, create robust mock treatments in `frontend/src/mocks/journal.ts` or locally in `JournalPage` for the prototype.

## Acceptance Gates

- [ ] `EventClusterCard` tests pass with `treatments` prop.
- [ ] `ClusterEventsChart` renders separate grid for carbs when data is present.
- [ ] No console warnings regarding prop types or unique keys.
- [ ] `npm run lint` passes.

## “Make-sure-you” Checklist

- [ ] Did you remove the local `Treatment` interface definition from `ClusterEventsChart.tsx` after moving it?
- [ ] Did you update imports in `ClusterEventsChart.tsx`?
- [ ] Did you verify that `EventClusterCard` does _not_ mutate the treatments array?
- [ ] Did you check that the chart handles `treatments={undefined}` and `treatments={[]}` identically?

## Project Hygiene Prep

1.  **Branch Setup**:
    ```bash
    git checkout develop
    git pull origin develop
    git checkout -b feat/meal-visualization
    ```
2.  **Issue Tracking**: Create a task "Implement Carb Visualization in Journal" (Task 1.5).
3.  **Commit Convention**: Use `feat`, `refactor`, `test` prefixes.

## In-depth Test Plan

### 1. Unit Testing (`EventClusterCard.test.tsx`)

- **Prop Propagation**: Verify `treatments` passed to `EventClusterCard` are forwarded to `ClusterEventsChart`.
  - _Oracle_: Mock `ClusterEventsChart`, render parent, assert mock calls contain exact treatment object reference.
- **Empty State**: Verify passing `[]` or `undefined` works without error.

### 2. Property-Based Testing (Conceptual)

- **Invariant**: The number of bars rendered should never exceed the number of treatments with `carbs > 0` within the time window.
- **Generator**: `fc.array(fc.record({ date: fc.date(), carbs: fc.integer() }))`.

### 3. Metamorphic Testing

- **Time Shift**: If we shift all glucose events and treatment times by +1 hour, the relative distance between the glucose peak and the carb bar on the X-axis must remain constant (visual delta = 0).

### 4. Runtime Guards

- **Type Guard**: Ensure `carbs` is a number. If `NaN` or string, filter out before rendering to prevent ECharts crash.

## In-depth Engineering Plan

### Phase 1: Type Refactoring

1.  **Refactor**: Move `Treatment` interface from `frontend/src/components/journal/charts/ClusterEventsChart.tsx` to `frontend/src/lib/agpUtils.ts`.
2.  **Refactor**: Export `Treatment` from `agpUtils.ts`.
3.  **Refactor**: Update imports in `ClusterEventsChart.tsx`.

### Phase 2: EventClusterCard Implementation (TDD)

4.  **Red**: Update `frontend/src/components/journal/EventClusterCard.test.tsx`.
    - Add import for `Treatment`.
    - Create a test case: "passes treatments to the chart when provided".
    - Mock `ClusterEventsChart` (already mocked, ensure it captures props).
    - Assert `ClusterEventsChart` is called with `treatments`.
5.  **Green**: Update `frontend/src/components/journal/EventClusterCard.tsx`.
    - Import `Treatment`.
    - Update `EventClusterCardProps` to include `treatments?: Treatment[]`.
    - Pass `treatments` prop to `<ClusterEventsChart />`.
6.  **Refactor**: Run lint and format.

### Phase 3: JournalPage Integration

7.  **Mock Data**: In `frontend/src/pages/JournalPage.tsx`, create a temporary `mockTreatments` array (or extend the mock journal response if possible) containing valid carb entries.
    - _Note_: Ensure dates align with the mock cluster dates (e.g., Jan 1, 2000 normalization might be tricky if raw data uses real dates. The chart handles normalization, so pass ISO strings).
8.  **Integration**: Pass `treatments={mockTreatments}` (or real data) to `<EventClusterCard />` in the render loop.
9.  **Verification**: Run application and verify visual output.
