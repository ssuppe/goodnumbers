// file: frontend/src/contexts/AuthContext.tsx
import {
  createContext,
  useState,
  useEffect,
  useMemo,
  useContext,
  type ReactNode,
} from 'react';
import { api } from '../lib/api';

// This is the SAFE user type. It includes only what the UI needs
// and explicitly omits sensitive tokens.
export interface SessionUser {
  id: string;
  name?: string | null;
  email?: string | null;
}

interface AuthContextType {
  user: SessionUser | null;
  isLoading: boolean;
  error: string | null; // Error is now a string for security
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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

    fetchSession();
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, error }),
    [user, isLoading, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
