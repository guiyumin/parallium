import { LRUCache } from './LRUCache.js';

/**
 * Row index entry - stores file position of each row
 */
interface RowIndex {
  offset: number;  // Byte offset in file
  length: number;  // Length in bytes
}

/**
 * Parsed row data
 */
export interface ParsedRow {
  rowNumber: number;
  cells: string[];
}

/**
 * Virtual data store for large files
 * Only keeps an index in memory, loads rows on-demand
 */
export class VirtualDataStore {
  private file: File | null = null;
  private rowIndex: Map<number, RowIndex> = new Map();
  private rowCache: LRUCache<number, ParsedRow>;
  private totalRows: number = 0;
  private isIndexed: boolean = false;

  constructor(cacheSize: number = 1000) {
    this.rowCache = new LRUCache(cacheSize);
  }

  /**
   * Load a file and build index
   */
  async loadFile(file: File, onProgress?: (percent: number) => void): Promise<void> {
    this.file = file;
    this.rowIndex.clear();
    this.rowCache.clear();
    this.isIndexed = false;

    console.log(`Indexing file: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

    await this.buildIndex(onProgress);

    console.log(`Indexed ${this.totalRows} rows`);
    this.isIndexed = true;
  }

  /**
   * Build index of row positions in the file
   * This is memory-efficient: only stores positions, not actual data
   */
  private async buildIndex(onProgress?: (percent: number) => void): Promise<void> {
    if (!this.file) {
      throw new Error('No file loaded');
    }

    console.log(`Building index for ${this.file.name} (${this.file.size} bytes)...`);

    const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
    let fileOffset = 0;
    let rowNumber = 0;
    let currentRowStart = 0;
    let bufferOffset = 0; // Track processed bytes in current buffer
    let buffer = '';

    while (fileOffset < this.file.size) {
      // Read chunk
      const chunkEnd = Math.min(fileOffset + CHUNK_SIZE, this.file.size);
      const chunk = this.file.slice(fileOffset, chunkEnd);
      const text = await chunk.text();

      // Add new text to buffer
      buffer += text;

      // Find last complete line
      let lastNewlineIndex = buffer.lastIndexOf('\n');

      // If no newline and more data to read, continue
      if (lastNewlineIndex === -1 && chunkEnd < this.file.size) {
        fileOffset = chunkEnd;
        continue;
      }

      // Process complete lines
      const completeText = lastNewlineIndex >= 0
        ? buffer.substring(0, lastNewlineIndex + 1)
        : buffer;

      const lines = completeText.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Skip empty lines at the end
        if (i === lines.length - 1 && line === '') {
          break;
        }

        const lineBytes = new TextEncoder().encode(line + '\n');
        const lineLength = lineBytes.length;

        this.rowIndex.set(rowNumber, {
          offset: currentRowStart + bufferOffset,
          length: lineLength,
        });

        bufferOffset += lineLength;
        rowNumber++;
      }

      // Update file offset and buffer
      if (lastNewlineIndex >= 0) {
        // Keep remainder in buffer
        currentRowStart += bufferOffset;
        bufferOffset = 0;
        buffer = buffer.substring(lastNewlineIndex + 1);
      }

      fileOffset = chunkEnd;

      // Report progress
      if (onProgress) {
        const percent = Math.min((fileOffset / this.file.size) * 100, 100);
        onProgress(percent);
      }
    }

    // Handle last line if buffer has content
    if (buffer.trim()) {
      const lineBytes = new TextEncoder().encode(buffer);
      this.rowIndex.set(rowNumber, {
        offset: currentRowStart + bufferOffset,
        length: lineBytes.length,
      });
      rowNumber++;
    }

    this.totalRows = rowNumber;
    console.log(`Index complete: ${rowNumber} rows indexed`);
  }

  /**
   * Get a specific row (lazy loads from file)
   */
  async getRow(rowNumber: number): Promise<ParsedRow | null> {
    if (!this.isIndexed || !this.file) {
      throw new Error('File not indexed yet');
    }

    if (rowNumber < 0 || rowNumber >= this.totalRows) {
      return null;
    }

    // Check cache first
    const cached = this.rowCache.get(rowNumber);
    if (cached) {
      return cached;
    }

    // Load from file
    const index = this.rowIndex.get(rowNumber);
    if (!index) {
      return null;
    }

    const blob = this.file.slice(index.offset, index.offset + index.length);
    const text = await blob.text();
    const cells = this.parseCSVLine(text.trim());

    const parsedRow: ParsedRow = {
      rowNumber,
      cells,
    };

    // Cache it
    this.rowCache.set(rowNumber, parsedRow);

    return parsedRow;
  }

  /**
   * Get multiple rows (batch loading)
   */
  async getRows(startRow: number, endRow: number): Promise<ParsedRow[]> {
    const rows: ParsedRow[] = [];

    for (let i = startRow; i <= endRow; i++) {
      const row = await this.getRow(i);
      if (row) {
        rows.push(row);
      }
    }

    return rows;
  }

  /**
   * RFC 4180 compliant CSV line parser
   * Handles quoted fields with commas, escaped quotes, etc.
   */
  private parseCSVLine(line: string): string[] {
    const cells: string[] = [];
    let currentCell = '';
    let insideQuotes = false;
    let i = 0;

    while (i < line.length) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          // Escaped quote: "" -> "
          currentCell += '"';
          i += 2;
        } else {
          // Toggle quote state
          insideQuotes = !insideQuotes;
          i++;
        }
      } else if (char === ',' && !insideQuotes) {
        // Field separator (only outside quotes)
        cells.push(currentCell.trim());
        currentCell = '';
        i++;
      } else {
        // Regular character
        currentCell += char;
        i++;
      }
    }

    // Push the last cell
    cells.push(currentCell.trim());

    return cells;
  }

  /**
   * Get total number of rows
   */
  getRowCount(): number {
    return this.totalRows;
  }

  /**
   * Check if file is indexed and ready
   */
  isReady(): boolean {
    return this.isIndexed;
  }

  /**
   * Get cache stats
   */
  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.rowCache.size(),
      hitRate: 0, // TODO: Track hit rate
    };
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.file = null;
    this.rowIndex.clear();
    this.rowCache.clear();
    this.totalRows = 0;
    this.isIndexed = false;
  }
}
