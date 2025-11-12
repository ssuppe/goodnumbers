import DataDisplayWidget from "./DataDisplayWidget";
import { Json } from "@goodnumbers/types";

export default function InfluencingFactors({ data }: { data: Json }) {
  return <DataDisplayWidget title="Influencing Factors Data" data={data} />;
}
