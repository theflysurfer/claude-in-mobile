import Cocoa

// CGWindowList-based window detection
// Much more reliable than AppleScript for Java/Compose apps

let options: CGWindowListOption = [.optionOnScreenOnly, .excludeDesktopElements]
guard let windowList = CGWindowListCopyWindowInfo(options, kCGNullWindowID) as? [[String: Any]] else {
    exit(1)
}

// Keywords that identify Java/Compose applications
let javaKeywords = ["java", "swarmhost", "compose", "kotlin", "jetbrains", "intellij", "android studio"]

for window in windowList {
    let ownerName = window["kCGWindowOwnerName"] as? String ?? ""
    let windowName = window["kCGWindowName"] as? String ?? ""
    let bounds = window["kCGWindowBounds"] as? [String: CGFloat] ?? [:]
    let layer = window["kCGWindowLayer"] as? Int ?? 0
    let ownerPID = window["kCGWindowOwnerPID"] as? Int ?? 0

    // Only layer 0 are normal windows (not menu bar, dock, etc.)
    guard layer == 0 else { continue }

    // Filter for Java/Compose windows
    let ownerLower = ownerName.lowercased()
    let isJavaApp = javaKeywords.contains { ownerLower.contains($0) }

    // Also check if this is a Java process by looking at the binary path
    // (could extend this later if needed)

    if isJavaApp && !windowName.isEmpty {
        let x = Int(bounds["X"] ?? 0)
        let y = Int(bounds["Y"] ?? 0)
        let w = Int(bounds["Width"] ?? 0)
        let h = Int(bounds["Height"] ?? 0)

        // Skip tiny windows (likely popups or invisible frames)
        guard w > 50 && h > 50 else { continue }

        // Output: owner|title|x|y|width|height|pid
        print("\(ownerName)|\(windowName)|\(x)|\(y)|\(w)|\(h)|\(ownerPID)")
    }
}
