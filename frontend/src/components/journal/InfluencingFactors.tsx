import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface InfluencingFactorsProps {
  selectedFactors: string[] | null;
  onChange: (factors: string[]) => void;
}

const FACTOR_GROUPS = [
  {
    title: "🍽️ Food",
    options: [
      { label: "Heavy or Fatty Meal", value: "Diet:FatProtein", emoji: "🍔" },
      { label: "Carb Counting Mistake", value: "Diet:CarbError", emoji: "📉" },
      {
        label: "Ate New or Restaurant Food",
        value: "Diet:EatingOut",
        emoji: "🍽️",
      },
      { label: "Drank Alcohol", value: "Logistics:Alcohol", emoji: "🍷" },
    ],
  },
  {
    title: "🏃 Movement",
    options: [
      {
        label: "Harder Exercise than Planned",
        value: "Exercise:Strenuous",
        emoji: "🏃",
      },
      {
        label: "Very Little Exercise",
        value: "Exercise:Sedentary",
        emoji: "🛋️",
      },
    ],
  },
  {
    title: "💊 Body & Meds",
    options: [
      {
        label: "Felt Sick (Cold, Flu, etc.)",
        value: "Biological:Illness",
        emoji: "🤒",
      },
      { label: "Hormone Changes", value: "Biological:Hormonal", emoji: "🩸" },
      {
        label: "Felt Dehydrated",
        value: "Biological:Dehydration",
        emoji: "💧",
      },
      {
        label: "Problematic Infusion Set Change",
        value: "Meds:SetChange",
        emoji: "💉",
      },
      { label: "Changed medications", value: "Meds:Steroids", emoji: "💊" },
    ],
  },
  {
    title: "🧠 Mind & Mood",
    options: [
      {
        label: "Major Stressful Event",
        value: "Emotional:StressAcute",
        emoji: "🤯",
      },
      {
        label: "Feeling Anxious or Tense",
        value: "Emotional:Anxiety",
        emoji: "😰",
      },
      { label: "Slept Poorly", value: "Emotional:SleepQuality", emoji: "😴" },
    ],
  },
  {
    title: "🔌 Life & Tech",
    options: [
      {
        label: "Traveling or Time Zone Change",
        value: "Logistics:Travel",
        emoji: "✈️",
      },
      {
        label: "Pump or Sensor Problem",
        value: "System:Malfunction",
        emoji: "🤖",
      },
    ],
  },
];

// Flatten options for easy lookup by value
const ALL_OPTIONS = FACTOR_GROUPS.flatMap((g) => g.options);

export default function InfluencingFactors({
  selectedFactors,
  onChange,
}: InfluencingFactorsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const currentFactors = selectedFactors || [];

  const handleToggle = (value: string) => {
    if (currentFactors.includes(value)) {
      onChange(currentFactors.filter((f) => f !== value));
    } else {
      onChange([...currentFactors, value]);
    }
  };

  return (
    <section className="bg-white p-6 rounded-xl shadow-md border border-gray-200 transition-all duration-300">
      <div
        className="flex justify-between items-center cursor-pointer mb-4"
        onClick={() => setIsOpen(!isOpen)}
      >
        <h2 className="text-2xl font-bold text-gray-900">
          What happened this week?
        </h2>
        <button
          className={`p-2 rounded-full hover:bg-gray-100 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
        >
          <ChevronDown className="w-6 h-6 text-gray-500" />
        </button>
      </div>

      {!isOpen ? (
        // SUMMARY VIEW (Closed)
        <div>
          {currentFactors.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {currentFactors.map((factorValue) => {
                const option = ALL_OPTIONS.find((o) => o.value === factorValue);
                if (!option) return null;
                return (
                  <button
                    key={option.value}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggle(option.value);
                    }}
                    className="px-2 py-1.5 rounded-lg text-sm font-medium bg-blue-100 text-blue-800 border border-blue-200 flex items-center hover:bg-blue-200 transition-colors"
                  >
                    <span className="mr-1.5 text-base">{option.emoji}</span>
                    {option.label}
                  </button>
                );
              })}
              <button
                onClick={() => setIsOpen(true)}
                className="px-3 py-1.5 text-sm text-gray-500 hover:text-blue-600 hover:underline"
              >
                + Add more
              </button>
            </div>
          ) : (
            <p
              className="text-gray-500 italic cursor-pointer hover:text-blue-600"
              onClick={() => setIsOpen(true)}
            >
              You haven't added any influencing factors. Expand to add.
            </p>
          )}
        </div>
      ) : (
        // FULL VIEW (Open)
        <div className="space-y-6 animate-in slide-in-from-top-2 duration-200">
          {FACTOR_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wider mb-3">
                {group.title}
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {group.options.map((option) => {
                  const isSelected = currentFactors.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      onClick={() => handleToggle(option.value)}
                      className={`px-2 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 flex items-center justify-center text-center border h-full ${
                        isSelected
                          ? "bg-blue-100 text-blue-800 border-blue-200"
                          : "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200 hover:scale-[1.05] transform"
                      }`}
                    >
                      <span
                        className={`overflow-hidden transition-all duration-200 ease-out flex items-center justify-center text-base ${
                          isSelected
                            ? "w-6 opacity-100 mr-1.5"
                            : "w-0 opacity-0 mr-0"
                        }`}
                      >
                        {option.emoji}
                      </span>
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="flex justify-center pt-4">
            <button
              onClick={() => setIsOpen(false)}
              className="text-sm text-gray-500 hover:text-gray-800 flex items-center"
            >
              <ChevronDown className="w-4 h-4 mr-1 rotate-180" />
              Collapse
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
