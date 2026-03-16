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
exports.ProtoDecoderPanel = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const ProtoService_1 = require("./ProtoService");
class ProtoDecoderPanel {
    static _panels = new Map();
    _panel;
    _key;
    _extensionUri;
    _disposables = [];
    _service;
    constructor(panel, protoFilePath, messageName, extensionUri) {
        this._key = ProtoDecoderPanel._makeKey(protoFilePath, messageName);
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._service = new ProtoService_1.ProtoService(protoFilePath, messageName);
        this._update();
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.onDidReceiveMessage(async (message) => {
            if (message.command === 'decode') {
                await this._handleDecode(message.data, message.format ?? 'base64');
            }
            else if (message.command === 'encode') {
                await this._handleEncode(message.data, message.format ?? 'base64');
            }
            else if (message.command === 'getTemplate') {
                await this._handleGetTemplate();
            }
        }, null, this._disposables);
    }
    static _makeKey(protoFilePath, messageName) {
        return `${protoFilePath}::${messageName}`;
    }
    static createOrShow(protoFilePath, messageName, extensionUri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;
        const config = vscode.workspace.getConfiguration('protobuf-tool');
        const reuseTab = config.get('panelMode', 'newTab') === 'reuseTab';
        if (reuseTab) {
            // Reuse the single shared panel if one is open
            const sharedEntry = ProtoDecoderPanel._panels.values().next();
            if (!sharedEntry.done && sharedEntry.value) {
                const existing = sharedEntry.value;
                existing._service = new ProtoService_1.ProtoService(protoFilePath, messageName);
                existing._update();
                existing._panel.reveal(column);
                return;
            }
        }
        else {
            // Per-message panel: reveal if this exact combo is already open
            const key = ProtoDecoderPanel._makeKey(protoFilePath, messageName);
            const existing = ProtoDecoderPanel._panels.get(key);
            if (existing) {
                existing._panel.reveal(column);
                return;
            }
        }
        const key = ProtoDecoderPanel._makeKey(protoFilePath, messageName);
        const panel = vscode.window.createWebviewPanel('protobufDecoder', `Decode: ${messageName}`, column || vscode.ViewColumn.Active, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [
                vscode.Uri.joinPath(extensionUri, 'media'),
                vscode.Uri.joinPath(extensionUri, 'node_modules', '@vscode', 'codicons', 'dist')
            ]
        });
        ProtoDecoderPanel._panels.set(key, new ProtoDecoderPanel(panel, protoFilePath, messageName, extensionUri));
    }
    async _handleDecode(input, format) {
        try {
            const json = await this._service.decode(input, format);
            this._panel.webview.postMessage({ command: 'result', json });
        }
        catch (e) {
            this._postError(e instanceof Error ? e.message : String(e));
        }
    }
    async _handleEncode(jsonInput, format) {
        try {
            const output = await this._service.encode(jsonInput, format);
            this._panel.webview.postMessage({ command: 'encodeResult', output, format });
        }
        catch (e) {
            this._postEncodeError(e instanceof Error ? e.message : String(e));
        }
    }
    async _handleGetTemplate() {
        try {
            const json = await this._service.getTemplate();
            this._panel.webview.postMessage({ command: 'templateResult', json });
        }
        catch (e) {
            this._postEncodeError(e instanceof Error ? e.message : String(e));
        }
    }
    _postError(message) {
        this._panel.webview.postMessage({ command: 'error', message });
    }
    _postEncodeError(message) {
        this._panel.webview.postMessage({ command: 'encodeError', message });
    }
    _update() {
        this._panel.title = `Proto Tool: ${this._service.messageName}`;
        this._panel.webview.html = this._getHtmlForWebview();
    }
    _getHtmlForWebview() {
        const fileName = path.basename(this._service.protoFilePath);
        const messageName = this._service.messageName;
        const escapedFileName = this._escapeHtml(fileName);
        const escapedMessageName = this._escapeHtml(messageName);
        const stylesUri = this._panel.webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'decoder.css'));
        const scriptUri = this._panel.webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'decoder.js'));
        const codiconsUri = this._panel.webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'node_modules', '@vscode', 'codicons', 'dist', 'codicon.css'));
        const nonce = this._getNonce();
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${this._panel.webview.cspSource}; font-src ${this._panel.webview.cspSource}; script-src 'nonce-${nonce}';">  
    <title>Proto Tool: ${escapedMessageName}</title>
    <link rel="stylesheet" href="${codiconsUri}">
    <link rel="stylesheet" href="${stylesUri}">
