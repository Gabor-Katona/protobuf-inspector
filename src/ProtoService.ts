import * as protobuf from 'protobufjs';
import * as path from 'path';
import * as fs from 'fs';

export class ProtoService {
    public readonly protoFilePath: string;
    public readonly messageName: string;

    private _cachedType: protobuf.Type | null = null;

    constructor(protoFilePath: string, messageName: string) {
        this.protoFilePath = protoFilePath;
        this.messageName = messageName;
    }

    public invalidateCache(): void {
        this._cachedType = null;
    }

    // ── Shared helper ────────────────────────────────────────────────────────

    private async _loadType(): Promise<protobuf.Type> {
        if (this._cachedType) {
            return this._cachedType;
        }

        try {
            await fs.promises.access(this.protoFilePath);
        } catch {
            throw new Error(`Proto file not found: ${path.basename(this.protoFilePath)}`);
        }

        const LOAD_TIMEOUT_MS = 3000;
        let root: protobuf.Root;
        try {
            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error(`Timed out — the .proto file may have unresolvable imports or an invalid message reference.`)), LOAD_TIMEOUT_MS)
            );
            root = await Promise.race([protobuf.load(this.protoFilePath), timeoutPromise]);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            throw new Error(`Failed to parse .proto file: ${msg}`);
        }

        try {
            this._cachedType = root.lookupType(this.messageName);
        } catch {
            throw new Error(
                `Message type '${this.messageName}' not found in ${path.basename(this.protoFilePath)}.`
            );
        }

        return this._cachedType;
    }

    // ── Decode ───────────────────────────────────────────────────────────────

    async decode(input: string, format: 'base64' | 'hex'): Promise<string> {
        const trimmed = input.trim();
        if (!trimmed) {
            throw new Error(
                `Please enter ${format === 'hex' ? 'hex' : 'base64'}-encoded protobuf binary data.`
            );
        }

        let buffer: Uint8Array;
        if (format === 'hex') {
            const hexClean = trimmed.replace(/\s+/g, '');
            if (!/^[0-9a-fA-F]*$/.test(hexClean) || hexClean.length % 2 !== 0) {
                throw new Error(
                    'Invalid hex input. Must be an even number of hex characters (0-9, a-f).'
                );
            }
            buffer = Buffer.from(hexClean, 'hex');
        } else {
            const b64Clean = trimmed.replace(/\s+/g, '');
            if (!/^[A-Za-z0-9+/]*(={0,2})$/.test(b64Clean)) {
                throw new Error('Invalid base64 input. Please check and try again.');
            }
            buffer = Buffer.from(b64Clean, 'base64');
        }

        const messageType = await this._loadType();

        let decoded: protobuf.Message;
        try {
            decoded = messageType.decode(buffer);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            throw new Error(
                `Decode failed: ${msg}\n\nMake sure the binary data matches the '${this.messageName}' message format.`
            );
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

    async encode(jsonInput: string, format: 'base64' | 'hex'): Promise<string> {
        const trimmed = jsonInput.trim();
        if (!trimmed) {
            throw new Error('Please enter a JSON object to encode.');
        }

        let obj: Record<string, unknown>;
        try {
            obj = JSON.parse(trimmed);
        } catch {
            throw new Error('Invalid JSON input. Please check the syntax and try again.');
        }

        const messageType = await this._loadType();

        const errMsg = messageType.verify(obj);
        if (errMsg) {
            throw new Error(`Validation failed: ${errMsg}`);
        }

        let encoded: Buffer;
        try {
            const msg = messageType.fromObject(obj);
            encoded = Buffer.from(messageType.encode(msg).finish());
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            throw new Error(`Encode failed: ${msg}`);
        }

        return format === 'hex' ? encoded.toString('hex') : encoded.toString('base64');
    }

    // ── Template ─────────────────────────────────────────────────────────────

    async getTemplate(): Promise<string> {
        const messageType = await this._loadType();
        const template = this._buildTemplate(messageType, new Set());
        return JSON.stringify(template, null, 2);
    }

    private _buildTemplate(messageType: protobuf.Type, visited: Set<string>): Record<string, unknown> {
        const obj: Record<string, unknown> = {};
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

            let value: unknown;

            if (field.resolvedType instanceof protobuf.Type) {
                // Nested message
                const nested = this._buildTemplate(field.resolvedType, nextVisited);
                value = isRepeated ? [nested] : nested;
            } else if (field.resolvedType instanceof protobuf.Enum) {
                // Enum — use the first named value
                const firstKey = Object.keys(field.resolvedType.values)[0] ?? '';
                value = isRepeated ? [firstKey] : firstKey;
            } else {
                // Scalar
                const scalar = this._scalarDefault(field.type);
                value = isRepeated ? [scalar] : scalar;
            }

            obj[field.name] = value;
        }

        return obj;
    }

    private _scalarDefault(type: string): unknown {
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
