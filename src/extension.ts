// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { ProtoDecoderPanel } from './ProtoDecoderPanel';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Register Hello World command
	const disposable = vscode.commands.registerCommand('protobuf-tool.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from protobuf-tool!');
	});
	context.subscriptions.push(disposable);

	// Register CodeLens provider for .proto files — shows a "Decode as <MessageName>" lens above each message definition
	class ProtoCodeLensProvider implements vscode.CodeLensProvider {
		provideCodeLenses(document: vscode.TextDocument, _token: vscode.CancellationToken): vscode.ProviderResult<vscode.CodeLens[]> {
			const lenses: vscode.CodeLens[] = [];
			const text = document.getText();
			const messageRegex = /^message\s+(\w+)\s*\{/gm;
			let match: RegExpExecArray | null;
			while ((match = messageRegex.exec(text)) !== null) {
				const messageName = match[1];
				const pos = document.positionAt(match.index);
				const range = new vscode.Range(pos, pos);
				lenses.push(new vscode.CodeLens(range, {
					title: `$(symbol-class) Decode as ${messageName}`,
					command: 'protobuf-tool.decodeMessage',
					arguments: [document.uri, messageName]
				}));
			}
			return lenses;
		}
	}
	const codelensProviderDisposable = vscode.languages.registerCodeLensProvider({ language: 'proto' }, new ProtoCodeLensProvider());
	context.subscriptions.push(codelensProviderDisposable);

	// Register the CodeLens command — opens the decoder panel for the chosen message
	const decodeMessageDisposable = vscode.commands.registerCommand(
		'protobuf-tool.decodeMessage',
		(uri: vscode.Uri, messageName: string) => {
			ProtoDecoderPanel.createOrShow(uri.fsPath, messageName);
		}
	);
	context.subscriptions.push(decodeMessageDisposable);

	// ...existing code...
}

// This method is called when your extension is deactivated
export function deactivate() {}
