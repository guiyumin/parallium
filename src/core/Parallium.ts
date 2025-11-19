import type { ParalliumOptions } from "./types.js";
import { WebGPURenderer } from "../render/WebGPURenderer.js";
import { TextRenderer } from "../render/TextRenderer.js";
import { GridDataStore } from "../data/GridDataStore.js";
import { VirtualDataStore } from "../data/VirtualDataStore.js";
import { SelectionManager } from "./SelectionManager.js";

/**
 * Main Parallium class - High-performance spreadsheet powered by WebGPU
 */
export class Parallium {
  private canvas: HTMLCanvasElement;
  private renderer: WebGPURenderer | null = null;
  private textRenderer: TextRenderer | null = null;
  private dataStore: GridDataStore;
  private virtualDataStore: VirtualDataStore;
  private selectionManager: SelectionManager;
  private rows: number;
  private columns: number;
  private cellWidth: number;
  private cellHeight: number;
  private editInput: HTMLInputElement | null = null;
  private usingVirtualData: boolean = false;
  private scrollOffsetX: number = 0;
  private scrollOffsetY: number = 0;
  private devicePixelRatio: number = 1;

  constructor(options: ParalliumOptions) {
    this.canvas = options.canvas;
    this.rows = options.rows ?? 1000;
    this.columns = options.columns ?? 26;
    this.cellWidth = options.cellWidth ?? 100;
    this.cellHeight = options.cellHeight ?? 30;
    this.dataStore = new GridDataStore();
    this.virtualDataStore = new VirtualDataStore(1000); // Cache 1000 rows
    this.selectionManager = new SelectionManager();
  }

  /**
   * Initialize the grid and WebGPU
   */
  async init(): Promise<void> {
    // Store device pixel ratio
    this.devicePixelRatio = window.devicePixelRatio || 1;

    // Initialize WebGPU renderer
    this.renderer = new WebGPURenderer(this.canvas);
    await this.renderer.init();

    // Initialize text renderer
    this.textRenderer = new TextRenderer(this.canvas);
    // Initial resize to ensure alignment before first render
    const rect = this.canvas.getBoundingClientRect();
    this.textRenderer.resize(
      rect.width * this.devicePixelRatio,
      rect.height * this.devicePixelRatio,
      this.devicePixelRatio
    );

    // Set up event listeners
    this.setupEventListeners();

    // Create edit input element
    this.createEditInput();

    // Setup resize observer
    this.setupResizeObserver();

    // Start rendering
    this.render();
  }

  /**
   * Set up mouse event listeners
   */
  private setupEventListeners(): void {
    this.canvas.addEventListener("click", this.handleClick.bind(this));
    this.canvas.addEventListener("dblclick", this.handleDoubleClick.bind(this));
    this.canvas.addEventListener("wheel", this.handleWheel.bind(this), {
      passive: false,
    });
    window.addEventListener("keydown", this.handleKeydown.bind(this));
  }

  private resizeObserver: ResizeObserver | null = null;

