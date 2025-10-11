import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import HomePage from './HomePage';

describe('HomePage', () => {
  it('renders the main heading', () => {
    render(<HomePage />);
    const headingElement = screen.getByRole('heading', {
      name: /Goodnumbers Home/i,
    });
    expect(headingElement).toBeInTheDocument();
  });
});