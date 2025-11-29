import type { Json } from "@goodnumbers/types";

interface DataDisplayWidgetProps {
  title: string;
  data: Json;
}

export default function DataDisplayWidget({
  title,
  data,
}: DataDisplayWidgetProps) {
  if (!data) {
    return (
      <section className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">{title}</h2>
        <p className="text-gray-500">No data available for {title}.</p>
      </section>
    );
  }

  // Use JSON.stringify for pretty-printing
  const prettyPrintedData = JSON.stringify(data, null, 2);

  return (
    <section className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">
        {title} (Low-Fidelity Data View)
      </h2>
      <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto text-sm text-gray-800 border border-gray-200">
        {prettyPrintedData}
      </pre>
    </section>
  );
}
