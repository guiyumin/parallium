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

    // UVs with Y flipped (0 at top, 1 at bottom) for standard screen coordinates
    var uvs = array<vec2f, 6>(
        vec2f(0.0, 1.0),  // bottom-left
        vec2f(1.0, 1.0),  // bottom-right
        vec2f(0.0, 0.0),  // top-left
        vec2f(0.0, 0.0),  // top-left
        vec2f(1.0, 1.0),  // bottom-right
        vec2f(1.0, 0.0),  // top-right
    );

    var output: VertexOutput;
    output.position = vec4f(positions[vertexIndex], 0.0, 1.0);
    output.uv = uvs[vertexIndex];
    return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
    let viewportX = floor(input.uv.x * uniforms.canvasWidth);
    let viewportY = floor(input.uv.y * uniforms.canvasHeight);

    let cellWidth = uniforms.cellWidth;
    let cellHeight = uniforms.cellHeight;

    // High precision scroll offset
    let scrollX = uniforms.scrollOffsetXHigh + uniforms.scrollOffsetXLow;
    let scrollY = uniforms.scrollOffsetYHigh + uniforms.scrollOffsetYLow;

    let adjustedX = viewportX + scrollX;
    let adjustedY = viewportY + scrollY;

    // Calculate which cell we're in
    let cellCol = floor(adjustedX / cellWidth);
    let cellRow = floor(adjustedY / cellHeight);

    // Position within the cell (0 to cellWidth-1, 0 to cellHeight-1)
    let cellOffsetX = adjustedX - cellCol * cellWidth;
    let cellOffsetY = adjustedY - cellRow * cellHeight;

    let lineThickness: f32 = 1.0;

    // Draw lines on LEFT/TOP edges of cells (except for row 0 and col 0)
    let isVerticalLine = (cellOffsetX < lineThickness) && (cellCol > 0.0);
    let isHorizontalLine = (cellOffsetY < lineThickness) && (cellRow > 0.0);

    if (isVerticalLine || isHorizontalLine) {
        return vec4f(0.8, 0.8, 0.8, 1.0);
    }

    return vec4f(1.0, 1.0, 1.0, 1.0);
}