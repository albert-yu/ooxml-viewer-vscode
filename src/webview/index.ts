import { XlsxViewer } from '@silurus/ooxml/xlsx';

declare function acquireVsCodeApi(): {
  postMessage(msg: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

const vscode = acquireVsCodeApi();

const container = document.getElementById('xlsx-container') as HTMLElement;
const loading = document.getElementById('loading') as HTMLElement;

let viewer: XlsxViewer | null = null;

window.addEventListener('message', async (event: MessageEvent) => {
  const message = event.data;

  switch (message.type) {
    case 'init': {
      const { fileData, wasmUrl } = message;

      if (!container) return;

      try {
        if (loading) {
          loading.textContent = 'Rendering workbook...';
          loading.style.display = 'block';
        }

        if (viewer) {
          viewer.destroy();
          viewer = null;
        }

        // Initialize XlsxViewer with WebAssembly parser path
        viewer = new XlsxViewer(container, {
          wasmUrl: wasmUrl || undefined,
          showZoomSlider: true,
          showScrollbars: true,
          resizable: true,
        });

        // Convert received array or ArrayBuffer into ArrayBuffer
        const buffer = Array.isArray(fileData)
          ? new Uint8Array(fileData).buffer
          : fileData instanceof ArrayBuffer
          ? fileData
          : new Uint8Array(fileData).buffer;

        await viewer.load(buffer);

        if (loading) {
          loading.style.display = 'none';
        }
      } catch (err: any) {
        console.error('XlsxViewer load error:', err);
        if (loading) {
          loading.textContent = `Failed to open spreadsheet: ${err?.message || err}`;
          loading.style.color = 'var(--vscode-errorForeground, #f48771)';
          loading.style.display = 'block';
        }
      }
      break;
    }
  }
});

// Notify extension host that webview is ready
vscode.postMessage({ type: 'ready' });
