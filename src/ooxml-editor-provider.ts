import * as vscode from 'vscode';
import * as path from 'path';

export type OoxmlDocType = 'docx' | 'xlsx' | 'pptx';

export class OoxmlEditorProvider implements vscode.CustomReadonlyEditorProvider {
  public static readonly docxViewType = 'ooxml.docxViewer';
  public static readonly xlsxViewType = 'ooxml.xlsxViewer';
  public static readonly pptxViewType = 'ooxml.pptxViewer';

  private wasmDataUrls = new Map<OoxmlDocType, string>();

  constructor(private readonly context: vscode.ExtensionContext) {}

  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new OoxmlEditorProvider(context);
    const options: vscode.WebviewPanelOptions & vscode.WebviewOptions = {
      retainContextWhenHidden: true,
      enableFindWidget: true,
    };

    const docxRegistration = vscode.window.registerCustomEditorProvider(
      OoxmlEditorProvider.docxViewType,
      provider,
      {
        webviewOptions: options,
        supportsMultipleEditorsPerDocument: false,
      }
    );

    const xlsxRegistration = vscode.window.registerCustomEditorProvider(
      OoxmlEditorProvider.xlsxViewType,
      provider,
      {
        webviewOptions: options,
        supportsMultipleEditorsPerDocument: false,
      }
    );

    const pptxRegistration = vscode.window.registerCustomEditorProvider(
      OoxmlEditorProvider.pptxViewType,
      provider,
      {
        webviewOptions: options,
        supportsMultipleEditorsPerDocument: false,
      }
    );

    return vscode.Disposable.from(docxRegistration, xlsxRegistration, pptxRegistration);
  }

  async openCustomDocument(
    uri: vscode.Uri,
    _openContext: vscode.CustomDocumentOpenContext,
    _token: vscode.CancellationToken
  ): Promise<vscode.CustomDocument> {
    return { uri, dispose: () => {} };
  }

  private getDocType(uri: vscode.Uri): OoxmlDocType {
    const ext = path.extname(uri.fsPath).toLowerCase();
    if (['.docx', '.docm', '.dotx', '.dotm'].includes(ext)) {
      return 'docx';
    }
    if (['.pptx', '.pptm', '.ppsx', '.ppsm', '.potx', '.potm'].includes(ext)) {
      return 'pptx';
    }
    return 'xlsx';
  }

  private async getWasmDataUrl(docType: OoxmlDocType): Promise<string> {
    let wasmDataUrl = this.wasmDataUrls.get(docType);
    if (!wasmDataUrl) {
      const wasmFileName =
        docType === 'docx'
          ? 'docx_parser_bg.wasm'
          : docType === 'pptx'
          ? 'pptx_parser_bg.wasm'
          : 'xlsx_parser_bg.wasm';
      const wasmUri = vscode.Uri.joinPath(this.context.extensionUri, 'dist', wasmFileName);
      const wasmBytes = await vscode.workspace.fs.readFile(wasmUri);
      wasmDataUrl = `data:application/wasm;base64,${Buffer.from(wasmBytes).toString('base64')}`;
      this.wasmDataUrls.set(docType, wasmDataUrl);
    }
    return wasmDataUrl;
  }

  async resolveCustomEditor(
    document: vscode.CustomDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    const webview = webviewPanel.webview;
    const docType = this.getDocType(document.uri);

    webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'dist'),
        vscode.Uri.joinPath(document.uri, '..'),
      ],
    };

    const sendFileData = async () => {
      try {
        const [fileData, wasmDataUrl] = await Promise.all([
          vscode.workspace.fs.readFile(document.uri),
          this.getWasmDataUrl(docType),
        ]);

        const fileBase64 = Buffer.from(fileData).toString('base64');

        await webview.postMessage({
          type: 'init',
          docType,
          wasmUrl: wasmDataUrl,
          fileBase64,
          fileName: path.basename(document.uri.fsPath),
        });
      } catch (err: any) {
        vscode.window.showErrorMessage(`Failed to read file: ${document.uri.fsPath}`);
      }
    };

    // Attach message listener before setting HTML to prevent race condition
    const messageListener = webview.onDidReceiveMessage((message) => {
      if (message.type === 'ready' || message.type === 'webview-ready') {
        sendFileData();
      }
    });

    const fileWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(document.uri, '*')
    );
    const changeSubscription = fileWatcher.onDidChange(() => {
      sendFileData();
    });

    webviewPanel.onDidDispose(() => {
      messageListener.dispose();
      fileWatcher.dispose();
      changeSubscription.dispose();
    });

    // Set webview HTML
    webview.html = this.getHtmlForWebview(webview, docType);
  }

  private getHtmlForWebview(webview: vscode.Webview, docType: OoxmlDocType): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview.js')
    );
    const nonce = getNonce();

    const titleMap: Record<OoxmlDocType, string> = {
      docx: 'OOXML Document Viewer',
      xlsx: 'OOXML Spreadsheet Viewer',
      pptx: 'OOXML Presentation Viewer',
    };

    const loadingMap: Record<OoxmlDocType, string> = {
      docx: 'Loading document...',
      xlsx: 'Loading spreadsheet...',
      pptx: 'Loading presentation...',
    };

    const title = titleMap[docType] || 'OOXML Viewer';
    const loadingText = loadingMap[docType] || 'Loading...';

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="
    default-src 'none';
    img-src ${webview.cspSource} data: blob:;
    media-src ${webview.cspSource} blob:;
    font-src ${webview.cspSource} data:;
    script-src 'nonce-${nonce}' 'unsafe-eval' 'wasm-unsafe-eval' ${webview.cspSource};
    worker-src data: blob:;
    style-src 'unsafe-inline' ${webview.cspSource};
    connect-src ${webview.cspSource} data: blob:;
  ">
  <title>${title}</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background-color: var(--vscode-editor-background, #1e1e1e);
      color: var(--vscode-editor-foreground, #cccccc);
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
    }
    #viewer-root {
      position: relative;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
    }
    #viewer-container {
      position: relative;
      width: 100%;
      height: 100%;
      flex: 1 1 auto;
      overflow: hidden;
    }
    #status {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10;
      background: var(--vscode-editor-background, #1e1e1e);
      font-size: 13px;
    }
    #status.error {
      color: var(--vscode-errorForeground, #f44747);
      padding: 20px;
      text-align: center;
    }
    .spinner {
      width: 24px;
      height: 24px;
      border: 3px solid rgba(127, 127, 127, 0.25);
      border-top-color: var(--vscode-progressBar-background, var(--vscode-editor-foreground, #007acc));
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-right: 10px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .loading-content {
      display: flex;
      align-items: center;
    }
  </style>
</head>
<body>
  <div id="viewer-root">
    <div id="status">
      <div class="loading-content">
        <div class="spinner"></div>
        <span id="status-text">${loadingText}</span>
      </div>
    </div>
    <div id="viewer-container"></div>
  </div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

// Backward-compatible alias
export class XlsxEditorProvider extends OoxmlEditorProvider {}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
