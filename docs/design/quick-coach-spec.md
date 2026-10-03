# Component Specification: Quick Coach Experience & Dashboard Ingress

**Component Name:** `QuickCoachBannerCard`, `QuickCoachPage`, `QuickCoachStoryPlayer`, `QuickCoachVoiceNegotiation`  
**Routes:**

- `/dashboard` (Dashboard with on-demand `QuickCoachBannerCard`)
- `/journal/:journalId/loading?target=coach` (Dedicated loading & hand-off transition)
- `/coach/:journalId` (Standalone mobile route outside global desktop layout)  
  **Tech Stack:** React (Functional), TypeScript, Tailwind CSS, ECharts (`echarts-for-react`), Web Speech API (`SpeechSynthesis`, `SpeechRecognition`)  
  **Design Tokens:** Mesa Palette (Primary Terracotta `#D9775B`, Petrol Blue `#2C4C5B`, Canvas Warm `#FBF9F5`, Sand `#E8E1D9`, Target Forest `#54A67A`)

---

## 1. Design Principles & Goals

1. **Combating Data Fatigue:** Zero distractions. No global navigation bars, headers, footers, or disclaimer banners. Focuses exclusively on the single most clinically significant glycemic cluster of the week.
2. **Audio-Visual Synchronicity:** Voice narration accompanies animated spline lines that stack sequentially on the ECharts canvas (`DRAW_MEAN` $\to$ `DRAW_DAY` $\to$ `DRAW_TREATMENTS`).
3. **Voice Negotiation:** Low-friction push-to-talk microphone interaction with an empathetic coach persona, converting subjective reflections into one concrete weekly micro-habit.
4. **Single-Tap Handshake:** The sticky bottom action bar commits the agreed habit directly into `Journal.goalsForNextWeek` without full journal editing.

---

## 2. Layout & Visual Hierarchy

```
+------------------------------------------------------+
| ⚡ Quick Coach              [Sep 8 – Sep 14] [Full]  |  <- Compact Header
+------------------------------------------------------+
| ✨ Primary Weekly Hotspot  High Blood Sugar Pattern  |
| Onset ~13:30 • Occurred 3x                           |  <- Compact Hotspot Banner (~36px)
+------------------------------------------------------+
| 🔊 Multistep Story Player                            |
| [==================================================] |
| | Top Grid: Blood Glucose Time Series (with Target) | |  <- 3-Tier Synchronized
| | Middle Grid: Carbs (g) Bars                      | |     ECharts Canvas (260px)
| | Bottom Grid: Insulin (u) Bars                    | |
| [==================================================] |
| Subtitle: "Notice the sharp peak after lunch..."     |  <- Dynamic Narration Subtitle
| [Step 1: Mean] [Step 2: Tue] [Step 3: Wed] [Step 4]  |  <- Step Pill Navigation
| [ ◀ Prev ] [ ▶ Play ] [ Next ▶ ] [ ↺ Restart ]       |  <- Accessible Step Controls
+------------------------------------------------------+
| ✨ Voice Habit Negotiation         AI Coach Active   |
| Coach: "What is one small micro-habit to test?"      |
|                                                      |
| Patient: "Walk 10m after lunch"                      |  <- Voice / Text Chat Feed
| Coach: "That's a terrific micro-habit!"              |
|                                                      |
| [✓ Proposed Weekly Micro-Habit: "10m lunch walk"]    |  <- Habit Proposal Card
| [Set as Weekly Micro-Habit]                          |
| [ Type habit...            ] [ Send ] [ 🎤 PTT ]     |
+------------------------------------------------------+
| Agreed Micro-Habit: "10m lunch walk" [Accept & Save] |  <- Sticky Action Bar
+------------------------------------------------------+
```

---

## 3. Component Breakdown

### 3.0 `QuickCoachBannerCard` (Dashboard Ingress & On-Demand Trigger)

- **Location:** Embedded in `DashboardPage.tsx` above the `Past weeks` section.
- **Visual Presentation:**
  - Warm gradient container (`from-orange-50 via-amber-50/40 to-white`) with rounded corners (`rounded-xl`), soft shadow (`shadow-md`), and subtle warm border (`border-orange-200/80`).
  - Left icon badge: `w-14 h-14 bg-orange-100` housing a solid filled `Zap` icon in Mesa terracotta (`#D9775B`).
  - Category pill: `Audio & Voice` in uppercase bold tracking.
  - Headline: _"Quick Coach: 3-Minute Glycemic Debrief"_ (`text-xl font-bold text-gray-900`).
  - Copy: _"Distill your last 7 days of CGM data into a single high-impact pattern with an audio breakdown and micro-habit negotiation."_
- **Action Button (`⚡ Start Quick Coach (3 min)`):**
  - Styled with primary terracotta (`bg-mesa-primary hover:bg-primary-hover text-white font-semibold`).
  - Submitting state: Disabled, `aria-busy={true}`, renders spinning `Loader2` and text _"Preparing..."_.
  - Disabled state: When parent dashboard reports an active in-progress session (`isProcessing={true}`), disabled with label _"Session in progress..."_.
- **Error & Recovery UI:**
  - Accessible `role="alert"` and `aria-live="polite"` error container.
  - If rejected with `code === "NIGHTSCOUT_REQUIRED"` (missing CGM credentials), renders an actionable recovery link: `Configure Nightscout in Settings →` pointing directly to `/setup`.
- **Target Redirection:** Dispatches `POST /api/coach/sessions` and upon receiving 201 Created immediately redirects to `/journal/:id/loading?target=coach`.

### 3.1 `QuickCoachPage` (Shell Container)

