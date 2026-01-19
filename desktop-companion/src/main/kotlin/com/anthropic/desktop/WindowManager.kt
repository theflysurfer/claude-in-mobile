package com.anthropic.desktop

import com.sun.jna.Native
import com.sun.jna.Pointer
import com.sun.jna.platform.mac.CoreFoundation.*
import com.sun.jna.platform.win32.User32
import com.sun.jna.platform.win32.WinDef
import com.sun.jna.platform.win32.WinUser
import java.awt.Rectangle
import java.util.concurrent.TimeUnit

/**
 * Cross-platform window management
 */
class WindowManager {
    private val isMac = System.getProperty("os.name").lowercase().contains("mac")
    private val isWindows = System.getProperty("os.name").lowercase().contains("windows")

    // Cache window list to avoid expensive AppleScript calls
    // AppleScript can take 10-20 seconds on macOS with many processes
    @Volatile
    private var cachedWindows: List<WindowInfo>? = null
    @Volatile
    private var cacheTimestamp: Long = 0
    private val CACHE_TTL_MS = 1000L // 1 second cache

    companion object {
        private const val APPLESCRIPT_TIMEOUT_SECONDS = 10L
    }

    /**
     * Get list of all visible windows (with caching)
     */
    fun getWindows(): List<WindowInfo> {
        val now = System.currentTimeMillis()
        val cached = cachedWindows
        if (cached != null && (now - cacheTimestamp) < CACHE_TTL_MS) {
            return cached
        }

        val windows = when {
            isMac -> getMacWindows()
            isWindows -> getWindowsWindows()
            else -> getLinuxWindows()
        }

        cachedWindows = windows
        cacheTimestamp = now
        return windows
    }

    /**
     * Invalidate cache (call after window changes)
     */
    fun invalidateCache() {
        cachedWindows = null
        cacheTimestamp = 0
    }

    /**
     * Get window info result with active window
     */
    fun getWindowListResult(): WindowListResult {
        val windows = getWindows()
        val activeId = windows.find { it.focused }?.id
        return WindowListResult(windows, activeId)
    }

    /**
     * Get bounds of a specific window
     */
    fun getWindowBounds(windowId: String): Rectangle {
        val windows = getWindows()
        val window = windows.find { it.id == windowId }
            ?: throw IllegalArgumentException("Window not found: $windowId")

        return Rectangle(
            window.bounds.x,
            window.bounds.y,
            window.bounds.width,
            window.bounds.height
        )
    }

    /**
     * Focus a window
     */
    fun focusWindow(windowId: String) {
        when {
            isMac -> focusMacWindow(windowId)
            isWindows -> focusWindowsWindow(windowId)
            else -> focusLinuxWindow(windowId)
        }
    }

    /**
     * Resize a window
     */
    fun resizeWindow(windowId: String?, width: Int, height: Int) {
        when {
            isMac -> resizeMacWindow(windowId, width, height)
            isWindows -> resizeWindowsWindow(windowId, width, height)
            else -> resizeLinuxWindow(windowId, width, height)
        }
    }

    // ============ macOS Implementation ============

