package com.anthropic.desktop

import java.awt.Robot
import java.awt.Toolkit
import java.awt.datatransfer.DataFlavor
import java.awt.datatransfer.StringSelection
import java.awt.event.InputEvent
import java.awt.event.KeyEvent
import java.io.File
import java.util.concurrent.TimeUnit
import kotlin.math.max

/**
 * Controls mouse and keyboard input using java.awt.Robot
 * Handles HiDPI coordinate conversion with multi-monitor support
 *
 * Supports two modes:
 * 1. Normal mode (Robot) - steals focus, works everywhere
 * 2. Background mode (CGEvent) - macOS only, sends events to specific PID without stealing focus
 */
class InputController {
    private val robot = Robot().apply {
        autoDelay = 10
        isAutoWaitForIdle = true
    }

    private val defaultScaleFactor: Double = detectDefaultScaleFactor()
    private val isMac = System.getProperty("os.name").lowercase().contains("mac")

    // Cached compiled CGEvent helper
    private var cgEventHelperPath: String? = null
    private val cgEventHelperLock = Any()

    // Cache for monitor info
    private data class MonitorBounds(
        val x: Int,
        val y: Int,
        val width: Int,
        val height: Int,
        val scaleFactor: Double
    )
    private var cachedMonitors: List<MonitorBounds>? = null
    private var monitorCacheTime: Long = 0
    private val MONITOR_CACHE_TTL_MS = 10000L // 10 seconds

    /**
     * Detect default HiDPI scale factor (from primary monitor)
     */
    private fun detectDefaultScaleFactor(): Double {
        return try {
            val ge = java.awt.GraphicsEnvironment.getLocalGraphicsEnvironment()
            val device = ge.defaultScreenDevice
            val config = device.defaultConfiguration
            config.defaultTransform.scaleX
        } catch (e: Exception) {
            1.0
        }
    }

    /**
     * Get all monitors with their bounds and scale factors
     */
    private fun getMonitors(): List<MonitorBounds> {
        val now = System.currentTimeMillis()
        cachedMonitors?.let { cached ->
            if (now - monitorCacheTime < MONITOR_CACHE_TTL_MS) {
                return cached
            }
        }

        val ge = java.awt.GraphicsEnvironment.getLocalGraphicsEnvironment()
        val monitors = ge.screenDevices.map { device ->
            val bounds = device.defaultConfiguration.bounds
            val scale = device.defaultConfiguration.defaultTransform.scaleX
            MonitorBounds(
                x = bounds.x,
                y = bounds.y,
                width = bounds.width,
                height = bounds.height,
                scaleFactor = scale
            )
        }

        cachedMonitors = monitors
        monitorCacheTime = now
        return monitors
    }

    /**
     * Find the scale factor for a specific coordinate
     * Returns the scale factor of the monitor containing the coordinate
     */
    private fun getScaleFactorForCoordinate(x: Int, y: Int): Double {
        val monitors = getMonitors()

        // Find the monitor containing this coordinate
        // Note: x,y here are logical coordinates
        for (monitor in monitors) {
            // For multi-monitor, coordinates are in the combined virtual screen space
            // Each monitor's bounds are in physical pixels
            val logicalX = (monitor.x / monitor.scaleFactor).toInt()
            val logicalY = (monitor.y / monitor.scaleFactor).toInt()
            val logicalWidth = (monitor.width / monitor.scaleFactor).toInt()
            val logicalHeight = (monitor.height / monitor.scaleFactor).toInt()

            if (x >= logicalX && x < logicalX + logicalWidth &&
                y >= logicalY && y < logicalY + logicalHeight) {
                return monitor.scaleFactor
            }
        }

        // Default to primary monitor's scale factor if coordinate not found
        return defaultScaleFactor
    }

    /**
     * Get the current scale factor (default/primary monitor)
     */
    fun getScaleFactor(): Double = defaultScaleFactor

    /**
     * Convert logical coordinates to physical, accounting for multi-monitor scale factors
     */
    private fun toPhysical(x: Int, y: Int): Pair<Int, Int> {
        val scaleFactor = getScaleFactorForCoordinate(x, y)
        return Pair(
            (x * scaleFactor).toInt(),
            (y * scaleFactor).toInt()
        )
    }

