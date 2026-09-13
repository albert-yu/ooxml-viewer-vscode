import * as vscode from 'vscode';
import { XlsxEditorProvider } from './xlsxEditorProvider';

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(XlsxEditorProvider.register(context));
}

export function deactivate(): void {}
