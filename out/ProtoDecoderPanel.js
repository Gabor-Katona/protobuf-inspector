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
const protobuf = __importStar(require("protobufjs"));
const path = __importStar(require("path"));
class ProtoDecoderPanel {
    static currentPanel;
    _panel;
    _disposables = [];
    _protoFilePath;
    _messageName;
    constructor(panel, protoFilePath, messageName) {
        this._panel = panel;
        this._protoFilePath = protoFilePath;
        this._messageName = messageName;
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
    static createOrShow(protoFilePath, messageName) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;
        if (ProtoDecoderPanel.currentPanel) {
            ProtoDecoderPanel.currentPanel._protoFilePath = protoFilePath;
            ProtoDecoderPanel.currentPanel._messageName = messageName;
            ProtoDecoderPanel.currentPanel._update();
            ProtoDecoderPanel.currentPanel._panel.reveal(column);
            return;
        }
        const panel = vscode.window.createWebviewPanel('protobufDecoder', `Decode: ${messageName}`, column || vscode.ViewColumn.Beside, {
            enableScripts: true,
            retainContextWhenHidden: true
        });
        ProtoDecoderPanel.currentPanel = new ProtoDecoderPanel(panel, protoFilePath, messageName);
    }
    async _handleDecode(input, format) {
        try {
            const trimmed = input.trim();
            if (!trimmed) {
                this._postError(`Please enter ${format === 'hex' ? 'hex' : 'base64'}-encoded protobuf binary data.`);
                return;
            }
            let buffer;
            try {
                if (format === 'hex') {
                    const hexClean = trimmed.replace(/\s+/g, '');
                    if (!/^[0-9a-fA-F]*$/.test(hexClean) || hexClean.length % 2 !== 0) {
                        this._postError('Invalid hex input. Must be an even number of hex characters (0-9, a-f).');
                        return;
                    }
                    buffer = Buffer.from(hexClean, 'hex');
                }
                else {
                    buffer = Buffer.from(trimmed, 'base64');
                }
            }
            catch {
                this._postError(`Invalid ${format} input. Please check and try again.`);
                return;
            }
            let root;
            try {
                root = await protobuf.load(this._protoFilePath);
            }
            catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                this._postError(`Failed to parse .proto file: ${msg}`);
                return;
            }
            let messageType;
            try {
                messageType = root.lookupType(this._messageName);
            }
            catch {
                this._postError(`Message type '${this._messageName}' not found in ${path.basename(this._protoFilePath)}.`);
                return;
            }
            let decoded;
            try {
                decoded = messageType.decode(buffer);
            }
            catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                this._postError(`Decode failed: ${msg}\n\nMake sure the binary data matches the '${this._messageName}' message format.`);
                return;
            }
            const obj = messageType.toObject(decoded, {
                longs: String,
                enums: String,
                bytes: String,
                defaults: true,
                arrays: true,
                objects: true,
                oneofs: true
            });
            const json = JSON.stringify(obj, null, 2);
            this._panel.webview.postMessage({ command: 'result', json });
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            this._postError(`Unexpected error: ${msg}`);
        }
    }
    async _handleEncode(jsonInput, format) {
        try {
            const trimmed = jsonInput.trim();
            if (!trimmed) {
                this._postEncodeError('Please enter a JSON object to encode.');
                return;
            }
            let obj;
            try {
                obj = JSON.parse(trimmed);
            }
            catch {
                this._postEncodeError('Invalid JSON input. Please check the syntax and try again.');
                return;
            }
            let root;
            try {
                root = await protobuf.load(this._protoFilePath);
            }
            catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                this._postEncodeError(`Failed to parse .proto file: ${msg}`);
                return;
            }
            let messageType;
            try {
                messageType = root.lookupType(this._messageName);
            }
            catch {
                this._postEncodeError(`Message type '${this._messageName}' not found in ${path.basename(this._protoFilePath)}.`);
                return;
            }
            const errMsg = messageType.verify(obj);
            if (errMsg) {
                this._postEncodeError(`Validation failed: ${errMsg}`);
                return;
            }
            let encoded;
            try {
                const msg = messageType.fromObject(obj);
                encoded = Buffer.from(messageType.encode(msg).finish());
            }
            catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                this._postEncodeError(`Encode failed: ${msg}`);
                return;
            }
            const output = format === 'hex' ? encoded.toString('hex') : encoded.toString('base64');
            this._panel.webview.postMessage({ command: 'encodeResult', output, format });
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            this._postEncodeError(`Unexpected error: ${msg}`);
        }
    }
    async _handleGetTemplate() {
        try {
            let root;
            try {
                root = await protobuf.load(this._protoFilePath);
            }
            catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                this._postEncodeError(`Failed to parse .proto file: ${msg}`);
                return;
            }
            let messageType;
            try {
                messageType = root.lookupType(this._messageName);
            }
            catch {
                this._postEncodeError(`Message type '${this._messageName}' not found.`);
                return;
            }
            const template = this._buildTemplate(messageType, new Set());
            const json = JSON.stringify(template, null, 2);
            this._panel.webview.postMessage({ command: 'templateResult', json });
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            this._postEncodeError(`Unexpected error: ${msg}`);
        }
    }
    _buildTemplate(messageType, visited) {
        const obj = {};
        const typeName = messageType.fullName ?? messageType.name;
        // Guard against infinite recursion for self-referential messages
        if (visited.has(typeName)) {
            return obj;
        }
        const nextVisited = new Set(visited);
        nextVisited.add(typeName);
        for (const field of Object.values(messageType.fields)) {
            field.resolve();
            const isRepeated = field.repeated;
            let value;
            if (field.resolvedType instanceof protobuf.Type) {
                // Nested message
                const nested = this._buildTemplate(field.resolvedType, nextVisited);
                value = isRepeated ? [nested] : nested;
            }
            else if (field.resolvedType instanceof protobuf.Enum) {
                // Enum — use the first named value
                const firstKey = Object.keys(field.resolvedType.values)[0] ?? '';
                value = isRepeated ? [firstKey] : firstKey;
            }
            else {
                // Scalar
                const scalar = this._scalarDefault(field.type);
                value = isRepeated ? [scalar] : scalar;
            }
            obj[field.name] = value;
        }
        return obj;
    }
    _scalarDefault(type) {
        switch (type) {
            case 'string': return '';
            case 'bool': return false;
            case 'bytes': return '';
            case 'float':
            case 'double': return 0.0;
            default: return 0; // all integer types
        }
    }
    _postError(message) {
        this._panel.webview.postMessage({ command: 'error', message });
    }
    _postEncodeError(message) {
        this._panel.webview.postMessage({ command: 'encodeError', message });
    }
    _update() {
        this._panel.title = `Proto Tool: ${this._messageName}`;
        this._panel.webview.html = this._getHtmlForWebview();
    }
    _getHtmlForWebview() {
        const fileName = path.basename(this._protoFilePath);
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Proto Tool: ${this._messageName}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            line-height: 1.5;
        }
        .header {
            margin-bottom: 16px;
            padding-bottom: 12px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .header h1 {
            font-size: 1.3em;
            font-weight: 600;
            color: var(--vscode-foreground);
        }
        .header .subtitle {
            font-size: 0.85em;
            color: var(--vscode-descriptionForeground);
            margin-top: 4px;
        }
        .header .subtitle code {
            font-family: var(--vscode-editor-font-family);
            background: var(--vscode-textCodeBlock-background);
            padding: 1px 5px;
            border-radius: 3px;
        }
        /* Tabs */
        .tabs {
            display: flex;
            gap: 0;
            border-bottom: 2px solid var(--vscode-panel-border);
            margin-bottom: 18px;
        }
        .tab-btn {
            padding: 7px 22px;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            font-weight: 600;
            background: none;
            border: none;
            border-bottom: 2px solid transparent;
            margin-bottom: -2px;
            cursor: pointer;
            color: var(--vscode-descriptionForeground);
            transition: color 0.15s, border-color 0.15s;
        }
        .tab-btn.active {
            color: var(--vscode-foreground);
            border-bottom-color: var(--vscode-focusBorder);
        }
        .tab-btn:not(.active):hover {
            color: var(--vscode-foreground);
        }
        .tab-panel { display: none; }
        .tab-panel.active { display: block; }
        /* Common */
        .section-label {
            font-size: 0.85em;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 6px;
        }
        textarea {
            width: 100%;
            min-height: 100px;
            font-family: var(--vscode-editor-font-family);
            font-size: var(--vscode-editor-font-size);
            color: var(--vscode-input-foreground);
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 3px;
            padding: 8px;
            resize: vertical;
            outline: none;
            transition: border-color 0.15s;
        }
        textarea:focus {
            border-color: var(--vscode-focusBorder);
        }
        textarea::placeholder {
            color: var(--vscode-input-placeholderForeground);
        }
        .actions {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-top: 12px;
            margin-bottom: 20px;
        }
        button {
            padding: 6px 18px;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-button-foreground);
            background-color: var(--vscode-button-background);
            border: none;
            border-radius: 3px;
            cursor: pointer;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        button:active { opacity: 0.85; }
        .clear-btn {
            color: var(--vscode-foreground);
            background-color: var(--vscode-button-secondaryBackground);
        }
        .clear-btn:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        .copy-btn {
            color: var(--vscode-foreground);
            background-color: var(--vscode-button-secondaryBackground);
        }
        .copy-btn:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        .template-btn {
            color: var(--vscode-foreground);
            background-color: var(--vscode-button-secondaryBackground);
            margin-left: auto;
        }
        .template-btn:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        .output-wrap { margin-top: 4px; }
        .output-box {
            width: 100%;
            min-height: 120px;
            font-family: var(--vscode-editor-font-family);
            font-size: var(--vscode-editor-font-size);
            background-color: var(--vscode-textCodeBlock-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 3px;
            padding: 12px;
            white-space: pre-wrap;
            word-break: break-all;
            overflow-y: auto;
            color: var(--vscode-foreground);
        }
        .output-box.empty  { color: var(--vscode-descriptionForeground); }
        .output-box.error  { color: var(--vscode-editorError-foreground); border-color: var(--vscode-editorError-foreground); }
        .output-box.success { color: var(--vscode-terminal-ansiGreen, #4ec9b0); }
        .hint {
            font-size: 0.8em;
            color: var(--vscode-descriptionForeground);
            margin-top: 6px;
        }
        .format-row {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 8px;
        }
        .format-toggle {
            display: flex;
            border: 1px solid var(--vscode-button-border, var(--vscode-input-border));
            border-radius: 4px;
            overflow: hidden;
        }
        .fmt-btn {
            padding: 4px 16px;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            border: none;
            cursor: pointer;
            user-select: none;
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            transition: background-color 0.15s, color 0.15s;
        }
        .fmt-btn:not(:last-child) {
            border-right: 1px solid var(--vscode-button-border, var(--vscode-input-border));
        }
        .fmt-btn.active {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        .fmt-btn:not(.active):hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        .output-actions {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 6px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>&#128268; <strong>${this._messageName}</strong></h1>
        <div class="subtitle">from <code>${fileName}</code></div>
    </div>

    <!-- Tabs -->
    <div class="tabs">
        <button class="tab-btn active" id="tab-decode" onclick="switchTab('decode')">&#9654; Decode</button>
        <button class="tab-btn" id="tab-encode" onclick="switchTab('encode')">&#11178; Encode</button>
    </div>

    <!-- DECODE PANEL -->
    <div class="tab-panel active" id="panel-decode">
        <div class="format-row">
            <div class="section-label" style="margin-bottom:0">Input Format</div>
            <div class="format-toggle">
                <button class="fmt-btn active" id="dec-btn-base64" onclick="setDecodeFormat('base64')">Base64</button>
                <button class="fmt-btn" id="dec-btn-hex" onclick="setDecodeFormat('hex')">Hex</button>
            </div>
        </div>
        <div class="section-label" style="margin-top:12px">Encoded Binary Input</div>
        <textarea
            id="decode-input"
            placeholder="Paste base64-encoded protobuf binary data here..."
            spellcheck="false"
            autocomplete="off"
        ></textarea>
        <div class="hint" id="decode-hint">Paste base64-encoded binary protobuf payload (e.g. <code>CgVXb3JsZA==</code>)</div>
        <div class="actions">
            <button id="decode-btn" onclick="decode()">&#9654; Decode</button>
            <button class="clear-btn" onclick="clearDecode()">Clear</button>
        </div>
        <div class="output-actions">
            <div class="section-label" style="margin-bottom:0">Decoded Output (JSON)</div>
            <button class="copy-btn" id="dec-copy-btn" onclick="copyOutput('decode-output')" style="padding:3px 12px;font-size:0.82em;">&#128203; Copy</button>
        </div>
        <div class="output-wrap">
            <pre id="decode-output" class="output-box empty">— Output will appear here —</pre>
        </div>
    </div>

    <!-- ENCODE PANEL -->
    <div class="tab-panel" id="panel-encode">
        <div class="format-row">
            <div class="section-label" style="margin-bottom:0">Output Format</div>
            <div class="format-toggle">
                <button class="fmt-btn active" id="enc-btn-base64" onclick="setEncodeFormat('base64')">Base64</button>
                <button class="fmt-btn" id="enc-btn-hex" onclick="setEncodeFormat('hex')">Hex</button>
            </div>
            <button class="template-btn" id="template-btn" onclick="generateTemplate()">&#128196; Generate Template</button>
        </div>
        <div class="section-label" style="margin-top:12px">JSON Input</div>
        <textarea
            id="encode-input"
            placeholder='Paste JSON object here, e.g. {"name":"World"}'
            spellcheck="false"
            autocomplete="off"
            style="min-height:140px"
        ></textarea>
        <div class="hint">Enter a JSON object matching the <code>${this._messageName}</code> message structure. Use <em>Generate Template</em> to prefill the schema.</div>
        <div class="actions">
            <button id="encode-btn" onclick="encodeMsg()">&#11178; Encode</button>
            <button class="clear-btn" onclick="clearEncode()">Clear</button>
        </div>
        <div class="output-actions">
            <div class="section-label" style="margin-bottom:0">Encoded Output</div>
            <button class="copy-btn" id="enc-copy-btn" onclick="copyOutput('encode-output')" style="padding:3px 12px;font-size:0.82em;">&#128203; Copy</button>
        </div>
        <div class="output-wrap">
            <pre id="encode-output" class="output-box empty">— Output will appear here —</pre>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        // ── Tab switching ────────────────────────────────────────────────────
        function switchTab(name) {
            ['decode', 'encode'].forEach(t => {
                document.getElementById('tab-' + t).classList.toggle('active', t === name);
                document.getElementById('panel-' + t).classList.toggle('active', t === name);
            });
        }

        // ── DECODE ───────────────────────────────────────────────────────────
        const decodeInputEl  = document.getElementById('decode-input');
        const decodeOutputEl = document.getElementById('decode-output');
        const decodeBtnEl    = document.getElementById('decode-btn');
        const decodeHintEl   = document.getElementById('decode-hint');

        const decodeHints = {
            base64: 'Paste base64-encoded binary protobuf payload (e.g. <code>CgVXb3JsZA==</code>)',
            hex:    'Paste hex-encoded binary protobuf payload (e.g. <code>0a05576f726c64</code>)'
        };
        const decodePlaceholders = {
            base64: 'Paste base64-encoded protobuf binary data here...',
            hex:    'Paste hex-encoded protobuf binary data here...'
        };

        let decodeFormat = 'base64';

        function setDecodeFormat(fmt) {
            decodeFormat = fmt;
            document.getElementById('dec-btn-base64').classList.toggle('active', fmt === 'base64');
            document.getElementById('dec-btn-hex').classList.toggle('active', fmt === 'hex');
            decodeHintEl.innerHTML = decodeHints[fmt];
            decodeInputEl.placeholder = decodePlaceholders[fmt];
            decodeOutputEl.className = 'output-box empty';
            decodeOutputEl.textContent = '\u2014 Output will appear here \u2014';
        }

        decodeInputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); decode(); }
        });

        function decode() {
            decodeBtnEl.disabled = true;
            decodeBtnEl.textContent = '⏳ Decoding...';
            decodeOutputEl.className = 'output-box empty';
            decodeOutputEl.textContent = '— Decoding… —';
            vscode.postMessage({ command: 'decode', data: decodeInputEl.value, format: decodeFormat });
        }

        function clearDecode() {
            decodeInputEl.value = '';
            decodeOutputEl.className = 'output-box empty';
            decodeOutputEl.textContent = '— Output will appear here —';
        }

        // ── ENCODE ───────────────────────────────────────────────────────────
        const encodeInputEl  = document.getElementById('encode-input');
        const encodeOutputEl = document.getElementById('encode-output');
        const encodeBtnEl    = document.getElementById('encode-btn');

        let encodeFormat = 'base64';

        function setEncodeFormat(fmt) {
            encodeFormat = fmt;
            document.getElementById('enc-btn-base64').classList.toggle('active', fmt === 'base64');
            document.getElementById('enc-btn-hex').classList.toggle('active', fmt === 'hex');
            encodeOutputEl.className = 'output-box empty';
            encodeOutputEl.textContent = '\u2014 Output will appear here \u2014';
        }

        encodeInputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); encodeMsg(); }
        });

        function encodeMsg() {
            encodeBtnEl.disabled = true;
            encodeBtnEl.textContent = '⏳ Encoding...';
            encodeOutputEl.className = 'output-box empty';
            encodeOutputEl.textContent = '— Encoding… —';
            vscode.postMessage({ command: 'encode', data: encodeInputEl.value, format: encodeFormat });
        }

        function generateTemplate() {
            const btn = document.getElementById('template-btn');
            btn.disabled = true;
            btn.textContent = '⏳ Loading...';
            vscode.postMessage({ command: 'getTemplate' });
        }

        function clearEncode() {
            encodeInputEl.value = '';
            encodeOutputEl.className = 'output-box empty';
            encodeOutputEl.textContent = '— Output will appear here —';
        }

        // ── Copy helper ──────────────────────────────────────────────────────
        function copyOutput(id) {
            const el = document.getElementById(id);
            if (!el || el.classList.contains('empty') || el.classList.contains('error')) return;
            navigator.clipboard.writeText(el.textContent || '').catch(() => {});
        }

        // ── Message handler ──────────────────────────────────────────────────
        window.addEventListener('message', (event) => {
            const msg = event.data;

            if (msg.command === 'result') {
                decodeBtnEl.disabled = false;
                decodeBtnEl.textContent = '▶ Decode';
                decodeOutputEl.className = 'output-box success';
                decodeOutputEl.textContent = msg.json;
            } else if (msg.command === 'error') {
                decodeBtnEl.disabled = false;
                decodeBtnEl.textContent = '▶ Decode';
                decodeOutputEl.className = 'output-box error';
                decodeOutputEl.textContent = '⚠ ' + msg.message;
            } else if (msg.command === 'encodeResult') {
                encodeBtnEl.disabled = false;
                encodeBtnEl.textContent = '⇒ Encode';
                encodeOutputEl.className = 'output-box success';
                encodeOutputEl.textContent = msg.output;
            } else if (msg.command === 'encodeError') {
                encodeBtnEl.disabled = false;
                encodeBtnEl.textContent = '⇒ Encode';
                encodeOutputEl.className = 'output-box error';
                encodeOutputEl.textContent = '⚠ ' + msg.message;
            } else if (msg.command === 'templateResult') {
                const btn = document.getElementById('template-btn');
                btn.disabled = false;
                btn.textContent = '📄 Generate Template';
                encodeInputEl.value = msg.json;
            }
        });
    </script>
</body>
</html>`;
    }
    dispose() {
        ProtoDecoderPanel.currentPanel = undefined;
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