# Component Specification: Influencing Factors Chip Group (V3)

**Component Name:** `InfluencingFactorsChipGroup` (Implemented in prototype as `FactorChip` and `App` parent)
**Location:** Journal Page (SubjectSubjective Input Section)
**Tech Stack:** React (Functional Components, Hooks), Tailwind CSS (V3 Utility Classes)

## 1\. Overview and Component Purpose

This component facilitates the logging of external variables that potentially impacted the user's weekly glucose control. It utilizes a multi-select chip pattern, allowing users to quickly toggle multiple factors on or off.

**Key Requirement:** This is a **multi-select** component. The state must manage an array of selected factor values.

## 2\. Design, Styling, and V3 Adherence

| Feature                 | Implementation Detail                     | Tailwind/Style Notes                                                   |
| :---------------------- | :---------------------------------------- | :--------------------------------------------------------------------- |
| **Container**           | Standard V3 Card                          | `bg-white`, `p-6`, `rounded-lg`, `shadow-sm`, `border border-gray-100` |
| **Chips Layout**        | Flexible Wrapping Group                   | `flex flex-wrap gap-3`                                                 |
| **Chip Shape**          | Fully Rounded Corners                     | `rounded-full`                                                         |
| **Inactive Chip Style** | Light gray background, border, dark text. | `bg-gray-100`, `text-gray-700`, `border border-gray-300`               |
| **Active Chip Style**   | Primary Blue background, white text.      | `bg-blue-600` (for high contrast), `text-white`                        |
| **Transitions**         | Smooth visual changes.                    | `transition-all duration-150`                                          |
| **Icon**                | Checkmark (`lucide/CheckCircle`)          | Must appear **only** when the chip is active (`isSelected`).           |

## 3\. Data Model (`FACTOR_OPTIONS`)

The component uses a predefined, fixed array of objects. The `label` is for display, and the `value` is the required API key.

| UI Label (Display)                      | API Value (Payload)      | Context                                    |
| :-------------------------------------- | :----------------------- | :----------------------------------------- |
| Heavy or Fatty Meal                     | `Diet:FatProtein`        | Slowed digestion impact.                   |
| Carb Counting Mistake                   | `Diet:CarbError`         | Human error in estimation.                 |
| Ate New or Restaurant Food              | `Diet:EatingOut`         | Unknown nutritional content.               |
| Harder Exercise than Planned            | `Exercise:Strenuous`     | Increased insulin sensitivity.             |
| Very Little Exercise                    | `Exercise:Sedentary`     | Decreased insulin sensitivity.             |
| Major Stressful Event                   | `Emotional:StressAcute`  | Sudden, high-impact stress.                |
| Feeling Anxious or Tense                | `Emotional:Anxiety`      | Chronic, underlying stress.                |
| Slept Poorly                            | `Emotional:SleepQuality` | Hormone and sensitivity disruption.        |
| Problematic Infusion Set Change         | `Meds:SetChange`         | Absorption or site issue.                  |
| Felt Sick (Cold, Flu, etc.)             | `Biological:Illness`     | Infection-driven insulin resistance.       |
| Hormone Changes (e.g., Menstrual Cycle) | `Biological:Hormonal`    | Biological sensitivity changes.            |
| Felt Dehydrated                         | `Biological:Dehydration` | Can directly affect blood sugar levels.    |
| Traveling or Time Zone Change           | `Logistics:Travel`       | Basal rate and timing confusion.           |
| Drank Alcohol                           | `Logistics:Alcohol`      | Risk of delayed hypoglycemia.              |
| Pump or Sensor Problem                  | `System:Malfunction`     | Technology error.                          |
| Changed medications                     | `Meds:Steroids`          | Generalized significant medication change. |

## 4\. Behavior and Interaction

### A. Core Multi-Select Toggle Logic

The parent component (`App` in the prototype) manages an array of strings (`selectedFactors`). The `onToggle` function must perform a check:

1.  **If the value is present in the array:** Remove it (Deselect).
2.  **If the value is NOT present:** Add it (Select).

### B. Micro-Interaction: Hover Animation

To improve discoverability and responsiveness, inactive chips must feature a distinct hover effect.

- **Effect:** The chip scales up slightly (`hover:scale-[1.05]`).
- **Implementation:** The `transform` and `hover:scale-[1.05]` utilities must be applied to the `<span>` element of the `FactorChip`.

### C. Visual Feedback

The active chip must include the `CheckCircle` icon on the left side of the label for clear visual confirmation of the selected state.

## 5\. Implementation Code Snippets (React/Tailwind)

### A. `FactorChip` Component: Conditional Styling and Hover

The component uses the `isSelected` prop to determine styling and conditional rendering of the icon.

```jsx
const FactorChip = ({ label, value, isSelected, onToggle }) => {
  // Define classes for active and inactive states. Note the transition and transform utilities
  // are included in both the active and inactive blocks to ensure smooth transitions.
  const activeClasses = isSelected
    ? "bg-blue-600 text-white"
    : // Inactive state includes the tactile hover animation (scale up)
      "bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200 hover:scale-[1.05] transform";

  return (
    <span
      className={`
        px-4 py-2 rounded-full text-sm font-medium cursor-pointer 
        transition-all duration-150 inline-flex items-center whitespace-nowrap
        ${activeClasses}
      `}
      onClick={() => onToggle(value)}
    >
      {/* CONDITIONAL ICON RENDERING */}
      {isSelected && <CheckCircle className="w-3 h-3 mr-1" />}
      {label}
    </span>
  );
};
```

### B. Parent Component Logic: `handleToggleFactor`

This function demonstrates the required logic for managing the state array (`selectedFactors`) in the parent component.

```javascript
// Example of state initialization:
// const [selectedFactors, setSelectedFactors] = useState([]);

const handleToggleFactor = (factorValue) => {
  setSelectedFactors((prevFactors) => {
    // Check if the factor is already in the array
    if (prevFactors.includes(factorValue)) {
      // DESELECT: Return a new array excluding the factorValue
      return prevFactors.filter((v) => v !== factorValue);
    } else {
      // SELECT: Return a new array with the factorValue added
      return [...prevFactors, factorValue];
    }
  });
};
```
