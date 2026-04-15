import { useState } from 'react';

export type Submitter<T> = (data: T) => Promise<unknown>;
export type HandleSubmit<T> = (data: T) => Promise<void>;

export function useApiForm<T>(
  submitter: Submitter<T>
): [HandleSubmit<T>, boolean, string | null] {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (data: T) => {
    setIsSubmitting(true);
    setError(null);
    try {
      await submitter(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return [handleSubmit, isSubmitting, error];
}