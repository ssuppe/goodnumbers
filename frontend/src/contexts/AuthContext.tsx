// file: frontend/src/contexts/AuthContext.tsx
import {
  useState,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { api } from '../lib/api';
import type { SessionUser } from './AuthTypes';



import { AuthContext } from './AuthContextDefinition';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSession = async () => {
      setIsLoading(true);
      try {
        // Define the expected response shape, using the safe SessionUser type.
        const response = await api.get<{ user: SessionUser } | null>('/session');
        setUser(response.data?.user ?? null);
      } catch (err) {
        // Store only the message, not the entire error object.
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    void fetchSession();
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, error }),
    [user, isLoading, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}