    private fun getMacWindows(): List<WindowInfo> {
        val windows = mutableListOf<WindowInfo>()

        // Use CGWindowList API via Swift for reliable Java/Compose window detection
        // AppleScript/Accessibility API often can't see Java windows, but CoreGraphics can
        try {
            val swiftCode = """
                import Cocoa
                let options: CGWindowListOption = [.optionOnScreenOnly, .excludeDesktopElements]
                guard let windowList = CGWindowListCopyWindowInfo(options, kCGNullWindowID) as? [[String: Any]] else { exit(1) }
                let keywords = ["java", "swarmhost", "compose", "kotlin", "jetbrains", "intellij", "android studio"]
                for window in windowList {
                    let ownerName = window["kCGWindowOwnerName"] as? String ?? ""
                    let windowName = window["kCGWindowName"] as? String ?? ""
                    let bounds = window["kCGWindowBounds"] as? [String: CGFloat] ?? [:]
                    let layer = window["kCGWindowLayer"] as? Int ?? 0
                    let ownerPID = window["kCGWindowOwnerPID"] as? Int ?? 0
                    guard layer == 0 else { continue }
                    let ownerLower = ownerName.lowercased()
                    let isJavaApp = keywords.contains { ownerLower.contains(${'$'}0) }
                    if isJavaApp && !windowName.isEmpty {
                        let x = Int(bounds["X"] ?? 0)
                        let y = Int(bounds["Y"] ?? 0)
                        let w = Int(bounds["Width"] ?? 0)
                        let h = Int(bounds["Height"] ?? 0)
                        guard w > 50 && h > 50 else { continue }
                        print("\(ownerName)|\(windowName)|\(x)|\(y)|\(w)|\(h)|\(ownerPID)")
                    }
                }
            """.trimIndent()

            // Write Swift code to temp file and compile/run
            val tempSwift = java.io.File.createTempFile("windowlist", ".swift")
            val tempExe = java.io.File(tempSwift.parent, "windowlist_exe")
            try {
                tempSwift.writeText(swiftCode)

                // Compile Swift code
                val compileProcess = ProcessBuilder("swiftc", "-O", "-o", tempExe.absolutePath, tempSwift.absolutePath)
                    .redirectErrorStream(true)
                    .start()
                val compileCompleted = compileProcess.waitFor(APPLESCRIPT_TIMEOUT_SECONDS, TimeUnit.SECONDS)

                if (!compileCompleted || compileProcess.exitValue() != 0) {
                    val error = compileProcess.inputStream.bufferedReader().readText()
                    System.err.println("Swift compile failed: $error")
                } else {
                    // Run the compiled executable
                    val runProcess = ProcessBuilder(tempExe.absolutePath)
                        .redirectErrorStream(false)
                        .start()

                    val stdoutFuture = java.util.concurrent.CompletableFuture.supplyAsync {
                        runProcess.inputStream.bufferedReader().readText()
                    }

                    val runCompleted = runProcess.waitFor(5, TimeUnit.SECONDS)
                    if (runCompleted) {
                        val output = stdoutFuture.get(2, TimeUnit.SECONDS)
                        parseCGWindowListOutput(output, windows)
                    } else {
                        runProcess.destroyForcibly()
                        System.err.println("Swift window list timeout")
                    }
                }
            } finally {
                tempSwift.delete()
                tempExe.delete()
            }
        } catch (e: Exception) {
            System.err.println("Error getting macOS windows via CGWindowList: ${e.message}")
        }

        // Get actual focused window (with timeout)
        try {
            val focusScript = """
                tell application "System Events"
                    set frontApp to first application process whose frontmost is true
                    return name of frontApp
                end tell
            """.trimIndent()

            val focusProcess = ProcessBuilder("osascript", "-e", focusScript)
                .redirectErrorStream(false)
                .start()

            // Read streams in separate threads
            val focusStdoutFuture = java.util.concurrent.CompletableFuture.supplyAsync {
                focusProcess.inputStream.bufferedReader().readText()
            }
            val focusStderrFuture = java.util.concurrent.CompletableFuture.supplyAsync {
                focusProcess.errorStream.bufferedReader().readText()
            }

            val focusCompleted = focusProcess.waitFor(5, TimeUnit.SECONDS)

            if (!focusCompleted) {
                focusProcess.destroyForcibly()
                System.err.println("AppleScript focus check timeout")
            } else {
                val focusedApp = focusStdoutFuture.get(2, TimeUnit.SECONDS).trim()
                val focusStderr = focusStderrFuture.get(2, TimeUnit.SECONDS)
                val focusExitCode = focusProcess.exitValue()

                if (focusExitCode != 0) {
                    System.err.println("AppleScript focus check failed: $focusStderr")
                }

                // Mark the focused app's first window as focused
                val focusedIndex = windows.indexOfFirst { it.ownerName == focusedApp }
                if (focusedIndex >= 0) {
                    windows[focusedIndex] = windows[focusedIndex].copy(focused = true)
                } else if (windows.isNotEmpty()) {
                    windows[0] = windows[0].copy(focused = true)
                }
            }
        } catch (e: Exception) {
            System.err.println("Error getting focused window: ${e.message}")
        }

        // If no window marked as focused, mark first one
        if (windows.isNotEmpty() && windows.none { it.focused }) {
            windows[0] = windows[0].copy(focused = true)
        }

        return windows
    }

