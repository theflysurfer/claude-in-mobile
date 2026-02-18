/**
 * Meta-tool pattern for Mobile MCP Server.
 * - Single "mobile" tool with action dispatch
 * - "mobile_search" for action discovery (Dynamic Toolset pattern)
 * - Platform-aware descriptions (filters irrelevant sections)
 */

import type { handleTool as HandleToolFn } from './tool-handlers.js';
import { deviceManager } from './tool-handlers.js';

// ──────────────────────────────────────────────
// Action Map: meta-tool action → internal tool
// ──────────────────────────────────────────────

const ACTION_MAP: Record<string, string> = {
  // ===== DEVICE MANAGEMENT =====
  'list_devices':         'list_devices',
  'devices':              'list_devices',
  'set_device':           'set_device',
  'set_target':           'set_target',
  'get_target':           'get_target',

  // ===== SCREEN & UI =====
  'screenshot':           'screenshot',
  'annotate':             'annotate_screenshot',
  'annotate_screenshot':  'annotate_screenshot',
  'get_ui':               'get_ui',
  'analyze_screen':       'analyze_screen',
  'get_webview':          'get_webview',

  // ===== INTERACTION =====
  'tap':                  'tap',
  'click':                'tap',
  'long_press':           'long_press',
  'swipe':                'swipe',
  'scroll':               'swipe',
  'input_text':           'input_text',
  'type':                 'input_text',
  'press_key':            'press_key',
  'find_element':         'find_element',
  'find_and_tap':         'find_and_tap',
  'tap_by_text':          'tap_by_text',

  // ===== APP MANAGEMENT =====
  'launch_app':           'launch_app',
  'stop_app':             'stop_app',
  'install_app':          'install_app',
  'list_apps':            'list_apps',
  'open_url':             'open_url',

  // ===== PERMISSIONS =====
  'grant_permission':     'grant_permission',
  'revoke_permission':    'revoke_permission',
  'reset_permissions':    'reset_permissions',

  // ===== DEBUGGING =====
  'get_logs':             'get_logs',
  'logs':                 'get_logs',
  'clear_logs':           'clear_logs',
  'get_system_info':      'get_system_info',
  'info':                 'get_system_info',
  'get_current_activity': 'get_current_activity',
  'shell':                'shell',

  // ===== RELIABILITY =====
  'wait':                 'wait',
  'wait_for_element':     'wait_for_element',
  'assert_visible':       'assert_visible',
  'assert_not_exists':    'assert_not_exists',
  'batch_commands':       'batch_commands',

  // ===== WIFI ADB =====
  'connect_wifi':         'connect_wifi',
  'pair_wifi':            'pair_wifi',
  'disconnect_wifi':      'disconnect_wifi',
  'keep_awake':           'keep_awake',
  'stay_awake':           'keep_awake',

  // ===== DESKTOP =====
  'launch_desktop_app':       'launch_desktop_app',
  'stop_desktop_app':         'stop_desktop_app',
  'get_window_info':          'get_window_info',
  'focus_window':             'focus_window',
  'resize_window':            'resize_window',
  'get_clipboard':            'get_clipboard',
  'set_clipboard':            'set_clipboard',
  'get_performance_metrics':  'get_performance_metrics',
  'get_monitors':             'get_monitors',

  // ===== AURORA =====
  'push_file':            'push_file',
  'pull_file':            'pull_file',
};

// ──────────────────────────────────────────────
// Action metadata for search + describe
// ──────────────────────────────────────────────

interface ActionMeta {
  params: string;
  platforms?: string[];  // undefined = all platforms
  category: string;
  aliases?: string[];
}

