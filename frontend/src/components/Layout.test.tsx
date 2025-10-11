// file: frontend/src/components/Layout.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './Layout';
import { AuthProvider, type SessionUser } from '../contexts/AuthContext';
import { api } from '../lib/api';

vi.mock('../lib/api');

const renderWithAuth = (ui: React.ReactElement) => {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={ui}>
            <Route path="/" element={<div>Child Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
};

describe('Layout', () => {
  it('renders a global loading indicator while session is loading', () => {
    vi.mocked(api.get).mockReturnValue(new Promise(() => {})); // Never resolves
    renderWithAuth(<Layout />);
    expect(screen.getByText('Loading session...')).toBeInTheDocument();
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
  });

  it('renders header, footer, and outlet when not loading (logged out)', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: null });
    renderWithAuth(<Layout />);
    expect(await screen.findByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getByText('Child Content')).toBeInTheDocument();
    expect(screen.getByText('Login')).toBeInTheDocument();
  });

  it('renders dynamic header for authenticated user', async () => {
    const mockUser: SessionUser = { id: '1', email: 'test@test.com', name: 'Test User' };
    vi.mocked(api.get).mockResolvedValue({ data: { user: mockUser } });
    renderWithAuth(<Layout />);
    expect(await screen.findByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Logout')).toBeInTheDocument();
    expect(screen.queryByText('Login')).not.toBeInTheDocument();
  });
});
