import DataDisplayWidget from "./DataDisplayWidget";

export default function Goals({ data }: { data: string | null }) {
  return <DataDisplayWidget title="Goals for Next Week Data" data={data} />;
}
