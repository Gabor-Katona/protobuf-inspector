# Protobuf Inspector

**Decode and encode Protobuf messages directly inside VS Code** — no external tools, no command line. Just open a `.proto` file, click a lens, and inspect your binary data.

---

## Features

### One-click Inspect from your `.proto` file

A **CodeLens** action appears above every `message` definition. Click **Inspect \<MessageName\>** to instantly open the decode/encode panel for that message — no configuration needed.

![CodeLens above a message definition](images/codelens.png)

---

### Decode binary Protobuf messages

Paste a **Base64** or **Hex** encoded binary payload and decode it into a clean, readable JSON representation. The panel displays the decoded result with full field names and values from your schema.

![Decode panel showing binary input and JSON output](images/decode.png)

---

### Encode JSON back to Protobuf binary

Switch to the **Encode** tab, paste a JSON object and get the binary-encoded Protobuf output in Base64 or Hex format. The extension validates the JSON against your schema before encoding.

![Encode panel showing JSON input and binary output](images/encode.png)

---

### Command Palette support

Run **Protobuf Inspector: Open Decode/Encode Panel** from the Command Palette (`Ctrl+Shift+P`):

- **If a `.proto` file is active in the editor** — the extension uses it automatically and shows a message picker listing all `message` definitions found in that file.
- **If no `.proto` file is open** — a file dialog opens so you can browse to any `.proto` file on disk, then the message picker appears.

---

### Auto-generate a JSON template

Not sure what fields a message has? Use the **Generate Template** button to auto-fill the editor with a skeleton JSON object containing all fields of the message, including nested messages, repeated fields, and enums — with sensible placeholder values.

---

### Live schema reload

When you save your `.proto` file, the panel automatically reloads the schema — no need to close and reopen anything. If your file has unsaved changes, the CodeLens shows a **Save to inspect** prompt instead.

---

## Usage

1. Open a `.proto` file in VS Code.
2. Click the **Inspect \<MessageName\>** CodeLens above any `message` definition.
3. In the **Decode** tab: paste your Base64 or Hex payload and click **Decode**.
4. In the **Encode** tab: paste or generate a JSON template and click **Encode**.

> **Tip:** Use the **Generate Template** button on the Encode tab to scaffold a valid JSON structure from your message definition.

---

## Extension Settings

| Setting | Default | Description |
|---|---|---|
| `protobuf-inspector.panelMode` | `reuseTab` | `reuseTab` — reuse a single shared panel; `newTab` — open a separate panel per message |
| `protobuf-inspector.enableCodeLens` | `true` | Show or hide the **Inspect** CodeLens above message definitions in `.proto` files |

---

## Requirements

No external dependencies or CLI tools required. Everything runs inside VS Code.

---

## Known Issues

- Only top-level `.proto` files are directly supported; schemas with complex multi-file `import` chains may not resolve all types correctly.
- The extension currently supports **proto3** syntax. Proto2 files may work partially.

---

## Release Notes

### 1.0.0

Initial release:
- Decode Protobuf binary (Base64 / Hex) to JSON
- Encode JSON to Protobuf binary (Base64 / Hex)
- Auto-generate JSON templates from message definitions
- CodeLens integration for `.proto` files
- Live schema reload on file save
- Command Palette command to open any `.proto` file

---

## Third-Party Notices

This extension uses the following open-source packages:

- **[protobufjs](https://github.com/protobufjs/protobuf.js)** — BSD 3-Clause License. Copyright © 2016, Daniel Wirtz.
- **[@vscode/codicons](https://github.com/microsoft/vscode-codicons)** — Icon font licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); code licensed under MIT. Copyright © Microsoft Corporation.
