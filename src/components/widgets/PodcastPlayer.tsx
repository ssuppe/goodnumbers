'use client';

import { useState, useEffect, useCallback } from 'react';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import { PodcastGenerateResult } from './nightscoutActions';

interface PodcastPlayerProps {
    podcastResult?: PodcastGenerateResult;
    checkOperationUrl: string;
    className?: string;
  }
  
  const PodcastPlayer: React.FC<PodcastPlayerProps> = ({
    podcastResult,
    checkOperationUrl,
    className = ''
  }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [jobStatus, setJobStatus] = useState<JobCheckResponse | null>(null);
    
    // Construct the GCS URL
    const audioUrl = `https://storage.googleapis.com/${podcastResult.bucket_name}/${podcastResult.gcs_path}`;
    
    // Function to check job status
    const checkJobStatus = useCallback(async () => {
      try {
        const response = await fetch(checkOperationUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            operation_id: podcastResult.operation_id
          } as JobCheck)
        });
        
        if (!response.ok) {
          throw new Error('Failed to check job status');
        }
        
        const data: JobCheckResponse = await response.json();
        setJobStatus(data);
        
        if (data.done) {
          setIsLoading(false);
        }
        
        if (data.error) {
          setError(JSON.stringify(data.error));
          setIsLoading(false);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        setIsLoading(false);
      }
    }, [podcastResult.operation_id, checkOperationUrl]);
    
    // Set up polling
    useEffect(() => {
      if (!isLoading || error) return;
      
      const pollInterval = setInterval(() => {
        checkJobStatus();
      }, 10000); // Check every 10 seconds
      
      // Initial check
      checkJobStatus();
      
      return () => clearInterval(pollInterval);
    }, [checkJobStatus, isLoading, error]);
    
    if (error) {
      return (
        <Alert variant="destructive" className={className}>
          <AlertTitle>Error</AlertTitle>
          {error}
        </Alert>
      );
    }
    
    if (isLoading || !jobStatus?.done) {
      return (
        <div className={`flex items-center space-x-2 ${className}`}>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Processing audio...</span>
          {jobStatus?.status && <span className="text-sm text-gray-500">Status: {jobStatus.status}</span>}
        </div>
      );
    }
    
    return (
      <div className={className}>
        <audio
          controls
          className="w-full"
          preload="metadata"
        >
          <source src={audioUrl} type="audio/mpeg" />
          <source src={audioUrl} type="audio/wav" />
          Your browser does not support the audio element.
        </audio>
      </div>
    );
  };
  
  export default PodcastPlayer;