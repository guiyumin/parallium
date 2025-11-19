# Parallium - Product Requirements Document

## Project Overview

**Name:** Parallium

**Tagline:** High-performance, local-first spreadsheet powered by WebGPU

**Vision:** Professional-grade spreadsheet that leverages consumer GPU hardware to deliver desktop-class performance in the browser while keeping all data private and local.

## Core Value Proposition

1. **Performance** - Handle millions of rows with real-time interactivity
2. **Privacy** - All computation happens locally, data never leaves your device
3. **Power** - Leverage underutilized consumer GPU hardware (RTX 4060+, M-series Macs)
4. **Cost** - No cloud fees, no API costs, works offline

## Target Users

- **Data Analysts** - Working with large datasets (1M+ rows)
- **Financial Analysts** - Running simulations and models on sensitive data
- **Developers** - Need privacy-first tools for local data processing
- **Power Users** - Frustrated with slow performance of existing web spreadsheets

## WebGPU Capabilities Beyond Rendering

### 1. Formula Evaluation (Massive Parallelization)

- **Traditional approach**: Evaluate formulas sequentially, cell by cell
- **WebGPU approach**: Evaluate thousands/millions of formulas in parallel using compute shaders
- **Example**: `=A1 * 2` applied to 1 million rows → GPU evaluates all at once
- **Complex formulas**: SUM, AVERAGE, IF statements, nested formulas across huge ranges

**Concrete Example - Formula Dependency Graph:**

```
A1: 100
A2: =A1 * 2     (200)
A3: =A2 + 50    (250)
B1: =A1 + A2    (300)
... (repeated 1M times)
```

**CPU approach**: Evaluate sequentially, following dependencies (slow)

**WebGPU approach**:
1. Build dependency graph
2. Evaluate in parallel waves (all independent cells per wave)
3. Wave 1: A1 (1M cells)
4. Wave 2: A2 (1M cells) - all in parallel
5. Wave 3: A3, B1 (2M cells) - all in parallel

**Result**: 10-100x faster than CPU

### 2. Sorting (GPU-Accelerated)

- **Parallel sorting algorithms**: Bitonic sort, radix sort on GPU
- Sort 1M rows in milliseconds vs seconds on CPU
- Multi-column sorting with GPU compute shaders

### 3. Filtering & Searching

- **Parallel search**: Find all cells matching criteria across millions of rows simultaneously
- **Text matching**: Regular expressions, fuzzy search on GPU
- **Range queries**: Find all values between X and Y instantly

### 4. Aggregations (Pivot Tables, Group By)

- **Parallel reduction**: SUM, COUNT, AVG, MIN, MAX across millions of rows
- **Group by operations**: GPU can group and aggregate in parallel
- **Example**: "Sum sales by region" across 10M rows → GPU does it in milliseconds

### 5. Data Transformations

- **Map operations**: Apply transformations to entire columns
  - Convert text to uppercase/lowercase
  - Parse dates, format numbers
  - Mathematical operations on entire columns
- **Join operations**: Merge datasets using GPU

### 6. Statistical Analysis

- **Parallel computation** of:
  - Standard deviation, variance
  - Correlation matrices
  - Linear regression
  - Moving averages, rolling windows
  - Histograms, frequency distributions

### 7. Financial Calculations

- **Monte Carlo simulations**: Run thousands of scenarios in parallel
- **Risk analysis**: VaR (Value at Risk) calculations
- **Portfolio optimization**: Parallel evaluation of scenarios
- **Time-series forecasting**

### 8. Data Validation

- **Parallel checking**: Validate millions of cells against rules
- **Duplicate detection**: Find duplicates across huge datasets
- **Data quality checks**: Missing values, outliers, format validation

### 9. Charts & Visualizations (Data Prep)

- **Binning data**: Create histograms from millions of points
- **Sampling**: Smart downsampling for visualization
- **Heatmap generation**: Color calculations for conditional formatting

### 10. ML/AI Integration (Compute Shaders)

- **Anomaly detection**: Find outliers in data
- **Clustering**: Group similar rows together
- **Pattern recognition**: Identify trends, seasonality
- **Predictions**: Run ML inference on spreadsheet data

## Performance Targets

| Operation    | CPU (1M rows) | WebGPU Target (1M rows) | Improvement |
| ------------ | ------------- | ----------------------- | ----------- |
| SUM column   | ~50ms         | ~2ms                    | 25x         |
| Sort         | ~200ms        | ~10ms                   | 20x         |
| Filter       | ~100ms        | ~5ms                    | 20x         |
| Formula eval | ~500ms        | ~20ms                   | 25x         |
| Pivot table  | ~1000ms       | ~50ms                   | 20x         |

## Key Features

### Phase 1: Core Spreadsheet (MVP)

1. **Grid Rendering**
   - Virtual scrolling for millions of rows
   - 60fps smooth scrolling and panning
   - Cell selection, editing, copying/pasting
   - WebGPU-accelerated rendering

2. **Data Import/Export**
   - CSV import (drag & drop)
   - Large file support (100MB+)
   - Export to CSV
   - Streaming file parsing

3. **Basic Formulas**
   - Simple arithmetic (+, -, *, /)
   - Basic functions (SUM, AVG, COUNT, MIN, MAX)
   - GPU-accelerated formula evaluation
   - Dependency graph tracking

