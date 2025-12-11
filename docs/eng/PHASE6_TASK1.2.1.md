# PHASE 6, TASK 1.2.1: Ambulatory Glucose Profile (AGP) Data Processor Design

## 1. Objective

To implement a secure, statistically accurate, and clinically correct backend utility for calculating the Ambulatory Glucose Profile (AGP) data structure from 7 days of raw Nightscout glucose entries. This data will directly populate the high-fidelity chart in the `JournalPage` frontend and replaces the current placeholder/debug data.

This task is crucial as it addresses the immediate production issue of the chart displaying "No AGP data available" and rectifies several flaws identified in the original Proof-of-Concept (PoC) related to timezone handling and statistical reliability.

## 2. Architecture and Data Flow

### 2.1 Component: `backend/src/lib/agp/calculateAgp.ts`

This new utility will contain all the core statistical logic and will be purely functional, accepting inputs and returning the AGP array, ensuring it is isolated and easily testable.

### 2.2 Execution Flow

1.  **Worker Initiation:** The `backend/src/worker.ts` receives a `journalId` job.
2.  **Data Fetching:** The worker fetches 7 days of `entries` (glucose data) and the user's `profiles` (which contains the timezone information) from Nightscout.
3.  **Data Processing:** The worker passes the raw `entries` and the user's timezone to `calculateAgp.ts`.
4.  **Data Storage:** `calculateAgp.ts` returns the final AGP data array (24 hourly objects). The worker saves this array directly into the `journal.agpChartData` column in the database.
5.  **Frontend Consumption:** The frontend fetches the `journal` data, and the `JournalPage` uses the new `normalizeAgpData` utility (which includes safety checks) to prepare the data for the `AgpChart`.

## 3. Core Requirements and Implementation Logic

The implementation must adhere to the following strict rules for clinical correctness and data integrity:

### 3.1 Timezone Handling (Critical Correction)

- **Requirement:** The AGP calculation must bin data based on the **user's local time (Time of Day)**, not the backend server's time (UTC).
- **Implementation:** The `calculateAgp.ts` utility must receive the timezone string (e.g., `America/New_York`) extracted from the Nightscout `profiles` data. For every UTC-stamped glucose reading, the utility must first convert the timestamp to the user's local time before extracting the hour-of-day for binning.

### 3.2 Time Binning

- **Requirement:** Data must be grouped into 24 distinct, one-hour bins, representing the hours of the day (00:00 to 23:59).
- **Implementation:** The utility will initialize an array of 24 empty arrays (one for each hour). Each glucose reading will be placed into the appropriate bucket based on its _localized_ hour.

### 3.3 Statistical Method (Clinical Standard)

- **Requirement:** Calculate the **5th, 25th, 50th (Median), 75th, and 95th** percentiles, as well as the **Mean**.
- **Implementation:** The **R-7 method** (Hazen's method/Linear Interpolation with Rounding) will be used for percentile calculation, which is the industry standard (used by `d3.quantile` and Excel's `PERCENTILE.INC`). The formula for the index is $P = (N - 1) p + 1$.

### 3.4 Minimum Data Threshold (Data Integrity)

- **Requirement:** An hourly bin must meet a minimum data coverage for percentiles to be considered statistically reliable.
- **Threshold:** We require **> 70% data capture over the 7-day period**.
  - Assuming a 5-minute sampling rate: $12 	ext{ points/hour} 	imes 7 	ext{ days} = 84 	ext{ total expected points}$.
  - Minimum Data Threshold = $84 	imes 0.70 = 58.8$ (rounded up to **59 data points**).
- **Implementation:** If an hourly bin contains **fewer than 59** glucose entries, the calculated percentile fields (`p5`, `p25`, `median`, `p75`, `p95`) for that hour will be set to `null` to indicate insufficient data. The `mean` value may still be calculated if any data exists.

### 3.5 Output Structure

The final output will be an array of 24 objects:

```typescript
interface AgpDataPoint {
  time: string; // e.g., '00:00', '01:00', etc.
  p5: number | null;
  p25: number | null;
  median: number | null;
  mean: number | null;
  p75: number | null;
  p95: number | null;
}
```

## 4. TDD Plan

| Step  | File                                       | Description                                                                                                        | Status  |
| :---- | :----------------------------------------- | :----------------------------------------------------------------------------------------------------------------- | :------ |
| **0** | `backend/src/lib/agp/`                     | Create directory.                                                                                                  | Pending |
| **1** | `backend/src/lib/agp/calculateAgp.test.ts` | Write failing tests to validate R-7 percentile, time binning (with localization mock), and the 59-point threshold. | Pending |
| **2** | `backend/src/lib/agp/calculateAgp.ts`      | Implement the AGP calculation utility, including moment-timezone (or similar) for localization logic.              | Pending |
| **3** | `backend/src/worker.ts`                    | Integrate `calculateAgp.ts` by passing `entries` and `profiles` and saving the result to `agpChartData`.           | Pending |