    /**
     * Convert logical coordinates to physical using a specific scale factor
     * Use this when you know the exact monitor
     */
    private fun toPhysicalWithScale(x: Int, y: Int, scale: Double): Pair<Int, Int> {
        return Pair(
            (x * scale).toInt(),
            (y * scale).toInt()
        )
    }

    /**
     * Tap at logical coordinates
     * On macOS, uses cliclick if available for better multi-monitor support
     */
    fun tap(x: Int, y: Int) {
        // Try cliclick first on macOS - it handles multi-monitor better
        if (isMac && tryCliClick(x, y)) {
            return
        }

        // Fallback to Robot
        val (px, py) = toPhysical(x, y)
        robot.mouseMove(px, py)
        robot.mousePress(InputEvent.BUTTON1_DOWN_MASK)
        robot.mouseRelease(InputEvent.BUTTON1_DOWN_MASK)
    }

    /**
     * Try to use cliclick for clicking (macOS only)
     * Returns true if successful, false if cliclick not available
     */
    private fun tryCliClick(x: Int, y: Int): Boolean {
        return try {
            val process = ProcessBuilder("cliclick", "c:$x,$y")
                .redirectErrorStream(true)
                .start()

            val success = process.waitFor(5, TimeUnit.SECONDS) && process.exitValue() == 0
            if (!success) {
                System.err.println("cliclick failed or not found, falling back to Robot")
            }
            success
        } catch (e: Exception) {
            // cliclick not installed
            false
        }
    }

    /**
     * Double tap at coordinates
     */
    fun doubleTap(x: Int, y: Int) {
        // Try cliclick for double-click on macOS
        if (isMac) {
            try {
                val process = ProcessBuilder("cliclick", "dc:$x,$y")
                    .redirectErrorStream(true)
                    .start()
                if (process.waitFor(5, TimeUnit.SECONDS) && process.exitValue() == 0) {
                    return
                }
            } catch (_: Exception) {}
        }

        // Fallback to two taps
        tap(x, y)
        Thread.sleep(50)
        tap(x, y)
    }

    /**
     * Long press at coordinates
     */
    fun longPress(x: Int, y: Int, durationMs: Int = 1000) {
        val (px, py) = toPhysical(x, y)
        robot.mouseMove(px, py)
        robot.mousePress(InputEvent.BUTTON1_DOWN_MASK)
        Thread.sleep(durationMs.toLong())
        robot.mouseRelease(InputEvent.BUTTON1_DOWN_MASK)
    }

    /**
     * Right click at coordinates
     */
    fun rightClick(x: Int, y: Int) {
        // Try cliclick for right-click on macOS
        if (isMac) {
            try {
                val process = ProcessBuilder("cliclick", "rc:$x,$y")
                    .redirectErrorStream(true)
                    .start()
                if (process.waitFor(5, TimeUnit.SECONDS) && process.exitValue() == 0) {
                    return
                }
            } catch (_: Exception) {}
        }

        // Fallback to Robot
        val (px, py) = toPhysical(x, y)
        robot.mouseMove(px, py)
        robot.mousePress(InputEvent.BUTTON3_DOWN_MASK)
        robot.mouseRelease(InputEvent.BUTTON3_DOWN_MASK)
    }

    /**
     * Swipe gesture from one point to another
     */
    fun swipe(x1: Int, y1: Int, x2: Int, y2: Int, durationMs: Int = 300) {
        val steps = max(10, durationMs / 16)
        val dx = (x2 - x1).toDouble() / steps
        val dy = (y2 - y1).toDouble() / steps
        val delay = durationMs.toLong() / steps

        val (px1, py1) = toPhysical(x1, y1)
        robot.mouseMove(px1, py1)
        robot.mousePress(InputEvent.BUTTON1_DOWN_MASK)

        for (i in 1..steps) {
            val (px, py) = toPhysical(
                (x1 + dx * i).toInt(),
                (y1 + dy * i).toInt()
            )
            robot.mouseMove(px, py)
            Thread.sleep(delay)
        }

        robot.mouseRelease(InputEvent.BUTTON1_DOWN_MASK)
    }

