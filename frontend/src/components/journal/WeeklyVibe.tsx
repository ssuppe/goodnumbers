interface WeeklyVibeProps {
  selectedVibe: string | null;
  onChange: (vibe: string) => void;
}

const vibes = [
  { label: "Wilted", emoji: "🥀" },
  { label: "Sprouting", emoji: "🌱" },
  { label: "Growing", emoji: "🌿" },
  { label: "Flourishing", emoji: "🌻" },
];

export default function WeeklyVibe({
  selectedVibe,
  onChange,
}: WeeklyVibeProps) {
  return (
    <section className="bg-white p-2 rounded-xl shadow-md border border-gray-200">
      {" "}
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Weekly Vibe</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {vibes.map((vibe) => (
          <button
            key={vibe.label}
            onClick={() => onChange(vibe.label)}
            className={`group flex flex-col items-center justify-center p-2 rounded-lg border transition-all duration-200 transform hover:scale-[1.03] hover:shadow-lg ${
              selectedVibe === vibe.label
                ? "border-mesa-primary bg-mesa-bg ring-2 ring-offset-1 ring-opacity-50 ring-mesa-primary"
                : "border-gray-200 hover:bg-mesa-bg"
            }`}
          >
            <span className="text-4xl mb-2 transition-transform duration-300 group-hover:rotate-6">
              {vibe.emoji}
            </span>
            <span className="font-medium text-gray-700">{vibe.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
