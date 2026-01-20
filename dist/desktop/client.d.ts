/**
 * Desktop Client - communicates with Kotlin companion app via JSON-RPC
 */
import { EventEmitter } from "events";
import type { LaunchOptions, ScreenshotOptions, ScreenshotResult, UiHierarchy, WindowInfo, LogEntry, LogOptions, PerformanceMetrics, DesktopState, PermissionStatus, MonitorInfo, TapByTextResult } from "./types.js";
export declare class DesktopClient extends EventEmitter {
    private process;
    private gradleLauncher;
    private requestId;
    private pendingRequests;
    private logs;
    private maxLogs;
    private state;
    private lastLaunchOptions;
    private readline;
    constructor();
    /**
     * Get current state
     */
    getState(): DesktopState;
    /**
     * Check if running
     */
    isRunning(): boolean;
    /**
     * Launch desktop automation (starts companion app, optionally launches user's app via Gradle)
     */
    launch(options: LaunchOptions): Promise<void>;
    /**
     * Wait for the companion app to be ready
     */
    private waitForReady;
    /**
     * Stop desktop app
     */
    stop(): Promise<void>;
    /**
     * Handle incoming line from stdout
     */
    private handleLine;
    /**
     * Handle JSON-RPC response
     */
    private handleResponse;
    /**
     * Handle process exit
     */
    private handleExit;
    /**
     * Handle crash with auto-restart
     */
    private handleCrash;
    /**
     * Send JSON-RPC request
     */
    private sendRequest;
    /**
     * Add log entry
     */
    private addLog;
    /**
     * Take screenshot
     */
    screenshotRaw(options?: ScreenshotOptions): Promise<Buffer>;
    /**
     * Take screenshot and return base64
     */
    screenshot(options?: ScreenshotOptions): Promise<string>;
    /**
     * Get screenshot with metadata
     */
    screenshotWithMeta(options?: ScreenshotOptions): Promise<ScreenshotResult>;
    /**
     * Tap at coordinates
     * @param targetPid - Optional PID to send click without stealing focus (macOS only)
     */
    tap(x: number, y: number, targetPid?: number): Promise<void>;
    /**
     * Tap an element by its text content using Accessibility API
     * This does NOT move the cursor - perfect for background automation (macOS only)
     * @param text - The text to search for (partial match, case-insensitive)
     * @param pid - The process ID of the target application
     * @param exactMatch - If true, requires exact text match
     */
    tapByText(text: string, pid: number, exactMatch?: boolean): Promise<TapByTextResult>;
    /**
     * Long press at coordinates
     */
    longPress(x: number, y: number, durationMs?: number): Promise<void>;
    /**
     * Swipe gesture
     */
    swipe(x1: number, y1: number, x2: number, y2: number, durationMs?: number): Promise<void>;
    /**
     * Swipe in direction
     */
    swipeDirection(direction: "up" | "down" | "left" | "right", distance?: number): Promise<void>;
    /**
     * Input text
     * @param targetPid - Optional PID to send input without stealing focus (macOS only)
     */
    inputText(text: string, targetPid?: number): Promise<void>;
    /**
     * Press key
     * @param targetPid - Optional PID to send key without stealing focus (macOS only)
     */
    pressKey(key: string, modifiers?: string[], targetPid?: number): Promise<void>;
    /**
     * Get the PID of the focused window (for background input)
     */
    getFocusedWindowPid(): Promise<number | null>;
    /**
     * Get UI hierarchy
     */
    getUiHierarchy(windowId?: string): Promise<UiHierarchy>;
    /**
     * Get UI hierarchy as XML string (for compatibility)
     */
    getUiHierarchyXml(): string;
    /**
     * Get window information
     */
    getWindowInfo(): Promise<WindowInfo>;
    /**
     * Focus a window
     */
    focusWindow(windowId: string): Promise<void>;
    /**
     * Resize a window
     */
    resizeWindow(width: number, height: number, windowId?: string): Promise<void>;
    /**
     * Get clipboard content
     */
    getClipboard(): Promise<string>;
    /**
     * Set clipboard content
     */
    setClipboard(text: string): Promise<void>;
    /**
     * Check accessibility permissions
     */
    checkPermissions(): Promise<PermissionStatus>;
    /**
     * Get logs
     */
    getLogs(options?: LogOptions): LogEntry[];
    /**
     * Clear logs
     */
    clearLogs(): void;
    /**
     * Get performance metrics
     */
    getPerformanceMetrics(): Promise<PerformanceMetrics>;
    /**
     * Get screen size
     */
    getScreenSize(): Promise<{
        width: number;
        height: number;
    }>;
    /**
     * Get list of connected monitors (multi-monitor support)
     */
    getMonitors(): Promise<MonitorInfo[]>;
    /**
     * Launch app (for compatibility with mobile interface)
     */
    launchApp(packageName: string): string;
    /**
     * Stop app (for compatibility)
     */
    stopApp(packageName: string): void;
    /**
     * Shell command (not supported)
     */
    shell(command: string): string;
}
export declare const desktopClient: DesktopClient;
//# sourceMappingURL=client.d.ts.map