// 逻辑：外部传入 cellWidth / cellHeight / scrollOffsetX / scrollOffsetY 全是「逻辑单位」（CSS px）
// 在 renderGrid 里统一乘 this.devicePixelRatio 变成像素，和 WebGPU 的 grid 完全对齐。
// textCanvas.width / height 使用像素尺寸；CSS width / height 用 rect.width / height（CSS px）。

export interface VisibleRange {
  start: number;
  end: number;
}

export interface RenderCellOptions {
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  align?: "left" | "center" | "right";
  verticalAlign?: "top" | "middle" | "bottom";
}

/**
 * Text renderer using Canvas 2D API
 * Renders on top of WebGPU grid
 */
export class TextRenderer {
  private canvas: HTMLCanvasElement;
  private textCanvas: HTMLCanvasElement;
  private textCtx: CanvasRenderingContext2D;
  private devicePixelRatio = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    // 叠加一个透明 canvas 专门画文字
    this.textCanvas = document.createElement("canvas");
    this.textCanvas.style.position = "absolute";
    this.textCanvas.style.pointerEvents = "none";
    this.textCanvas.style.left = "0";
    this.textCanvas.style.top = "0";
    // Ensure we default to top-left of the offset parent,
    // but we will sync exact coordinates in resize().

    canvas.parentElement?.appendChild(this.textCanvas);

