/**
 * Renders the PWA icons from one SVG of the Blob mascot. Run with `npm run icons`; the PNGs
 * are committed so hosted builds never need this script.
 *
 *   public/icons/icon-192.png           manifest (purpose: any)
 *   public/icons/icon-512.png           manifest (purpose: any)
 *   public/icons/icon-512-maskable.png  manifest (purpose: maskable, sphere inside the safe zone)
 *   app/icon.png                        favicon  (Next file convention)
 *   app/apple-icon.png                  apple-touch-icon, 180px (Next file convention)
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** @param {{ radius: number }} opts radius of the sphere in a 512 viewBox */
function blobSvg({ radius: r }) {
  const cx = 256;
  const cy = 256;
  const eye = (dx) => `<circle cx="${cx + dx * r}" cy="${cy + 0.02 * r}" r="${0.055 * r}" fill="#1C1B1A" opacity="0.82"/>`;
  const smile = `M ${cx - 0.17 * r} ${cy + 0.2 * r} Q ${cx} ${cy + 0.36 * r} ${cx + 0.17 * r} ${cy + 0.2 * r}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <radialGradient id="sphere" cx="0.36" cy="0.3" r="0.78">
      <stop offset="0" stop-color="#FFF4EA"/>
      <stop offset="0.28" stop-color="#FFB38A"/>
      <stop offset="0.64" stop-color="#FF9EC4"/>
      <stop offset="1" stop-color="#8E7AD6"/>
    </radialGradient>
    <radialGradient id="glowPeach" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#FFB38A" stop-opacity="0.95"/>
      <stop offset="1" stop-color="#FFB38A" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glowLilac" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#C9B6FF" stop-opacity="0.95"/>
      <stop offset="1" stop-color="#C9B6FF" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="shine" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.9"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" fill="#F7F5F2"/>
  <circle cx="120" cy="96" r="230" fill="url(#glowPeach)"/>
  <circle cx="410" cy="430" r="240" fill="url(#glowLilac)"/>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#sphere)"/>
  <ellipse cx="${cx - 0.3 * r}" cy="${cy - 0.42 * r}" rx="${0.34 * r}" ry="${0.2 * r}" fill="url(#shine)"/>
  ${eye(-0.24)}${eye(0.24)}
  <path d="${smile}" fill="none" stroke="#1C1B1A" stroke-opacity="0.82" stroke-width="${0.045 * r}" stroke-linecap="round"/>
</svg>`;
}

const ANY = blobSvg({ radius: 154 }); // 60% of the tile; the OS adds its own corner radius
const MASKABLE = blobSvg({ radius: 118 }); // inside the 80% safe zone with air around it

const outputs = [
  ["public/icons/icon-192.png", ANY, 192],
  ["public/icons/icon-512.png", ANY, 512],
  ["public/icons/icon-512-maskable.png", MASKABLE, 512],
  ["app/icon.png", ANY, 192],
  ["app/apple-icon.png", ANY, 180],
];

for (const [rel, svg, size] of outputs) {
  const file = path.join(root, rel);
  await mkdir(path.dirname(file), { recursive: true });
  await sharp(Buffer.from(svg), { density: 192 }).resize(size, size).png({ compressionLevel: 9 }).toFile(file);
  console.log(`wrote ${rel} (${size}px)`);
}
