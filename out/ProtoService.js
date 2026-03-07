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
exports.ProtoService = void 0;
const protobuf = __importStar(require("protobufjs"));
const path = __importStar(require("path"));
class ProtoService {
    protoFilePath;
    messageName;
    constructor(protoFilePath, messageName) {
        this.protoFilePath = protoFilePath;
        this.messageName = messageName;
    }
    // ── Shared helper ────────────────────────────────────────────────────────
    async _loadType() {
        let root;
        try {
            root = await protobuf.load(this.protoFilePath);
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            throw new Error(`Failed to parse .proto file: ${msg}`);
        }
        try {
            return root.lookupType(this.messageName);
        }
        catch {
            throw new Error(`Message type '${this.messageName}' not found in ${path.basename(this.protoFilePath)}.`);
        }
    }
    // ── Decode ───────────────────────────────────────────────────────────────
    async decode(input, format) {
        const trimmed = input.trim();
        if (!trimmed) {
            throw new Error(`Please enter ${format === 'hex' ? 'hex' : 'base64'}-encoded protobuf binary data.`);
        }
        let buffer;
        if (format === 'hex') {
            const hexClean = trimmed.replace(/\s+/g, '');
            if (!/^[0-9a-fA-F]*$/.test(hexClean) || hexClean.length % 2 !== 0) {
                throw new Error('Invalid hex input. Must be an even number of hex characters (0-9, a-f).');
            }
            buffer = Buffer.from(hexClean, 'hex');
        }
        else {
            try {
                buffer = Buffer.from(trimmed, 'base64');
            }
            catch {
                throw new Error('Invalid base64 input. Please check and try again.');
            }
        }
        const messageType = await this._loadType();
        let decoded;
        try {
            decoded = messageType.decode(buffer);
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            throw new Error(`Decode failed: ${msg}\n\nMake sure the binary data matches the '${this.messageName}' message format.`);
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
        return JSON.stringify(obj, null, 2);
    }
    // ── Encode ───────────────────────────────────────────────────────────────
    async encode(jsonInput, format) {
        const trimmed = jsonInput.trim();
        if (!trimmed) {
            throw new Error('Please enter a JSON object to encode.');
        }
        let obj;
        try {
            obj = JSON.parse(trimmed);
        }
        catch {
            throw new Error('Invalid JSON input. Please check the syntax and try again.');
        }
        const messageType = await this._loadType();
        const errMsg = messageType.verify(obj);
        if (errMsg) {
            throw new Error(`Validation failed: ${errMsg}`);
        }
        let encoded;
        try {
            const msg = messageType.fromObject(obj);
            encoded = Buffer.from(messageType.encode(msg).finish());
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            throw new Error(`Encode failed: ${msg}`);
        }
        return format === 'hex' ? encoded.toString('hex') : encoded.toString('base64');
    }
    // ── Template ─────────────────────────────────────────────────────────────
    async getTemplate() {
        const messageType = await this._loadType();
        const template = this._buildTemplate(messageType, new Set());
        return JSON.stringify(template, null, 2);
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
}
exports.ProtoService = ProtoService;
//# sourceMappingURL=ProtoService.js.map