    /**
     * Swipe in a direction from screen center
     */
    fun swipeDirection(direction: String, distance: Int = 400) {
        val screenSize = Toolkit.getDefaultToolkit().screenSize
        val centerX = (screenSize.width / defaultScaleFactor / 2).toInt()
        val centerY = (screenSize.height / defaultScaleFactor / 2).toInt()

        val (x1, y1, x2, y2) = when (direction.lowercase()) {
            "up" -> listOf(centerX, centerY + distance / 2, centerX, centerY - distance / 2)
            "down" -> listOf(centerX, centerY - distance / 2, centerX, centerY + distance / 2)
            "left" -> listOf(centerX + distance / 2, centerY, centerX - distance / 2, centerY)
            "right" -> listOf(centerX - distance / 2, centerY, centerX + distance / 2, centerY)
            else -> throw IllegalArgumentException("Invalid direction: $direction")
        }

        swipe(x1, y1, x2, y2)
    }

    /**
     * Scroll wheel
     */
    fun scroll(amount: Int, x: Int? = null, y: Int? = null) {
        if (x != null && y != null) {
            val (px, py) = toPhysical(x, y)
            robot.mouseMove(px, py)
        }
        robot.mouseWheel(amount)
    }

    /**
     * Type text using clipboard (most reliable cross-platform method)
     */
    fun typeText(text: String) {
        val clipboard = Toolkit.getDefaultToolkit().systemClipboard

        // Save original clipboard content
        val original = try {
            clipboard.getData(DataFlavor.stringFlavor) as? String
        } catch (e: Exception) {
            null
        }

        // Set new content
        clipboard.setContents(StringSelection(text), null)

        // Paste using platform-specific shortcut
        val isMac = System.getProperty("os.name").lowercase().contains("mac")
        val modifier = if (isMac) KeyEvent.VK_META else KeyEvent.VK_CONTROL

        robot.keyPress(modifier)
        robot.keyPress(KeyEvent.VK_V)
        robot.keyRelease(KeyEvent.VK_V)
        robot.keyRelease(modifier)

        // Wait for paste to complete
        Thread.sleep(100)

        // Restore original clipboard
        if (original != null) {
            clipboard.setContents(StringSelection(original), null)
        }
    }

    /**
     * Type text character by character (slower but works with Compose Desktop)
     * This is more reliable than clipboard paste for Compose TextField
     */
    fun typeTextDirect(text: String) {
        // Disable auto-wait-for-idle temporarily (Compose has separate event loop)
        val wasAutoWait = robot.isAutoWaitForIdle
        robot.isAutoWaitForIdle = false

        for (char in text) {
            typeCharDirect(char)
            Thread.sleep(10) // Small delay between characters for reliability
        }

        robot.isAutoWaitForIdle = wasAutoWait
    }

