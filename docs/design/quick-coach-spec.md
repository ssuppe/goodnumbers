# Component Specification: Quick Coach Mobile Experience

**Component Name:** `QuickCoachPage`, `QuickCoachStoryPlayer`, `QuickCoachVoiceNegotiation`  
**Route:** `/coach/:journalId` (Standalone mobile route outside global desktop layout)  
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
| ⚡ Quick Coach              [Sep 8 – Sep 14] [Full]  |  <- Minimal Header
+------------------------------------------------------+
| ✨ Primary Weekly Hotspot             Occurred 5x    |
| High Blood Sugar Pattern (13:00)                     |  <- Hotspot Summary Card
+------------------------------------------------------+
| 🔊 Audio-Visual Data Story                           |
| [==================================================] |
| [        ECharts Animated Spline Canvas            ] |  <- Story Player (ECharts)
| [==================================================] |
| Subtitle: "Notice the sharp peak after lunch..."     |
| [ ▶ Play ] [ ↺ Replay ]    ● 0:14 / 0:24             |
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

### 3.1 `QuickCoachPage` (Shell Container)

- **Route:** `/coach/:journalId` wrapped in `ProtectedRoute`, rendered outside desktop `Layout.tsx`.
- **States:**
  - `isLoading`: Displays Mesa terracotta loading spinner.
  - `error`: Displays red alert triangle and "Return to Dashboard" link.
  - `emptyClusters`: Displays celebratory empty state (_"No Recurring Patterns Detected!"_) if the weekly CGM had no recurring clusters.
  - `saveSuccess`: Opens fullscreen celebration modal with confetti emojis and dashboard exit links.

### 3.2 `QuickCoachStoryPlayer` (Audio-Visual Player)

- **Canvas:** `echarts-for-react` responsive spline chart with target glucose shading (`70 – 180 mg/dL`).
- **Timecode Synchronizer:** Drives animation states via `VisibleCues`:
  - `DRAW_MEAN`: Renders bold smooth spline for average trend (`#D9775B` for high, `#8A4F7D` for low).
  - `DRAW_DAY`: Sequentially stacks dashed individual daily traces.
  - `DRAW_TREATMENTS`: Draws meal bolus pins (`4.5u`) and carb pins (`50g`).
- **Speech Playback:** Native browser `window.speechSynthesis` with pause/resume synchronization.

### 3.3 `QuickCoachVoiceNegotiation` (Interactive Coach)

- **Push-to-Talk:** Browser `SpeechRecognition` / `webkitSpeechRecognition` with pulsing red microphone indicator.
- **Text Fallback:** Keyboard-accessible input box with Enter key submission.
- **Aloud AI Replies:** Automatically speaks Gemini coach reflections back aloud.
- **Habit Selection Card:** Highlights the extracted micro-habit in target forest green (`#54A67A`) with a single-tap button to lock it into the sticky action bar.

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
