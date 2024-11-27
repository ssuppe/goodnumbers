import React from 'react';
import { PodcastGenerateResult } from '~/types/nightscout';

type PrimitiveType = string | number | boolean | null | undefined;
type GenericObject = Record<string, PrimitiveType>;

const DebugInterfaceViewer = <T extends Record<string, PrimitiveType>>({ data }: { data: PodcastGenerateResult | T | null | undefined }) => {
  if (!data) {
    return (
      <div className="rounded-lg border border-gray-200 bg-slate-50 p-6 w-full max-w-xl">
        <div className="font-mono text-slate-700">No data available</div>
      </div>
    );
  }

  const formatValue = (value: PrimitiveType): string => {
    if (value === null) return '(null)';
    if (value === undefined) return '(undefined)';
    if (typeof value === 'boolean') return value.toString();
    if (typeof value === 'number') return value.toString();
    return value?.toString() ?? '(empty)';
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-slate-50 p-6 w-full max-w-xl">
      <div className="space-y-2 font-mono">
        {Object.entries(data).map(([key, value]) => (
          <div key={key} className="flex">
            <span className="text-blue-600 w-32">{key}:</span>
            <span className="ml-2 text-slate-700">{formatValue(value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DebugInterfaceViewer;