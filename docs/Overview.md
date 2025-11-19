# ngengrid Overview

**ngengrid** is a high-performance, local-first spreadsheet application powered by WebGPU. It is designed to handle large datasets efficiently by leveraging modern browser capabilities.

## Key Features

- **WebGPU Rendering**: Utilizes WebGPU for hardware-accelerated rendering of the grid structure, ensuring smooth performance even with massive datasets.
- **Virtual Data Store**: Implements a virtual data store that indexes large CSV files and loads rows on-demand, minimizing memory usage.
- **Local-First Architecture**: All data processing happens locally in the user's browser, ensuring data privacy and eliminating server latency.
- **Custom Text Rendering**: Features a specialized text renderer optimized for grid content.
- **Hybrid Data Management**: Combines an in-memory store for edits with a file-backed virtual store for bulk data.

## Architecture

The project is structured around several core components:

### Core
- **`NgenGrid`**: The main controller class that orchestrates the renderer, data stores, and user interactions.
- **`SelectionManager`**: Manages cell selection and editing states.

### Rendering
- **`WebGPURenderer`**: Handles the drawing of grid lines and background using WebGPU shaders (`grid.wgsl`). It manages the GPU device, pipeline, and uniform buffers.
- **`TextRenderer`**: A separate renderer dedicated to drawing cell text efficiently.

### Data
- **`VirtualDataStore`**: A sophisticated data store for large files. It builds an index of row positions in the file and uses an LRU cache (`LRUCache`) to manage loaded rows.
- **`GridDataStore`**: A standard in-memory data store for smaller datasets and user edits.

## Usage

To initialize the grid:

```typescript
import { NgenGrid } from './core/NgenGrid';

const canvas = document.getElementById('grid-canvas') as HTMLCanvasElement;
const grid = new NgenGrid({
  canvas,
  rows: 1000,
  columns: 26,
  cellWidth: 100,
  cellHeight: 30
});

await grid.init();
```

## Loading Data

You can load large CSV files directly:

```typescript
const fileInput = document.getElementById('file-input');
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (file) {
    await grid.loadFile(file);
  }
});
```
