import DataDisplayWidget from "./DataDisplayWidget";
import type { Json } from "@goodnumbers/types";

export default function InfluencingFactors({ data }: { data: Json }) {
  return <DataDisplayWidget title="Influencing Factors Data" data={data} />;
}
