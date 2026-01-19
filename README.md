# Claude Mobile

MCP server for mobile and desktop automation — Android (via ADB), iOS Simulator (via simctl), and Desktop (Compose Multiplatform). Like [Claude in Chrome](https://www.anthropic.com/news/claude-for-chrome) but for mobile devices and desktop apps.

Control your Android phone, emulator, iOS Simulator, or Desktop applications with natural language through Claude.

## Features

- **Unified API** — Same commands work for Android, iOS, and Desktop
- **Smart screenshots** — Auto-compressed for optimal LLM processing (no more oversized images!)
- **Device logs** — Read logcat/system logs with filters for debugging
- **UI interactions** — Tap, long press, swipe by coordinates or element text
- **Text input** — Type into focused fields
- **App control** — Launch, stop, and install apps
- **Platform selection** — Explicitly target Android, iOS, or Desktop
- **Desktop support** — Test Compose Multiplatform desktop apps with window management, clipboard, and performance metrics

## Installation

### Claude Code CLI (recommended)

```bash
claude mcp add --transport stdio mobile -- npx -y claude-in-mobile
```

To add globally (available in all projects):

```bash
claude mcp add --scope user --transport stdio mobile -- npx -y claude-in-android
```

### From npm

```bash
npx claude-in-mobile
```

### From source

```bash
git clone https://github.com/AlexGladkov/claude-in-mobile.git
cd claude-in-mobile
npm install
npm run build:all  # Builds TypeScript + Desktop companion
```

> **Note:** For Desktop support, you need to run `npm run build:desktop` (or `build:all`) to compile the Desktop companion app.

### Manual configuration

Add to your Claude Code settings (`~/.claude.json` or project settings):

```json
{
  "mcpServers": {
    "mobile": {
      "command": "npx",
      "args": ["-y", "claude-in-mobile"]
    }
  }
}
```

### Windows

```bash
claude mcp add --transport stdio mobile -- cmd /c npx -y claude-in-android
```

## Requirements

### Android
- ADB installed and in PATH
- Connected Android device (USB debugging enabled) or emulator

### iOS
- macOS with Xcode installed
- iOS Simulator (no physical device support yet)

### Desktop
- macOS (Windows/Linux support planned)
- JDK 17+ for building the Desktop companion
- Compose Multiplatform desktop application to test

## Available Tools

### Core Tools (All Platforms)

| Tool | Android | iOS | Desktop | Description |
|------|---------|-----|---------|-------------|
| `list_devices` | ✅ | ✅ | ✅ | List all connected devices |
| `set_device` | ✅ | ✅ | ✅ | Select active device |
| `screenshot` | ✅ | ✅ | ✅ | Take screenshot |
| `tap` | ✅ | ✅ | ✅ | Tap at coordinates or by text |
| `long_press` | ✅ | ✅ | ✅ | Long press gesture |
| `swipe` | ✅ | ✅ | ✅ | Swipe in direction or coordinates |
| `input_text` | ✅ | ✅ | ✅ | Type text |
| `press_key` | ✅ | ✅ | ✅ | Press hardware buttons |
| `launch_app` | ✅ | ✅ | ❌ | Launch app (use `launch_desktop_app` for Desktop) |
| `stop_app` | ✅ | ✅ | ❌ | Stop app (use `stop_desktop_app` for Desktop) |
| `install_app` | ✅ | ✅ | ❌ | Install APK/.app |
| `get_ui` | ✅ | ⚠️ | ✅ | Get UI hierarchy (limited on iOS) |
| `find_element` | ✅ | ❌ | ✅ | Find elements by text/id |
| `get_current_activity` | ✅ | ❌ | ❌ | Get foreground activity |
| `open_url` | ✅ | ✅ | ❌ | Open URL in browser |
| `shell` | ✅ | ✅ | ❌ | Run shell command |
| `wait` | ✅ | ✅ | ✅ | Wait for duration |
| `get_logs` | ✅ | ✅ | ❌ | Get device logs (logcat/system log) |
| `clear_logs` | ✅ | ⚠️ | ❌ | Clear log buffer |
| `get_system_info` | ✅ | ❌ | ❌ | Battery, memory info |

### Desktop-Specific Tools

| Tool | Description |
|------|-------------|
| `set_target` | Set target platform (android/ios/desktop) |
| `get_target` | Get current target platform |
| `launch_desktop_app` | Launch a Compose Desktop application |
| `stop_desktop_app` | Stop the running desktop application |
| `get_window_info` | Get desktop window position and size |
| `focus_window` | Bring desktop window to front |
| `resize_window` | Resize desktop window |
| `get_clipboard` | Get system clipboard content |
| `set_clipboard` | Set system clipboard content |
| `get_performance_metrics` | Get CPU/memory usage of desktop app |

> For detailed Desktop API documentation, see [Desktop Specification](docs/SPEC_DESKTOP.md)

## Usage Examples

Just talk to Claude naturally:

```
"Show me all connected devices"
"Take a screenshot of the Android emulator"
"Take a screenshot on iOS"
"Tap on Settings"
"Swipe down to scroll"
"Type 'hello world' in the search field"
"Press the back button on Android"
"Open Safari on iOS"
"Switch to iOS simulator"
"Run the app on both platforms"
```

### Platform Selection

You can explicitly specify the platform:

```
"Screenshot on android"     → Uses Android device
"Screenshot on ios"         → Uses iOS simulator
"Screenshot on desktop"     → Uses Desktop app
"Screenshot"                → Uses last active device
```

Or set the active device:

```
"Use the iPhone 15 simulator"
"Switch to the Android emulator"
"Switch to desktop"
```

### Desktop Examples

```
"Launch my desktop app from /path/to/app"
"Take a screenshot of the desktop app"
"Get window info"
"Resize window to 1280x720"
"Tap at coordinates 100, 200"
"Get clipboard content"
"Set clipboard to 'test text'"
"Get performance metrics"
"Stop the desktop app"
```

## How It Works

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Claude    │────▶│  Claude Mobile   │────▶│  Android (ADB)  │
│             │     │   MCP Server     │     └─────────────────┘
│             │     │                  │     ┌─────────────────┐
│             │     │                  │────▶│  iOS (simctl)   │
│             │     │                  │     └─────────────────┘
│             │     │                  │     ┌─────────────────┐
│             │     │                  │────▶│ Desktop (Compose)│
└─────────────┘     └──────────────────┘     └─────────────────┘
```

1. Claude sends commands through MCP protocol
2. Server routes to appropriate platform (ADB, simctl, or Desktop companion)
3. Commands execute on your device or desktop app
4. Results (screenshots, UI data, metrics) return to Claude

## License

MIT
