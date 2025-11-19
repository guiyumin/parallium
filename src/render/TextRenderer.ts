// text-renderer.ts
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

    canvas.parentElement?.appendChild(this.textCanvas);

    const textCtx = this.textCanvas.getContext("2d");
    if (!textCtx) {
      throw new Error("Failed to get 2D context for text canvas");
    }
    this.textCtx = textCtx;
  }

  /**
   * Resize text canvas to match main canvas (pixel size + CSS size)
   *
   * @param pixelWidth - canvas 像素宽度（通常 = rect.width * DPR）
   * @param pixelHeight - canvas 像素高度
   * @param devicePixelRatio - 当前 DPR
   */
  resize(
    pixelWidth: number,
    pixelHeight: number,
    devicePixelRatio: number = 1
  ): void {
    this.devicePixelRatio = devicePixelRatio;

    // 内部像素分辨率
    this.textCanvas.width = pixelWidth;
    this.textCanvas.height = pixelHeight;

    // CSS 大小保持和主 canvas 一致（CSS px）
    const rect = this.canvas.getBoundingClientRect();
    this.textCanvas.style.width = `${rect.width}px`;
    this.textCanvas.style.height = `${rect.height}px`;
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

    if (this.textCtx.measureText(text).width > maxWidth) {
      // 简单的二分截断 "...”
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
   *
   * 注意：cellWidth / cellHeight / scrollOffsetX / scrollOffsetY 仍然是「逻辑单位（CSS px）」，
   * 这里统一乘 this.devicePixelRatio 变成像素，和 WebGPU 的 grid 保持一致。
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
    this.clear();

    const dpr = devicePixelRatio ?? this.devicePixelRatio;

    // 逻辑 -> 像素
    const cellWidthPx = cellWidth * dpr;
    const cellHeightPx = cellHeight * dpr;
    const scrollOffsetXPx = scrollOffsetX * dpr;
    const scrollOffsetYPx = scrollOffsetY * dpr;

    for (let row = visibleRows.start; row <= visibleRows.end; row++) {
      for (let col = visibleCols.start; col <= visibleCols.end; col++) {
        const key = `${row},${col}`;
        const value = data.get(key);
        if (!value) continue;

        // 每个 cell 的像素位置（和 WebGPU 的 grid 算法一致：row/col * cellSizePx - scrollOffsetPx）
        const xPx = col * cellWidthPx - scrollOffsetXPx;
        const yPx = row * cellHeightPx - scrollOffsetYPx;

        this.renderCell(value, xPx, yPx, cellWidthPx, cellHeightPx, {
          fontSize: 14,
          fontFamily: "monospace",
          color: "#000000",
          align: "left",
          verticalAlign: "middle",
        }, dpr);
      }
    }
  }

  /**
   * Clean up
   */
  destroy(): void {
    this.textCanvas.remove();
    // 其他引用交给 GC
  }
}
