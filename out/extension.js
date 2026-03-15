"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = __importStar(require("vscode"));
const ProtoDecoderPanel_1 = require("./ProtoDecoderPanel");
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
function activate(context) {
    // Register Hello World command
    const disposable = vscode.commands.registerCommand('protobuf-tool.helloWorld', () => {
        vscode.window.showInformationMessage('Hello World from protobuf-tool!');
    });
    context.subscriptions.push(disposable);
    // Register CodeLens provider for .proto files — shows a "Decode as <MessageName>" lens above each message definition
    class ProtoCodeLensProvider {
        provideCodeLenses(document, _token) {
            const lenses = [];
            const text = document.getText();
            const messageRegex = /^message\s+(\w+)\s*\{/gm;
            let match;
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
    const decodeMessageDisposable = vscode.commands.registerCommand('protobuf-tool.decodeMessage', (uri, messageName) => {
        ProtoDecoderPanel_1.ProtoDecoderPanel.createOrShow(uri.fsPath, messageName);
    });
    context.subscriptions.push(decodeMessageDisposable);
    // Register command-palette command — picks a message and opens the decode/encode panel
    const openDecodePanelDisposable = vscode.commands.registerCommand('protobuf-tool.openDecodePanel', async () => {
        const editor = vscode.window.activeTextEditor;
        let fileUri;
        if (editor && editor.document.languageId === 'proto') {
            fileUri = editor.document.uri;
        }
        else {
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
        const messages = [];
        let match;
        while ((match = messageRegex.exec(text)) !== null) {
            messages.push(match[1]);
        }
        if (messages.length === 0) {
            vscode.window.showWarningMessage('No message definitions found in this file.');
            return;
        }
        let messageName;
        if (messages.length === 1) {
            messageName = messages[0];
        }
        else {
            messageName = await vscode.window.showQuickPick(messages, {
                placeHolder: 'Select a message to decode/encode',
                title: 'Protobuf Message'
            });
        }
        if (messageName) {
            ProtoDecoderPanel_1.ProtoDecoderPanel.createOrShow(fileUri.fsPath, messageName);
        }
    });
    context.subscriptions.push(openDecodePanelDisposable);
    // ...existing code...
}
// This method is called when your extension is deactivated
function deactivate() { }
//# sourceMappingURL=extension.js.map