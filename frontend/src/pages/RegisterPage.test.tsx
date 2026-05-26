import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RegisterPage from './RegisterPage';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch for CSRF token
global.fetch = vi.fn();

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ csrfToken: 'test-token' }),
    });
  });

  it('renders the registration form correctly', async () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Create Account/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Register/i })).toBeInTheDocument();
    
    // Wait for CSRF token fetch
    await waitFor(() => {
      const csrfInput = document.querySelector('input[name="csrfToken"]') as HTMLInputElement;
      expect(csrfInput.value).toBe('test-token');
    });
  });

  it('contains the correct hidden fields for Auth.js registration', () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );

    const actionInput = document.querySelector('input[name="action"]') as HTMLInputElement;
    expect(actionInput.value).toBe('register');
  });

  it('links to the login page', () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );

    const loginLink = screen.getByRole('link', { name: /Log in here/i });
    expect(loginLink).toHaveAttribute('href', '/login');
  });
});