/** Canonical action metadata (excludes aliases) */
const ACTION_META: Record<string, ActionMeta> = {
  // Device
  list_devices:   { params: 'platform?:android|ios|desktop|aurora', category: 'device' },
  set_device:     { params: 'deviceId:string', category: 'device' },
  set_target:     { params: 'target:android|ios|desktop|aurora', category: 'device' },
  get_target:     { params: '(none)', category: 'device' },
  // Screen
  screenshot:     { params: 'compress?:bool, maxWidth?:int, maxHeight?:int, quality?:1-100, force?:bool', category: 'screen' },
  annotate:       { params: '(none) → screenshot + colored bounding boxes + numbered labels', category: 'screen' },
  get_ui:         { params: 'showAll?:bool → compact tree idx|Cls|id:val|txt|flags|cx,cy', category: 'screen' },
  analyze_screen: { params: '(none) → structured buttons/inputs/text', category: 'screen', platforms: ['android'] },
  get_webview:    { params: '(none) → Chrome DevTools Protocol', category: 'screen', platforms: ['android'] },
  // Interaction
  tap:            { params: 'x?:int,y?:int | text?:string | resourceId?:string | index?:int', category: 'interaction', aliases: ['click'] },
  long_press:     { params: 'x?:int,y?:int | text?:string, duration?:ms(default 1000)', category: 'interaction' },
  swipe:          { params: 'direction:up|down|left|right | x1,y1,x2,y2, duration?:ms', category: 'interaction', aliases: ['scroll'] },
  input_text:     { params: 'text:string', category: 'interaction', aliases: ['type'] },
  press_key:      { params: 'key:BACK|HOME|ENTER|TAB|DELETE|POWER|VOLUME_UP|VOLUME_DOWN|...', category: 'interaction' },
  find_element:   { params: 'text?,resourceId?,className?,clickable?:bool,visible?:bool', category: 'interaction' },
  find_and_tap:   { params: 'description:string, minConfidence?:0-100', category: 'interaction' },
  // App
  launch_app:     { params: 'package:string (e.g. com.example.app)', category: 'app' },
  stop_app:       { params: 'package:string', category: 'app' },
  install_app:    { params: 'path:string (APK or .app file)', category: 'app' },
  open_url:       { params: 'url:string', category: 'app' },
  list_apps:      { params: '(none)', category: 'app', platforms: ['aurora'] },
  // Permissions
  grant_permission:  { params: 'package:string, permission:string (e.g. android.permission.CAMERA or camera/microphone)', category: 'permission' },
  revoke_permission: { params: 'package:string, permission:string', category: 'permission' },
  reset_permissions: { params: 'package:string', category: 'permission' },
  // Debug
  get_logs:             { params: 'level?:V|D|I|W|E|F, tag?:string, lines?:int, package?:string', category: 'debug' },
  clear_logs:           { params: '(none)', category: 'debug', platforms: ['android'] },
  get_system_info:      { params: '(none) → battery, memory', category: 'debug' },
  get_current_activity: { params: '(none) → foreground activity', category: 'debug', platforms: ['android'] },
  shell:                { params: 'command:string', category: 'debug' },
  // Reliability
  wait:              { params: 'ms?:int(default 1000)', category: 'reliability' },
  wait_for_element:  { params: 'text?|resourceId?|className?, timeout?:ms, interval?:ms', category: 'reliability' },
  assert_visible:    { params: 'text?|resourceId? → PASS/FAIL', category: 'reliability' },
  assert_not_exists: { params: 'text?|resourceId? → PASS/FAIL', category: 'reliability' },
  batch_commands:    { params: 'commands:[{name,arguments}], stopOnError?:bool', category: 'reliability' },
  // WiFi
  connect_wifi:    { params: 'ip:string, port:int', category: 'wifi', platforms: ['android'] },
  pair_wifi:       { params: 'ip:string, port:int, code:string(6-digit)', category: 'wifi', platforms: ['android'] },
  disconnect_wifi: { params: 'ip?:string, port?:int', category: 'wifi', platforms: ['android'] },
  keep_awake:      { params: 'enabled?:bool(default true), mode?:usb|wifi|all(auto-detect)', category: 'wifi', platforms: ['android'], aliases: ['stay_awake'] },
  // Desktop
  launch_desktop_app:      { params: 'projectPath?:string', category: 'desktop', platforms: ['desktop'] },
  stop_desktop_app:        { params: '(none)', category: 'desktop', platforms: ['desktop'] },
  get_window_info:         { params: '(none) → windows with IDs, titles, PIDs', category: 'desktop', platforms: ['desktop'] },
  focus_window:            { params: 'windowId:string', category: 'desktop', platforms: ['desktop'] },
  resize_window:           { params: 'width:int, height:int, windowId?:string', category: 'desktop', platforms: ['desktop'] },
  get_clipboard:           { params: '(none)', category: 'desktop', platforms: ['desktop'] },
  set_clipboard:           { params: 'text:string', category: 'desktop', platforms: ['desktop'] },
  get_performance_metrics: { params: '(none) → memory, CPU', category: 'desktop', platforms: ['desktop'] },
  get_monitors:            { params: '(none) → monitor list', category: 'desktop', platforms: ['desktop'] },
  // Aurora
  push_file: { params: 'local:string, remote:string', category: 'files', platforms: ['aurora'] },
  pull_file: { params: 'remote:string, local:string', category: 'files', platforms: ['aurora'] },
};

// ──────────────────────────────────────────────
// Dynamic platform-filtered description
// ──────────────────────────────────────────────

/** Description sections by category */
const SECTION_LINES: Record<string, string> = {
  device:      'DEVICE: list_devices(platform?), set_device(deviceId), set_target(target), get_target',
  screen:      'SCREEN: screenshot(compress?,maxW?,maxH?,quality?,force?), annotate, get_ui(showAll?), analyze_screen[android], get_webview[android]',
  interaction: 'TAP: tap(x?,y?|text?|resourceId?|index?), long_press, find_and_tap(description), find_element',
  gesture:     'GESTURE: swipe(direction|x1,y1,x2,y2), input_text(text), press_key(key)',
  app:         'APP: launch_app(package), stop_app(package), install_app(path), open_url(url)',
  permission:  'PERM: grant_permission(package,perm), revoke_permission, reset_permissions',
  debug:       'DEBUG: get_logs(level?,tag?,lines?,package?), clear_logs, get_system_info, shell(command)',
  reliability: 'WAIT: wait(ms?), wait_for_element(text?,timeout?), assert_visible, assert_not_exists, batch_commands',
  wifi:        'WIFI[android]: connect_wifi(ip,port), pair_wifi(ip,port,code), disconnect_wifi, keep_awake(enabled?,mode?)',
  desktop:     'DESKTOP: launch_desktop_app, get_window_info, focus_window, resize_window, get/set_clipboard',
  files:       'FILES[aurora]: push_file(local,remote), pull_file(remote,local)',
};