    /**
     * Parse CGWindowList output format: owner|title|x|y|width|height|pid
     */
    private fun parseCGWindowListOutput(output: String, windows: MutableList<WindowInfo>) {
        var index = windows.size
        val seen = mutableSetOf<String>()

        output.lines().filter { it.isNotBlank() }.forEach { line ->
            try {
                val parts = line.split("|")
                if (parts.size >= 6) {
                    val ownerName = parts[0]
                    val windowName = parts[1]
                    val x = parts[2].toInt()
                    val y = parts[3].toInt()
                    val w = parts[4].toInt()
                    val h = parts[5].toInt()
                    val pid = parts.getOrNull(6)?.toIntOrNull() ?: 0

                    val key = "${windowName}_${x}_${y}"
                    if (key !in seen) {
                        seen.add(key)
                        windows.add(
                            WindowInfo(
                                id = "mac_${index++}",
                                title = windowName.ifEmpty { ownerName },
                                bounds = Bounds(x, y, w, h),
                                focused = false,
                                ownerName = ownerName,
                                processId = if (pid > 0) pid else null
                            )
                        )
                    }
                }
            } catch (e: Exception) {
                System.err.println("Failed to parse CGWindowList line: $line - ${e.message}")
            }
        }
    }

    private fun parseAppleScriptWindowList(output: String, windows: MutableList<WindowInfo>, prefix: String = "mac") {
        // Parse AppleScript list output - handles multiple formats:
        // 1. Braced items: "{{java, Win1, 75, 84, 100, 100}, {java, Win2, 200, 100, 200, 200}}"
        // 2. Flat list: "java, LangChain Kotlin Agent, 75, 84, 2857, 1522, java, Win2, 100, 100, 200, 200"
        // 3. Single item: "java, LangChain Kotlin Agent, 75, 84, 2857, 1522"
        var index = windows.size
        val seen = mutableSetOf<String>() // Track seen windows to avoid duplicates

        // First try braced pattern
        val bracedPattern = Regex("""\{([^{},]+),\s*([^{},]*),\s*(-?\d+),\s*(-?\d+),\s*(\d+),\s*(\d+)\}""")
        val bracedMatches = bracedPattern.findAll(output).toList()

        if (bracedMatches.isNotEmpty()) {
            bracedMatches.forEach { match ->
                val (procName, winName, x, y, w, h) = match.destructured
                val key = "${winName}_${x}_${y}"
                if (key !in seen) {
                    seen.add(key)
                    windows.add(
                        WindowInfo(
                            id = "${prefix}_${index++}",
                            title = winName.trim().ifEmpty { procName.trim() },
                            bounds = Bounds(x.toInt(), y.toInt(), w.toInt(), h.toInt()),
                            focused = false,
                            ownerName = procName.trim()
                        )
                    )
                }
            }
            return
        }

        // Flat list: split by comma and group into chunks of 6
        // Format: procName, winName, x, y, w, h, procName2, winName2, x2, y2, w2, h2, ...
        val parts = output.trim().split(",").map { it.trim() }

        if (parts.size >= 6 && parts.size % 6 == 0) {
            for (i in parts.indices step 6) {
                try {
                    val procName = parts[i]
                    val winName = parts[i + 1]
                    val x = parts[i + 2].toInt()
                    val y = parts[i + 3].toInt()
                    val w = parts[i + 4].toInt()
                    val h = parts[i + 5].toInt()

                    val key = "${winName}_${x}_${y}"
                    if (key !in seen) {
                        seen.add(key)
                        windows.add(
                            WindowInfo(
                                id = "${prefix}_${index++}",
                                title = winName.ifEmpty { procName },
                                bounds = Bounds(x, y, w, h),
                                focused = false,
                                ownerName = procName
                            )
                        )
                    }
                } catch (e: Exception) {
                    System.err.println("Failed to parse window chunk at index $i: ${e.message}")
                }
            }
            return
        }

        // Fallback: try single pattern
        val singlePattern = Regex("""^([^,]+),\s*([^,]*),\s*(-?\d+),\s*(-?\d+),\s*(\d+),\s*(\d+)$""")
        val singleMatch = singlePattern.find(output.trim())

        if (singleMatch != null) {
            val (procName, winName, x, y, w, h) = singleMatch.destructured
            windows.add(
                WindowInfo(
                    id = "${prefix}_${index++}",
                    title = winName.trim().ifEmpty { procName.trim() },
                    bounds = Bounds(x.toInt(), y.toInt(), w.toInt(), h.toInt()),
                    focused = false,
                    ownerName = procName.trim()
                )
            )
        } else if (output.isNotBlank()) {
            System.err.println("Failed to parse AppleScript output (parts=${parts.size}): $output")
        }
    }

