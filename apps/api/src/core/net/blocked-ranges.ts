import { BlockList, isIPv4, isIPv6 } from 'node:net';

/** Special-purpose ranges a recon tool must not reach unless explicitly allowed. */
const IPV4_RANGES: [string, number][] = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
];

const IPV6_RANGES: [string, number][] = [
  ['::', 128],
  ['::1', 128],
  ['64:ff9b:1::', 48],
  ['100::', 64],
  ['2001:db8::', 32],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
];

const blockList = new BlockList();
for (const [net, prefix] of IPV4_RANGES)
  blockList.addSubnet(net, prefix, 'ipv4');
for (const [net, prefix] of IPV6_RANGES)
  blockList.addSubnet(net, prefix, 'ipv6');

/** True if the address is loopback, private, link-local, reserved, etc. */
export function isBlockedAddress(address: string): boolean {
  // IPv4-mapped IPv6 (::ffff:10.0.0.1) -> check the embedded IPv4
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  if (mapped) return blockList.check(mapped[1]!, 'ipv4');
  if (isIPv4(address)) return blockList.check(address, 'ipv4');
  if (isIPv6(address)) return blockList.check(address, 'ipv6');
  return true; // not an IP at all -> refuse
}
