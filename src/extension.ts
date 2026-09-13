import * as vscode from 'vscode';
import { OoxmlEditorProvider } from './ooxmlEditorProvider';

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(OoxmlEditorProvider.register(context));
}

export function deactivate(): void {}
