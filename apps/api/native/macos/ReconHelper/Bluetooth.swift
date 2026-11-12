import CoreBluetooth
import Foundation
import IOBluetooth

// Bluetooth: BLE via CoreBluetooth, Classic via IOBluetooth inquiry.
// Both require the Bluetooth privacy permission (CBManager.authorization).

func bluetoothStatusName(_ a: CBManagerAuthorization) -> String {
  switch a {
  case .notDetermined: return "notDetermined"
  case .restricted: return "restricted"
  case .denied: return "denied"
  case .allowedAlways: return "authorized"
  @unknown default: return "unknown"
  }
}

final class BleScanner: NSObject, CBCentralManagerDelegate {
  private var central: CBCentralManager?
  private(set) var state: CBManagerState = .unknown
  private(set) var devices: [UUID: [String: Any]] = [:]

  func start() {
    central = CBCentralManager(delegate: self, queue: nil)
  }

  func stop() {
    central?.stopScan()
  }

  func centralManagerDidUpdateState(_ central: CBCentralManager) {
    state = central.state
    if central.state == .poweredOn {
      central.scanForPeripherals(withServices: nil, options: [CBCentralManagerScanOptionAllowDuplicatesKey: true])
    }
  }

  func centralManager(
    _ central: CBCentralManager,
    didDiscover peripheral: CBPeripheral,
    advertisementData ad: [String: Any],
    rssi RSSI: NSNumber
  ) {
    var o = devices[peripheral.identifier] ?? ["id": peripheral.identifier.uuidString, "transport": "ble"]
    let rssi = RSSI.intValue
    if rssi != 127 && rssi < 0 {
      if let prev = o["rssi"] as? Int { o["rssi"] = max(prev, rssi) } else { o["rssi"] = rssi }
    }
    if let name = peripheral.name ?? (ad[CBAdvertisementDataLocalNameKey] as? String), !name.isEmpty {
      o["name"] = name
    }
    if let c = ad[CBAdvertisementDataIsConnectable] as? NSNumber { o["connectable"] = c.boolValue }
    if let t = ad[CBAdvertisementDataTxPowerLevelKey] as? NSNumber { o["txPower"] = t.intValue }
    if let m = ad[CBAdvertisementDataManufacturerDataKey] as? Data, m.count >= 2 {
      let bytes = [UInt8](m)
      o["manufacturerId"] = Int(bytes[0]) | (Int(bytes[1]) << 8)
    }
    if let uuids = ad[CBAdvertisementDataServiceUUIDsKey] as? [CBUUID] {
      let existing = Set(o["services"] as? [String] ?? [])
      o["services"] = Array(existing.union(uuids.map { $0.uuidString })).sorted()
    }
    o["seen"] = (o["seen"] as? Int ?? 0) + 1
    devices[peripheral.identifier] = o
  }
}

final class ClassicScanner: NSObject, IOBluetoothDeviceInquiryDelegate {
  private var inquiry: IOBluetoothDeviceInquiry?
  private(set) var devices: [String: [String: Any]] = [:]
  private(set) var done = false
  private(set) var error: String?

  func start(duration: Int) {
    let inq = IOBluetoothDeviceInquiry(delegate: self)
    inq?.inquiryLength = UInt8(max(1, min(duration, 48)))
    inq?.updateNewDeviceNames = true
    inquiry = inq
    let result = inq?.start() ?? kIOReturnError
    if result != kIOReturnSuccess {
      error = "Classic inquiry could not start (IOReturn \(result))"
      done = true
    }
  }

  func stop() {
    inquiry?.stop()
  }

  func deviceInquiryDeviceFound(_ sender: IOBluetoothDeviceInquiry!, device: IOBluetoothDevice!) {
    record(device, discovered: true)
  }

  func deviceInquiryDeviceNameUpdated(
    _ sender: IOBluetoothDeviceInquiry!, device: IOBluetoothDevice!, devicesRemaining: UInt32
  ) {
    record(device, discovered: true)
  }

  func deviceInquiryComplete(_ sender: IOBluetoothDeviceInquiry!, error: IOReturn, aborted: Bool) {
    if error != kIOReturnSuccess && !aborted { self.error = "Classic inquiry failed (IOReturn \(error))" }
    done = true
  }

  func record(_ d: IOBluetoothDevice?, discovered: Bool) {
    guard let d, let address = d.addressString else { return }
    var o = devices[address] ?? ["id": address, "address": address, "transport": "classic"]
    if discovered { o["discovered"] = true } else if o["discovered"] == nil { o["discovered"] = false }
    if let name = d.name, !name.isEmpty { o["name"] = name }
    let rssi = Int(d.rawRSSI())
    if rssi != 127 && rssi < 0 { o["rssi"] = rssi }
    o["classOfDevice"] = Int(d.classOfDevice)
    o["majorClass"] = Int(d.deviceClassMajor)
    o["paired"] = d.isPaired()
    o["connected"] = d.isConnected()
    devices[address] = o
  }

  /// Paired devices are known even when they are not discoverable right now.
  func addPaired() {
    for case let d as IOBluetoothDevice in IOBluetoothDevice.pairedDevices() ?? [] {
      if let addr = d.addressString, devices[addr] == nil { record(d, discovered: false) }
    }
  }
}

func runBluetooth(_ opts: Options) -> Never {
  let auth = CBManager.authorization

  if opts.requestAuth {
    if auth == .notDetermined {
      // Creating a central manager triggers the permission prompt.
      let ble = BleScanner()
      ble.start()
      spin(seconds: 120) { CBManager.authorization != .notDetermined }
      ble.stop()
    }
    let now = CBManager.authorization
    write(["authorized": now == .allowedAlways, "status": bluetoothStatusName(now)], to: opts.output)
  }

  guard auth == .allowedAlways else {
    write(["authorized": false, "status": bluetoothStatusName(auth), "devices": []], to: opts.output)
  }

  let wantBle = opts.transport != "classic"
  let wantClassic = opts.transport != "ble"
  let ble = BleScanner()
  let classic = ClassicScanner()

  if wantBle { ble.start() }
  if wantClassic { classic.start(duration: opts.duration) }

  // BLE listens for the full duration; Classic inquiry ends on its own (plus name lookups).
  spin(seconds: Double(opts.duration))
  ble.stop()
  if wantClassic {
    spin(seconds: 12) { classic.done }
    classic.stop()
    classic.addPaired()
  }

  var result: [String: Any] = [
    "authorized": true,
    "status": "authorized",
    "devices": Array(ble.devices.values) + Array(classic.devices.values),
  ]
  if wantBle && ble.state == .poweredOff { result["error"] = "Bluetooth is turned off" }
  if wantBle && ble.state == .unsupported { result["error"] = "Bluetooth LE is not supported on this Mac" }
  if let e = classic.error { result["classicError"] = e }
  write(result, to: opts.output)
}
