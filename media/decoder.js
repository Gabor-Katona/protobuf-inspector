const vscode = acquireVsCodeApi();

const decodeInputEl = document.getElementById('decode-input');
const decodeOutputEl = document.getElementById('decode-output');
const decodeBtnEl = document.getElementById('decode-btn');
const decodeHintEl = document.getElementById('decode-hint');
const decodeClearBtnEl = document.getElementById('decode-clear-btn');

const encodeInputEl = document.getElementById('encode-input');
const encodeOutputEl = document.getElementById('encode-output');
const encodeBtnEl = document.getElementById('encode-btn');
const encodeClearBtnEl = document.getElementById('encode-clear-btn');
const templateBtnEl = document.getElementById('template-btn');

const tabDecodeBtnEl = document.getElementById('tab-decode');
const tabEncodeBtnEl = document.getElementById('tab-encode');

const decBase64BtnEl = document.getElementById('dec-btn-base64');
const decHexBtnEl = document.getElementById('dec-btn-hex');
const encBase64BtnEl = document.getElementById('enc-btn-base64');
const encHexBtnEl = document.getElementById('enc-btn-hex');

const decCopyBtnEl = document.getElementById('dec-copy-btn');
const encCopyBtnEl = document.getElementById('enc-copy-btn');

const decodeHints = {
    base64: 'Paste base64-encoded binary protobuf payload (e.g. <code>CgVXb3JsZA==</code>)',
    hex: 'Paste hex-encoded binary protobuf payload (e.g. <code>0a05576f726c64</code>)'
};

const decodePlaceholders = {
    base64: 'Paste base64-encoded protobuf binary data here...',
    hex: 'Paste hex-encoded protobuf binary data here...'
};

let decodeFormat = 'base64';
let encodeFormat = 'base64';

function switchTab(name) {
    ['decode', 'encode'].forEach((t) => {
        document.getElementById('tab-' + t).classList.toggle('active', t === name);
        document.getElementById('panel-' + t).classList.toggle('active', t === name);
    });

    if (name === 'encode' && !encodeInputEl.value.trim()) {
        generateTemplate();
    }
}

function setDecodeFormat(fmt) {
    decodeFormat = fmt;
    decBase64BtnEl.classList.toggle('active', fmt === 'base64');
    decHexBtnEl.classList.toggle('active', fmt === 'hex');
    decodeHintEl.innerHTML = decodeHints[fmt];
    decodeInputEl.placeholder = decodePlaceholders[fmt];
    decodeOutputEl.className = 'output-box empty';
    decodeOutputEl.textContent = '\u2014 Output will appear here \u2014';
}

function decode() {
    decodeBtnEl.disabled = true;
    decodeOutputEl.className = 'output-box empty';
    decodeOutputEl.textContent = '\u2014 Decoding\u2026 \u2014';
    vscode.postMessage({ command: 'decode', data: decodeInputEl.value, format: decodeFormat });
}

function clearDecode() {
    decodeInputEl.value = '';
    decodeOutputEl.className = 'output-box empty';
    decodeOutputEl.textContent = '\u2014 Output will appear here \u2014';
}

function setEncodeFormat(fmt) {
    encodeFormat = fmt;
    encBase64BtnEl.classList.toggle('active', fmt === 'base64');
    encHexBtnEl.classList.toggle('active', fmt === 'hex');
    encodeOutputEl.className = 'output-box empty';
    encodeOutputEl.textContent = '\u2014 Output will appear here \u2014';
}

function encodeMsg() {
    encodeBtnEl.disabled = true;
    encodeOutputEl.className = 'output-box empty';
    encodeOutputEl.textContent = '\u2014 Encoding\u2026 \u2014';
    vscode.postMessage({ command: 'encode', data: encodeInputEl.value, format: encodeFormat });
}

function generateTemplate() {
    templateBtnEl.disabled = true;
    vscode.postMessage({ command: 'getTemplate' });
}

function clearEncode() {
    encodeInputEl.value = '';
    encodeOutputEl.className = 'output-box empty';
    encodeOutputEl.textContent = '\u2014 Output will appear here \u2014';
}

function copyOutput(id) {
    const el = document.getElementById(id);
    if (!el || el.classList.contains('empty') || el.classList.contains('error')) {
        return;
    }

    navigator.clipboard.writeText(el.textContent || '').catch(() => {
        // No-op: clipboard access can fail in limited environments.
    });
}

decodeInputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        decode();
    }
});

encodeInputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        encodeMsg();
    }
});

tabDecodeBtnEl.addEventListener('click', () => switchTab('decode'));
tabEncodeBtnEl.addEventListener('click', () => switchTab('encode'));

decBase64BtnEl.addEventListener('click', () => setDecodeFormat('base64'));
decHexBtnEl.addEventListener('click', () => setDecodeFormat('hex'));
encBase64BtnEl.addEventListener('click', () => setEncodeFormat('base64'));
encHexBtnEl.addEventListener('click', () => setEncodeFormat('hex'));

decodeBtnEl.addEventListener('click', decode);
decodeClearBtnEl.addEventListener('click', clearDecode);
encodeBtnEl.addEventListener('click', encodeMsg);
encodeClearBtnEl.addEventListener('click', clearEncode);
templateBtnEl.addEventListener('click', generateTemplate);

decCopyBtnEl.addEventListener('click', () => copyOutput('decode-output'));
encCopyBtnEl.addEventListener('click', () => copyOutput('encode-output'));

window.addEventListener('message', (event) => {
    const msg = event.data;

    if (msg.command === 'result') {
        decodeBtnEl.disabled = false;
        decodeOutputEl.className = 'output-box success';
        decodeOutputEl.textContent = msg.json;
    } else if (msg.command === 'error') {
        decodeBtnEl.disabled = false;
        decodeOutputEl.className = 'output-box error';
        decodeOutputEl.textContent = '\u26a0 ' + msg.message;
    } else if (msg.command === 'encodeResult') {
        encodeBtnEl.disabled = false;
        encodeOutputEl.className = 'output-box success';
        encodeOutputEl.textContent = msg.output;
    } else if (msg.command === 'encodeError') {
        encodeBtnEl.disabled = false;
        templateBtnEl.disabled = false;
        encodeOutputEl.className = 'output-box error';
        encodeOutputEl.textContent = '\u26a0 ' + msg.message;
    } else if (msg.command === 'templateResult') {
        templateBtnEl.disabled = false;
        encodeInputEl.value = msg.json;
    }
});
