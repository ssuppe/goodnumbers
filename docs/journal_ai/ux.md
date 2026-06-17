# UX/UI Plan: Collaborative AI Chat Insights

**Project:** Goodnumbers Weekly Health Journal  
**Feature Overhaul:** Right-side Persistent Chat Drawer for Event Clusters  
**Status:** UX Proposal (Refined with right-panel design)  
**Date:** June 17, 2026

---

## 1. User Scenarios

### Scenario A: The Direct Logger (Manual Reflection)

1. **Context:** Sarah is reviewing her weekly journal. She opens an Event Cluster Card showing high glucose readings around 2:00 PM on weekdays.
2. **Action:** She immediately knows the cause (she's been snacking on school cookies without bolusing).
3. **Execution:** She clicks on the standard "Your Notes" text box at the bottom of the card and types: _"Snacking on school cookies, forgot to bolus."_
4. **Outcome:** The notes area stays on the card. The sticky action bar at the bottom of the screen prompts her to save. She saves the journal.

### Scenario B: The Collaborator (Guided Reflection)

1. **Context:** David is reviewing a cluster of hypoglycemia (low blood sugar) events occurring around 3:00 AM. He doesn't know why these are happening and feels overwhelmed.
2. **Action:** He clicks the **"💡 Help me reflect"** button underneath the empty notes text box.
3. **Transition:** The text area on the card stays in place. A side panel smoothly slides in from the right edge of the viewport. A pulsing loader appears inside the panel.
4. **Active Highlighting:** The active cluster card on the main page receives a subtle pulsing borders highlight (`border-mesa-primary animate-pulse` or similar) to visually link the card to the active chat panel.
5. **Dialogue Starts:** The AI Coach in the right panel starts the chat with a specific question: _"I notice that you had 4 low events around 3:00 AM this week, mostly on days following high afternoon activity. Did you do heavy exercise in the afternoon on those days?"_
6. **Back-and-Forth:** David types: _"Yes, I started running at 5 PM."_ The AI responds: _"Aha! Late afternoon exercise causes delayed nighttime lows. Did you have a bedtime snack?"_ David replies: _"No, just normal dinner."_
7. **Synthesis:** David clicks the **"Summarize my notes"** button at the bottom of the right panel.
8. **Outcome:** Gemini synthesizes the conversation logs. The panel triggers a slide-out hide animation. The synthesized markdown text is pasted directly into the notes text box of the active card:

   > _"I realized my late-afternoon runs (around 5:00 PM) are causing delayed nighttime hypoglycemia at 3:00 AM."_
   >
   > - **Resolution:** Eat a complex carb snack before bed or reduce nighttime basal rates on running days.

   The notes text box performs a brief green outline pulse/flash (`ring-2 ring-green-500`) to confirm the insert, and remains in its expanded state. David can review, edit, or directly save the journal.

### Scenario C: Context Switching

1. **Context:** While David is in the middle of chatting with the AI Coach about his 3:00 AM lows, he scrolls down and clicks **"💡 Help me reflect"** on a different cluster showing afternoon highs.
2. **Action:** The right-side panel remains open, but its contents transition:
   - The active card highlight shifts to the new cluster card.
   - The message feed clears and loads the new cluster's dynamic starting prompt.
   - The chat is now bound to the new cluster. Typing and summarizing will update the new cluster's note box instead.

---

## 2. Interface Workflow & States

```
[ State 1: Default Page Layout (All notes boxes empty/manual) ]
        |
        +---> Click "💡 Help me reflect" on Cluster A
        |
[ State 2: Drawer Slides In & Active Highlight on Card A ]
        |
        +---> User chats with AI Coach in Right Panel
        |
        +---> (Optional) Click "💡 Help me reflect" on Cluster B
        |       * Chat clears, active highlight shifts to Card B, starts prompt for Cluster B
        |
        +---> Click "Summarize my notes"
        |
[ State 3: Synthesis Loading Overlay ] ---> Calls API for summary
        |
[ State 4: Paste & Flash Visual Cue ] ---> Notes box on active card flashes green & receives markdown
        |
[ State 5: Drawer Slides Out / Closes ]
```

---

## 3. Layout and UI Component Hierarchy

### EventClusterCard Integration

- **Notes Area:** Retains the standard `CollapsingNoteArea`.
- **Button:** Rendered directly below the notes textarea:
  - Text: `"Help me reflect"` with a sparkles icon.
  - Border: `border border-mesa-primary`, `hover:bg-primary-hover hover:text-white` transition.
  - When chat is active for this cluster, the button shows a selected state (e.g. solid Terracotta background or explicit active label).

### Right-Side Chat Drawer (`ClusterChatDrawer.tsx`)

- **Container:** Fixed position overlay (`w-[400px] h-screen fixed right-0 top-0 bg-white border-l border-gray-200 shadow-2xl z-50 flex flex-col`).
- **Header:**
  - Left: Title `"AI Reflection Coach"` (Mesa Petrol Blue) with a pulsing green online indicator.
  - Subtitle: Indicating the active cluster event type and time (e.g., _"Reflecting on: 3 low events at 03:00"_).
  - Right: Close button (`X` icon) to close the drawer.
- **Message Feed:**
  - Scrollable balloon feed with `flex-grow` and auto-scroll to bottom.
  - Balloons are styled as old-school messenger chat blocks.
  - AI: `bg-blue-50/70` text, left-aligned.
  - User: `bg-mesa-primary` (Terracotta) text, white font, right-aligned.
- **Input Area:**
  - Text input with placeholder _"Type your response..."_ and a send icon button.
- **Actions Dock:**
  - Centered or full-width primary button: **"Summarize my notes"** (`bg-mesa-primary text-white hover:bg-primary-hover font-bold uppercase tracking-wider`).

---

## 4. Visual Style & Interactions

### Active Card Highlight (Visual Tether)

To avoid user confusion about which notes box will receive the summary:

- Add a CSS outline/shadow to the active cluster card.
- Class: `ring-2 ring-mesa-primary ring-offset-2 transition-all duration-300 shadow-lg`.

### Textarea Flash Cue

Upon clicking "Summarize my notes" and receiving the API response:

- The target textarea transitions its border/ring color:
  - `.animate-flash-green`: brief outline change to `ring-2 ring-green-500` for `1000ms`, then fades back to default.
