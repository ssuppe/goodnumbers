import { useState } from "react";

export const useLoadingState = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressText, setProgressText] = useState('');
    const [error, setError] = useState<string | null>(null);
  
    const startLoading = (initialText: string = 'Loading...') => {
      setIsLoading(true);
      setProgress(0);
      setProgressText(initialText);
      setError(null);
    };
  
    const updateProgress = (newProgress: number, newText: string) => {
      setProgress(newProgress);
      setProgressText(newText);
    };
  
    const stopLoading = () => {
      setIsLoading(false);
      setProgress(0);
      setProgressText('');
    };
  
    const setLoadingError = (errorMessage: string) => {
      setError(errorMessage);
      stopLoading();
    };
  
    return {
      isLoading,
      progress,
      progressText,
      error,
      startLoading,
      updateProgress,
      stopLoading,
      setLoadingError
    };
  };