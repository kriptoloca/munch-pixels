#!/usr/bin/env node
// Prints the phone-test links for this machine before the Vite dev server starts
// (`npm run dev`), so nobody has to look up the LAN IP by hand. Pure local information: it reads
// the network interfaces and prints; it never opens a connection.
import { networkInterfaces } from 'node:os';

const PORT = 5173;
const LINKS = [
  ['Phone test (fake ads, boosters)', '/?fakeads=1'],
  ['Fresh start, level 1', '/?reset=1'],
  ['Jump to a level', '/?level=20'],
];

const addresses = Object.values(networkInterfaces())
  .flat()
  .filter((i) => i && i.family === 'IPv4' && !i.internal)
  .map((i) => i.address);

console.log('');
if (addresses.length === 0) {
  console.log(
    'No LAN address found: connect the laptop to Wi-Fi, then open the links on the phone.',
  );
} else {
  console.log('Open on the phone (same Wi-Fi as this computer):');
  for (const ip of addresses) {
    for (const [label, query] of LINKS) {
      console.log(`  ${label.padEnd(40)} http://${ip}:${String(PORT)}${query}`);
    }
  }
  if (addresses.length > 1) {
    console.log(
      '  (several addresses: the one starting with 192.168. or 10. is usually the Wi-Fi one)',
    );
  }
}
console.log(
  'If the phone cannot reach it: allow Node.js through the firewall on private networks.',
);
console.log('');
