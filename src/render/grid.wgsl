// grid.wgsl
// 所有 uniforms 都使用「像素单位」：canvasWidth / canvasHeight / cellWidth / cellHeight / scrollOffsetX / scrollOffsetY
// 顶点着色器画一个全屏 quad，片元着色器按像素坐标算出每个 cell 内的位置并画线

struct Uniforms {
    canvasWidth: f32,
    canvasHeight: f32,
    cellWidth: f32,
    cellHeight: f32,
    scrollOffsetX: f32,
    scrollOffsetY: f32,
};

@group(0) @binding(0)
var<uniform> uniforms: Uniforms;

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) uv: vec2f,
};

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    // 全屏 quad（NDC）
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
    // UV -> 像素坐标（viewport space），注意这里使用 canvasWidth / canvasHeight（像素）
    let viewportX = input.uv.x * uniforms.canvasWidth;
    let viewportY = input.uv.y * uniforms.canvasHeight;

    // 滚动偏移也都是像素单位
    let cellWidth = uniforms.cellWidth;
    let cellHeight = uniforms.cellHeight;

    // 将全局 scrollOffset 拆分成 “滚动了多少个 cell + cell 内的偏移”
    let scrollCellRow = floor(uniforms.scrollOffsetY / cellHeight);
    let scrollOffsetInCellY = uniforms.scrollOffsetY - scrollCellRow * cellHeight;

    let scrollCellCol = floor(uniforms.scrollOffsetX / cellWidth);
    let scrollOffsetInCellX = uniforms.scrollOffsetX - scrollCellCol * cellWidth;

    // 当前像素在整个文档中的位置（像素）
    let adjustedX = viewportX + scrollOffsetInCellX;
    let adjustedY = viewportY + scrollOffsetInCellY;

    // 当前像素在 cell 内部的偏移（像素）
    let cellOffsetX = adjustedX % cellWidth;
    let cellOffsetY = adjustedY % cellHeight;

    // 实际 cell 行列（从 0 开始，float 表示）
    let localCellCol = floor(adjustedX / cellWidth);
    let localCellRow = floor(adjustedY / cellHeight);
    let actualCellCol = scrollCellCol + localCellCol;
    let actualCellRow = scrollCellRow + localCellRow;

    // 画网格线：画每个 cell 的底边和右边（而不是上边和左边）
    // 这样可以避免第一行/第一列的边界问题
    let lineThickness: f32 = 1.0; // 1 像素线

    // 垂直线：画在 cell 的右边界
    let isVerticalLine = (cellOffsetX >= cellWidth - lineThickness);

    // 水平线：画在 cell 的底边界
    let isHorizontalLine = (cellOffsetY >= cellHeight - lineThickness);

    if (isVerticalLine || isHorizontalLine) {
        // 灰色线
        return vec4f(0.8, 0.8, 0.8, 1.0);
    }

    // 白色背景
    return vec4f(1.0, 1.0, 1.0, 1.0);
}