# Change Log

All notable changes to the "protobuf-inspector" extension will be documented in this file.

## [1.0.0] - 2026-03-21

### Added

- Decode Protobuf binary payloads (Base64 or Hex) to human-readable JSON
- Encode JSON back to Protobuf binary (Base64 or Hex)
- Auto-generate a JSON template from a message definition (including nested messages, repeated fields, and enums)
- CodeLens **Inspect \<MessageName\>** action above every `message` definition in `.proto` files
- Command Palette command **Protobuf Inspector: Open Decode/Encode Panel** — auto-detects the active `.proto` file or opens a file picker
- Live schema reload when a `.proto` file is saved — no need to reopen the panel
- `protobuf-inspector.panelMode` setting: reuse a single shared tab or open a new tab per message
- `protobuf-inspector.enableCodeLens` setting: show or hide CodeLens actions in `.proto` files