declare function acquireVsCodeApi(): {
  postMessage(msg: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

const vscode = acquireVsCodeApi();

const container = document.getElementById('xlsx-container') as HTMLElement;
const statusEl = document.getElementById('status') as HTMLElement;

function showError(message: string, detail?: any) {
  console.error('[OOXML Webview Error]:', message, detail);
  if (statusEl) {
    statusEl.className = 'error';
    statusEl.innerHTML = `
      <div style="max-width: 600px; text-align: left; background: var(--vscode-editorWidget-background, #252526); padding: 16px; border: 1px solid var(--vscode-widget-border, #454545); border-radius: 4px;">
        <h3 style="margin-top: 0; color: var(--vscode-errorForeground, #f44747);">Failed to render spreadsheet</h3>
        <p style="white-space: pre-wrap; font-family: monospace; font-size: 12px; margin-bottom: 0;">${escapeHtml(message)}</p>
      </div>
    `;
    statusEl.style.display = 'flex';
  }
}

function hideStatus() {
  if (statusEl) {
    statusEl.style.display = 'none';
  }
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

window.addEventListener('error', (event) => {
  showError(`Uncaught script error: ${event.message} (${event.filename}:${event.lineno})`, event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  showError(`Unhandled rejection: ${reason?.message || String(reason)}`, reason);
});

import { XlsxViewer } from '@silurus/ooxml/xlsx';

let viewer: XlsxViewer | null = null;

window.addEventListener('message', async (event: MessageEvent) => {
  const message = event.data;
  if (!message || (message.type !== 'init' && message.type !== 'ooxml-init')) {
    return;
  }

  const { wasmUrl, fileBase64, fileData, docUrl } = message;

  if (!container) {
    showError('Container element #xlsx-container was not found in the DOM.');
    return;
  }

  try {
    if (viewer) {
      viewer.destroy();
      viewer = null;
    }

    let buffer: ArrayBuffer;
    if (fileBase64) {
      buffer = base64ToArrayBuffer(fileBase64);
    } else if (fileData instanceof ArrayBuffer) {
      buffer = fileData;
    } else if (fileData && fileData.buffer instanceof ArrayBuffer) {
      buffer = fileData.buffer.slice(fileData.byteOffset, fileData.byteOffset + fileData.byteLength);
    } else if (docUrl) {
      const response = await fetch(docUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch spreadsheet: HTTP ${response.status} ${response.statusText}`);
      }
      buffer = await response.arrayBuffer();
    } else {
      throw new Error('No valid file data received from extension host.');
    }

    viewer = new XlsxViewer(container, {
      wasmUrl: wasmUrl || undefined,
      showZoomSlider: true,
      showScrollbars: true,
      resizable: true,
      enableElementSelection: true,
      onError(err) {
        showError(err.message, err);
      },
    });

    await viewer.load(buffer);
    hideStatus();
  } catch (err: any) {
    showError(err?.message || String(err), err);
  }
});

// Signal extension host that webview is ready
vscode.postMessage({ type: 'ready' });
