/**
 * One-off icon generator. Renders the POUR app icon SVG to the PNG sizes a
 * PWA needs for installability + notifications. Run: `node scripts/make-icons.mjs`
 * Output: public/icons/*.png. Safe to re-run; overwrites in place.
 */
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "icons");
mkdirSync(outDir, { recursive: true });

// Full-bleed icon (background fills the whole square) — used for "any" purpose
// and as the maskable icon, so the safe-zone glass sits centered and un-cropped.
const iconSVG = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0a1420"/>
      <stop offset="1" stop-color="#040608"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f7e08a"/>
      <stop offset="0.5" stop-color="#e6c25a"/>
      <stop offset="1" stop-color="#c99a2e"/>
    </linearGradient>
    <linearGradient id="liquid" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1fae7a"/>
      <stop offset="1" stop-color="#0e7a52"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <!-- martini/cocktail glass, centered in the maskable safe zone (~center 80%) -->
  <g transform="translate(256,248)" stroke="url(#gold)" stroke-width="12" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <!-- bowl -->
    <path d="M -112 -104 L 112 -104 L 0 24 Z" fill="url(#liquid)" fill-opacity="0.85"/>
    <!-- surface line -->
    <path d="M -112 -104 L 112 -104" />
    <!-- stem -->
    <path d="M 0 24 L 0 120" />
    <!-- base -->
    <path d="M -66 128 L 66 128" />
  </g>
  <!-- olive / garnish -->
  <circle cx="292" cy="176" r="14" fill="url(#gold)" stroke="none"/>
</svg>`;

const sizes = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "icon-maskable-512.png", size: 512 },
  { name: "apple-touch-icon.png", size: 180 },
  { name: "badge-72.png", size: 72 },
];

for (const { name, size } of sizes) {
  const png = await sharp(Buffer.from(iconSVG(size))).resize(size, size).png().toBuffer();
  writeFileSync(join(outDir, name), png);
  console.log("wrote", name, size + "x" + size);
}
console.log("done");
