// webgpurenderer.ts
// Logic: cellWidth / cellHeight / scrollOffsetX / scrollOffsetY passed from outside are all in "logical units" (CSS px)
// In render(), they are uniformly multiplied by devicePixelRatio to convert to pixels, then written to uniforms.
// canvas.width / height use pixel dimensions (rect * DPR), consistent with TextRenderer.

import gridShaderCode from "./grid.wgsl?raw";

export interface GridRenderOptions {
  rows: number;
  columns: number;
  cellWidth: number; // logical unit (CSS px)
  cellHeight: number; // logical unit (CSS px)
  scrollOffsetX?: number; // logical unit (CSS px)
  scrollOffsetY?: number; // logical unit (CSS px)
  devicePixelRatio?: number;
}

/**
 * WebGPU Renderer for the grid
 */
export class WebGPURenderer {
  private canvas: HTMLCanvasElement;

  private device: GPUDevice | null = null;
  private context: GPUCanvasContext | null = null;
  private canvasFormat: GPUTextureFormat | null = null;

  private renderPipeline: GPURenderPipeline | null = null;
  private uniformBuffer: GPUBuffer | null = null;
  private bindGroup: GPUBindGroup | null = null;

  private pixelWidth = 0;
  private pixelHeight = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  /**
   * Initialize WebGPU device and rendering pipeline
   */
  async init(): Promise<void> {
    if (!navigator.gpu) {
      throw new Error("WebGPU is not supported in this browser");
    }

    const adapter = await navigator.gpu?.requestAdapter();
    if (!adapter) {
      throw new Error("Failed to get WebGPU adapter");
    }

    this.device = await adapter.requestDevice();

    this.context = this.canvas.getContext("webgpu");
    if (!this.context) {
      throw new Error("Failed to get WebGPU context");
    }

    this.canvasFormat = navigator.gpu.getPreferredCanvasFormat();

    // Configure once first, specific width/height will be adjusted and reconfigured in render based on DPR (if necessary)
    this.context.configure({
      device: this.device,
      format: this.canvasFormat,
      alphaMode: "opaque",
    });

    await this.createRenderPipeline(this.canvasFormat);

    console.log("[WebGPURenderer] WebGPU initialized successfully");
  }

  /**
   * Create the rendering pipeline
   */
  private async createRenderPipeline(format: GPUTextureFormat): Promise<void> {
    if (!this.device) {
      throw new Error("Device not initialized");
    }

    // Uniform buffer: 8 f32 values (32 bytes), alignment requires multiples of 16, so we allocate 64 bytes
    this.uniformBuffer = this.device.createBuffer({
      label: "Grid Uniforms",
      size: 64,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const shaderModule = this.device.createShaderModule({
      label: "Grid Shader",
      code: gridShaderCode,
    });

    this.renderPipeline = this.device.createRenderPipeline({
      label: "Grid Render Pipeline",
      layout: "auto",
      vertex: {
        module: shaderModule,
        entryPoint: "vertexMain",
      },
      fragment: {
        module: shaderModule,
        entryPoint: "fragmentMain",
        targets: [{ format }],
      },
    });

    this.bindGroup = this.device.createBindGroup({
      label: "Grid Bind Group",
      layout: this.renderPipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: { buffer: this.uniformBuffer },
        },
      ],
    });
  }

  /**
   * Current canvas pixel width and height (for TextRenderer to use for resize)
   */
  getPixelWidth(): number {
    return this.pixelWidth;
  }

  getPixelHeight(): number {
    return this.pixelHeight;
  }

  /**
   * Render the grid
   *
   * Note: cellWidth / cellHeight / scrollOffsetX / scrollOffsetY are all in "logical units", internally multiplied by DPR to become pixels.
   */
  render(options: GridRenderOptions): void {
    if (
      !this.device ||
      !this.context ||
      !this.renderPipeline ||
      !this.uniformBuffer ||
      !this.bindGroup ||
      !this.canvasFormat
    ) {
      throw new Error("Renderer not fully initialized");
    }

    const dpr = options.devicePixelRatio ?? window.devicePixelRatio ?? 1;

    // Get pixel dimensions using DOM dimensions * DPR
    const rect = this.canvas.getBoundingClientRect();
    const pixelWidth = Math.max(1, Math.round(rect.width * dpr));
    const pixelHeight = Math.max(1, Math.round(rect.height * dpr));

    // If pixel dimensions changed, update canvas and context
    if (
      this.canvas.width !== pixelWidth ||
      this.canvas.height !== pixelHeight
    ) {
      this.canvas.width = pixelWidth;
      this.canvas.height = pixelHeight;

      // Reconfigure context immediately after resize to prevent black flash
      this.context.configure({
        device: this.device,
        format: this.canvasFormat,
        alphaMode: "opaque",
      });

      this.pixelWidth = pixelWidth;
      this.pixelHeight = pixelHeight;

      // Immediately render to the new size to avoid showing empty canvas
      // (The render will continue below with updated dimensions)
    }

    // Convert logical units to pixel units (consistent with shader)
    const cellWidthPx = options.cellWidth * dpr;
    const cellHeightPx = options.cellHeight * dpr;
    const scrollOffsetXPx = (options.scrollOffsetX ?? 0) * dpr;
    const scrollOffsetYPx = (options.scrollOffsetY ?? 0) * dpr;

    // Split scroll offsets for high precision (shader expects High/Low pairs)
    const uniformData = new Float32Array([
      this.canvas.width, // canvasWidth (pixels)
      this.canvas.height, // canvasHeight (pixels)
      cellWidthPx, // cellWidth (pixels)
      cellHeightPx, // cellHeight (pixels)
      scrollOffsetXPx, // scrollOffsetXHigh (pixels)
      0, // scrollOffsetXLow (not needed for now, but shader expects it)
      scrollOffsetYPx, // scrollOffsetYHigh (pixels)
      0, // scrollOffsetYLow (not needed for now, but shader expects it)
    ]);

    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);

    const encoder = this.device.createCommandEncoder();
    const textureView = this.context.getCurrentTexture().createView();

    const renderPass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          clearValue: { r: 1, g: 1, b: 1, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });

    renderPass.setPipeline(this.renderPipeline);
    renderPass.setBindGroup(0, this.bindGroup);
    // 2 triangles to fill the screen
    renderPass.draw(6);
    renderPass.end();

    this.device.queue.submit([encoder.finish()]);
  }

  /**
   * Clean up WebGPU resources
   */
  destroy(): void {
    this.device = null;
    this.context = null;
    this.renderPipeline = null;
    this.uniformBuffer = null;
    this.bindGroup = null;
  }
}
