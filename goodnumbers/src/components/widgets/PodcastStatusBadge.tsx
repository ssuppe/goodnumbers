import React from 'react';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PodcastStatusProps {
  status: string;
}

const PodcastStatusBadge = ({ status }: PodcastStatusProps) => {
  // Don't render anything if status is 'done'
  if (status === 'done') return null;

  // Show error state
  if (status === 'error') {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertDescription>An error occurred while generating your podcast. Please try again.</AlertDescription>
      </Alert>
    );
  }

  // Show processing state with enhanced animation
  return (
    <Alert className="mb-4 bg-blue-50 border-blue-200">
      <div className="flex items-center gap-2">
        {/* Enhanced spinner with multiple animation classes for better browser support */}
        <div className="animate-spin motion-reduce:animate-none">
          <Loader2 className="h-4 w-4 text-blue-500" />
        </div>
        <AlertDescription className="text-blue-700">
          Assessment complete, please wait for your podcast to be created
        </AlertDescription>
      </div>
    </Alert>
  );
};

export default PodcastStatusBadge;
