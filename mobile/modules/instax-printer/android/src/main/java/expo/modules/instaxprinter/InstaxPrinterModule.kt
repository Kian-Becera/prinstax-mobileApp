package expo.modules.instaxprinter

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.exception.CodedException

// Stub implementation. Replace the bodies with calls into Fujifilm's Instax SDK
// (or your own BLE code) once the SDK aar is dropped into android/libs.

class InstaxPrinterModule : Module() {
    private var state: String = "disconnected"
    private var deviceName: String? = null
    private var filmRemaining: Int = 8

    private fun statusMap(): Map<String, Any?> = mapOf(
        "state" to state,
        "deviceName" to deviceName,
        "batteryLevel" to 0.82,
        "filmRemaining" to filmRemaining,
    )

    override fun definition() = ModuleDefinition {
        Name("InstaxPrinter")

        AsyncFunction("scanForDevices") { _: Int ->
            // TODO: Use BluetoothLeScanner with the Instax service UUID filter.
            listOf(
                mapOf("id" to "instax-mini-link-2", "name" to "INSTAX-MINI Link 2", "rssi" to -52),
                mapOf("id" to "instax-square-link", "name" to "INSTAX SQUARE Link", "rssi" to -67),
            )
        }

        AsyncFunction("connect") { deviceId: String? ->
            // TODO: BluetoothGatt connectGatt + Instax pairing handshake.
            state = "connected"
            deviceName = deviceId ?: "INSTAX (stub)"
            statusMap()
        }

        AsyncFunction("disconnect") {
            state = "disconnected"
            deviceName = null
            statusMap()
        }

        AsyncFunction("getStatus") {
            statusMap()
        }

        AsyncFunction("print") { imageUri: String ->
            // TODO: Decode imageUri to a Bitmap, scale to the target Instax format
            // (mini = 600x800 px), and call the SDK send-print method. Suspend on
            // the printer's print-finished callback before returning.
            if (state != "connected") {
                throw CodedException("NotConnected", "Printer not connected", null)
            }
            state = "printing"
            Thread.sleep(1500)
            filmRemaining = (filmRemaining - 1).coerceAtLeast(0)
            state = "connected"
            mapOf("jobId" to "stub-${System.currentTimeMillis()}")
        }
    }
}
