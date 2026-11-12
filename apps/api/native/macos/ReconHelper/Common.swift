import Foundation

struct Options {
  /// "wifi" | "bluetooth"
  var mode = "wifi"
  var output: String?
  var interfaceName: String?
  var requestAuth = false
  var duration = 8
  /// "both" | "ble" | "classic"
  var transport = "both"
}

func parseOptions() -> Options {
  var opts = Options()
  var it = CommandLine.arguments.dropFirst().makeIterator()
  while let arg = it.next() {
    switch arg {
    case "--mode": opts.mode = it.next() ?? opts.mode
    case "--output": opts.output = it.next()
    case "--interface": opts.interfaceName = it.next()
    case "--request-auth": opts.requestAuth = true
    case "--duration": opts.duration = max(1, min(60, Int(it.next() ?? "") ?? opts.duration))
    case "--transport": opts.transport = it.next() ?? opts.transport
    default: break
    }
  }
  return opts
}

func write(_ object: [String: Any], to path: String?) -> Never {
  guard let data = try? JSONSerialization.data(withJSONObject: object, options: [.sortedKeys]) else { exit(2) }
  if let path {
    // Atomic: the API polls for this file, so it must never see a partial write.
    let tmp = path + ".partial"
    FileManager.default.createFile(atPath: tmp, contents: data)
    _ = try? FileManager.default.replaceItemAt(URL(fileURLWithPath: path), withItemAt: URL(fileURLWithPath: tmp))
    if !FileManager.default.fileExists(atPath: path) { try? FileManager.default.moveItem(atPath: tmp, toPath: path) }
  } else {
    FileHandle.standardOutput.write(data)
  }
  exit(0)
}

/// Spins the main run loop (delegate callbacks) until `done()` or the deadline.
func spin(seconds: Double, until done: () -> Bool = { false }) {
  let deadline = Date().addingTimeInterval(seconds)
  while !done() && Date() < deadline {
    RunLoop.main.run(until: Date().addingTimeInterval(0.1))
  }
}
