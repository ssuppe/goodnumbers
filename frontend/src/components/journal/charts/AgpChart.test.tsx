import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
// @ts-ignore - implementation doesn't exist yet
import { AgpChart } from './AgpChart';

// Mock echarts-for-react because JSDOM doesn't support Canvas well
vi.mock('echarts-for-react', () => ({
  default: ({ option }: { option: any }) => (
    <div data-testid="mock-echarts">
      {/* Serialize options to DOM so we can assert on them */}
      <pre data-testid="echarts-option">{JSON.stringify(option)}</pre>
    </div>
  ),
}));

// Mock resize observer
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

const MOCK_DATA = [
  { time: '00:00', median: 100, mean: 105, p5: 80, p95: 140, p25: 90, p75: 120 },
  { time: '00:30', median: 102, mean: 106, p5: 82, p95: 142, p25: 92, p75: 122 },
];

describe('AgpChart', () => {
  it('renders without crashing', () => {
    render(<AgpChart data={MOCK_DATA} units="MGDL" />);
    expect(screen.getByTestId('mock-echarts')).toBeInTheDocument();
  });

  it('passes correct options to ECharts', () => {
    render(<AgpChart data={MOCK_DATA} units="MGDL" />);
    
    const optionJson = screen.getByTestId('echarts-option').textContent;
    const option = JSON.parse(optionJson!);

    // Verify basic structure
    expect(option).toHaveProperty('series');
    expect(option).toHaveProperty('xAxis');
    expect(option).toHaveProperty('yAxis');
    
    // Verify we have the specific custom series for the bands
    // We expect 5th-95th band, 25th-75th band, Mean line, Median line, + threshold lines
    const customSeries = option.series.filter((s: any) => s.type === 'custom');
    expect(customSeries.length).toBeGreaterThanOrEqual(2);
    
    const medianSeries = option.series.find((s: any) => s.name === 'Median');
    expect(medianSeries).toBeDefined();

    // Verify Target Range markArea exists
    // We expect a series (typically the first one or a specialized one) to contain the markArea
    const seriesWithMarkArea = option.series.find((s: any) => s.markArea);
    expect(seriesWithMarkArea).toBeDefined();
    // Check default values (70-180 mg/dL)
    expect(seriesWithMarkArea.markArea.data[0][0].yAxis).toBe(70);
    expect(seriesWithMarkArea.markArea.data[0][1].yAxis).toBe(180);
  });

  it('renders "No Data" state if data is empty', () => {
    render(<AgpChart data={[]} units="MGDL" />);
    expect(screen.getByText(/No AGP data available/i)).toBeInTheDocument();
    expect(screen.queryByTestId('mock-echarts')).not.toBeInTheDocument();
  });

  it('uses MMOL units in yAxis name when requested', () => {
    render(<AgpChart data={MOCK_DATA} units="MMOL" />);
    const optionJson = screen.getByTestId('echarts-option').textContent;
    const option = JSON.parse(optionJson!);
    expect(option.yAxis.name).toContain('mmol/L');
  });
});