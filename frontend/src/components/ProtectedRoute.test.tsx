// file: frontend/src/components/ProtectedRoute.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import * as useAuth from '../hooks/useAuth';

// Mock the useAuth hook
vi.mock('../hooks/useAuth');
const useAuthMock = vi.mocked(useAuth.useAuth);

// A helper component to display the current path
const LocationDisplay = () => <div>Current Path: {useLocation().pathname}</div>;

describe('ProtectedRoute', () => {
  it('renders children when user is authenticated', () => {
    useAuthMock.mockReturnValue({
      user: { id: '1', name: 'Test' },
      isLoading: false,
      error: null,
    });

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/protected" element={<div>Protected Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('redirects to the login page when user is not authenticated', () => {
    useAuthMock.mockReturnValue({
      user: null,
      isLoading: false,
      error: null,
    });

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/protected" element={<div>Protected Content</div>} />
          </Route>
          <Route path="/api/auth/signin" element={<LocationDisplay />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    expect(screen.getByText('Current Path: /api/auth/signin')).toBeInTheDocument();
  });

  it('renders loading state while auth context is loading', () => {
    useAuthMock.mockReturnValue({
      user: null,
      isLoading: true,
      error: null,
    });

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/protected" element={<div>Protected Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    // Assuming loading state is null or a spinner, not the content
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });
});