    /**
     * Type a single character directly via Robot (no clipboard fallback)
     */
    private fun typeCharDirect(char: Char) {
        // Handle special characters that need shift
        val shiftChars = mapOf(
            '!' to KeyEvent.VK_1,
            '@' to KeyEvent.VK_2,
            '#' to KeyEvent.VK_3,
            '$' to KeyEvent.VK_4,
            '%' to KeyEvent.VK_5,
            '^' to KeyEvent.VK_6,
            '&' to KeyEvent.VK_7,
            '*' to KeyEvent.VK_8,
            '(' to KeyEvent.VK_9,
            ')' to KeyEvent.VK_0,
            '_' to KeyEvent.VK_MINUS,
            '+' to KeyEvent.VK_EQUALS,
            '{' to KeyEvent.VK_OPEN_BRACKET,
            '}' to KeyEvent.VK_CLOSE_BRACKET,
            '|' to KeyEvent.VK_BACK_SLASH,
            ':' to KeyEvent.VK_SEMICOLON,
            '"' to KeyEvent.VK_QUOTE,
            '<' to KeyEvent.VK_COMMA,
            '>' to KeyEvent.VK_PERIOD,
            '?' to KeyEvent.VK_SLASH,
            '~' to KeyEvent.VK_BACK_QUOTE
        )

        // Handle non-shift special characters
        val plainChars = mapOf(
            '-' to KeyEvent.VK_MINUS,
            '=' to KeyEvent.VK_EQUALS,
            '[' to KeyEvent.VK_OPEN_BRACKET,
            ']' to KeyEvent.VK_CLOSE_BRACKET,
            '\\' to KeyEvent.VK_BACK_SLASH,
            ';' to KeyEvent.VK_SEMICOLON,
            '\'' to KeyEvent.VK_QUOTE,
            ',' to KeyEvent.VK_COMMA,
            '.' to KeyEvent.VK_PERIOD,
            '/' to KeyEvent.VK_SLASH,
            '`' to KeyEvent.VK_BACK_QUOTE,
            ' ' to KeyEvent.VK_SPACE
        )

        when {
            char in shiftChars -> {
                robot.keyPress(KeyEvent.VK_SHIFT)
                robot.keyPress(shiftChars[char]!!)
                robot.keyRelease(shiftChars[char]!!)
                robot.keyRelease(KeyEvent.VK_SHIFT)
            }
            char in plainChars -> {
                robot.keyPress(plainChars[char]!!)
                robot.keyRelease(plainChars[char]!!)
            }
            char.isUpperCase() -> {
                robot.keyPress(KeyEvent.VK_SHIFT)
                val keyCode = KeyEvent.getExtendedKeyCodeForChar(char.lowercaseChar().code)
                if (keyCode != KeyEvent.VK_UNDEFINED) {
                    robot.keyPress(keyCode)
                    robot.keyRelease(keyCode)
                }
                robot.keyRelease(KeyEvent.VK_SHIFT)
            }
            char.isLetter() || char.isDigit() -> {
                val keyCode = KeyEvent.getExtendedKeyCodeForChar(char.code)
                if (keyCode != KeyEvent.VK_UNDEFINED) {
                    robot.keyPress(keyCode)
                    robot.keyRelease(keyCode)
                }
            }
            else -> {
                // For any other character, try getExtendedKeyCodeForChar
                val keyCode = KeyEvent.getExtendedKeyCodeForChar(char.code)
                if (keyCode != KeyEvent.VK_UNDEFINED) {
                    robot.keyPress(keyCode)
                    robot.keyRelease(keyCode)
                }
                // Skip if undefined (emoji, etc.)
            }
        }
    }

    /**
     * Type a single character (legacy - uses clipboard fallback)
     */
    private fun typeChar(char: Char) {
        val keyCode = KeyEvent.getExtendedKeyCodeForChar(char.code)
        if (keyCode == KeyEvent.VK_UNDEFINED) {
            // Use clipboard for special characters
            typeText(char.toString())
            return
        }

        val needsShift = char.isUpperCase() || char in "~!@#$%^&*()_+{}|:\"<>?"

        if (needsShift) {
            robot.keyPress(KeyEvent.VK_SHIFT)
        }
        robot.keyPress(keyCode)
        robot.keyRelease(keyCode)
        if (needsShift) {
            robot.keyRelease(KeyEvent.VK_SHIFT)
        }
    }

    /**
     * Press a key combination
     */
    fun keyEvent(key: String, modifiers: List<String>? = null) {
        val keyCode = mapKeyCode(key)

        // Press modifiers
        val modifierCodes = modifiers?.map { mapModifier(it) } ?: emptyList()
        modifierCodes.forEach { robot.keyPress(it) }

        // Press and release key
        robot.keyPress(keyCode)
        robot.keyRelease(keyCode)

        // Release modifiers in reverse order
        modifierCodes.reversed().forEach { robot.keyRelease(it) }
    }

