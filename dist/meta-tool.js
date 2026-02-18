/**
 * Meta-tool pattern for Mobile MCP Server.
 * Exposes a single "mobile" tool instead of 40+ individual tools,
 * reducing token usage from ~15-20k to ~2-3k.
 */
/**
 * Maps meta-tool action names to internal tool names.
 * Includes 1:1 mappings and convenient aliases.
 */
const ACTION_MAP = {
    // ===== DEVICE MANAGEMENT =====
    'list_devices': 'list_devices',
    'devices': 'list_devices',
    'set_device': 'set_device',
    'set_target': 'set_target',
    'get_target': 'get_target',
    // ===== SCREEN & UI =====
    'screenshot': 'screenshot',
    'annotate': 'annotate_screenshot',
    'annotate_screenshot': 'annotate_screenshot',
    'get_ui': 'get_ui',
    'analyze_screen': 'analyze_screen',
    'get_webview': 'get_webview',
    // ===== INTERACTION =====
    'tap': 'tap',
    'click': 'tap',
    'long_press': 'long_press',
    'swipe': 'swipe',
    'scroll': 'swipe',
    'input_text': 'input_text',
    'type': 'input_text',
    'press_key': 'press_key',
    'find_element': 'find_element',
    'find_and_tap': 'find_and_tap',
    'tap_by_text': 'tap_by_text',
    // ===== APP MANAGEMENT =====
    'launch_app': 'launch_app',
    'stop_app': 'stop_app',
    'install_app': 'install_app',
    'list_apps': 'list_apps',
    'open_url': 'open_url',
    // ===== PERMISSIONS =====
    'grant_permission': 'grant_permission',
    'revoke_permission': 'revoke_permission',
    'reset_permissions': 'reset_permissions',
    // ===== DEBUGGING =====
    'get_logs': 'get_logs',
    'logs': 'get_logs',
    'clear_logs': 'clear_logs',
    'get_system_info': 'get_system_info',
    'info': 'get_system_info',
    'get_current_activity': 'get_current_activity',
    'shell': 'shell',
    // ===== RELIABILITY =====
    'wait': 'wait',
    'wait_for_element': 'wait_for_element',
    'assert_visible': 'assert_visible',
    'assert_not_exists': 'assert_not_exists',
    'batch_commands': 'batch_commands',
    // ===== WIFI ADB =====
    'connect_wifi': 'connect_wifi',
    'pair_wifi': 'pair_wifi',
    'disconnect_wifi': 'disconnect_wifi',
    // ===== DESKTOP =====
    'launch_desktop_app': 'launch_desktop_app',
    'stop_desktop_app': 'stop_desktop_app',
    'get_window_info': 'get_window_info',
    'focus_window': 'focus_window',
    'resize_window': 'resize_window',
    'get_clipboard': 'get_clipboard',
    'set_clipboard': 'set_clipboard',
    'get_performance_metrics': 'get_performance_metrics',
    'get_monitors': 'get_monitors',
    // ===== AURORA =====
    'push_file': 'push_file',
    'pull_file': 'pull_file',
};
/**
 * Returns the MCP tool definition for the single "mobile" meta-tool.
 * Telegraphic description to minimize token usage (~800 tokens vs ~1500).
 */
export function getMetaToolDefinition() {
    return {
        name: 'mobile',
        description: `Device automation. Use { action, ...params }.

DEVICE: list_devices(platform?), set_device(deviceId), set_target(target:android|ios|desktop|aurora), get_target
SCREEN: screenshot(compress?,maxWidth?,maxHeight?,quality?,force?), annotate, get_ui(showAll?), analyze_screen[android], get_webview[android]
TAP: tap(x?,y?|text?|resourceId?|index?), long_press(x?,y?|text?,duration?), find_and_tap(description,minConfidence?), find_element(text?,resourceId?,className?,clickable?)
GESTURE: swipe(direction:up|down|left|right|x1,y1,x2,y2,duration?), input_text(text), press_key(key:BACK|HOME|ENTER|TAB|DELETE|POWER|VOLUME_UP|VOLUME_DOWN|...)
APP: launch_app(package), stop_app(package), install_app(path), open_url(url), list_apps[aurora]
PERM: grant_permission(package,permission), revoke_permission(package,permission), reset_permissions(package)
DEBUG: get_logs(level?,tag?,lines?,package?), clear_logs[android], get_system_info, get_current_activity[android], shell(command)
WAIT: wait(ms?), wait_for_element(text?|resourceId?,timeout?,interval?), assert_visible(text?|resourceId?), assert_not_exists(text?|resourceId?)
BATCH: batch_commands(commands:[{name,arguments}],stopOnError?)
WIFI: connect_wifi(ip,port), pair_wifi(ip,port,code), disconnect_wifi(ip?,port?)
DESKTOP: launch_desktop_app(projectPath?), stop_desktop_app, get_window_info, focus_window(windowId), resize_window(width,height,windowId?), get_clipboard, set_clipboard(text), get_performance_metrics, get_monitors
FILES: push_file(local,remote), pull_file(remote,local)

Screenshot returns hash; use force=true to bypass cache if screen unchanged.
UI tree uses compact format: idx|Class|id:val|txt:val|flags|cx,cy`,
        inputSchema: {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    description: 'Action to perform',
                },
                platform: {
                    type: 'string',
                    enum: ['android', 'ios', 'desktop', 'aurora'],
                },
            },
            required: ['action'],
            additionalProperties: true,
        },
    };
}
/**
 * Route a meta-tool call to the appropriate internal tool handler.
 */
export async function executeMetaAction(args, handleToolFn) {
    const action = args.action;
    if (!action) {
        throw new Error('Missing required parameter: action');
    }
    const toolName = ACTION_MAP[action];
    if (!toolName) {
        const available = Object.keys(ACTION_MAP).sort().join(', ');
        throw new Error(`Unknown action: "${action}". Available actions: ${available}`);
    }
    // Forward all args (except action) to the handler
    const { action: _, ...forwardArgs } = args;
    return handleToolFn(toolName, forwardArgs);
}
/**
 * Get the list of available actions.
 */
export function getAvailableActions() {
    return Object.keys(ACTION_MAP);
}
//# sourceMappingURL=meta-tool.js.map