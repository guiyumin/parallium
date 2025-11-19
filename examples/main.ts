import { Parallium } from "../src/index.js";

async function main() {
  const canvas = document.getElementById("parallium") as HTMLCanvasElement;

  if (!canvas) {
    showError("Canvas element not found");
    return;
  }

  try {
    // Create and initialize the grid
    const grid = new Parallium({
      canvas,
      rows: 1_000_000, // Start with 1 million rows!
      columns: 26,
      cellWidth: 80,
      cellHeight: 24,
    });

    await grid.init();

    console.log("Parallium initialized successfully!");

    // Set up file input handler
    const fileInput = document.getElementById("fileInput") as HTMLInputElement;
    const fileStatus = document.getElementById("fileStatus");

    if (fileInput && fileStatus) {
      fileInput.addEventListener("change", async (event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) {
          return;
        }

        fileStatus.textContent = "Loading...";

        try {
          await grid.loadFile(file, (percent) => {
            fileStatus.textContent = `Indexing: ${percent.toFixed(1)}%`;
          });

          fileStatus.textContent = `Loaded: ${file.name} ✓`;
          console.log("File loaded successfully!");
        } catch (error) {
          fileStatus.textContent = `Error loading file`;
          console.error("Failed to load file:", error);
        }
      });
    }
  } catch (error) {
    console.error("Failed to initialize Parallium:", error);
    showError(error instanceof Error ? error.message : "Unknown error");
  }
}

function showError(message: string) {
  const main = document.querySelector("main");
  if (main) {
    const errorDiv = document.createElement("div");
    errorDiv.className = "error";
    errorDiv.innerHTML = `
      <h2>Error</h2>
      <p>${message}</p>
      <p style="margin-top: 1rem; font-size: 0.875rem;">
        Make sure you're using a browser that supports WebGPU (Chrome 113+, Edge 113+)
      </p>
    `;
    main.appendChild(errorDiv);
  }
}

main();
