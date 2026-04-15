// file: frontend/src/contexts/AuthContext.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { useAuth } from '../hooks/useAuth';
import type { SessionUser } from './AuthTypes';


vi.mock('../hooks/useAuth');
const useAuthMock = vi.mocked(useAuth);

const TestConsumer = () => {
  const { user, isLoading, error } = useAuth();
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>; // Now expects a string
  if (user) return <div>Welcome, {user.name}</div>;
  return <div>Logged out</div>;
};

describe('TestConsumer', () => {
  it('shows loading state initially', () => {
    useAuthMock.mockReturnValue({ user: null, isLoading: true, error: null });
    render(<TestConsumer />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('provides user data on successful session fetch', () => {
    const mockUser: SessionUser = { id: '1', email: 'test@test.com', name: 'Test User' };
    useAuthMock.mockReturnValue({ user: mockUser, isLoading: false, error: null });
    render(<TestConsumer />);
    expect(screen.getByText('Welcome, Test User')).toBeInTheDocument();
  });

  it('provides null user when session is empty', () => {
    useAuthMock.mockReturnValue({ user: null, isLoading: false, error: null });
    render(<TestConsumer />);
    expect(screen.getByText('Logged out')).toBeInTheDocument();
  });

  it('provides an error message string on failed fetch', () => {
    const errorMessage = 'Network Error';
    useAuthMock.mockReturnValue({ user: null, isLoading: false, error: errorMessage });
    render(<TestConsumer />);
    expect(screen.getByText(`Error: ${errorMessage}`)).toBeInTheDocument();
  });
});
