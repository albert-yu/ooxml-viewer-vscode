# OOXML Viewer for VS Code

A high-fidelity local viewer for Office Open XML (OOXML) documents — Word documents, Excel spreadsheets, and PowerPoint presentations — powered by [office-open-xml-viewer](https://github.com/yukiyokotani/office-open-xml-viewer) (`@silurus/ooxml`), Rust/WebAssembly, and HTML5 Canvas.

## Supported Formats

| Document Type | Supported File Extensions |
| --- | --- |
| **Rich Text Documents (Word)** | `.docx`, `.docm`, `.dotx`, `.dotm` |
| **Spreadsheets (Excel)** | `.xlsx`, `.xlsm`, `.xltx`, `.xltm` |
| **Slideshows & Presentations (PowerPoint)** | `.pptx`, `.pptm`, `.ppsx`, `.ppsm`, `.potx`, `.potm` |

## Features

- **Rich Text Documents (Word)**:
  - Seamless continuous page scrolling with responsive layout.
  - High-fidelity formatting: typography, tables, lists, images, shapes, headers/footers, and equations.
  - Text selection and clickable hyperlinks.
- **Spreadsheets (Excel)**:
  - Interactive grid with cell, range, row, and column selection.
  - Multi-sheet tab navigation for switching between worksheets.
  - Built-in zoom slider and scrollbar controls.
- **Slideshows & Presentations (PowerPoint)**:
  - Slide-by-slide and continuous presentation rendering with shape and text fidelity.
  - Interactive element selection, text selection, and hyperlinks.
  - Embedded media playback support.
- **100% Private & Local**:
  - All files are parsed and rendered directly in your local VS Code environment via WebAssembly. Zero data leaves your machine.

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
3. Open any `.docx`, `.xlsx`, or `.pptx` file in the debug window to view it.

## Packaging

To package the extension into a `.vsix` file:
```bash
npx @vscode/vsce package
```
