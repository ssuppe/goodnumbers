import DataDisplayWidget from "./DataDisplayWidget";
import type { GlycemicEventCluster } from "@goodnumbers/types";

export default function EventClusterCard({
  cluster,
}: {
  cluster: GlycemicEventCluster;
}) {
  // We create a dynamic title to make the output clearer
  const title = `Glycemic Event Cluster: ${cluster.eventType} (x${cluster.eventCount})`;
  // We pass the entire cluster object to see all its data, including the summary fields.
  return <DataDisplayWidget title={title} data={cluster} />;
}
