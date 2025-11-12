import DataDisplayWidget from "./DataDisplayWidget";
import { Json } from "@goodnumbers/types";

export default function AGPChart({ data }: { data: Json }) {
  return (
    <DataDisplayWidget
      title="Ambulatory Glucose Profile (AGP) Chart Data"
      data={data}
    />
  );
}
