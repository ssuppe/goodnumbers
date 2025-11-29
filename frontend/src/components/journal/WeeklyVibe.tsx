import DataDisplayWidget from "./DataDisplayWidget";

export default function WeeklyVibe({ data }: { data: string | null }) {
  return <DataDisplayWidget title="Weekly Vibe Data" data={data} />;
}
