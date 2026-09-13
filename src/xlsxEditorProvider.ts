import * as vscode from 'vscode';

export class XlsxEditorProvider implements vscode.CustomReadonlyEditorProvider {
  public static readonly viewType = 'ooxml.xlsxViewer';
  private wasmDataUrl: string | null = null;

  constructor(private readonly context: vscode.ExtensionContext) {}

  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new XlsxEditorProvider(context);
    return vscode.window.registerCustomEditorProvider(
      XlsxEditorProvider.viewType,
      provider,
      {
        webviewOptions: {
          retainContextWhenHidden: true,
          enableFindWidget: true,
        },
        supportsMultipleEditorsPerDocument: false,
      }
    );
  }

  async openCustomDocument(
    uri: vscode.Uri,
    _openContext: vscode.CustomDocumentOpenContext,
    _token: vscode.CancellationToken
  ): Promise<vscode.CustomDocument> {
    return { uri, dispose: () => {} };
  }

  private async getWasmsDataUrl(): Promise<string> {
    if (!this.wasmDataUrl) {
      const wasmUri = vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'xlsx_parser_bg.wasm');
      const wasmBytes = await vscode.workspace.fs.readFile(wasmUri);
      this.wasmDataUrl = `data:application/wasm;base64,${Buffer.from(wasmBytes).toString('base64')}`;
    }
    return this.wasmDataUrl;
  }

  async resolveCustomEditor(
    document: vscode.CustomDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    const webview = webviewPanel.webview;

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
          this.getWasmsDataUrl(),
        ]);

        const fileBase64 = Buffer.from(fileData).toString('base64');

        await webview.postMessage({
          type: 'init',
          wasmUrl: wasmDataUrl,
          fileBase64: fileBase64,
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
    webview.html = this.getHtmlForWebview(webview);
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview.js')
    );
    const nonce = getNonce();

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
  <title>OOXML Spreadsheet Viewer</title>
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
    #xlsx-container {
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
        <span>Loading spreadsheet...</span>
      </div>
    </div>
    <div id="xlsx-container"></div>
  </div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
