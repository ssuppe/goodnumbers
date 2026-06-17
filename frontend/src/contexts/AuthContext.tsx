// file: frontend/src/contexts/AuthContext.tsx
import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  useContext,
  type ReactNode,
} from "react";
import { api } from "../lib/api";
import type { SessionUser } from "./AuthTypes";

import { AuthContext } from "./AuthContextDefinition";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const refetchSession = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await api.get<{ user: SessionUser } | null>("/session");
      if (isMounted.current) {
        setUser(response.data?.user ?? null);
      }
    } catch (err) {
      if (isMounted.current) {
        setError(
          err instanceof Error ? err.message : "An unknown error occurred",
        );
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void refetchSession();
  }, [refetchSession]);

  const value = useMemo(
    () => ({ user, isLoading, error, refetchSession }),
    [user, isLoading, error, refetchSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
