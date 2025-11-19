/**
 * Configuration options for Parallium
 */
export interface ParalliumOptions {
  /** Canvas element to render the grid */
  canvas: HTMLCanvasElement;

  /** Number of rows in the grid */
  rows?: number;

  /** Number of columns in the grid */
  columns?: number;

  /** Width of each cell in pixels */
  cellWidth?: number;

  /** Height of each cell in pixels */
  cellHeight?: number;
}

/**
 * Cell data structure
 */
export interface Cell {
  value: string | number;
  formula?: string;
}

/**
 * Grid data structure
 */
export interface GridData {
  cells: Map<string, Cell>;
}