  /**
   * Set up resize observer to handle canvas resizing
   */
  private setupResizeObserver(): void {
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === this.canvas) {
          this.handleResize();
        }
      }
    });
    this.resizeObserver.observe(this.canvas);
  }

  /**
   * Handle canvas resize
   */
  private handleResize(): void {
    if (!this.textRenderer) return;

    // Update DPR
    this.devicePixelRatio = window.devicePixelRatio || 1;

    // Get new CSS size
    const rect = this.canvas.getBoundingClientRect();

    // Update canvas buffer size to match CSS size * DPR
    const pixelWidth = Math.round(rect.width * this.devicePixelRatio);
    const pixelHeight = Math.round(rect.height * this.devicePixelRatio);

    // Always update canvas pixel dimensions to match CSS dimensions
    this.canvas.width = pixelWidth;
    this.canvas.height = pixelHeight;

    // Note: We don't strictly need to call this.textRenderer.resize() here
    // because renderGrid() now handles it automatically, but doing it here
    // ensures the overlay is resized immediately even if rendering is paused.
    this.textRenderer.resize(pixelWidth, pixelHeight, this.devicePixelRatio);
  }

  /**
   * Create the edit input element
   */
  private createEditInput(): void {
    this.editInput = document.createElement("input");
    this.editInput.type = "text";
    this.editInput.style.position = "absolute";
    this.editInput.style.display = "none";
    this.editInput.style.border = "2px solid #4CAF50";
    this.editInput.style.outline = "none";
    this.editInput.style.padding = "4px"; // Note: padding affects width calculation
    this.editInput.style.boxSizing = "border-box"; // Fix: Ensure padding doesn't overflow cell
    this.editInput.style.fontFamily = "monospace";
    this.editInput.style.fontSize = "14px";
    this.editInput.style.zIndex = "1000";

    // Add to canvas parent
    this.canvas.parentElement?.appendChild(this.editInput);

    // Handle input events
    this.editInput.addEventListener("blur", this.handleEditBlur.bind(this));
    this.editInput.addEventListener(
      "keydown",
      this.handleEditKeydown.bind(this)
    );
  }

  /**
   * Get cell coordinates from mouse event
   */
  private getCellFromMouseEvent(
    event: MouseEvent
  ): { row: number; col: number } | null {
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left + this.scrollOffsetX;
    const y = event.clientY - rect.top + this.scrollOffsetY;

    const col = Math.floor(x / this.cellWidth);
    const row = Math.floor(y / this.cellHeight);

    if (col >= 0 && col < this.columns && row >= 0 && row < this.rows) {
      return { row, col };
    }

    return null;
  }

  /**
   * Handle click event (select cell)
   */
  private handleClick(event: MouseEvent): void {
    const cell = this.getCellFromMouseEvent(event);
    if (cell) {
      this.selectionManager.selectCell(cell.row, cell.col);
      // console.log(`Selected cell: Row ${cell.row}, Col ${cell.col}`);
    }
  }

  /**
   * Handle double-click event (start editing)
   */
  private handleDoubleClick(event: MouseEvent): void {
    const cell = this.getCellFromMouseEvent(event);
    if (cell && this.editInput) {
      this.startEditing(cell.row, cell.col);
    }
  }

  /**
   * Start editing a cell
   */
  private startEditing(row: number, col: number): void {
    if (!this.editInput) {
      return;
    }

    this.selectionManager.startEditing(row, col);

    // Get current cell value
    const cellData = this.dataStore.getCell(row, col);
    this.editInput.value = cellData?.value.toString() ?? "";

    // FIX: Position input relative to the canvas element itself,
    // not the viewport (rect.left), because editInput is a sibling of canvas.
    // This prevents misalignment if the grid is not at (0,0) of the page.
    const x = col * this.cellWidth - this.scrollOffsetX;
    const y = row * this.cellHeight - this.scrollOffsetY;

    this.editInput.style.left = `${this.canvas.offsetLeft + x}px`;
    this.editInput.style.top = `${this.canvas.offsetTop + y}px`;
    this.editInput.style.width = `${this.cellWidth}px`;
    this.editInput.style.height = `${this.cellHeight}px`;
    this.editInput.style.display = "block";

    // Focus and select all text
    this.editInput.focus();
    this.editInput.select();

    console.log(`Editing cell: Row ${row}, Col ${col}`);
  }

  /**
   * Stop editing and save value
   */
  private stopEditing(save: boolean): void {
    if (!this.editInput) {
      return;
    }

    const editingCell = this.selectionManager.getEditingCell();
    if (editingCell && save) {
      const value = this.editInput.value;
      // Only save if value changed (optimization) or just overwrite
      if (value.trim()) {
        this.dataStore.setCell(editingCell.row, editingCell.col, { value });
      } else {
        this.dataStore.deleteCell(editingCell.row, editingCell.col);
      }
    }

    this.editInput.style.display = "none";
    this.selectionManager.stopEditing();
    this.canvas.focus();
  }

  /**
   * Handle edit input blur
   */
  private handleEditBlur(): void {
    this.stopEditing(true);
  }

  /**
   * Handle edit input keydown
   */
  private handleEditKeydown(event: KeyboardEvent): void {
    if (event.key === "Enter") {
      event.preventDefault();
      this.stopEditing(true);
    } else if (event.key === "Escape") {
      event.preventDefault();
      this.stopEditing(false);
    }
  }

  /**
   * Handle mouse wheel scrolling
   */
  private handleWheel(event: WheelEvent): void {
    event.preventDefault();

    if (this.selectionManager.isEditingAny()) {
      return;
    }

    const scrollSpeed = 1;
    const deltaX = event.deltaX * scrollSpeed;
    const deltaY = event.deltaY * scrollSpeed;

    const rawScrollX = this.scrollOffsetX + deltaX;
    const rawScrollY = this.scrollOffsetY + deltaY;

    // Convert canvas pixel width to CSS logical width
    const cssCanvasWidth = this.canvas.width / this.devicePixelRatio;
    const cssCanvasHeight = this.canvas.height / this.devicePixelRatio;

    const clampedX = Math.max(
      0,
      Math.min(rawScrollX, this.columns * this.cellWidth - cssCanvasWidth)
    );

    const clampedY = Math.max(
      0,
      Math.min(rawScrollY, this.rows * this.cellHeight - cssCanvasHeight)
    );

    // Round to nearest integer to ensure crisp rendering lines
    this.scrollOffsetX = Math.round(clampedX);
    this.scrollOffsetY = Math.round(clampedY);
  }

  /**
   * Handle keyboard navigation
   */
  private handleKeydown(event: KeyboardEvent): void {
    if (this.selectionManager.isEditingAny()) {
      return;
    }

    const selected = this.selectionManager.getSelectedCell();
    if (!selected) {
      return;
    }

    let newRow = selected.row;
    let newCol = selected.col;

    switch (event.key) {
      case "ArrowUp":
        event.preventDefault();
        newRow = Math.max(0, selected.row - 1);
        break;
      case "ArrowDown":
        event.preventDefault();
        newRow = Math.min(this.rows - 1, selected.row + 1);
        break;
      case "ArrowLeft":
        event.preventDefault();
        newCol = Math.max(0, selected.col - 1);
        break;
      case "ArrowRight":
        event.preventDefault();
        newCol = Math.min(this.columns - 1, selected.col + 1);
        break;
      case "PageUp":
        event.preventDefault();
        newRow = Math.max(
          0,
          selected.row -
            Math.floor(
              this.canvas.height / this.devicePixelRatio / this.cellHeight
            )
        );
        break;
      case "PageDown":
        event.preventDefault();
        newRow = Math.min(
          this.rows - 1,
          selected.row +
            Math.floor(
              this.canvas.height / this.devicePixelRatio / this.cellHeight
            )
        );
        break;
      case "Home":
        event.preventDefault();
        if (event.ctrlKey || event.metaKey) {
          newRow = 0;
          newCol = 0;
        } else {
          newCol = 0;
        }
        break;
      case "End":
        event.preventDefault();
        if (event.ctrlKey || event.metaKey) {
          newRow = this.rows - 1;
          newCol = this.columns - 1;
        } else {
          newCol = this.columns - 1;
        }
        break;
      case "Enter": // Start editing on Enter
        event.preventDefault();
        this.startEditing(selected.row, selected.col);
        break;
      default:
        // Type to start editing (if simple char)
        if (
          event.key.length === 1 &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.altKey
        ) {
          this.startEditing(selected.row, selected.col);
          // We don't set value here because the editInput isn't focused yet
          // until next frame, but the browser keypress might be lost.
          // For a robust app, we'd capture this key.
        }
        return;
    }

    if (newRow !== selected.row || newCol !== selected.col) {
      this.selectionManager.selectCell(newRow, newCol);
      this.scrollToCell(newRow, newCol);
    }
  }

  /**
   * Scroll to make a cell visible
   */
  private scrollToCell(row: number, col: number): void {
    const cellX = col * this.cellWidth;
    const cellY = row * this.cellHeight;

    const canvasWidthCSS = this.canvas.width / this.devicePixelRatio;
    const canvasHeightCSS = this.canvas.height / this.devicePixelRatio;

    if (cellY < this.scrollOffsetY) {
      this.scrollOffsetY = cellY;
    } else if (cellY + this.cellHeight > this.scrollOffsetY + canvasHeightCSS) {
      this.scrollOffsetY = Math.round(
        cellY + this.cellHeight - canvasHeightCSS
      );
    }

    if (cellX < this.scrollOffsetX) {
      this.scrollOffsetX = cellX;
    } else if (cellX + this.cellWidth > this.scrollOffsetX + canvasWidthCSS) {
      this.scrollOffsetX = Math.round(cellX + this.cellWidth - canvasWidthCSS);
    }
  }

  /**
   * Render the grid
   */
  private async render(): Promise<void> {
    if (!this.renderer || !this.textRenderer) {
      throw new Error("Renderer not initialized");
    }

    this.devicePixelRatio = window.devicePixelRatio || 1;

    // Render grid lines (WebGPU) - Pass logical units
    this.renderer.render({
      rows: this.rows,
      columns: this.columns,
      cellWidth: this.cellWidth,
      cellHeight: this.cellHeight,
      scrollOffsetX: this.scrollOffsetX,
      scrollOffsetY: this.scrollOffsetY,
      devicePixelRatio: this.devicePixelRatio,
    });

    const canvasWidthCSS = this.canvas.width / this.devicePixelRatio;
    const canvasHeightCSS = this.canvas.height / this.devicePixelRatio;

    const visibleRows = {
      start: Math.floor(this.scrollOffsetY / this.cellHeight),
      end: Math.min(
        Math.ceil((this.scrollOffsetY + canvasHeightCSS) / this.cellHeight),
        this.rows - 1
      ),
    };

    const visibleCols = {
      start: Math.floor(this.scrollOffsetX / this.cellWidth),
      end: Math.min(
        Math.ceil((this.scrollOffsetX + canvasWidthCSS) / this.cellWidth),
        this.columns - 1
      ),
    };

    await this.renderVisibleCells(
      visibleRows,
      visibleCols,
      this.cellWidth, // Passing LOGICAL width
      this.cellHeight, // Passing LOGICAL height
      this.scrollOffsetX,
      this.scrollOffsetY,
      this.devicePixelRatio
    );

    requestAnimationFrame(() => this.render());
  }

  /**
   * Render visible cells (text content)
   */
  private async renderVisibleCells(
    visibleRows: { start: number; end: number },
    visibleCols: { start: number; end: number },
    cellWidth: number, // Rename: These are logical units, not scaled
    cellHeight: number,
    scrollX: number,
    scrollY: number,
    devicePixelRatio: number
  ): Promise<void> {
    if (!this.textRenderer) {
      return;
    }

    const cellData = new Map<string, string>();

    if (this.usingVirtualData) {
      for (let row = visibleRows.start; row <= visibleRows.end; row++) {
        const rowData = await this.virtualDataStore.getRow(row);
        if (rowData) {
          for (let col = visibleCols.start; col <= visibleCols.end; col++) {
            const value = rowData.cells[col];
            if (value) {
              cellData.set(`${row},${col}`, value);
            }
          }
        }
      }
    } else {
      for (let row = visibleRows.start; row <= visibleRows.end; row++) {
        for (let col = visibleCols.start; col <= visibleCols.end; col++) {
          const cell = this.dataStore.getCell(row, col);
          if (cell) {
            cellData.set(`${row},${col}`, cell.value.toString());
          }
        }
      }
    }

    // RenderGrid handles the DPR scaling internally
    this.textRenderer.renderGrid(
      cellData,
      cellWidth,
      cellHeight,
      visibleRows,
      visibleCols,
      scrollX,
      scrollY,
      devicePixelRatio
    );
  }

  /**
   * Load a CSV file
   */
  async loadFile(
    file: File,
    onProgress?: (percent: number) => void
  ): Promise<void> {
    console.log(`Loading file: ${file.name}`);
    await this.virtualDataStore.loadFile(file, onProgress);
    this.rows = this.virtualDataStore.getRowCount();

    const firstRow = await this.virtualDataStore.getRow(0);
    if (firstRow) {
      this.columns = firstRow.cells.length;
    }

    this.usingVirtualData = true;
    console.log(`File loaded: ${this.rows} rows, ${this.columns} columns`);
  }

  /**
   * Get cell value
   */
  async getCellValue(row: number, col: number): Promise<string> {
    if (this.usingVirtualData) {
      const rowData = await this.virtualDataStore.getRow(row);
      return rowData?.cells[col] ?? "";
    } else {
      const cell = this.dataStore.getCell(row, col);
      return cell?.value.toString() ?? "";
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.renderer?.destroy();
    this.textRenderer?.destroy();
    this.resizeObserver?.disconnect();
    this.virtualDataStore.clear();
    this.editInput?.remove();
  }
}
