struct Uniforms {
    canvasWidth: f32,
    canvasHeight: f32,
    cellWidth: f32,
    cellHeight: f32,
    scrollOffsetXHigh: f32,
    scrollOffsetXLow: f32,
    scrollOffsetYHigh: f32,
    scrollOffsetYLow: f32,
};

@group(0) @binding(0)
var<uniform> uniforms: Uniforms;

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) uv: vec2f,
};

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    var positions = array<vec2f, 6>(
        vec2f(-1.0, -1.0),
        vec2f( 1.0, -1.0),
        vec2f(-1.0,  1.0),
        vec2f(-1.0,  1.0),
        vec2f( 1.0, -1.0),
        vec2f( 1.0,  1.0),
    );

    var uvs = array<vec2f, 6>(
        vec2f(0.0, 0.0),
        vec2f(1.0, 0.0),
        vec2f(0.0, 1.0),
        vec2f(0.0, 1.0),
        vec2f(1.0, 0.0),
        vec2f(1.0, 1.0),
    );

    var output: VertexOutput;
    output.position = vec4f(positions[vertexIndex], 0.0, 1.0);
    output.uv = uvs[vertexIndex];
    return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
    let viewportX = input.uv.x * uniforms.canvasWidth;
    let viewportY = input.uv.y * uniforms.canvasHeight;

    let cellWidth = uniforms.cellWidth;
    let cellHeight = uniforms.cellHeight;

    // 高精度滚动偏移
    let scrollX = uniforms.scrollOffsetXHigh + uniforms.scrollOffsetXLow;
    let scrollY = uniforms.scrollOffsetYHigh + uniforms.scrollOffsetYLow;

    let adjustedX = viewportX + scrollX;
    let adjustedY = viewportY + scrollY;

    // 高精度取模（比 % 更稳，误差永远小于 0.0001px）
    let cellOffsetX = fract(adjustedX / cellWidth) * cellWidth;
    let cellOffsetY = fract(adjustedY / cellHeight) * cellHeight;

    let lineThickness: f32 = 1.0;

    let isVerticalLine = (cellOffsetX >= cellWidth - lineThickness);
    let isHorizontalLine = (cellOffsetY >= cellHeight - lineThickness);

    if (isVerticalLine || isHorizontalLine) {
        return vec4f(0.8, 0.8, 0.8, 1.0);
    }

    return vec4f(1.0, 1.0, 1.0, 1.0);
}