</head>
<body>
    <div class="header">
        <h1>&#128268; <strong>${escapedMessageName}</strong></h1>
        <div class="subtitle">from <code>${escapedFileName}</code></div>
    </div>

    <div class="tabs">
        <button class="tab-btn active" id="tab-decode">&#9654; Decode</button>
        <button class="tab-btn" id="tab-encode">&#11178; Encode</button>
    </div>

    <div class="tab-panel active" id="panel-decode">
        <div class="format-row">
            <div class="section-label no-margin">Input Format</div>
            <div class="format-toggle">
                <button class="fmt-btn active" id="dec-btn-base64">Base64</button>
                <button class="fmt-btn" id="dec-btn-hex">Hex</button>
            </div>
        </div>
        <div class="section-label mt-12">Encoded Binary Input</div>
        <textarea
            id="decode-input"
            placeholder="Paste base64-encoded protobuf binary data here..."
            spellcheck="false"
            autocomplete="off"
            class="text-area-lg"
        ></textarea>
        <div class="hint" id="decode-hint">Paste base64-encoded binary protobuf payload (e.g. <code>CgVXb3JsZA==</code>)</div>
        <div class="actions">
            <button id="decode-btn">&#9654; Decode</button>
            <button class="clear-btn" id="decode-clear-btn">Clear</button>
        </div>
        <div class="output-actions">
            <div class="section-label no-margin">Decoded Output (JSON)</div>
            <button class="copy-btn small-btn" id="dec-copy-btn">
                <span class="btn-content">
                    <i class="codicon codicon-copy" aria-hidden="true"></i>
                    <span>Copy</span>
                </span>
            </button>
        </div>
        <div class="output-wrap">
            <pre id="decode-output" class="output-box empty">— Output will appear here —</pre>
        </div>
    </div>

    <div class="tab-panel" id="panel-encode">
        <div class="format-row">
            <div class="section-label no-margin">Output Format</div>
            <div class="format-toggle">
                <button class="fmt-btn active" id="enc-btn-base64">Base64</button>
                <button class="fmt-btn" id="enc-btn-hex">Hex</button>
            </div>
            <button class="template-btn" id="template-btn">
                <span class="btn-content">
                    <i class="codicon codicon-file-add" aria-hidden="true"></i>
                    <span>Generate Template</span>
                </span>
            </button>
        </div>
        <div class="section-label mt-12">JSON Input</div>
        <textarea
            id="encode-input"
            placeholder='Paste JSON object here, e.g. {"name":"World"}'
            spellcheck="false"
            autocomplete="off"
            class="text-area-lg"
        ></textarea>
        <div class="hint">Enter a JSON object matching the <code>${escapedMessageName}</code> message structure. Use <em>Generate Template</em> to prefill the schema.</div>
        <div class="actions">
            <button id="encode-btn">&#11178; Encode</button>
            <button class="clear-btn" id="encode-clear-btn">Clear</button>
        </div>
        <div class="output-actions">
            <div class="section-label no-margin">Encoded Output</div>
            <button class="copy-btn small-btn" id="enc-copy-btn">
                <span class="btn-content">
                    <i class="codicon codicon-copy" aria-hidden="true"></i>
                    <span>Copy</span>
                </span>
            </button>
        </div>
        <div class="output-wrap">
            <pre id="encode-output" class="output-box empty">— Output will appear here —</pre>
        </div>
    </div>

    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }
    _escapeHtml(value) {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
    _getNonce() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let nonce = '';
        for (let i = 0; i < 32; i += 1) {
            nonce += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return nonce;
    }
    dispose() {
        ProtoDecoderPanel._panels.delete(this._key);
        this._panel.dispose();
        while (this._disposables.length) {
            const d = this._disposables.pop();
            if (d) {
                d.dispose();
            }
        }
    }
}
exports.ProtoDecoderPanel = ProtoDecoderPanel;
//# sourceMappingURL=ProtoDecoderPanel.js.map