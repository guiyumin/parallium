// webgpurenderer.ts
// 逻辑：外部传入 cellWidth / cellHeight / scrollOffsetX / scrollOffsetY 全部是「逻辑单位」（CSS px）
// 在 render() 里统一乘 devicePixelRatio 转成像素，再写入 uniform。
// canvas.width / height 使用像素尺寸（rect * DPR），和 TextRenderer 保持一致。

import gridShaderCode from "./grid.wgsl?raw";

export interface GridRenderOptions {
  rows: number;
  columns: number;
  cellWidth: number; // 逻辑单位（CSS px）
  cellHeight: number; // 逻辑单位（CSS px）
  scrollOffsetX?: number; // 逻辑单位（CSS px）
  scrollOffsetY?: number; // 逻辑单位（CSS px）
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

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error("Failed to get WebGPU adapter");
    }

    this.device = await adapter.requestDevice();

    this.context = this.canvas.getContext("webgpu");
    if (!this.context) {
      throw new Error("Failed to get WebGPU context");
    }

    this.canvasFormat = navigator.gpu.getPreferredCanvasFormat();

    // 先配置一次，具体宽高在 render 时会根据 DPR 调整并重新配置（如有必要）
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

    // Uniform buffer：8 个 f32（32 字节），对齐需要 16 的倍数，直接给 64 字节
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
   * 当前 canvas 的像素宽高（给 TextRenderer 用来 resize）
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
   * 注意：cellWidth / cellHeight / scrollOffsetX / scrollOffsetY 都是「逻辑单位」，内部会乘 DPR 变成像素。
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

    // 用 DOM 尺寸 * DPR 得到像素尺寸
    const rect = this.canvas.getBoundingClientRect();
    const pixelWidth = Math.max(1, Math.round(rect.width * dpr));
    const pixelHeight = Math.max(1, Math.round(rect.height * dpr));

    // 如果像素尺寸变化了，更新 canvas 和 context
    if (
      this.canvas.width !== pixelWidth ||
      this.canvas.height !== pixelHeight
    ) {
      this.canvas.width = pixelWidth;
      this.canvas.height = pixelHeight;

      this.context.configure({
        device: this.device,
        format: this.canvasFormat,
        alphaMode: "opaque",
      });

      this.pixelWidth = pixelWidth;
      this.pixelHeight = pixelHeight;
    }

    // 把逻辑单位转换为像素单位（和 shader 保持一致）
    const cellWidthPx = options.cellWidth * dpr;
    const cellHeightPx = options.cellHeight * dpr;
    const scrollOffsetXPx = (options.scrollOffsetX ?? 0) * dpr;
    const scrollOffsetYPx = (options.scrollOffsetY ?? 0) * dpr;

    // Split scroll offsets for high precision (shader expects High/Low pairs)
    const uniformData = new Float32Array([
      this.canvas.width, // canvasWidth（像素）
      this.canvas.height, // canvasHeight（像素）
      cellWidthPx, // cellWidth（像素）
      cellHeightPx, // cellHeight（像素）
      scrollOffsetXPx, // scrollOffsetXHigh（像素）
      0, // scrollOffsetXLow (not needed for now, but shader expects it)
      scrollOffsetYPx, // scrollOffsetYHigh（像素）
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
    // 2 个三角形，画满屏
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