    private fun focusMacWindow(windowId: String) {
        val windows = getMacWindows()
        val window = windows.find { it.id == windowId } ?: return

        // Strategy 1: Try direct application activation (works for native apps)
        var success = false
        try {
            val script1 = """
                tell application "${window.ownerName}"
                    activate
                end tell
            """.trimIndent()

            val proc1 = ProcessBuilder("osascript", "-e", script1).start()
            val exitCode = proc1.waitFor()
            success = exitCode == 0

            // Verify it actually worked
            if (success) {
                Thread.sleep(100) // Give time to switch
                val verifyScript = """
                    tell application "System Events"
                        set frontApp to first application process whose frontmost is true
                        return name of frontApp
                    end tell
                """.trimIndent()
                val verifyProc = ProcessBuilder("osascript", "-e", verifyScript).start()
                val frontApp = verifyProc.inputStream.bufferedReader().readText().trim()
                verifyProc.waitFor()
                success = frontApp == window.ownerName
            }
        } catch (e: Exception) {
            success = false
        }

        // Strategy 2: Use System Events for Java/background processes
        if (!success) {
            try {
                val script2 = """
                    tell application "System Events"
                        set frontmost of process "${window.ownerName}" to true
                    end tell
                """.trimIndent()
                ProcessBuilder("osascript", "-e", script2).start().waitFor()
            } catch (e: Exception) {
                System.err.println("Error focusing window via System Events: ${e.message}")
            }
        }

        // Strategy 3: Click on the window to bring it to front (last resort)
        if (!success) {
            try {
                val script3 = """
                    tell application "System Events"
                        tell process "${window.ownerName}"
                            try
                                perform action "AXRaise" of window 1
                            end try
                            set frontmost to true
                        end tell
                    end tell
                """.trimIndent()
                ProcessBuilder("osascript", "-e", script3).start().waitFor()
            } catch (e: Exception) {
                System.err.println("Error raising window: ${e.message}")
            }
        }
    }

    private fun resizeMacWindow(windowId: String?, width: Int, height: Int) {
        val script = """
            tell application "System Events"
                set frontApp to first application process whose frontmost is true
                tell frontApp
                    set size of window 1 to {$width, $height}
                end tell
            end tell
        """.trimIndent()

        ProcessBuilder("osascript", "-e", script).start().waitFor()
    }

    // ============ Windows Implementation ============

