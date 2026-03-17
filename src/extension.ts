// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { ProtoDecoderPanel } from './ProtoDecoderPanel';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Register CodeLens provider for .proto files — shows a "Decode as <MessageName>" lens above each message definition
	class ProtoCodeLensProvider implements vscode.CodeLensProvider {
		private readonly _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
		readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

		fire() { this._onDidChangeCodeLenses.fire(); }

		provideCodeLenses(document: vscode.TextDocument, _token: vscode.CancellationToken): vscode.ProviderResult<vscode.CodeLens[]> {
			const enabled = vscode.workspace.getConfiguration('protobuf-inspector').get<boolean>('enableCodeLens', true);
			if (!enabled) { return []; }
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
					command: 'protobuf-inspector.decodeMessage',
					arguments: [document.uri, messageName]
				}));
			}
			return lenses;
		}
	}
	const codeLensProvider = new ProtoCodeLensProvider();
	const codelensProviderDisposable = vscode.languages.registerCodeLensProvider({ language: 'proto' }, codeLensProvider);
	context.subscriptions.push(codelensProviderDisposable);

	// Refresh CodeLens immediately when the setting is toggled
	const configChangeDisposable = vscode.workspace.onDidChangeConfiguration(e => {
		if (e.affectsConfiguration('protobuf-inspector.enableCodeLens')) {
			codeLensProvider.fire();
		}
	});
	context.subscriptions.push(configChangeDisposable);

	// Register the CodeLens command — opens the decoder panel for the chosen message
	const decodeMessageDisposable = vscode.commands.registerCommand(
		'protobuf-inspector.decodeMessage',
		(uri: vscode.Uri, messageName: string) => {
			ProtoDecoderPanel.createOrShow(uri.fsPath, messageName, context.extensionUri);
		}
	);
	context.subscriptions.push(decodeMessageDisposable);

	// Register command-palette command — picks a message and opens the decode/encode panel
	const openDecodePanelDisposable = vscode.commands.registerCommand(
		'protobuf-inspector.openDecodePanel',
		async () => {
			const editor = vscode.window.activeTextEditor;

			let fileUri: vscode.Uri | undefined;
			if (editor && editor.document.languageId === 'proto') {
				fileUri = editor.document.uri;
			} else {
				const picked = await vscode.window.showOpenDialog({
					canSelectMany: false,
					filters: { 'Proto files': ['proto'] },
					title: 'Select a .proto file'
				});
				if (!picked || picked.length === 0) {
					return;
				}
				fileUri = picked[0];
			}

			const document = await vscode.workspace.openTextDocument(fileUri);
			const text = document.getText();
			const messageRegex = /^message\s+(\w+)\s*\{/gm;
			const messages: string[] = [];
			let match: RegExpExecArray | null;
			while ((match = messageRegex.exec(text)) !== null) {
				messages.push(match[1]);
			}

			if (messages.length === 0) {
				vscode.window.showWarningMessage('No message definitions found in this file.');
				return;
			}

			let messageName: string | undefined;
			if (messages.length === 1) {
				messageName = messages[0];
			} else {
				messageName = await vscode.window.showQuickPick(messages, {
					placeHolder: 'Select a message to decode/encode',
					title: 'Protobuf Message'
				});
			}

			if (messageName) {
				ProtoDecoderPanel.createOrShow(fileUri.fsPath, messageName, context.extensionUri);
			}
		}
	);
	context.subscriptions.push(openDecodePanelDisposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