    /**
     * Map key name to KeyEvent code
     */
    private fun mapKeyCode(key: String): Int {
        return when (key.uppercase()) {
            "ENTER", "RETURN" -> KeyEvent.VK_ENTER
            "TAB" -> KeyEvent.VK_TAB
            "SPACE" -> KeyEvent.VK_SPACE
            "BACKSPACE", "BACK_SPACE" -> KeyEvent.VK_BACK_SPACE
            "DELETE", "DEL" -> KeyEvent.VK_DELETE
            "ESCAPE", "ESC" -> KeyEvent.VK_ESCAPE
            "HOME" -> KeyEvent.VK_HOME
            "END" -> KeyEvent.VK_END
            "PAGE_UP", "PAGEUP" -> KeyEvent.VK_PAGE_UP
            "PAGE_DOWN", "PAGEDOWN" -> KeyEvent.VK_PAGE_DOWN
            "UP", "ARROW_UP" -> KeyEvent.VK_UP
            "DOWN", "ARROW_DOWN" -> KeyEvent.VK_DOWN
            "LEFT", "ARROW_LEFT" -> KeyEvent.VK_LEFT
            "RIGHT", "ARROW_RIGHT" -> KeyEvent.VK_RIGHT
            "F1" -> KeyEvent.VK_F1
            "F2" -> KeyEvent.VK_F2
            "F3" -> KeyEvent.VK_F3
            "F4" -> KeyEvent.VK_F4
            "F5" -> KeyEvent.VK_F5
            "F6" -> KeyEvent.VK_F6
            "F7" -> KeyEvent.VK_F7
            "F8" -> KeyEvent.VK_F8
            "F9" -> KeyEvent.VK_F9
            "F10" -> KeyEvent.VK_F10
            "F11" -> KeyEvent.VK_F11
            "F12" -> KeyEvent.VK_F12
            else -> {
                // Try to get key code for single character
                if (key.length == 1) {
                    KeyEvent.getExtendedKeyCodeForChar(key[0].uppercaseChar().code)
                } else {
                    throw IllegalArgumentException("Unknown key: $key")
                }
            }
        }
    }

    /**
     * Map modifier name to KeyEvent code
     */
    private fun mapModifier(modifier: String): Int {
        return when (modifier.lowercase()) {
            "ctrl", "control" -> KeyEvent.VK_CONTROL
            "shift" -> KeyEvent.VK_SHIFT
            "alt", "option" -> KeyEvent.VK_ALT
            "meta", "cmd", "command", "win", "windows" -> KeyEvent.VK_META
            else -> throw IllegalArgumentException("Unknown modifier: $modifier")
        }
    }

    // ============ CGEvent-based input (macOS, no focus stealing) ============

    /**
     * Get or compile the CGEvent helper
     */
    private fun getCGEventHelper(): String? {
        if (!isMac) return null

        synchronized(cgEventHelperLock) {
            cgEventHelperPath?.let { if (File(it).exists()) return it }

            try {
                // Write Swift source to temp file
                val swiftSource = javaClass.getResourceAsStream("/cgevent_helper.swift")
                    ?.bufferedReader()?.readText()
                    ?: return null

                val tempSwift = File.createTempFile("cgevent_helper", ".swift")
                val tempExe = File(tempSwift.parent, "cgevent_helper_exe")

                tempSwift.writeText(swiftSource)

                // Compile Swift
                val compileProcess = ProcessBuilder("swiftc", "-O", "-o", tempExe.absolutePath, tempSwift.absolutePath)
                    .redirectErrorStream(true)
                    .start()

                val compileOutput = compileProcess.inputStream.bufferedReader().readText()
                val compileOk = compileProcess.waitFor(30, TimeUnit.SECONDS) && compileProcess.exitValue() == 0

                tempSwift.delete()

                if (!compileOk) {
                    System.err.println("CGEvent helper compile failed: $compileOutput")
                    return null
                }

                cgEventHelperPath = tempExe.absolutePath
                return cgEventHelperPath
            } catch (e: Exception) {
                System.err.println("CGEvent helper setup failed: ${e.message}")
                return null
            }
        }
    }

    /**
     * Run CGEvent helper command
     */
    private fun runCGEventHelper(vararg args: String): Boolean {
        val helper = getCGEventHelper() ?: return false

        return try {
            val process = ProcessBuilder(helper, *args)
                .redirectErrorStream(true)
                .start()

            val output = process.inputStream.bufferedReader().readText()
            val success = process.waitFor(10, TimeUnit.SECONDS) && process.exitValue() == 0

            if (!success && output.isNotBlank()) {
                System.err.println("CGEvent helper error: $output")
            }

            success
        } catch (e: Exception) {
            System.err.println("CGEvent helper execution failed: ${e.message}")
            false
        }
    }

