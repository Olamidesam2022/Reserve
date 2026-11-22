import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../src/ui/style.css', import.meta.url), 'utf8');
const tokens = Object.fromEntries(
  [...css.matchAll(/(--[\w-]+)\s*:\s*(#[\da-fA-F]{6})/g)].map(([, name, value]) => [name, value]),
);

function luminance(hex) {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    .map((channel) => parseInt(channel, 16) / 255)
    .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(foreground, background) {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

const pairs = [
  ['primary text on page', '#e8e7e2', '--bg'],
  ['primary text on panel', '#e8e7e2', '--surface'],
  ['primary text on raised panel', '#e8e7e2', '--surface2'],
  ['muted text on page', '--muted', '--bg'],
  ['muted text on panel', '--muted', '--surface'],
  ['muted text on raised panel', '--muted', '--surface2'],
  ['amber text on page', '--amber', '--bg'],
  ['amber text on panel', '--amber', '--surface'],
  ['amber text on raised panel', '--amber', '--surface2'],
  ['steel blue text on page', '--blue', '--bg'],
  ['steel blue text on panel', '--blue', '--surface'],
  ['steel blue text on raised panel', '--blue', '--surface2'],
  ['dark button text on amber', '#17191a', '--amber'],
];

let failed = false;
for (const [label, foregroundToken, backgroundToken] of pairs) {
  const foreground = tokens[foregroundToken] ?? foregroundToken;
  const background = tokens[backgroundToken] ?? backgroundToken;
  if (!foreground.startsWith('#') || !background.startsWith('#')) {
    console.error(`Missing color token for ${label}: ${foregroundToken}, ${backgroundToken}`);
    failed = true;
    continue;
  }
  const ratio = contrast(foreground, background);
  const passes = ratio >= 4.5;
  console.log(`${passes ? 'PASS' : 'FAIL'} ${label}: ${ratio.toFixed(2)}:1`);
  if (!passes) failed = true;
}

if (failed) process.exitCode = 1;
