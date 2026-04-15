import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Banner from './Banner';

describe('Banner', () => {
  it('renders the critical medical disclaimer text', () => {
    render(<Banner />);
    expect(screen.getByText(/goodnumbers is an experiment/i)).toBeInTheDocument();
    expect(screen.getByText('NOTE')).toBeInTheDocument();
  });
});