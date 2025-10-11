// file: frontend/src/contexts/AuthContextDefinition.ts
import { createContext } from 'react';
import type { SessionUser } from './AuthTypes';

export interface AuthContextType {
  user: SessionUser | null;
  isLoading: boolean;
  error: string | null;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);