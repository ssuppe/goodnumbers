import React, { useState } from 'react';
import { AssessmentData, AssessmentInsight, PodcastGenerateResult, ReportItem } from '@/types/nightscout';

// Enhanced DebugInterfaceViewer that supports complex nested objects and arrays
const DebugInterfaceViewer = ({
  data,
  maxDepth = 3,
  initialExpanded = true,
}: {
  data: any | null | undefined;
  maxDepth?: number;
  initialExpanded?: boolean;
}) => {
  if (data === null || data === undefined) {
    return (
      <div className="rounded-lg border border-gray-200 bg-slate-50 p-6 w-full max-w-2xl">
        <div className="font-mono text-slate-700">No data available</div>
      </div>
    );
  }

  // If data is an array of ReportItem or any other array, we'll display it as a JSON tree
  return (
    <div className="rounded-lg border border-gray-200 bg-slate-50 p-6 w-full overflow-auto">
      <details open={initialExpanded}>
        <summary className="font-mono text-blue-700 cursor-pointer font-semibold mb-2">
          Debug Data {Array.isArray(data) ? `(${data.length} items)` : ''}
        </summary>
        <JSONTree data={data} depth={0} maxDepth={maxDepth} />
      </details>
    </div>
  );
};

// Recursive component to display JSON data as a collapsible tree
const JSONTree = ({ data, depth = 0, maxDepth = 3, path = '' }: { data: any; depth?: number; maxDepth?: number; path?: string }) => {
  const [isExpanded, setIsExpanded] = useState(depth < 2);

  // For primitive values
  if (data === null) return <span className="text-gray-500">null</span>;
  if (data === undefined) return <span className="text-gray-500">undefined</span>;
  if (typeof data === 'string') return <span className="text-green-600">"{data}"</span>;
  if (typeof data === 'number') return <span className="text-purple-600">{data}</span>;
  if (typeof data === 'boolean') return <span className="text-red-600">{data.toString()}</span>;
  
  // For arrays
  if (Array.isArray(data)) {
    if (depth >= maxDepth) {
      return <span className="text-gray-500">[Array: {data.length} items]</span>;
    }
    
    // Empty array
    if (data.length === 0) return <span className="text-gray-500">[]</span>;
    
    return (
      <div className="ml-4">
        <div 
          className="cursor-pointer font-semibold text-blue-600" 
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? '▼' : '►'} Array ({data.length} items)
        </div>
        
        {isExpanded && (
          <div className="ml-4 border-l-2 border-gray-200 pl-2">
            {data.map((item, index) => (
              <div key={`${path}-${index}`} className="font-mono">
                <span className="text-gray-500 mr-2">{index}:</span>
                <JSONTree data={item} depth={depth + 1} maxDepth={maxDepth} path={`${path}-${index}`} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
  
  // For objects
  if (typeof data === 'object') {
    if (depth >= maxDepth) {
      return <span className="text-gray-500">{'{Object}'}</span>;
    }
    
    const entries = Object.entries(data);
    if (entries.length === 0) return <span className="text-gray-500">{'{}'}</span>;
    
    return (
      <div className="ml-4">
        <div 
          className="cursor-pointer font-semibold text-blue-600" 
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? '▼' : '►'} Object ({entries.length} properties)
        </div>
        
        {isExpanded && (
          <div className="ml-4 border-l-2 border-gray-200 pl-2">
            {entries.map(([key, value]) => (
              <div key={`${path}-${key}`} className="font-mono">
                <span className="text-blue-600 mr-2">{key}:</span>
                <JSONTree data={value} depth={depth + 1} maxDepth={maxDepth} path={`${path}-${key}`} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
  
  // Fallback for other types
  return <span className="text-gray-700">{String(data)}</span>;
};

// Alternative simplified viewer that just uses pre-formatted JSON
export const SimpleJSONViewer = ({ data }: { data: any }) => {
  if (data === null || data === undefined) {
    return <div className="font-mono text-slate-700">No data available</div>;
  }
  
  return (
    <div className="rounded-lg border border-gray-200 bg-slate-50 p-6 w-full overflow-auto">
      <pre className="font-mono text-sm whitespace-pre-wrap">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
};

export default DebugInterfaceViewer;
