import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from './LoginPage';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch for CSRF token
global.fetch = vi.fn();

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ csrfToken: 'test-token' }),
    });
  });

  it('renders the login form correctly', async () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Log In/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
    
    // Wait for CSRF token fetch
    await waitFor(() => {
      const csrfInput = document.querySelector('input[name="csrfToken"]') as HTMLInputElement;
      expect(csrfInput.value).toBe('test-token');
    });
  });

  it('contains the correct hidden fields for Auth.js', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    const actionInput = document.querySelector('input[name="action"]') as HTMLInputElement;
    expect(actionInput.value).toBe('login');
  });

  it('links to the registration page', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    const registerLink = screen.getByRole('link', { name: /Register here/i });
    expect(registerLink).toHaveAttribute('href', '/register');
  });
});
