declare module 'd3' {
  export function select(selector: string | Element): Selection;
  export function selectAll(selector: string): Selection;

  export interface Selection {
    attr(name: string, value?: any): Selection;
    style(name: string, value?: any): Selection;
    append(name: string): Selection;
    call(func: Function): Selection;
    select(selector: string): Selection; // Add this for chaining
    selectAll(selector: string): Selection; // Add this too
    call(func: Function): Selection;
  }

  export namespace svg {
    export function axis(): Axis;
    // Add other svg namespace functions as needed
  }

  export interface Axis {
    scale(scale: any): Axis;
    orient(orientation: string): Axis;
    outerTickSize(size: number): Axis;
    ticks(count: number): Axis;
    // Add other Axis methods as needed
  }

  // Add other D3 v3 functionality as needed
}
