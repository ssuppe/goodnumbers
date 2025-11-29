import DataDisplayWidget from "./DataDisplayWidget";
import type { Json } from "@goodnumbers/types";

export default function InsightsList({ data }: { data: Json }) {
  return <DataDisplayWidget title="Key Insights Data" data={data} />;
}
