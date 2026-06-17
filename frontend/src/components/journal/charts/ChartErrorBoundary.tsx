import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * A specialized Error Boundary for charts to prevent the entire Journal
 * from crashing if ECharts fails to render specific messy data.
 */
export class ChartErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(
      "[ChartErrorBoundary] Visual map or rendering error:",
      error,
      errorInfo,
    );
  }

  public render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex flex-col items-center justify-center h-64 bg-slate-50 border border-dashed rounded-lg text-slate-400 p-8 text-center">
            <div className="text-3xl mb-2">📊</div>
            <h3 className="text-slate-600 font-medium">Visualization Error</h3>
            <p className="text-sm mt-1">
              Some of your data points could not be rendered in this specific
              chart. The rest of your journal is still safe to use.
            </p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="mt-4 text-xs bg-white border px-3 py-1 rounded-md hover:bg-white/80 transition-colors shadow-sm"
            >
              Attempt Retry
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
