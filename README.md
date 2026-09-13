# OOXML Spreadsheet Viewer for VS Code

A high-fidelity local viewer for Excel spreadsheets (`.xlsx`, `.xlsm`, `.xltx`, `.xltm`), powered by [office-open-xml-viewer](https://github.com/yukiyokotani/office-open-xml-viewer) (`@silurus/ooxml`), Rust/WebAssembly, and HTML5 Canvas.

## Features

- **High-Fidelity Rendering**: Renders standard and complex Excel spreadsheets directly in VS Code.
- **Interactive Grid**: Interactive cell, range, row, and column selection.
- **Multi-Sheet Navigation**: Bottom tab bar for switching between worksheets.
- **Private & Local**: Documents are parsed locally via WebAssembly with zero network or cloud dependencies.

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
2. Press <kbd>F5</kbd> (or select **Run > Start Debugging**) to open the **Extension Development Host**.
3. Open any `.xlsx` or `.xlsm` file in the debug window to view it.

## Packaging

To package the extension into a `.vsix` file:
```bash
npx @vscode/vsce package
```
