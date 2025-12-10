// Centralized chart theme configuration
// Colors match CSS variables defined in index.css

export const CHART_THEME = {
  medianLine: '#1976d2', // Matches var(--primary-color)
  meanLine: 'rgba(70, 90, 130, 0.8)',
  clinicalLow: '#d32f2f', // Matches var(--feedback-critical-color)
  clinicalHigh: '#d32f2f',
  patientGoal: '#52c41a',
  bands: {
    outer: 'rgba(120, 140, 180, 0.25)', // 5th-95th
    inner: 'rgba(90, 110, 150, 0.35)',  // 25th-75th
  }
};
