import { AssessmentInsight } from '~/types/nightscout';

export enum TidelineChartType {
  DAILY,
  WEEKLY,
}

export interface TidelineConfig {
  type: TidelineChartType;
  // Basic chart configuration
  id: string; // DOM element ID for the chart
  width: number; // Width of chart
  height: number; // Height of chart
  imagesBaseUrl?: string; // Base URL for images used by Tideline

  // Date configuration
  datetime?: string; // Central date to display (will show 24h centered on this)

  // Pool configurations
  pools: Array<{
    id: string; // Pool identifier
    label?: string; // Optional label for the pool
    weight: number; // Relative height (1.0 is standard, 0.5 half height, etc.)
    gutterWeight: number; // Space above pool (0.0 for none, 1.0 for standard)
    plotTypes: Array<{
      type: string; // e.g., 'smbg', 'bolus', 'carbs', 'basal', etc.
      axis?: {
        scale: string; // Scale type (e.g., 'linear', 'time', etc.)
        domain?: [number, number]; // Min/max values
        ticks?: number; // Number of ticks to display
        orient?: 'left' | 'right'; // Orientation of axis
      };
      data?: string; // Reference to data field name in the client data
      opts?: Record<string, any>; // Additional options for this plot type
    }>;
    annotations?: boolean; // Whether this pool needs annotations
    tooltips?: boolean; // Whether this pool needs tooltips
  }>;

  // Navigation options
  scrollNav?: boolean; // Whether to add scrollbar navigation

  // Insights configuration would remain similar
  insights?: AssessmentInsight[];
}
