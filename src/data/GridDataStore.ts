import type { Cell } from '../core/types.js';

/**
 * Data store for grid cells
 */
export class GridDataStore {
  private cells: Map<string, Cell> = new Map();

  /**
   * Get cell key from row and column
   */
  private getCellKey(row: number, col: number): string {
    return `${row},${col}`;
  }

  /**
   * Get cell value
   */
  getCell(row: number, col: number): Cell | undefined {
    return this.cells.get(this.getCellKey(row, col));
  }

  /**
   * Set cell value
   */
  setCell(row: number, col: number, cell: Cell): void {
    this.cells.set(this.getCellKey(row, col), cell);
  }

  /**
   * Delete cell
   */
  deleteCell(row: number, col: number): void {
    this.cells.delete(this.getCellKey(row, col));
  }

  /**
   * Clear all cells
   */
  clear(): void {
    this.cells.clear();
  }

  /**
   * Get all cells
   */
  getAllCells(): Map<string, Cell> {
    return this.cells;
  }
}
