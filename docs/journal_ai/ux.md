# UX/UI Plan: Collaborative AI Chat Insights

**Project:** Goodnumbers Weekly Health Journal  
**Feature Overhaul:** Event Cluster Notes to Collaborative AI Coaching  
**Status:** UX Proposal  
**Date:** June 16, 2026

---

## 1. User Scenarios

### Scenario A: The Direct Logger (Manual Reflection)

1. **Context:** Sarah (a Type 1 Diabetic) is reviewing her weekly journal. She opens an Event Cluster Card showing high glucose readings around 2:00 PM on weekdays.
2. **Action:** She immediately knows the cause (she's been snacking on school cookies without bolusing).
3. **Execution:** She clicks on the standard "Your Notes" text box at the bottom of the card, types: _"Snacking on school cookies, forgot to bolus."_
4. **Outcome:** She clicks out of the text area. The sticky action bar at the bottom of the screen prompts her to save. She saves the journal.

### Scenario B: The Collaborator (Guided Reflection)

1. **Context:** David is reviewing a cluster of hypoglycemia (low blood sugar) events occurring around 3:00 AM. He doesn't know why these are happening and feels overwhelmed.
2. **Action:** He clicks the **"💡 Help me reflect"** button underneath the empty notes text box.
3. **Transition:** The text area smoothly transitions (fades/collapses) and is replaced by the AI Reflection Coach panel. A loading skeleton pulses briefly.
4. **Dialogue Starts:** The AI Coach starts the chat with a specific, friendly question: _"I notice that you had 4 low events around 3:00 AM this week, mostly on days following high afternoon activity. Did you go for a run or do heavy exercise in the late afternoon on those days?"_
5. **Back-and-Forth:** David types: _"Yes, I started running on Monday and Wednesday at 5 PM."_ The AI responds: _"Aha! Heavy late afternoon exercise can cause increased insulin sensitivity hours later, often spiking nighttime lows. Did you have a snack before bed or adjust your basal insulin on those days?"_ David replies: _"No, I just had my normal dinner."_
6. **Synthesis:** David feels they have found the issue. He clicks the **"Save as Insight"** button.
7. **Outcome:** The chat interface fades out. The standard text box returns, now pre-populated with a beautifully formatted markdown note:

   > _"I realized my late-afternoon runs (around 5:00 PM) are causing delayed nighttime hypoglycemia at 3:00 AM."_
   >
   > - **Resolution:** Eat a complex carb snack before bed or reduce nighttime basal rates on running days.

   David can make minor manual edits to this text directly, or hit save.

---

## 2. Interface Workflow & States

```
[ State 1: Manual Notes (Default) ]
        |
        +---> Click "💡 Help me reflect" (Lucide Sparkles Icon)
        |
[ State 2: Start Prompt Generating ] ---> Calls API for custom starting question (Pulsing Loader2)
        |
[ State 3: Active Conversational Chat ] <---> User types, AI Coach responds
        |
        +---> Click "Save as Insight"
        |
[ State 4: Synthesis Loading ] ---> Calls API to compile POV summary & action items (Loader2)
        |
[ State 5: Synthesized View (Populated Manual Notes) ]
        |
        +---> Edit Text Area (Manual override)
        |
        +---> Click "Reset Chat" (Clear and start over via Lucide RotateCcw Icon)
```

---

## 3. Layout and UI Component Hierarchy

Within each [EventClusterCard.tsx](file:///home/clark/dev/goodnumbers-clean/frontend/src/components/journal/EventClusterCard.tsx), the note reflection section is structured in a card footer layout matching the existing layout:

### State 1: Default Input Layout

- **Header / Title:** "Your Reflection" (14px, Semibold, `text-mesa-text`).
- **Text Area:** Standard text box (`CollapsingNoteArea`) utilizing the class `border-mesa-border` and transition states (collapsing to an input field when empty and unfocused, auto-focusing on expand).
- **Control Row (placed directly below the text box):**
  - Left: **"Help me reflect"** button. Styled with a transparent background, `text-brand` (Mesa Terracotta), `border border-mesa-primary`, `hover:bg-primary-hover` with `text-white` transition, and a leading Lucide `Sparkles` icon.
  - Right: Characters remaining text (`text-mesa-muted` / `text-xs`).

### State 2: Chat Pane Layout

Replaces the standard input layout with a card-like conversation wrapper:

- **Chat Header:**
  - Left: Title "✨ AI Reflection Coach" (12px, bold, `v3-primary-text` / Mesa Petrol Blue) with an pulsing green "online" dot.
  - Right: Close button (Lucide `X` icon) to exit chat and return to manual text area.
- **Chat Message Feed:**
  - Fixed height of `300px` with auto scroll and a subtle border `border-mesa-border` top/bottom.
  - _AI Message Bubble:_ Left-aligned, light Petrol Blue background (`bg-blue-50/50` / border-blue-100), `text-mesa-text` font-sans.
  - _User Message Bubble:_ Right-aligned, `bg-mesa-primary` (Terracotta) background, `text-white` font-sans.
- **Chat Action Footer:**
  - Input area: A single-line text input with a placeholder: _"Type your answer..."_ and focus ring `focus:ring-mesa-primary`.
  - Right: **"Send"** button (icon button, Lucide `Send` icon, `bg-mesa-primary hover:bg-primary-hover text-white` background).
  - Bottom Dock: **"Save as Insight"** button. Large, primary call-to-action button with a solid `bg-mesa-primary hover:bg-primary-hover text-white` background, centered or right-aligned.

---

## 4. Visual Style & Interactions

### Typography & Colors (Tailwind v4 Alignments)

We adhere strictly to the GoodNumbers **Mesa Theme** defined in [index.css](file:///home/clark/dev/goodnumbers-clean/frontend/src/index.css):

- **UI Labels & Chat Input:** `font-sans` (`Nunito`)
- **Synthesized Quotes:** `.font-narrative` (`Lora` serif, italic) for the synthesized patient POV summary to convey a personalized journal feeling.
- **AI Message Bubble:**
  - Background: `bg-blue-50/70` with border `border-blue-100` (Petrol Blue tint)
  - Text: `text-mesa-text`
- **User Message Bubble:**
  - Background: `bg-mesa-primary` (Terracotta)
  - Text: `text-white`

### Micro-Animations & Transitions

- **Activation Slide:** When clicking "Help me reflect", the height of the card footer expands smoothly using standard Tailwind animation utilities, and the text area fades out as the chat feed slides upward.
- **AI Typing Indicator:** While waiting for the AI response, a 3-dot pulsing typing indicator is shown in a bubble on the left.
- **Save Complete Animation:** When "Save as Insight" is clicked:
  - A full-width progress skeleton overlays the chat.
  - Once the API resolves, the chat panel collapses with a slide-down transition.
  - The text area reappears with a green checkmark check flash, then displays the newly generated markdown text. Since the value length is > 0, `CollapsingNoteArea` remains in its expanded text area state.
