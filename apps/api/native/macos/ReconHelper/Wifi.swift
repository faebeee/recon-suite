import CoreLocation
import CoreWLAN
import Foundation

// WiFi: SSIDs/BSSIDs require Location Services permission.

func locationStatusName(_ s: CLAuthorizationStatus) -> String {
  switch s {
  case .notDetermined: return "notDetermined"
  case .restricted: return "restricted"
  case .denied: return "denied"
  case .authorizedAlways: return "authorized"
  @unknown default: return "authorized"
  }
}

func locationAuthorized(_ s: CLAuthorizationStatus) -> Bool {
  return s != .notDetermined && s != .restricted && s != .denied
}

final class LocationAuthDelegate: NSObject, CLLocationManagerDelegate {
  var status: CLAuthorizationStatus = .notDetermined
  func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
    status = manager.authorizationStatus
  }
}

func securityLabel(_ n: CWNetwork) -> String {
  let order: [(CWSecurity, String)] = [
    (.wpa3Transition, "WPA2/WPA3 Personal"),
    (.wpa3Enterprise, "WPA3 Enterprise"),
    (.wpa3Personal, "WPA3 Personal"),
    (.wpa2Enterprise, "WPA2 Enterprise"),
    (.wpa2Personal, "WPA2 Personal"),
    (.oweTransition, "OWE Transition"),
    (.OWE, "OWE"),
    (.wpaEnterprise, "WPA Enterprise"),
    (.wpaEnterpriseMixed, "WPA Enterprise"),
    (.wpaPersonal, "WPA Personal"),
    (.wpaPersonalMixed, "WPA Personal"),
    (.dynamicWEP, "WEP"),
    (.WEP, "WEP"),
    (.none, "Open"),
  ]
  return order.first { n.supportsSecurity($0.0) }?.1 ?? "Unknown"
}

func band(_ c: CWChannel?) -> String? {
  switch c?.channelBand {
  case .band2GHz: return "2.4 GHz"
  case .band5GHz: return "5 GHz"
  case .band6GHz: return "6 GHz"
  default: return nil
  }
}

func width(_ c: CWChannel?) -> Int? {
  switch c?.channelWidth {
  case .width20MHz: return 20
  case .width40MHz: return 40
  case .width80MHz: return 80
  case .width160MHz: return 160
  default: return nil
  }
}

func runWifi(_ opts: Options) -> Never {
  let manager = CLLocationManager()
  let delegate = LocationAuthDelegate()
  manager.delegate = delegate
  delegate.status = manager.authorizationStatus
  spin(seconds: 0.3)

  if opts.requestAuth {
    if delegate.status == .notDetermined {
      manager.requestAlwaysAuthorization()
      spin(seconds: 120) { delegate.status != .notDetermined }
    }
    write(["authorized": locationAuthorized(delegate.status), "status": locationStatusName(delegate.status)], to: opts.output)
  }

  guard locationAuthorized(delegate.status) else {
    write(["authorized": false, "status": locationStatusName(delegate.status), "networks": []], to: opts.output)
  }

  let client = CWWiFiClient.shared()
  guard let iface = opts.interfaceName.flatMap({ client.interface(withName: $0) }) ?? client.interface() else {
    write(["authorized": true, "status": "authorized", "error": "No WiFi interface found", "networks": []], to: opts.output)
  }

  do {
    let found = try iface.scanForNetworks(withName: nil, includeHidden: true)
    let currentBssid = iface.bssid()
    let currentSsid = iface.ssid()
    let networks: [[String: Any]] = found.map { n in
      var o: [String: Any] = [
        "ssid": n.ssid ?? "",
        "rssi": n.rssiValue,
        "noise": n.noiseMeasurement,
        "security": securityLabel(n),
        "current": n.bssid != nil ? n.bssid == currentBssid : (n.ssid != nil && n.ssid == currentSsid),
      ]
      if let b = n.bssid { o["bssid"] = b }
      if let ch = n.wlanChannel?.channelNumber { o["channel"] = ch }
      if let b = band(n.wlanChannel) { o["band"] = b }
      if let w = width(n.wlanChannel) { o["width"] = w }
      return o
    }
    write(["authorized": true, "status": "authorized", "interface": iface.interfaceName ?? "", "networks": networks], to: opts.output)
  } catch {
    write(["authorized": true, "status": "authorized", "error": error.localizedDescription, "networks": []], to: opts.output)
  }
}
