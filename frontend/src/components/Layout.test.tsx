// file: frontend/src/components/Layout.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './Layout';
import * as useAuth from '../hooks/useAuth';
import type { SessionUser } from '../contexts/AuthTypes';

vi.mock('../hooks/useAuth');
const useAuthMock = vi.mocked(useAuth.useAuth);

const renderWithRouter = (ui: React.ReactElement) => {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route element={ui}>
          <Route path="/" element={<div>Child Content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
};

describe('Layout', () => {
  it('renders a global loading indicator while session is loading', () => {
    useAuthMock.mockReturnValue({ user: null, isLoading: true, error: null });
    renderWithRouter(<Layout />);
    expect(screen.getByText('Loading session...')).toBeInTheDocument();
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
  });

  it('renders header, footer, and outlet when not loading (logged out)', () => {
    useAuthMock.mockReturnValue({ user: null, isLoading: false, error: null });
    renderWithRouter(<Layout />);
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getByText('Child Content')).toBeInTheDocument();
    expect(screen.getByText('Login')).toBeInTheDocument();
  });

  it('renders dynamic header for authenticated user', () => {
    const mockUser: SessionUser = { id: '1', email: 'test@test.com', name: 'Test User' };
    useAuthMock.mockReturnValue({ user: mockUser, isLoading: false, error: null });
    renderWithRouter(<Layout />);
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Logout')).toBeInTheDocument();
    expect(screen.queryByText('Login')).not.toBeInTheDocument();
  });
});
