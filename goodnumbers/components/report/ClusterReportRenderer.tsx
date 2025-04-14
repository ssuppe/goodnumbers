'use client';

import React, { useState, useEffect } from 'react';
import { ReportItem, AssessmentInsight, GlucoseUnits } from '@/types/nightscout.d';
import { ClusterAnalysisDisplay } from '../charts/ClusterAnalysisDisplay';
import { TimeCluster } from '@/lib/events/time_clustering/time_clustering';
import { decompress } from 'compress-json';
import { NightscoutEntry } from '@/types/nightscout';

interface ClusterReportRendererProps {
  reportItem: ReportItem;
  units: GlucoseUnits;
  patientLowGoal?: number;
  patientHighGoal?: number;
}

/**
 * Component to render a TimeCluster report item
 * This handles decompressing the cluster data and retrieving the referenced entries
 */
export function ClusterReportRenderer({
  reportItem,
  units,
  patientLowGoal,
  patientHighGoal,
}: ClusterReportRendererProps) {
  const [cluster, setCluster] = useState<TimeCluster | null>(null);
  const [entries, setEntries] = useState<NightscoutEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Extract and decompress the cluster data
  useEffect(() => {
    if (!reportItem.data || reportItem.data.length === 0) {
      setError('No cluster data available');
      setIsLoading(false);
      return;
    }
    
    try {
      // Get the compressed data package
      const dataPackage = reportItem.data[0];
      
      // Check if this is a compressed package
      if (dataPackage && 'compressedCluster' in dataPackage && 'dataReference' in dataPackage) {
        // Decompress the cluster
        const decompressedCluster = decompress(dataPackage.compressedCluster);
        setCluster(decompressedCluster);
        
        // Get the reference to entries data
        const reference = dataPackage.dataReference;
        
        if (reference.type === 'nightscout-entries' && reference.id) {
          // Try to get the entries from localStorage
          const storageKey = `goodnumbers-nightscout-entries-${reference.id}`;
          const entriesData = localStorage.getItem(storageKey);
          
          if (entriesData) {
            // Parse and decompress the entries
            const parsedData = JSON.parse(entriesData);
            if (parsedData && parsedData.entries) {
              const decompressedEntries = decompress(parsedData.entries);
              setEntries(decompressedEntries);
              console.log('Retrieved entries for cluster:', {
                count: decompressedEntries.length,
                firstEntry: decompressedEntries.length > 0 ? 
                  new Date(decompressedEntries[0].date).toISOString() : 'none',
                lastEntry: decompressedEntries.length > 0 ? 
                  new Date(decompressedEntries[decompressedEntries.length - 1].date).toISOString() : 'none'
              });
            } else {
              setError('Invalid entries data in storage');
            }
          } else {
            setError('Entries data not found in storage');
          }
        } else {
          setError('Invalid data reference');
        }
      } else if (dataPackage && 'events' in dataPackage && 'meanTime' in dataPackage) {
        // Handle legacy non-compressed clusters for backward compatibility
        setCluster(dataPackage as TimeCluster);
        setError('Using legacy data format - some features may be limited');
      } else {
        setError('Invalid cluster data format');
      }
    } catch (err) {
      setError(`Error processing cluster data: ${err}`);
      console.error('Error processing cluster data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [reportItem.data]);
  
  if (isLoading) {
    return (
      <div className="p-4 border rounded-md bg-gray-50 dark:bg-gray-800">
        <p className="text-gray-500 dark:text-gray-400">Loading cluster data...</p>
      </div>
    );
  }
  
  if (error || !cluster) {
    return (
      <div className="p-4 border rounded-md bg-red-50 dark:bg-red-900/20">
        <p className="text-red-600 dark:text-red-400 font-medium">Error loading cluster data</p>
        {error && <p className="text-red-500 dark:text-red-300 text-sm mt-1">{error}</p>}
      </div>
    );
  }

  return (
    <ClusterAnalysisDisplay
      entries={entries}
      cluster={cluster}
      units={units}
      patientLowGoal={patientLowGoal}
      patientHighGoal={patientHighGoal}
      insights={reportItem.insights}
    />
  );
}