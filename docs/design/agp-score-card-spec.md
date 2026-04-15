# **Technical & UX Specification: Voyager Glucose Scorecards**

## **1\. Overview**

The Voyager Scorecard is a set of four metrics displayed at the top of the Glucose Journal view. It uses a "Nautical/Voyage" metaphor to transform clinical data into an intuitive narrative of navigation and stability.

## **2\. Layout & Positioning**

- **Placement:** Positioned at the top of the `Journal` view, directly above the AGP (Ambulatory Glucose Profile) chart.
- **Container:** A horizontal flex container (`flex-row`) with `gap: 12px` (3 units).
- **Responsive Behavior:** \- On mobile, the row should be horizontally scrollable (`overflow-x-auto`) to maintain metric legibility.
  - On desktop, cards should grow equally to fill the container width (`flex-1`).
- **Margins:** `margin-bottom: 24px` (6 units) below the scorecard row to separate it from the main chart area.

## **3\. Component Architecture: `MetricScorecard`**

### **Visual Anatomy**

Each card is a contained surface with the following layers:

1. **Icon Box:** A 44x44px (11 units) rounded square (`rounded-lg`) with a background opacity of 10% of the brand color.
2. **Label Area:** \- **Label:** Uppercase, 10px bold text, letter-spacing `0.05em` (tracking-widest).
   - **Tooltip:** A `HelpCircle` icon (10px) positioned next to the label for non-obvious metrics.
   - **Trend Indicator:** A small 8px bold indicator showing the delta from the previous period (e.g., ↑ 4).
3. **Value Display:** Large bold text (20px) with a secondary font size for units (e.g., "mg/dL").
4. **Stability Bar (Progress Bar):** A 3px high track at the absolute bottom of the card for percentage-based metrics.

### **Theme & Branding (The Voyager Set)**

| Metric            | Icon | Color (Tailwind) | Meta-Tag      | Tooltip Definition                                          |
| :---------------- | :--- | :--------------- | :------------ | :---------------------------------------------------------- |
| **Avg Glucose**   | 🧭   | `slate-600`      | "The Heading" | None                                                        |
| **Stability**     | 🌊   | `blue-500`       | "The Ride"    | Time spent with flat arrows (changing \< 1.5mg/dL per min). |
| **Time in Range** | ⛵   | `emerald-600`    | "The Journey" | % of time between 70–180 mg/dL.                             |
| **Tight Range**   | 🏝️   | `teal-600`       | "The Target"  | % of time between 70–140 mg/dL.                             |

## **4\. Engineering Implementation Details**

### **Interaction States**

- **Hover:** The card border should transition from `gray-100` to `gray-200`.
- **Tooltip:** \- **Trigger:** Hover (desktop) or Tap (mobile).
  - **Positioning:** Tooltip appears above the card, centered horizontally.
  - **Styling:** Dark theme (`gray-800`), 10px text, with a small triangle pointer.

### **Animation Specs**

- **Progress Bar:** Use `duration-1000 ease-out` on the width property to create a "loading" effect when the data is first rendered.
- **Hover Scale:** A subtle scale-up (`scale-101`) or shadow depth increase on the card is recommended for a premium feel.

### **Prop Types (React/TS)**

interface MetricScorecardProps {  
 label: string; // "Avg Glucose", "Stability", etc.  
 value: string; // The primary number  
 unit?: string; // "mg/dL" or "%"  
 emoji: string; // Nautical icon  
 colorClass: string; // Tailwind bg- color  
 percentage?: number; // 0-100 for the bottom bar  
 tooltip?: string; // Clinical definition text  
 trend?: {  
 value: string; // String delta (e.g., "4")  
 isPositive: boolean; // Green if positive, Amber if negative  
 };  
}

## **5\. Design Tokens**

- **Surface:** `white` (\#FFFFFF)
- **Border:** `gray-100` (\#F3F4F6)
- **Label Color:** `gray-400` (\#9CA3AF)
- **Value Color:** `gray-800` (\#1F2937)
- **Radius:** `rounded-xl` (12px)
