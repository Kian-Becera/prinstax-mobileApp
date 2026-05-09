import ExpoModulesCore

// Stub implementation. Replace the bodies of `connect`, `print`, etc. with calls
// into Fujifilm's Instax SDK (or your own CoreBluetooth code) once the SDK is
// linked into the Xcode project.

public class InstaxPrinterModule: Module {
    private var state: String = "disconnected"
    private var deviceName: String? = nil
    private var filmRemaining: Int = 8

    private func statusDict() -> [String: Any] {
        var dict: [String: Any] = ["state": state]
        if let n = deviceName { dict["deviceName"] = n }
        dict["batteryLevel"] = 0.82
        dict["filmRemaining"] = filmRemaining
        return dict
    }

    public func definition() -> ModuleDefinition {
        Name("InstaxPrinter")

        AsyncFunction("scanForDevices") { (_ timeoutMs: Int) -> [[String: Any]] in
            // TODO: Replace with CoreBluetooth scan filtered to Fujifilm Instax service UUIDs.
            return [
                ["id": "instax-mini-link-2", "name": "INSTAX-MINI Link 2", "rssi": -52],
                ["id": "instax-square-link", "name": "INSTAX SQUARE Link", "rssi": -67],
            ]
        }

        AsyncFunction("connect") { (deviceId: String?) -> [String: Any] in
            // TODO: Resolve a CBPeripheral by id and connect via the Fujifilm SDK.
            self.state = "connected"
            self.deviceName = deviceId ?? "INSTAX (stub)"
            return self.statusDict()
        }

        AsyncFunction("disconnect") { () -> [String: Any] in
            self.state = "disconnected"
            self.deviceName = nil
            return self.statusDict()
        }

        AsyncFunction("getStatus") { () -> [String: Any] in
            return self.statusDict()
        }

        AsyncFunction("print") { (imageUri: String) -> [String: String] in
            // TODO: Decode imageUri (file:// or https://) into a UIImage, downscale to
            // the target Instax format (mini = 600x800 px @ 318 dpi), then call the SDK
            // print method. Wait for completion or progress events before resolving.
            guard self.state == "connected" else {
                throw Exception(name: "NotConnected", description: "Printer not connected")
            }
            self.state = "printing"
            // simulate latency
            Thread.sleep(forTimeInterval: 1.5)
            self.filmRemaining = max(0, self.filmRemaining - 1)
            self.state = "connected"
            return ["jobId": "stub-\(Int(Date().timeIntervalSince1970))"]
        }
    }
}
