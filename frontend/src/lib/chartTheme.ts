// Centralized chart theme configuration
// Colors match CSS variables defined in index.css

export const CHART_THEME = {
  medianLine: "#D9775B", // Mesa Primary (Terracotta)
  meanLine: "#2C4C5B", // Mesa Secondary (Petrol Blue)
  clinicalLow: "#d32f2f", // Keep Critical Red
  clinicalHigh: "#d32f2f",
  patientGoal: "#52c41a",
  bands: {
    outer: "rgba(44, 76, 91, 0.1)", // Mesa Secondary at 10%
    inner: "rgba(44, 76, 91, 0.2)", // Mesa Secondary at 20%
  },
};