const PLATFORM_SECTIONS: Record<string, string[]> = {
  android: ['device', 'screen', 'interaction', 'gesture', 'app', 'permission', 'debug', 'reliability', 'wifi'],
  ios:     ['device', 'screen', 'interaction', 'gesture', 'app', 'permission', 'debug', 'reliability'],
  desktop: ['device', 'screen', 'interaction', 'gesture', 'debug', 'reliability', 'desktop'],
  aurora:  ['device', 'screen', 'interaction', 'gesture', 'app', 'debug', 'reliability', 'files'],
};

const ALL_SECTIONS = Object.keys(SECTION_LINES);

function buildDescription(platform?: string): string {
  const sections = platform && PLATFORM_SECTIONS[platform]
    ? PLATFORM_SECTIONS[platform]
    : ALL_SECTIONS;

  const lines = sections.map(s => SECTION_LINES[s]).filter(Boolean);
  return `Device automation. Use { action, ...params }. Use mobile_search(query) for details.\n\n${lines.join('\n')}\n\nScreenshot: WebP greyscale, hash-cached (force=true to bypass). UI tree: compact idx|Cls|id:val|txt|flags|cx,cy`;
}

// ──────────────────────────────────────────────
// Tool definitions
// ──────────────────────────────────────────────

/**
 * Main mobile tool - dynamically filtered by active platform.
 */
export function getMetaToolDefinition() {
  const platform = deviceManager.getCurrentPlatform();
  return {
    name: 'mobile',
    description: buildDescription(platform),
    inputSchema: {
      type: 'object' as const,
      properties: {
        action: { type: 'string', description: 'Action to perform' },
        platform: { type: 'string', enum: ['android', 'ios', 'desktop', 'aurora'] },
      },
      required: ['action'],
      additionalProperties: true,
    },
  };
}

/**
 * Search/describe tool - Dynamic Toolset pattern.
 * LLM queries this to get detailed params for specific actions.
 */
export function getSearchToolDefinition() {
  return {
    name: 'mobile_search',
    description: 'Search mobile actions by keyword or get detailed params for specific actions.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Search keyword (e.g. "screenshot", "tap", "wifi") or comma-separated action names for detailed schemas',
        },
      },
      required: ['query'],
    },
  };
}

/**
 * Execute search: find matching actions or describe specific ones.
 */
export function executeSearch(query: string): string {
  const q = query.toLowerCase().trim();
  const queryParts = q.split(',').map(s => s.trim()).filter(Boolean);

  // If query matches exact action names, return detailed schemas
  const exactMatches = queryParts.filter(p => ACTION_META[p]);
  if (exactMatches.length > 0) {
    return exactMatches.map(name => {
      const meta = ACTION_META[name];
      const platform = meta.platforms ? `[${meta.platforms.join('|')}]` : '';
      const aliases = meta.aliases ? ` (aliases: ${meta.aliases.join(', ')})` : '';
      return `${name}${platform}${aliases}: ${meta.params}`;
    }).join('\n');
  }

  // Otherwise, keyword search across action names, categories, and params
  const results: string[] = [];
  for (const [name, meta] of Object.entries(ACTION_META)) {
    const searchStr = `${name} ${meta.category} ${meta.params}`.toLowerCase();
    if (queryParts.some(p => searchStr.includes(p))) {
      const platform = meta.platforms ? `[${meta.platforms.join('|')}]` : '';
      results.push(`${name}${platform}: ${meta.params}`);
    }
  }

  if (results.length === 0) {
    return `No actions matching "${query}". Categories: device, screen, interaction, app, debug, reliability, wifi, desktop, files`;
  }

  return results.join('\n');
}

// ──────────────────────────────────────────────
// Action execution
// ──────────────────────────────────────────────

/**
 * Route a meta-tool call to the appropriate internal tool handler.
 */
export async function executeMetaAction(
  args: Record<string, unknown>,
  handleToolFn: typeof HandleToolFn,
): Promise<unknown> {
  const action = args.action as string;
  if (!action) {
    throw new Error('Missing required parameter: action');
  }

  const toolName = ACTION_MAP[action];
  if (!toolName) {
    const available = Object.keys(ACTION_MAP).sort().join(', ');
    throw new Error(`Unknown action: "${action}". Available actions: ${available}`);
  }

  const { action: _, ...forwardArgs } = args;
  return handleToolFn(toolName, forwardArgs);
}

/**
 * Get the list of available actions.
 */
export function getAvailableActions(): string[] {
  return Object.keys(ACTION_MAP);
}
