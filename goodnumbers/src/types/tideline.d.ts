// src/types/tideline.d.ts
declare module 'tideline' {
  /**
   * Interface for the Tideline chart object itself.
   * This interface defines the API of a Tideline chart instance,
   * including methods for configuration and rendering.
   * Expand this interface to include all public methods of the Tideline chart
   * as you need them in your TypeScript code, ensuring accurate type annotations.
   */
  export interface TidelineChart {
    id(id?: string): TidelineChart;
    width(width?: number): TidelineChart;
    height(height?: number): TidelineChart;
    data(data?: any): TidelineChart;
    load(data?: any): TidelineChart;
    setAxes(): TidelineChart;
    setNav(): TidelineChart;
    setScrollNav(): TidelineChart;
    setAnnotation(): TidelineChart;
    setTooltip(): TidelineChart;
    setAtDate(date: Date | string, isNewest?: boolean): TidelineChart;
    panForward(): TidelineChart;
    panBack(): TidelineChart;

    newPool(): any;
    pools(): any[];
    poolGroup(): any;
    arrangePools(): TidelineChart;
    renderedData(domain?: any): any;
    destroy(): void; // Or destroy(): void if it doesn't return the chart for chaining

    // Add the Call Signature here:
    (selection: d3.Selection<SVGSVGElement, any, any, any>): d3.Selection<SVGSVGElement, any, any, any>;
  }

  const _default: any;
  export default _default;
  export const oneDay: any;
  export const twoWeek: any;
  // Add other exports you need
}
