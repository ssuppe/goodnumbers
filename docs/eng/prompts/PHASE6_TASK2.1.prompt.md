We just finished eng/docs/PHASE6_TASK2.md. However, I'd like to expand and contextualize the GMI stat below. Any time we give information as an insight, we should give information on what it means, and how to consider it in the real world. The insights should be based on modern healthcare best practices for type 1 diabetes from an endocrinology/medical healthcare professional standpoint, but NOT issue medical advice. If there are things to look at, we should avoid specific instructions, and position as 'talk to your doctor about.'

For GMI, I have written the following spec, that uses other data (TIR, TITR, below range, etc) to give more actionable information. Please write a technical design doc to make this happen for my review.

This expands the logic to prioritize **clinical safety (hypoglycemia)** first, then **stability (Time in Range)**, and finally **optimization (Time in Tight Range)**.

This approach prevents the common "A1C trap" where a user gets a "Great job!" for a 6.2% GMI that was actually achieved by having dangerous lows 10% of the time.

### **The Hierarchy of Metrics (Order of Operations)**

1.  **Safety Check (Time Below Range - TBR):** Is the user safe? (Target: `< 4%`)
2.  **Stability Check (Time In Range - TIR):** Are they spending enough time in target? (Target: `> 70%`)
3.  **Optimization Check (Time in Tight Range - TITR):** Are they achieving "flat" lines? (Target: `> 50%` is a common advanced goal).

---

### **Detailed Decision Matrix: `getUserInsight`**

Here is the branching logic. You can implement this as a nested `switch` or `if/else` block inside your generator.

#### **1. GMI < 6.5% (The "Low" Zone)**

_Clinical Note: This is historically "excellent," but in modern care, we must verify it isn't driven by hypoglycemia._

| Secondary Data Check                                 | Insight Priority | **Goodnumbers Insight Text**                                                                                                                                                                                                                                                                                                   |
| :--------------------------------------------------- | :--------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Time Below Range > 4%**<br>_(Urgent Safety Issue)_ | **SERIOUS**      | "Your GMI is low (<6.5%), but your Time Below Range is high this week (>4%). This suggests your average is being pulled down by frequent lows. **This is a 'false positive' for tight control.** The priority should be reducing those lows to ensure safety, even if it means your average glucose rises slightly next week." |
| **Time Below Range ≤ 4%**<br>_(True Tight Control)_  | **IMPORTANT**    | "This is an exceptionally tight GMI (<6.5%) with safe amounts of low blood sugar. You are effectively managing your diabetes at a level often seen in people without diabetes. **Reflection:** How much mental effort did this take? Ensure this level of management feels sustainable for you."                               |

#### **2. GMI 6.5% – 6.9% (The "Target" Zone)**

_Clinical Note: The ADA "Sweet Spot."_

| Secondary Data Check                                                              | Insight Priority | **Goodnumbers Insight Text**                                                                                                                                                                                                                                             |
| :-------------------------------------------------------------------------------- | :--------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Time Below Range > 4%**<br>_(Safety Warning)_                                   | **IMPORTANT**    | "You hit the GMI target (<7.0%), but your Time Below Range is elevated. While the average looks good, the 'cost' was too much time low. Try to trim the lows next week; a slightly higher average with fewer lows is clinically preferred."                              |
| **Time Below Range ≤ 4%**<br>**AND Time in Range < 70%**<br>_(High Variability)_  | **IMPORTANT**    | "Your GMI is on target, but your Time in Range is lower than recommended (<70%). This usually means you had swings between highs and lows that averaged out to a 'good' number. **Goal:** Focus on flattening the roller coaster rather than just lowering the average." |
| **Time Below Range ≤ 4%**<br>**AND Time in Range > 70%**<br>_(The Gold Standard)_ | **IMPORTANT**    | "This is the clinical 'Gold Standard': A GMI on target with high Time in Range and safe low levels. You balanced your glucose beautifully this week."                                                                                                                    |

#### **3. GMI 7.0% – 7.9% (Slightly Elevated)**

_Clinical Note: Common range. Optimization is the goal, but check for "hidden" instability._

| Secondary Data Check                                                                        | Insight Priority | **Goodnumbers Insight Text**                                                                                                                                                                                                                              |
| :------------------------------------------------------------------------------------------ | :--------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Time Below Range > 4%**<br>_(The Rollercoaster)_                                          | **IMPORTANT**    | "Your GMI is slightly elevated, and you also had significant time low. This indicates a 'rollercoaster' week where highs and lows are both present. **Tip:** Fix the lows first. Often, rebound highs (over-treating lows) are what keep the average up." |
| **Time Below Range ≤ 4%**<br>**AND Time in Tight Range > 40%**<br>_(Solid, needing tweaks)_ | **INFO**         | "You are very close to the target. Your Time in Tight Range suggests you are hitting the mark often, but perhaps dealing with stubborn highs after meals or overnight. Small adjustments to timing could be effective here."                              |
| **Time Below Range ≤ 4%**<br>**AND Time in Tight Range < 40%**                              | **INFO**         | "Your GMI is slightly above target. Since your lows are safe, the focus shifts to the highs. Look for patterns: are there specific times of day (like post-breakfast) pulling your average up?"                                                           |