    /**
     * Type text to specific process (no focus stealing)
     * Falls back to Robot if CGEvent fails
     */
    fun typeTextToPid(text: String, pid: Int): Boolean {
        if (!isMac || pid <= 0) {
            typeTextDirect(text)
            return true
        }

        return runCGEventHelper("type", pid.toString(), text)
    }

    /**
     * Tap at coordinates for specific process (no focus stealing)
     * Falls back to Robot if CGEvent fails
     */
    fun tapToPid(x: Int, y: Int, pid: Int): Boolean {
        if (!isMac || pid <= 0) {
            tap(x, y)
            return true
        }

        // CGEvent uses screen coordinates, need to convert from logical
        val (px, py) = toPhysical(x, y)
        return runCGEventHelper("click", pid.toString(), px.toString(), py.toString())
    }

    /**
     * Send key event to specific process (no focus stealing)
     */
    fun keyEventToPid(key: String, pid: Int, modifiers: List<String>? = null): Boolean {
        if (!isMac || pid <= 0) {
            keyEvent(key, modifiers)
            return true
        }

        val keyCode = mapKeyCodeToCGKeyCode(key)
        val modsStr = modifiers?.joinToString(",") ?: ""

        return if (modsStr.isNotEmpty()) {
            runCGEventHelper("key", pid.toString(), keyCode.toString(), modsStr)
        } else {
            runCGEventHelper("key", pid.toString(), keyCode.toString())
        }
    }

    /**
     * Map key name to CGKeyCode (macOS virtual key codes)
     */
    private fun mapKeyCodeToCGKeyCode(key: String): Int {
        return when (key.uppercase()) {
            "ENTER", "RETURN" -> 36
            "TAB" -> 48
            "SPACE" -> 49
            "BACKSPACE", "BACK_SPACE" -> 51
            "DELETE", "DEL" -> 117
            "ESCAPE", "ESC" -> 53
            "HOME" -> 115
            "END" -> 119
            "PAGE_UP", "PAGEUP" -> 116
            "PAGE_DOWN", "PAGEDOWN" -> 121
            "UP", "ARROW_UP" -> 126
            "DOWN", "ARROW_DOWN" -> 125
            "LEFT", "ARROW_LEFT" -> 123
            "RIGHT", "ARROW_RIGHT" -> 124
            "F1" -> 122
            "F2" -> 120
            "F3" -> 99
            "F4" -> 118
            "F5" -> 96
            "F6" -> 97
            "F7" -> 98
            "F8" -> 100
            "F9" -> 101
            "F10" -> 109
            "F11" -> 103
            "F12" -> 111
            else -> {
                // For single characters, map to macOS key codes
                if (key.length == 1) {
                    charToCGKeyCode(key[0])
                } else {
                    throw IllegalArgumentException("Unknown key: $key")
                }
            }
        }
    }

    /**
     * Map character to macOS CGKeyCode
     */
    private fun charToCGKeyCode(char: Char): Int {
        return when (char.lowercaseChar()) {
            'a' -> 0; 'b' -> 11; 'c' -> 8; 'd' -> 2; 'e' -> 14; 'f' -> 3
            'g' -> 5; 'h' -> 4; 'i' -> 34; 'j' -> 38; 'k' -> 40; 'l' -> 37
            'm' -> 46; 'n' -> 45; 'o' -> 31; 'p' -> 35; 'q' -> 12; 'r' -> 15
            's' -> 1; 't' -> 17; 'u' -> 32; 'v' -> 9; 'w' -> 13; 'x' -> 7
            'y' -> 16; 'z' -> 6
            '1' -> 18; '2' -> 19; '3' -> 20; '4' -> 21; '5' -> 23
            '6' -> 22; '7' -> 26; '8' -> 28; '9' -> 25; '0' -> 29
            '-' -> 27; '=' -> 24; '[' -> 33; ']' -> 30; '\\' -> 42
            ';' -> 41; '\'' -> 39; ',' -> 43; '.' -> 47; '/' -> 44
            '`' -> 50; ' ' -> 49
            else -> 49 // Default to space
        }
    }
}
