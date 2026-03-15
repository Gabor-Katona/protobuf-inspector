import * as vscode from 'vscode';
import * as path from 'path';
import { ProtoService } from './ProtoService';

export class ProtoDecoderPanel {
    private static readonly _panels = new Map<string, ProtoDecoderPanel>();

    private readonly _panel: vscode.WebviewPanel;
    private readonly _key: string;
    private _disposables: vscode.Disposable[] = [];

    private _service: ProtoService;

    private constructor(panel: vscode.WebviewPanel, protoFilePath: string, messageName: string) {
        this._key = ProtoDecoderPanel._makeKey(protoFilePath, messageName);
        this._panel = panel;
        this._service = new ProtoService(protoFilePath, messageName);

        this._update();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                if (message.command === 'decode') {
                    await this._handleDecode(message.data, message.format ?? 'base64');
                } else if (message.command === 'encode') {
                    await this._handleEncode(message.data, message.format ?? 'base64');
                } else if (message.command === 'getTemplate') {
                    await this._handleGetTemplate();
                }
            },
            null,
            this._disposables
        );
    }

    private static _makeKey(protoFilePath: string, messageName: string): string {
        return `${protoFilePath}::${messageName}`;
    }

    public static createOrShow(protoFilePath: string, messageName: string): void {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        const config = vscode.workspace.getConfiguration('protobuf-tool');
        const reuseTab = config.get<string>('panelMode', 'newTab') === 'reuseTab';

        if (reuseTab) {
            // Reuse the single shared panel if one is open
            const sharedEntry = ProtoDecoderPanel._panels.values().next();
            if (!sharedEntry.done && sharedEntry.value) {
                const existing = sharedEntry.value;
                existing._service = new ProtoService(protoFilePath, messageName);
                existing._update();
                existing._panel.reveal(column);
                return;
            }
        } else {
            // Per-message panel: reveal if this exact combo is already open
            const key = ProtoDecoderPanel._makeKey(protoFilePath, messageName);
            const existing = ProtoDecoderPanel._panels.get(key);
            if (existing) {
                existing._panel.reveal(column);
                return;
            }
        }

        const key = ProtoDecoderPanel._makeKey(protoFilePath, messageName);
        const panel = vscode.window.createWebviewPanel(
            'protobufDecoder',
            `Decode: ${messageName}`,
            column || vscode.ViewColumn.Active,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        ProtoDecoderPanel._panels.set(key, new ProtoDecoderPanel(panel, protoFilePath, messageName));
    }

    private async _handleDecode(input: string, format: 'base64' | 'hex'): Promise<void> {
        try {
            const json = await this._service.decode(input, format);
            this._panel.webview.postMessage({ command: 'result', json });
        } catch (e: unknown) {
            this._postError(e instanceof Error ? e.message : String(e));
        }
    }

    private async _handleEncode(jsonInput: string, format: 'base64' | 'hex'): Promise<void> {
        try {
            const output = await this._service.encode(jsonInput, format);
            this._panel.webview.postMessage({ command: 'encodeResult', output, format });
        } catch (e: unknown) {
            this._postEncodeError(e instanceof Error ? e.message : String(e));
        }
    }

    private async _handleGetTemplate(): Promise<void> {
        try {
            const json = await this._service.getTemplate();
            this._panel.webview.postMessage({ command: 'templateResult', json });
        } catch (e: unknown) {
            this._postEncodeError(e instanceof Error ? e.message : String(e));
        }
    }

    private _postError(message: string): void {
        this._panel.webview.postMessage({ command: 'error', message });
    }

    private _postEncodeError(message: string): void {
        this._panel.webview.postMessage({ command: 'encodeError', message });
    }

    private _update(): void {
        this._panel.title = `Proto Tool: ${this._service.messageName}`;
        this._panel.webview.html = this._getHtmlForWebview();
    }

    private _getHtmlForWebview(): string {
        const fileName = path.basename(this._service.protoFilePath);
        const messageName = this._service.messageName;
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Proto Tool: ${messageName}</title>
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
        <h1>&#128268; <strong>${messageName}</strong></h1>
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
            style="min-height:140px"
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
        <div class="hint">Enter a JSON object matching the <code>${messageName}</code> message structure. Use <em>Generate Template</em> to prefill the schema.</div>
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

    public dispose(): void {
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
