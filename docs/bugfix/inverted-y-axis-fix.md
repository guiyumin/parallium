# Bug Fix: Inverted Y-Axis Causing First Row Height Issue

**Date**: 2025-01-19
**Status**: Fixed
**Severity**: High
**Component**: WebGPU Grid Renderer

## Problem Description

### Symptoms
- The first row appeared significantly shorter (~12px) compared to other rows (~24px)
- All subsequent rows had consistent, correct heights
- Row 0 (first row) was not visible at all when scrolled to the top
- Grid appeared to start rendering partway down the canvas

### User Impact
- Inconsistent cell heights made the spreadsheet unusable
- Users could not see or interact with row 0
- Visual alignment between grid lines and text was broken

## Root Cause Analysis

The Y-axis coordinate system in the WebGPU shader was **inverted**.

### Technical Details

In `src/render/grid.wgsl`, the UV coordinates were mapped incorrectly:

**Before (Incorrect)**:
```wgsl
var uvs = array<vec2f, 6>(
    vec2f(0.0, 0.0),  // bottom-left
    vec2f(1.0, 0.0),  // bottom-right
    vec2f(0.0, 1.0),  // top-left
    vec2f(0.0, 1.0),  // top-left
    vec2f(1.0, 0.0),  // bottom-right
    vec2f(1.0, 1.0),  // top-right
);
```

This mapping resulted in:
- `uv.y = 0.0` → Bottom of screen
- `uv.y = 1.0` → Top of screen

When the fragment shader calculated `viewportY = input.uv.y * canvasHeight`:
- Pixel at top of canvas got `viewportY ≈ canvasHeight` (e.g., 1609)
- Pixel at bottom of canvas got `viewportY = 0`

This caused:
- Row 0 to be rendered at the **bottom** of the canvas (off-screen)
- Higher row numbers to appear at the top
- The visible "first row" was actually a partial view of row 1

## Solution

### Fix Implementation

Flipped the UV Y-coordinates to match standard screen coordinates:

**After (Correct)**:
```wgsl
// UVs with Y flipped (0 at top, 1 at bottom) for standard screen coordinates
var uvs = array<vec2f, 6>(
    vec2f(0.0, 1.0),  // bottom-left
    vec2f(1.0, 1.0),  // bottom-right
    vec2f(0.0, 0.0),  // top-left
    vec2f(0.0, 0.0),  // top-left
    vec2f(1.0, 1.0),  // bottom-right
    vec2f(1.0, 0.0),  // top-right
);
```

Now:
- `uv.y = 0.0` → Top of screen
- `uv.y = 1.0` → Bottom of screen

### Files Modified
- `src/render/grid.wgsl:31-39` - Fixed UV coordinate mapping

## Verification

### Debug Process
1. Added colored tints to different rows to visualize row numbers
2. Added red line at `viewportY < 5` to verify coordinate origin
3. Confirmed red line appeared at bottom (proving Y-axis inversion)
4. Applied UV flip fix
5. Verified red line moved to top and all rows had equal heights

### Test Results
- ✅ All rows now have consistent heights (24px logical / 48px device pixels)
- ✅ Row 0 is fully visible when scrolled to top
- ✅ Grid lines align correctly with cell boundaries
- ✅ Text rendering aligns with grid cells
- ✅ Scrolling works correctly in both directions

## Lessons Learned

### WebGPU Coordinate Systems
- WebGPU clip space: Y+ is up, ranging from -1 (bottom) to +1 (top)
- Screen/texture coordinates: Typically Y=0 at top, Y=1 at bottom
- **Always verify UV mapping** matches the intended screen coordinate system

### Debugging Graphics Issues
1. Use simple color-coded regions to visualize coordinate systems
2. Test at coordinate boundaries (0, max values)
3. Verify assumptions about coordinate system origins
4. Add temporary visual debugging before diving into complex math

### Prevention
- Document coordinate system assumptions in shader code
- Add unit tests or visual regression tests for renderer
- Consider adding shader validation for coordinate ranges

## Related Issues
- Text/grid alignment issues were initially suspected but were actually masked by this bug
- Uniform buffer mismatch was discovered and fixed during investigation
- Grid line positioning (LEFT/TOP vs RIGHT/BOTTOM) was adjusted during debug process

## Impact
**Critical fix** - The spreadsheet is now usable with correct, consistent row heights across all cells.
