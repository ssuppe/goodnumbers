// file: frontend/src/contexts/AuthContext.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AuthProvider, useAuth, type SessionUser } from './AuthContext';
import { api } from '../lib/api';

vi.mock('../lib/api');

const TestConsumer = () => {
  const { user, isLoading, error } = useAuth();
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>; // Now expects a string
  if (user) return <div>Welcome, {user.name}</div>;
  return <div>Logged out</div>;
};

describe('AuthProvider', () => {
  it('shows loading state initially', () => {
    vi.mocked(api.get).mockReturnValue(new Promise(() => {})); // Never resolves
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('provides user data on successful session fetch', async () => {
    // IMPORTANT: This mock only contains non-sensitive data.
    const mockUser: SessionUser = { id: '1', email: 'test@test.com', name: 'Test User' };
    vi.mocked(api.get).mockResolvedValue({ data: { user: mockUser } });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Welcome, Test User')).toBeInTheDocument();
    });
  });

  it('provides null user when session is empty', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { user: null } });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Logged out')).toBeInTheDocument();
    });
  });

  it('provides an error message string on failed fetch', async () => {
    const errorMessage = 'Network Error';
    vi.mocked(api.get).mockRejectedValue(new Error(errorMessage));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      // The component should render the error message directly as a string.
      expect(screen.getByText(`Error: ${errorMessage}`)).toBeInTheDocument();
    });
  });
});
