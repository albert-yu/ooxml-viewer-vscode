# OOXML Viewer for VS Code

Basically [office-open-xml-viewer](https://github.com/yukiyokotani/office-open-xml-viewer?tab=readme-ov-file)
packaged into a VS Code extension.

## Development

### 1. Install Dependencies

```bash
npm install
```

### 2. Build Extension & Webview

```bash
npm run build
```

To watch for changes during development:

```bash
npm run watch
```

### 3. Run and Debug

1. Open this repository in VS Code.
2. Press <kbd>F5</kbd> (or select **Run > Start Debugging**) to launch the **Extension Development Host**.
3. Open any `.docx`, `.xlsx`, or `.pptx` file in the debug instance to view it.

## Packaging

To package the extension into a `.vsix` file:

```bash
npx @vscode/vsce package
```