4. **Sorting & Filtering**
   - Single column sort
   - Multi-column sort
   - Basic filters
   - GPU-accelerated operations

### Phase 2: Advanced Features

1. **Complex Formulas**
   - IF, AND, OR statements
   - VLOOKUP, HLOOKUP
   - Text functions (CONCATENATE, SPLIT, etc.)
   - Date/time functions

2. **Pivot Tables**
   - Drag-and-drop interface
   - Multiple aggregation types
   - GPU-accelerated grouping and aggregation

3. **Charts & Visualizations**
   - Line, bar, scatter plots
   - Real-time updates as data changes
   - GPU-accelerated rendering

4. **Advanced Filtering**
   - Conditional formatting
   - Advanced filter expressions
   - Filter combinations (AND/OR)

### Phase 3: ML Integration

1. **Image Support**
   - Image cells (display images in grid)
   - Image classification
   - OCR (extract text from images)

2. **Data Intelligence**
   - Anomaly detection
   - Pattern recognition
   - Smart suggestions
   - Predictive modeling

3. **Natural Language**
   - Query data with natural language
   - Smart data cleaning suggestions

## Specific Use Case: Large File Processing

**Killer Feature: Drop a 5GB CSV → Work with it instantly**

1. Drop a 5GB CSV file → Indexed in seconds
2. Smooth scrolling through millions of rows
3. Real-time search and filtering across entire dataset
4. GPU-accelerated sorting and aggregations
5. Privacy: Your data never leaves your machine

**User Flow:**
1. User drags 5GB CSV file into browser
2. Parallium streams file, parses with GPU acceleration
3. Progress bar shows indexing status
4. Within seconds, user can:
   - Scroll smoothly through millions of rows
   - Filter/search across entire dataset
   - Run aggregations and pivot tables
   - Create charts and visualizations
5. All operations remain fast and responsive

## Technical Architecture

### Core Components

1. **WebGPU Engine**
   - Device initialization and management
   - Compute pipeline for data processing
   - Render pipeline for grid visualization
   - Buffer management and optimization

2. **Data Layer**
   - Efficient data structures for large datasets
   - Streaming file parser
   - Virtual data store (only load visible data)
   - GPU buffer synchronization

3. **Formula Engine**
   - Parser for formula syntax
   - Dependency graph builder
   - GPU compute shaders for parallel evaluation
   - Cache for computed values

4. **Rendering Engine**
   - Virtual scrolling system
   - Cell rendering with WebGPU
   - Selection and editing UI
   - 60fps animation and transitions

5. **ML Inference Engine** (Phase 3)
   - ONNX model loader
   - WebGPU compute shaders for inference
   - Pre-trained models for common tasks
   - Integration with spreadsheet data

### Technology Stack

- **Language**: TypeScript
- **Graphics**: WebGPU (compute + render pipelines)
- **UI Framework**: TBD (React/Svelte/Vanilla)
- **Build Tool**: Vite
- **Testing**: Vitest, Playwright
- **ML**: ONNX Runtime Web / Custom WebGPU kernels

## Success Metrics

1. **Performance**
   - Load 1M rows in < 5 seconds
   - Smooth 60fps scrolling
   - Formula recalculation < 100ms for 1M cells
   - Sort 1M rows in < 500ms

2. **Scale**
   - Support datasets up to 10M rows
   - Handle files up to 5GB
   - Maintain responsiveness at scale

3. **User Experience**
   - All operations feel instant
   - No loading states for common operations
   - Privacy guarantee (no network calls for data)

## Competitive Advantage

**vs Google Sheets:**
- 10-100x faster on large datasets
- Privacy (no data upload)
- Works offline
- No row limits

**vs Excel Online:**
- Better web performance
- GPU acceleration
- Cross-platform (works on any OS with browser)
- Free and open source

**vs Desktop Excel:**
- No installation required
- Cross-platform
- Modern web UI
- Extensible with ML features

## Risks & Mitigations

**Risk 1: WebGPU browser support**
- Mitigation: CPU fallback for browsers without WebGPU support
- Target users on modern browsers (Chrome 113+, Edge 113+)

**Risk 2: GPU memory limits**
- Mitigation: Stream data, only keep visible/active data in GPU
- Smart buffer management

**Risk 3: Learning curve for users**
- Mitigation: Familiar spreadsheet UI
- Progressive disclosure of advanced features
- Good documentation and examples

## Future Possibilities

1. **Collaboration** - Real-time collaboration with CRDT
2. **Extensions** - Plugin system for custom functions
3. **Data Connectors** - Connect to databases, APIs (local processing)
4. **Mobile Support** - Optimized mobile UI
5. **Desktop App** - Electron wrapper for desktop integration
6. **Advanced ML** - More ML models, custom model support

## Timeline

- **Phase 1 (MVP)**: 2-3 months
  - Basic grid, formulas, import/export
  - Core WebGPU engine

- **Phase 2 (Advanced)**: 2-3 months
  - Complex formulas, pivot tables, charts
  - Performance optimization

- **Phase 3 (ML)**: 2-3 months
  - ML integration, image support
  - Advanced features

## Open Questions

1. UI Framework choice? (React vs Svelte vs Vanilla)
2. File format for saving (custom binary vs JSON vs SQLite)?
3. Formula syntax compatibility (Excel-like vs custom)?
4. Monetization strategy (open source, freemium, paid)?
5. Target first use case (finance, data analysis, general)?
