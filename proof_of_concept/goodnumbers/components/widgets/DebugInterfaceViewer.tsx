import React, { useState } from 'react';
import { AssessmentData, AssessmentInsight, PodcastGenerateResult, ReportItem } from '@/types/nightscout';

// Enhanced DebugInterfaceViewer that supports complex nested objects and arrays
const DebugInterfaceViewer = ({
  data,
  maxDepth = 3,
  initialExpanded = true,
  label = "Debug Data",
}: {
  data: any | null | undefined;
  maxDepth?: number;
  initialExpanded?: boolean;
  label?: string;
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
          {label} {Array.isArray(data) ? `(${data.length} items)` : typeof data === 'object' ? `(${Object.keys(data).length} properties)` : ''}
        </summary>
        <div className="pt-2">
          <JSONTree 
            data={data} 
            depth={0} 
            maxDepth={maxDepth}
            varName={label} 
          />
        </div>
      </details>
    </div>
  );
};

// Helper to get a descriptive type
const getTypeDescription = (value: any): string => {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return `Array(${value.length})`;
  if (typeof value === 'object') return `Object{${Object.keys(value).length}}`;
  return typeof value;
};

// Recursive component to display JSON data as a collapsible tree
const JSONTree = ({ 
  data, 
  depth = 0, 
  maxDepth = 3, 
  path = '',
  varName = '' 
}: { 
  data: any; 
  depth?: number; 
  maxDepth?: number; 
  path?: string;
  varName?: string;
}) => {
  const [isExpanded, setIsExpanded] = useState(depth < 2);
  const type = getTypeDescription(data);
  
  // Display the variable name and type for the root level
  const showVarName = varName && depth === 0;

  // For primitive values
  if (data === null) {
    return (
      <div className="font-mono">
        {showVarName && <span className="text-blue-600 font-semibold mr-2">{varName}</span>}
        <span className="text-gray-500 italic">(null)</span>
      </div>
    );
  }
  
  if (data === undefined) {
    return (
      <div className="font-mono">
        {showVarName && <span className="text-blue-600 font-semibold mr-2">{varName}</span>}
        <span className="text-gray-500 italic">(undefined)</span>
      </div>
    );
  }
  
  if (typeof data === 'string') {
    return (
      <div className="font-mono">
        {showVarName && <span className="text-blue-600 font-semibold mr-2">{varName}</span>}
        <span className="text-gray-500 text-xs mr-1">(string)</span>
        <span className="text-green-600">"{data}"</span>
      </div>
    );
  }
  
  if (typeof data === 'number') {
    return (
      <div className="font-mono">
        {showVarName && <span className="text-blue-600 font-semibold mr-2">{varName}</span>}
        <span className="text-gray-500 text-xs mr-1">(number)</span>
        <span className="text-purple-600">{data}</span>
      </div>
    );
  }
  
  if (typeof data === 'boolean') {
    return (
      <div className="font-mono">
        {showVarName && <span className="text-blue-600 font-semibold mr-2">{varName}</span>}
        <span className="text-gray-500 text-xs mr-1">(boolean)</span>
        <span className="text-red-600">{data.toString()}</span>
      </div>
    );
  }
  
  // For arrays
  if (Array.isArray(data)) {
    if (depth >= maxDepth) {
      return (
        <div className="font-mono">
          {showVarName && <span className="text-blue-600 font-semibold mr-2">{varName}</span>}
          <span className="text-gray-500">[Array: {data.length} items]</span>
        </div>
      );
    }
    
    // Empty array
    if (data.length === 0) {
      return (
        <div className="font-mono">
          {showVarName && <span className="text-blue-600 font-semibold mr-2">{varName}</span>}
          <span className="text-gray-500 text-xs mr-1">(empty array)</span>
          <span className="text-gray-500">[]</span>
        </div>
      );
    }
    
    return (
      <div className="font-mono">
        {showVarName && <span className="text-blue-600 font-semibold mr-2">{varName}</span>}
        <div 
          className="cursor-pointer inline-block"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <span className="text-gray-500 text-xs mr-1">(array)</span>
          <span className="text-blue-600 font-semibold">
            {isExpanded ? '▼' : '►'} [{data.length} items]
          </span>
        </div>
        
        {isExpanded && (
          <div className="ml-6 border-l-2 border-gray-200 pl-2 mt-1">
            {data.map((item, index) => (
              <div key={`${path}-${index}`}>
                <div className="flex">
                  <span className="text-gray-500 mr-2 min-w-10">[{index}]:</span>
                  <JSONTree 
                    data={item} 
                    depth={depth + 1} 
                    maxDepth={maxDepth} 
                    path={`${path}-${index}`}
                  />
                </div>
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
      return (
        <div className="font-mono">
          {showVarName && <span className="text-blue-600 font-semibold mr-2">{varName}</span>}
          <span className="text-gray-500">{`{Object: ${Object.keys(data).length} properties}`}</span>
        </div>
      );
    }
    
    const entries = Object.entries(data);
    if (entries.length === 0) {
      return (
        <div className="font-mono">
          {showVarName && <span className="text-blue-600 font-semibold mr-2">{varName}</span>}
          <span className="text-gray-500 text-xs mr-1">(empty object)</span>
          <span className="text-gray-500">{'{}'}</span>
        </div>
      );
    }
    
    const constructorName = data.constructor && data.constructor.name !== 'Object' 
      ? data.constructor.name 
      : 'Object';
    
    return (
      <div className="font-mono">
        {showVarName && <span className="text-blue-600 font-semibold mr-2">{varName}</span>}
        <div 
          className="cursor-pointer inline-block"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <span className="text-gray-500 text-xs mr-1">({constructorName.toLowerCase()})</span>
          <span className="text-blue-600 font-semibold">
            {isExpanded ? '▼' : '►'} {`{${entries.length} properties}`}
          </span>
        </div>
        
        {isExpanded && (
          <div className="ml-6 border-l-2 border-gray-200 pl-2 mt-1">
            {entries.map(([key, value]) => {
              const valueType = getTypeDescription(value);
              return (
                <div key={`${path}-${key}`}>
                  <div className="flex">
                    <span className="text-blue-600 mr-2 min-w-32 truncate">{key}:</span>
                    <JSONTree 
                      data={value} 
                      depth={depth + 1} 
                      maxDepth={maxDepth} 
                      path={`${path}-${key}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }
  
  // Fallback for other types
  return (
    <div className="font-mono">
      {showVarName && <span className="text-blue-600 font-semibold mr-2">{varName}</span>}
      <span className="text-gray-500 text-xs mr-1">({typeof data})</span>
      <span className="text-gray-700">{String(data)}</span>
    </div>
  );
};

// Alternative simplified viewer that just uses pre-formatted JSON
export const SimpleJSONViewer = ({ data, label = "JSON Data" }: { data: any; label?: string }) => {
  if (data === null || data === undefined) {
    return <div className="font-mono text-slate-700">No data available</div>;
  }
  
  return (
    <div className="rounded-lg border border-gray-200 bg-slate-50 p-6 w-full overflow-auto">
      <div className="font-mono text-blue-700 font-semibold mb-2">{label}</div>
      <pre className="font-mono text-sm whitespace-pre-wrap">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
};

export default DebugInterfaceViewer;
