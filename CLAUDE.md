# Mobile MCP Server

Fork of [claude-in-mobile](https://github.com/AlexGladkov/claude-in-mobile) adapted to the metatool/MetaMcp pattern.

## Architecture

Single "mobile" metatool exposed via MetaMcp (port 8750). Reduces token usage from ~15-20k to ~2-3k.

```
MetaMcp (port 8750)
  └── mobile (stdio subprocess)
        └── single "mobile" tool with action dispatch
```

## Usage

All actions go through `mobile({ action: "...", ...params })`.

### Device Connection

```
mobile({ action: "list_devices" })
mobile({ action: "set_device", deviceId: "<id>" })
```

### WiFi ADB (no USB cable needed)

1. On the phone: Settings > Developer options > Wireless debugging > Enable
2. Pair (first time only):
```
mobile({ action: "pair_wifi", ip: "192.168.0.50", port: 37123, code: "123456" })
```
3. Connect:
```
mobile({ action: "connect_wifi", ip: "192.168.0.50", port: 44701 })
```
4. Disconnect:
```
mobile({ action: "disconnect_wifi" })
```

### Screenshots & UI

```
mobile({ action: "screenshot" })
mobile({ action: "annotate" })          // screenshot + bounding boxes
mobile({ action: "get_ui" })            // accessibility tree
mobile({ action: "analyze_screen" })    // structured analysis (Android)
```

### Interaction

```
mobile({ action: "tap", x: 500, y: 1200 })
mobile({ action: "tap", text: "Settings" })
mobile({ action: "find_and_tap", description: "submit button" })
mobile({ action: "swipe", direction: "up" })
mobile({ action: "input_text", text: "hello" })
mobile({ action: "press_key", key: "BACK" })
```

### App Management

```
mobile({ action: "launch_app", package: "com.slopus.happy.dev" })
mobile({ action: "stop_app", package: "com.slopus.happy.dev" })
mobile({ action: "get_logs", package: "com.slopus.happy.dev", lines: 50 })
```

### Reliability

```
mobile({ action: "wait_for_element", text: "Welcome", timeout: 5000 })
mobile({ action: "assert_visible", text: "Submit" })
mobile({ action: "batch_commands", commands: [
  { name: "tap", arguments: { text: "Menu" } },
  { name: "wait", arguments: { ms: 500 } },
  { name: "tap", arguments: { text: "Settings" } }
]})
```

## CLI Options

```
node dist/index.js                    # stdio + metatool (default, used by MetaMcp)
node dist/index.js --no-meta          # stdio + 49 individual tools
node dist/index.js --transport http   # HTTP mode on port 3100
node dist/index.js --port 4000        # custom HTTP port
```

## Configuration

### MetaMcp (servers.json)

```json
"mobile": {
  "command": "node",
  "args": ["C:\\...\\Mobile MCP Server\\dist\\index.js"],
  "env": {
    "ANDROID_HOME": "C:/Dev/android",
    "ADB_PATH": "C:/Dev/android/platform-tools/adb.exe"
  }
}
```

### Claude Code (.mcp.json)

```json
{
  "mobile": {
    "type": "http",
    "url": "http://127.0.0.1:8750/servers/mobile/mcp"
  }
}
```

## Target Device

- Samsung Galaxy S22 Ultra (SM-S908B, `happy_test`)
- WiFi ADB: `192.168.0.50` (same LAN as dev machine)
- APK build: `C:\h\android\app\build\outputs\apk\release\app-release.apk`

### Happy App Variants

| Package | Variante | Notes |
|---------|----------|-------|
| `com.ex3ndr.happy` | **Production** | Happy (store/release) |
| `com.slopus.happy.dev` | **Dev** | Happy (dev) - notre build, flags `experiments` actifs |

Pour tester les features dev (File Browser, Zen/Plannotator), utiliser `com.slopus.happy.dev`.

## File Structure

```
src/
  index.ts          # Commander CLI entry point
  server.ts         # MobileMcpServer (stdio + HTTP dual transport)
  meta-tool.ts      # ACTION_MAP + single "mobile" tool definition
  tool-handlers.ts  # Tool definitions (49 tools) + handleTool dispatcher
  device-manager.ts # Unified facade for all platform clients
  adb/
    client.ts       # AdbClient (+ WiFi: connectWifi, pairWifi, disconnectWifi)
    ui-parser.ts    # Parse uiautomator XML
    webview.ts      # WebView inspection via CDP
  ios/              # iOS simulator support (simctl + WDA)
  desktop/          # Desktop automation (Kotlin companion)
  aurora/           # Aurora OS support
  utils/
    image.ts        # Screenshot compression + annotation
```

## Prerequisites: Starting MetaMcp

The mobile server runs as a subprocess of MetaMcp (port 8750). **MetaMcp must be running first.**

### Start MetaMcp

```bash
cd "C:\Users\julien\OneDrive\Coding\_Projets de code\MCP servers\MetaMcp"
npm start
```

MetaMcp starts all registered servers sequentially (~2-3 min for all 12 servers).

### Healthcheck

```bash
# Check if gateway is running
curl http://127.0.0.1:8750/health

# Expected: {"status":"ok","servers":{"mobile":{"connected":true},...}}
```

### Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| "Failed to reconnect to mobile" | MetaMcp not running | Start MetaMcp (see above) |
| Port 8750 not listening | Gateway crashed or never started | Check MetaMcp logs, restart |
| mobile: connected: false | dist/index.js outdated or missing | Run `npm run build` in this project |

**Do NOT install `mobile-mcp-server` from npm** — that's a different package. This project's npm name is `claude-in-mobile`.

## Building

```bash
npm install --ignore-scripts   # OneDrive-safe
npm run build                  # TypeScript -> dist/
```
