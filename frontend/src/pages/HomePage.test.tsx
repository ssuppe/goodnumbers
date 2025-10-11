import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import HomePage from './HomePage';

describe('HomePage', () => {
  it('renders marketing content with correct internal and external links', () => {
    render(<MemoryRouter><HomePage /></MemoryRouter>);

    // Check for headline
    expect(screen.getByRole('heading', { name: /a smart weekly journal/i })).toBeInTheDocument();

    // Check Login / Register button (external link)
    const loginLink = screen.getByRole('link', { name: /login \/ register/i });
    expect(loginLink).toBeInTheDocument();
    expect(loginLink).toHaveAttribute('href', '/api/auth/signin');
    // SECURITY CHECK: Ensure rel attribute is present for external links
    expect(loginLink).toHaveAttribute('rel', 'noopener noreferrer');

    // Check See a demo button (internal link)
    const demoLink = screen.getByRole('link', { name: /see a demo/i });
    expect(demoLink).toBeInTheDocument();
    expect(demoLink).toHaveAttribute('href', '/demo');
  });
});