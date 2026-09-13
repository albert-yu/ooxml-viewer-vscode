import * as vscode from 'vscode';

export class XlsxEditorProvider implements vscode.CustomReadonlyEditorProvider {
  public static readonly viewType = 'ooxml.xlsxViewer';

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
      ],
    };

    webview.html = this.getHtmlForWebview(webview);

    const wasmUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'xlsx_parser_bg.wasm')
    );

    const sendFileData = async () => {
      try {
        const fileData = await vscode.workspace.fs.readFile(document.uri);
        webview.postMessage({
          type: 'init',
          fileData: Array.from(fileData),
          wasmUrl: wasmUri.toString(),
        });
      } catch (err) {
        vscode.window.showErrorMessage(`Failed to read file: ${document.uri.fsPath}`);
      }
    };

    const messageListener = webview.onDidReceiveMessage((message) => {
      if (message.type === 'ready') {
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
    script-src 'nonce-${nonce}' 'unsafe-eval' 'wasm-unsafe-eval' vscode-webview:;
    style-src 'unsafe-inline' vscode-webview:;
    wasm-src 'self' vscode-webview: blob:;
    connect-src vscode-webview: blob: data:;
    img-src vscode-webview: blob: data:;
  ">
  <title>OOXML Spreadsheet Viewer</title>
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background-color: var(--vscode-editor-background, #1e1e1e);
      color: var(--vscode-editor-foreground, #cccccc);
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
    }
    #xlsx-container {
      width: 100%;
      height: 100%;
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
    }
    #loading {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 14px;
      color: var(--vscode-descriptionForeground, #888888);
      z-index: 10;
      pointer-events: none;
    }
  </style>
</head>
<body>
  <div id="loading">Loading spreadsheet...</div>
  <div id="xlsx-container"></div>
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