- **Route:** `/coach/:journalId` wrapped in `ProtectedRoute`, rendered outside desktop `Layout.tsx`.
- **States:**
  - `isLoading`: Displays Mesa terracotta loading spinner.
  - `error`: Displays red alert triangle and "Return to Dashboard" link.
  - `emptyClusters`: Displays celebratory empty state (_"No Recurring Patterns Detected!"_) if the weekly CGM had no recurring clusters.
  - `saveSuccess`: Opens fullscreen celebration modal with confetti emojis and dashboard exit links.
- **Viewport Optimization:** Clean mobile-optimized height budget (< 500px for above-the-fold content) so the header, compact hotspot banner, 260px chart canvas, and controls fit neatly without auto-scroll clipping on mobile viewports.

### 3.2 `QuickCoachStoryPlayer` (Multistep Audio-Visual Player)

- **Layout:** 3-tier synchronized ECharts grid visually matching the journal cluster graph:
  - **Top Grid (50%)**: Blood glucose time series with target range background shading (70–180 mg/dL or 3.9–10.0 mmol/L). Includes dynamic Y-axis min/max scaling clamped to 2.0 mmol/L or 40 mg/dL.
  - **Middle Grid (18%)**: Aligned Carbs bar chart (amber `#E09F3E`) synchronized to the common time domain.
  - **Bottom Grid (18%)**: Aligned Insulin bar chart (teal `#3D8B96`) synchronized to the common time domain.
- **Multistep Day-by-Day Progression:**
  - **Step 1 (The Big Picture / Mean Trend):** Highlights the bold average glucose curve alone across all event days without carb/insulin noise.
  - **Steps 2..N (Day by Day):** Walks through each day chronologically (e.g., Tuesday, Wednesday, Friday), dynamically animating in that day's glucose trace, meal bolus bars, carb entries, and narration.
  - **Final Step (Wrap-up):** Summarizes the full picture with all days combined and displays the _"Ready for reflection"_ indicator.
- **Navigation Controls:** Accessible Step Pills, Prev/Next buttons, Play/Pause toggle, and Restart button. Automatically pins chart into viewport via `window.scrollTo` on step transition.
- **Speech Playback & Auto-Advance Synchronization:** Native browser `window.speechSynthesis` synchronized with step progression. Auto-advance steps dynamically wait for speech completion (`SpeechSynthesisUtterance.onend`) and text length (~380ms/word with 5.5s minimum window) to prevent audio cut-offs.
- **Fallback Subtitle Drawer:** Dynamic narration subtitle box displaying spoken text in real-time.

### 3.3 `QuickCoachVoiceNegotiation` (Interactive Coach)

- **AI Coach Persona:** Friendly, expert medical healthcare professional specializing in Type 1 Diabetes management.
- **Dynamic Initial Prompt:** Displays Gemini's personalized `initialPrompt` extracted from the cluster analysis, providing data-driven reflection questions tailored to the user's specific pattern.
- **Push-to-Talk & Real-time STT:** Browser `SpeechRecognition` / `webkitSpeechRecognition` configured with `continuous = true` and `interimResults = true`, populating speech text live in real-time as the user speaks (optimized for Chrome on Android / Desktop).
- **Text Fallback:** Keyboard-accessible input box with Enter key submission and Send button.
- **Fluid Multi-Turn Chat Feed:** Conversational chat interface displaying user and model bubbles naturally without popping proposed goal cards automatically after every turn.
- **Transcript Micro-Goal Synthesis:** Features a dedicated `🎯 Draft Micro-Goal from Conversation` button. When clicked, it sends the full `chatHistory` transcript to `POST /api/journals/:id/clusters/:clusterId/save-insight` for Gemini to synthesize a single, actionable 1-sentence micro-habit based on the conversation's conclusion.
- **Investigative Tool Calling:** Equipped with 10 server-side function calling tools (comparing recurring daily windows, profile switch history, successful benchmark days, post-meal peaks, treatment notes, automated loop delivery, and prior context) executed locally via `dispatcher.ts` with sub-second cached responses.
- **Unit-Free Spoken Audio:** Speech synthesis (`speakReply`) and LLM prompt guidelines (`CLUSTER_AI_CHAT_PROMPT`) explicitly omit unit suffixes (e.g. `mmol/L` or `mg/dL`) when reading blood sugar values out loud for clean, natural-sounding voice playback.
- **Habit Review & Handshake Card:** Displays the drafted micro-habit in target forest green (`#54A67A`) with a single-tap `Set as Weekly Micro-Habit` button to lock it into the sticky action bar and trigger celebration.

---

## 4. Design Tokens Reference

| Element                    | Color Hex                  | Tailwind Equivalent / Usage        |
| -------------------------- | -------------------------- | ---------------------------------- |
| Background Canvas          | `#FBF9F5`                  | `bg-[#FBF9F5]`                     |
| Card Containers            | `#FFFFFF`                  | `bg-white border-[#E8E1D9]`        |
| Primary Accent / Mean High | `#D9775B`                  | `text-[#D9775B] bg-[#D9775B]`      |
| Deep Petrol Header / Pins  | `#2C4C5B`                  | `text-[#2C4C5B] bg-[#2C4C5B]`      |
| Plum (Hypo Pattern)        | `#8A4F7D`                  | `text-[#8A4F7D] bg-[#8A4F7D]`      |
| Target Range Shading       | `rgba(84, 166, 122, 0.08)` | Target glucose zone (70–180 mg/dL) |
| Habit Confirmation Card    | `#54A67A`                  | `bg-[#54A67A]/10 text-[#54A67A]`   |