    private fun getWindowsWindows(): List<WindowInfo> {
        val windows = mutableListOf<WindowInfo>()

        try {
            val user32 = User32.INSTANCE
            val foreground = user32.GetForegroundWindow()

            user32.EnumWindows({ hwnd, _ ->
                if (user32.IsWindowVisible(hwnd)) {
                    val title = CharArray(512)
                    user32.GetWindowText(hwnd, title, 512)
                    val titleStr = String(title).trim('\u0000')

                    if (titleStr.isNotEmpty()) {
                        val rect = WinDef.RECT()
                        user32.GetWindowRect(hwnd, rect)

                        windows.add(
                            WindowInfo(
                                id = "win_${hwnd.pointer}",
                                title = titleStr,
                                bounds = Bounds(
                                    rect.left,
                                    rect.top,
                                    rect.right - rect.left,
                                    rect.bottom - rect.top
                                ),
                                focused = hwnd == foreground
                            )
                        )
                    }
                }
                true
            }, null)
        } catch (e: Exception) {
            System.err.println("Error getting Windows windows: ${e.message}")
        }

        return windows
    }

    private fun focusWindowsWindow(windowId: String) {
        try {
            val user32 = User32.INSTANCE
            // Extract pointer from window ID
            val ptrStr = windowId.removePrefix("win_")
            val ptr = Pointer(ptrStr.toLong())
            val hwnd = WinDef.HWND(ptr)

            user32.SetForegroundWindow(hwnd)
            user32.BringWindowToTop(hwnd)
        } catch (e: Exception) {
            System.err.println("Error focusing window: ${e.message}")
        }
    }

    private fun resizeWindowsWindow(windowId: String?, width: Int, height: Int) {
        try {
            val user32 = User32.INSTANCE
            val hwnd = if (windowId != null) {
                val ptrStr = windowId.removePrefix("win_")
                WinDef.HWND(Pointer(ptrStr.toLong()))
            } else {
                user32.GetForegroundWindow()
            }

            val rect = WinDef.RECT()
            user32.GetWindowRect(hwnd, rect)

            user32.MoveWindow(hwnd, rect.left, rect.top, width, height, true)
        } catch (e: Exception) {
            System.err.println("Error resizing window: ${e.message}")
        }
    }

    // ============ Linux Implementation ============

    private fun getLinuxWindows(): List<WindowInfo> {
        val windows = mutableListOf<WindowInfo>()

        try {
            // Use wmctrl to list windows
            val process = ProcessBuilder("wmctrl", "-l", "-G").start()
            val output = process.inputStream.bufferedReader().readText()
            process.waitFor()

            // Parse wmctrl output
            // Format: 0x12345678  0 x y w h hostname title
            val pattern = Regex("""(0x[0-9a-f]+)\s+\d+\s+(-?\d+)\s+(-?\d+)\s+(\d+)\s+(\d+)\s+\S+\s+(.*)""")

            pattern.findAll(output).forEach { match ->
                val (id, x, y, w, h, title) = match.destructured
                windows.add(
                    WindowInfo(
                        id = id,
                        title = title.trim(),
                        bounds = Bounds(x.toInt(), y.toInt(), w.toInt(), h.toInt()),
                        focused = false
                    )
                )
            }

            // Get active window
            val activeProcess = ProcessBuilder("xdotool", "getactivewindow").start()
            val activeId = activeProcess.inputStream.bufferedReader().readText().trim()
            activeProcess.waitFor()

            // Mark active window
            windows.replaceAll { win ->
                if (win.id.contains(activeId)) win.copy(focused = true) else win
            }
        } catch (e: Exception) {
            System.err.println("Error getting Linux windows: ${e.message}")
        }

        return windows
    }

    private fun focusLinuxWindow(windowId: String) {
        try {
            ProcessBuilder("wmctrl", "-i", "-a", windowId).start().waitFor()
        } catch (e: Exception) {
            System.err.println("Error focusing window: ${e.message}")
        }
    }

    private fun resizeLinuxWindow(windowId: String?, width: Int, height: Int) {
        try {
            val id = windowId ?: run {
                val process = ProcessBuilder("xdotool", "getactivewindow").start()
                val output = process.inputStream.bufferedReader().readText().trim()
                process.waitFor()
                output
            }

            ProcessBuilder("wmctrl", "-i", "-r", id, "-e", "0,-1,-1,$width,$height").start().waitFor()
        } catch (e: Exception) {
            System.err.println("Error resizing window: ${e.message}")
        }
    }
}
