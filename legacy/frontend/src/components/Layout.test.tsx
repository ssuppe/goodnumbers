import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './Layout';
import * as useAuthModule from '../hooks/useAuth'; // Import the module as a namespace

// Mock the useAuth hook
vi.mock('../hooks/useAuth');
const mockedUseAuth = vi.mocked(useAuthModule.useAuth); // Access the mocked export

describe('Layout', () => {
  beforeEach(() => {
    mockedUseAuth.mockClear();
    mockedUseAuth.mockReturnValue({ user: null, isLoading: false, error: null });
  });

  it('renders the banner, header, footer, and child outlet content', () => {
    render(
      <MemoryRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<div>Child Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/goodnumbers is an experiment/i)).toBeInTheDocument(); // Verifies Banner
    expect(screen.getByRole('link', { name: 'GoodNumbers' })).toBeInTheDocument(); // Verifies Header
    expect(screen.getByText('Child Content')).toBeInTheDocument(); // Verifies Outlet
    expect(screen.getByText(/© 2025 goodnumbers, inc/i)).toBeInTheDocument(); // Verifies Footer
  });
});