#### **4. GMI ≥ 8.0% (Elevated)**

_Clinical Note: Risk of complications increases. Supportive encouragement is vital here, not judgment._

| Secondary Data Check                                      | Insight Priority | **Goodnumbers Insight Text**                                                                                                                                                                                                                            |
| :-------------------------------------------------------- | :--------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Time Below Range > 4%**<br>_(High Volatility)_          | **SERIOUS**      | "This week looks tough. You are seeing both significant highs and lows. This creates a high physical and mental burden. **Suggestion:** Don't worry about the highs yet. Focus 100% on stopping the lows/hypos for a few days to stabilize the vessel." |
| **Time Below Range ≤ 4%**<br>_(Persistent Hyperglycemia)_ | **SERIOUS**      | "Your average this week was consistently above target range. The good news is you aren't battling lows, which provides a safe foundation to be more aggressive. It may be time to review your basal rates or carb ratios with your care team."          |

---

### **Implementation Guide (Pseudo-Code)**

```typescript
// Assuming inputs:
// gmi (number)
// timeBelowRange (number, percentage 0-1)
// timeInRange (number, percentage 0-1)
// timeInTightRange (number, percentage 0-1)

export function getRefinedUserInsight(
  gmi: number,
  tbr: number,
  tir: number,
  titr: number,
): AssessmentInsight {
  const TBR_LIMIT = 0.04; // 4%
  const TIR_TARGET = 0.7; // 70%

  // Note preamble (Contextualizes the 7-day nature)
  let note = `Your estimated GMI for this week is ${gmi.toFixed(1)}%. `;
  let priority = InsightPriority.IMPORTANT;

  // BRANCH 1: LOW GMI (< 6.5)
  if (gmi < 6.5) {
    if (tbr > TBR_LIMIT) {
      note +=
        "While this is a 'tight' number, your Time Below Range is high (>4%). This suggests the low average is being driven by too many lows. Prioritizing safety and reducing hypos is recommended, even if your GMI rises slightly.";
      priority = InsightPriority.SERIOUS;
    } else {
      note +=
        "This is exceptional management with safe levels of low blood sugar. You are maintaining very tight control. Check in with yourself to ensure this level of effort feels sustainable.";
      priority = InsightPriority.IMPORTANT;
    }
  }

  // BRANCH 2: TARGET GMI (6.5 - 6.9)
  else if (gmi < 7.0) {
    if (tbr > TBR_LIMIT) {
      note +=
        "You are hitting the target GMI, but with too much time spent low. A truly 'good' number requires safety first. Try backing off slightly to reduce the lows.";
      priority = InsightPriority.IMPORTANT;
    } else if (tir < TIR_TARGET) {
      note +=
        "You hit the GMI target, but your Time in Range is lower than 70%. This usually implies larger swings between high and low averaging out. Flattening those swings is the next step.";
      priority = InsightPriority.IMPORTANT;
    } else {
      note +=
        "This is the clinical 'Gold Standard': a target GMI, high Time in Range, and safe low levels. Great work balancing everything this week.";
      priority = InsightPriority.IMPORTANT;
    }
  }

  // BRANCH 3: SLIGHTLY ELEVATED (7.0 - 7.9)
  else if (gmi < 8.0) {
    if (tbr > TBR_LIMIT) {
      note +=
        "Your average is slightly up, but you are also seeing frequent lows. This 'rollercoaster' effect often happens when we over-treat lows, leading to rebound highs. Focusing on stabilizing the lows often fixes the highs naturally.";
    } else {
      note +=
        "You are just outside the target range (<7.0%). Since your lows are safe, you have room to look at stubborn highs—perhaps after meals or overnight—to gently bring this number down.";
    }
  }

  // BRANCH 4: ELEVATED (>= 8.0)
  else {
    priority = InsightPriority.SERIOUS;
    if (tbr > TBR_LIMIT) {
      note +=
        "This looks like a volatile week with both highs and lows. This is exhausting for the body. We recommend focusing purely on eliminating the lows first to find some stability.";
    } else {
      note +=
        "Glucose levels were consistently above target this week. Since you aren't dealing with lows, this suggests a need to review your insulin plan (basal or ratios) with your provider to help step these numbers down.";
    }
  }

  return { note, priority };
}
```
