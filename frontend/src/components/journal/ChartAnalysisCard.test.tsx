import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
// @ts-ignore - implementation doesn't exist yet
import { ChartAnalysisCard } from './ChartAnalysisCard';

// Mock the child chart component to test in isolation
vi.mock('./charts/AgpChart', () => ({
  AgpChart: () => <div data-testid="mock-agp-chart">[Chart]</div>,
}));

// Mock Lucide icons to avoid rendering SVG complexity
vi.mock('lucide-react', () => ({
  AlertCircle: () => <span data-testid="icon-critical">Critical</span>,
  AlertTriangle: () => <span data-testid="icon-serious">Serious</span>,
  Info: () => <span data-testid="icon-important">Important</span>,
  Lightbulb: () => <span data-testid="icon-info">Info</span>,
}));

const MOCK_DATA = [{ time: '00:00', median: 100, mean: 100, p5: 80, p95: 120, p25: 90, p75: 110 }];

const MOCK_INSIGHTS = [
  { priority: 'CRITICAL', note: 'Hypo risk at night' },
  { priority: 'SERIOUS', note: 'High after breakfast' },
  { priority: 'IMPORTANT', note: 'Stable afternoon' },
  { priority: 'ALWAYS_INCLUDE', note: 'Good variability' },
];

describe('ChartAnalysisCard', () => {
  it('renders title and chart', () => {
    render(
      <ChartAnalysisCard 
        title="Weekly Glucose" 
        data={MOCK_DATA} 
        units="MGDL" 
        insights={[]}
      />
    );
    
    expect(screen.getByText('Weekly Glucose')).toBeInTheDocument();
    expect(screen.getByTestId('mock-agp-chart')).toBeInTheDocument();
  });

  it('renders insights with correct icons', () => {
    render(
      <ChartAnalysisCard 
        title="Test" 
        data={MOCK_DATA} 
        units="MGDL" 
        insights={MOCK_INSIGHTS}
      />
    );

    // Check text content
    expect(screen.getByText('Hypo risk at night')).toBeInTheDocument();
    expect(screen.getByText('High after breakfast')).toBeInTheDocument();

    // Check icons mapping
    expect(screen.getByTestId('icon-critical')).toBeInTheDocument();
    expect(screen.getByTestId('icon-serious')).toBeInTheDocument();
    expect(screen.getByTestId('icon-important')).toBeInTheDocument();
    expect(screen.getByTestId('icon-info')).toBeInTheDocument();
  });

  it('handles empty insights list gracefully', () => {
    render(
      <ChartAnalysisCard 
        title="Test" 
        data={MOCK_DATA} 
        units="MGDL" 
        insights={[]}
      />
    );
    
    expect(screen.queryByRole('list')).toBeNull(); // Should not render empty ul
    expect(screen.getByText(/No specific insights/i)).toBeInTheDocument();
  });
});