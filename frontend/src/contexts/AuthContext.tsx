// file: frontend/src/contexts/AuthContext.tsx
import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  type ReactNode,
} from "react";
import { api } from "../lib/api";
import type { SessionUser } from "./AuthTypes";

import { AuthContext } from "./AuthContextDefinition";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetchSession = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await api.get<{ user: SessionUser } | null>("/session");
      setUser(response.data?.user ?? null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unknown error occurred",
      );
    } finally {
      setIsLoading(false);
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