    const textCtx = this.textCanvas.getContext("2d");
    if (!textCtx) {
      throw new Error("Failed to get 2D context for text canvas");
    }
    this.textCtx = textCtx;
  }

  /**
   * Resize text canvas to match main canvas (pixel size + CSS size + Position)
   *
   * This now also syncs the Position (left/top) to ensure the overlay
   * stays perfectly aligned if the main canvas moves (e.g. via margin:auto).
   */
  resize(
    pixelWidth: number,
    pixelHeight: number,
    devicePixelRatio: number = 1
  ): void {
    this.devicePixelRatio = devicePixelRatio;

    // 1. Match Internal Resolution (Pixel Size)
    // Only write if changed to avoid Canvas context reset if possible
    if (
      this.textCanvas.width !== pixelWidth ||
      this.textCanvas.height !== pixelHeight
    ) {
      this.textCanvas.width = pixelWidth;
      this.textCanvas.height = pixelHeight;
    }

    // 2. Match CSS Size (Visual Size)
    // We calculate CSS size from the target pixel size to ensure consistency
    const cssWidth = pixelWidth / devicePixelRatio;
    const cssHeight = pixelHeight / devicePixelRatio;
    this.textCanvas.style.width = `${cssWidth}px`;
    this.textCanvas.style.height = `${cssHeight}px`;

    // 3. Match CSS Position (Alignment)
    // This fixes the issue where resizing the tab moves the main grid (e.g. centering)
    // but the absolute text overlay stayed at left:0.
    this.textCanvas.style.left = `${this.canvas.offsetLeft}px`;
    this.textCanvas.style.top = `${this.canvas.offsetTop}px`;
  }

  /**
   * Clear text canvas
   */
  clear(): void {
    this.textCtx.clearRect(0, 0, this.textCanvas.width, this.textCanvas.height);
  }

  /**
   * Render text in a single cell
   *
   * x / y / width / height 现在都是「像素单位」
   */
  renderCell(
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
    options?: RenderCellOptions,
    dpr: number = 1
  ): void {
    const baseFontSize = options?.fontSize ?? 14; // 逻辑 fontSize
    const fontSize = baseFontSize * dpr; // 像素 fontSize
    const fontFamily = options?.fontFamily ?? "monospace";
    const color = options?.color ?? "#000";
    const align = options?.align ?? "left";
    const verticalAlign = options?.verticalAlign ?? "middle";

    this.textCtx.font = `${fontSize}px ${fontFamily}`;
    this.textCtx.fillStyle = color;

    // padding 也按逻辑单位乘 DPR
    const paddingX = 6 * dpr;
    const paddingY = 2 * dpr;
    let textX = x + paddingX;
    let textY = y;

    // 水平对齐
    if (align === "center") {
      textX = x + width / 2;
      this.textCtx.textAlign = "center";
    } else if (align === "right") {
      textX = x + width - paddingX;
      this.textCtx.textAlign = "right";
    } else {
      textX = x + paddingX;
      this.textCtx.textAlign = "left";
    }

    // 垂直对齐（注意 baseline）
    if (verticalAlign === "middle") {
      this.textCtx.textBaseline = "middle";
      textY = y + height / 2;
    } else if (verticalAlign === "top") {
      this.textCtx.textBaseline = "top";
      textY = y + paddingY;
    } else {
      // bottom
      this.textCtx.textBaseline = "bottom";
      textY = y + height - paddingY;
    }

    const maxWidth = width - paddingX * 2;
    let displayText = text;

    // Simple binary search truncation
    if (this.textCtx.measureText(text).width > maxWidth) {
      let low = 0;
      let high = text.length;

      while (low < high) {
        const mid = Math.floor((low + high + 1) / 2);
        const truncated = text.substring(0, mid) + "...";

        if (this.textCtx.measureText(truncated).width <= maxWidth) {
          low = mid;
        } else {
          high = mid - 1;
        }
      }

      displayText = text.substring(0, low) + "...";
    }

    this.textCtx.fillText(displayText, textX, textY);
  }

  /**
   * Render grid of text values
   */
  renderGrid(
    data: Map<string, string>,
    cellWidth: number, // 逻辑单位
    cellHeight: number, // 逻辑单位
    visibleRows: VisibleRange,
    visibleCols: VisibleRange,
    scrollOffsetX: number = 0, // 逻辑单位
    scrollOffsetY: number = 0, // 逻辑单位
    devicePixelRatio?: number
  ): void {
    // 1. Get current DPR
    const dpr = devicePixelRatio ?? window.devicePixelRatio ?? 1;

    // 2. Auto-Resize & Re-Align
    // We check the MAIN canvas bounding box to see what size/pos it currently is.
    const rect = this.canvas.getBoundingClientRect();
    const targetPixelWidth = Math.max(1, Math.round(rect.width * dpr));
    const targetPixelHeight = Math.max(1, Math.round(rect.height * dpr));

    // We must check if size OR position (offset) needs updating.
    // However, offsetLeft checks are cheap, so we just call resize if dimensions change,
    // AND we enforce position update every frame to handle layout shifts (like flex/margin changes).
    if (
      this.textCanvas.width !== targetPixelWidth ||
      this.textCanvas.height !== targetPixelHeight ||
      this.devicePixelRatio !== dpr
    ) {
      this.resize(targetPixelWidth, targetPixelHeight, dpr);
    } else {
      // Always sync position just in case the layout moved without resizing (e.g. margin change)
      if (this.textCanvas.style.left !== `${this.canvas.offsetLeft}px`) {
        this.textCanvas.style.left = `${this.canvas.offsetLeft}px`;
      }
      if (this.textCanvas.style.top !== `${this.canvas.offsetTop}px`) {
        this.textCanvas.style.top = `${this.canvas.offsetTop}px`;
      }
    }

    this.clear();

    // 逻辑 -> 像素
    const cellWidthPx = cellWidth * dpr;
    const cellHeightPx = cellHeight * dpr;
    const scrollOffsetXPx = scrollOffsetX * dpr;
    const scrollOffsetYPx = scrollOffsetY * dpr;

    // Optimization: Clip to avoid drawing text far outside visible area
    this.textCtx.save();
    this.textCtx.beginPath();
    this.textCtx.rect(0, 0, this.textCanvas.width, this.textCanvas.height);
    this.textCtx.clip();

    for (let row = visibleRows.start; row <= visibleRows.end; row++) {
      for (let col = visibleCols.start; col <= visibleCols.end; col++) {
        const key = `${row},${col}`;
        const value = data.get(key);
        if (!value) continue;

        const xPx = col * cellWidthPx - scrollOffsetXPx;
        const yPx = row * cellHeightPx - scrollOffsetYPx;

        // Skip if completely out of bounds (simple culling)
        if (
          xPx > this.textCanvas.width ||
          yPx > this.textCanvas.height ||
          xPx + cellWidthPx < 0 ||
          yPx + cellHeightPx < 0
        ) {
          continue;
        }

        this.renderCell(
          value,
          xPx,
          yPx,
          cellWidthPx,
          cellHeightPx,
          {
            fontSize: 14,
            fontFamily: "monospace",
            color: "#000000",
            align: "left",
            verticalAlign: "middle",
          },
          dpr
        );
      }
    }

    this.textCtx.restore();
  }

  /**
   * Clean up
   */
  destroy(): void {
    this.textCanvas.remove();
    // 其他引用交给 GC
  }
}
