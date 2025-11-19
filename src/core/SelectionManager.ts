/**
 * Manages cell selection state
 */
export class SelectionManager {
  private selectedRow: number | null = null;
  private selectedCol: number | null = null;
  private editingRow: number | null = null;
  private editingCol: number | null = null;

  /**
   * Select a cell
   */
  selectCell(row: number, col: number): void {
    this.selectedRow = row;
    this.selectedCol = col;
  }

  /**
   * Get selected cell
   */
  getSelectedCell(): { row: number; col: number } | null {
    if (this.selectedRow === null || this.selectedCol === null) {
      return null;
    }
    return { row: this.selectedRow, col: this.selectedCol };
  }

  /**
   * Clear selection
   */
  clearSelection(): void {
    this.selectedRow = null;
    this.selectedCol = null;
  }

  /**
   * Start editing a cell
   */
  startEditing(row: number, col: number): void {
    this.editingRow = row;
    this.editingCol = col;
  }

  /**
   * Stop editing
   */
  stopEditing(): void {
    this.editingRow = null;
    this.editingCol = null;
  }

  /**
   * Check if a cell is being edited
   */
  isEditing(row: number, col: number): boolean {
    return this.editingRow === row && this.editingCol === col;
  }

  /**
   * Get editing cell
   */
  getEditingCell(): { row: number; col: number } | null {
    if (this.editingRow === null || this.editingCol === null) {
      return null;
    }
    return { row: this.editingRow, col: this.editingCol };
  }

  /**
   * Check if currently editing any cell
   */
  isEditingAny(): boolean {
    return this.editingRow !== null && this.editingCol !== null;
  }
}
