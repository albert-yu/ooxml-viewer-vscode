import { DocxScrollViewer } from '@silurus/ooxml/docx';
import { PptxScrollViewer } from '@silurus/ooxml/pptx';
import { XlsxViewer } from '@silurus/ooxml/xlsx';

declare function acquireVsCodeApi(): {
  postMessage(msg: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

const vscode = acquireVsCodeApi();

const container = (document.getElementById('viewer-container') ||
  document.getElementById('xlsx-container')) as HTMLElement;
const statusEl = document.getElementById('status') as HTMLElement;

type AnyViewer = DocxScrollViewer | PptxScrollViewer | XlsxViewer;
let viewer: AnyViewer | null = null;

function showError(message: string, detail?: any) {
  console.error('[OOXML Webview Error]:', message, detail);
  if (statusEl) {
    statusEl.className = 'error';
    statusEl.innerHTML = `
      <div style="max-width: 600px; text-align: left; background: var(--vscode-editorWidget-background, #252526); padding: 16px; border: 1px solid var(--vscode-widget-border, #454545); border-radius: 4px;">
        <h3 style="margin-top: 0; color: var(--vscode-errorForeground, #f44747);">Failed to render document</h3>
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

function detectDocType(fileName?: string, docType?: string): 'docx' | 'xlsx' | 'pptx' {
  if (docType === 'docx' || docType === 'xlsx' || docType === 'pptx') {
    return docType;
  }
  if (fileName) {
    const ext = fileName.toLowerCase().split('.').pop() || '';
    if (['docx', 'docm', 'dotx', 'dotm'].includes(ext)) {
      return 'docx';
    }
    if (['pptx', 'pptm', 'ppsx', 'ppsm', 'potx', 'potm'].includes(ext)) {
      return 'pptx';
    }
  }
  return 'xlsx';
}

window.addEventListener('error', (event) => {
  showError(`Uncaught script error: ${event.message} (${event.filename}:${event.lineno})`, event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  showError(`Unhandled rejection: ${reason?.message || String(reason)}`, reason);
});

window.addEventListener('message', async (event: MessageEvent) => {
  const message = event.data;
  if (!message || (message.type !== 'init' && message.type !== 'ooxml-init')) {
    return;
  }

  const { wasmUrl, fileBase64, fileData, docUrl, fileName, docType: rawDocType } = message;

  if (!container) {
    showError('Container element was not found in the DOM.');
    return;
  }

  const docType = detectDocType(fileName, rawDocType);

  try {
    if (viewer) {
      viewer.destroy();
      viewer = null;
    }
    container.innerHTML = '';

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
        throw new Error(`Failed to fetch document: HTTP ${response.status} ${response.statusText}`);
      }
      buffer = await response.arrayBuffer();
    } else {
      throw new Error('No valid file data received from extension host.');
    }

    if (docType === 'docx') {
      const docxViewer = new DocxScrollViewer(container, {
        wasmUrl: wasmUrl || undefined,
        enableTextSelection: true,
        enableElementSelection: true,
        enableHyperlinks: true,
        enableZoom: true,
        refitOnResize: true,
        onError(err) {
          showError(err.message, err);
        },
      });
      await docxViewer.load(buffer);
      viewer = docxViewer;
    } else if (docType === 'pptx') {
      const pptxViewer = new PptxScrollViewer(container, {
        wasmUrl: wasmUrl || undefined,
        enableTextSelection: true,
        enableElementSelection: true,
        enableHyperlinks: true,
        enableMediaPlayback: true,
        enableZoom: true,
        refitOnResize: true,
        onError(err) {
          showError(err.message, err);
        },
      });
      await pptxViewer.load(buffer);
      viewer = pptxViewer;
    } else {
      const xlsxViewer = new XlsxViewer(container, {
        wasmUrl: wasmUrl || undefined,
        showZoomSlider: true,
        showScrollbars: true,
        resizable: true,
        enableElementSelection: true,
        onError(err) {
          showError(err.message, err);
        },
      });
      await xlsxViewer.load(buffer);
      viewer = xlsxViewer;
    }

    hideStatus();
  } catch (err: any) {
    showError(err?.message || String(err), err);
  }
});

// Signal extension host that webview is ready
vscode.postMessage({ type: 'ready' });
