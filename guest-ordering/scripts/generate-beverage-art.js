const fs = require("fs");
const path = require("path");

const outDir = path.join(__dirname, "..", "public", "beverages");
fs.mkdirSync(outDir, { recursive: true });

// ─── Shared template pieces (same on every card) ───────────────────────────

const DEFS = `
<linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#0a0e1a"/>
<stop offset="1" stop-color="#040507"/>
</linearGradient>
<radialGradient id="glowRed" cx="0.1" cy="0.1" r="0.4">
<stop offset="0" stop-color="#c0273a" stop-opacity="0.4"/>
<stop offset="1" stop-color="#c0273a" stop-opacity="0"/>
</radialGradient>
<radialGradient id="glowBlue" cx="0.92" cy="0.92" r="0.42">
<stop offset="0" stop-color="#2451d6" stop-opacity="0.38"/>
<stop offset="1" stop-color="#2451d6" stop-opacity="0"/>
</radialGradient>
<linearGradient id="frameGrad" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#c0273a"/>
<stop offset="0.5" stop-color="#f4f4f4"/>
<stop offset="1" stop-color="#2451d6"/>
</linearGradient>
<radialGradient id="spot" cx="0.5" cy="0.45" r="0.62">
<stop offset="0" stop-color="#fff4d6" stop-opacity="0.6"/>
<stop offset="0.35" stop-color="#ffdfa3" stop-opacity="0.3"/>
<stop offset="0.7" stop-color="#ffdfa3" stop-opacity="0.08"/>
<stop offset="1" stop-color="#ffdfa3" stop-opacity="0"/>
</radialGradient>`;

const BACKGROUND = `
<rect x="0" y="0" width="680" height="680" fill="url(#bgGrad)"/>
<rect x="0" y="0" width="680" height="680" fill="url(#glowRed)"/>
<rect x="0" y="0" width="680" height="680" fill="url(#glowBlue)"/>
<rect x="0" y="0" width="680" height="680" fill="url(#spot)"/>`;

const FRAME = `
<rect x="40" y="40" width="600" height="600" rx="18" fill="none" stroke="url(#frameGrad)" stroke-width="5"/>
<rect x="52" y="52" width="576" height="576" rx="14" fill="none" stroke="#ffffff" stroke-opacity="0.25" stroke-width="1.5"/>`;

function card(title, desc, inner) {
  return `<svg width="100%" height="100%" viewBox="0 0 680 680" xmlns="http://www.w3.org/2000/svg" role="img">
<title>${title}</title>
<desc>${desc}</desc>
<defs>${DEFS}</defs>${BACKGROUND}
${inner}
${FRAME}
</svg>`;
}

// ─── Garnish helpers ────────────────────────────────────────────────────────

function citrusWheel(cx, cy, color) {
  return `<circle cx="${cx}" cy="${cy}" r="13" fill="${color}" opacity="0.9"/>
<circle cx="${cx}" cy="${cy}" r="13" fill="none" stroke="#fff" stroke-opacity="0.4" stroke-width="1"/>
<line x1="${cx}" y1="${cy-13}" x2="${cx}" y2="${cy+13}" stroke="#fff" stroke-opacity="0.3" stroke-width="1"/>
<line x1="${cx-13}" y1="${cy}" x2="${cx+13}" y2="${cy}" stroke="#fff" stroke-opacity="0.3" stroke-width="1"/>`;
}

function peelTwist(cx, cy, color) {
  return `<path d="M${cx} ${cy} q14 -4 18 10 q4 14 -10 16" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round"/>`;
}

function iceCubes(cx, cy) {
  return `<rect x="${cx-14}" y="${cy}" width="16" height="16" rx="2" fill="#ffffff" opacity="0.22"/>
<rect x="${cx+4}" y="${cy+10}" width="14" height="14" rx="2" fill="#ffffff" opacity="0.18"/>`;
}

function bubbles(cx, cy, color) {
  return `<circle cx="${cx-8}" cy="${cy+30}" r="2.2" fill="${color}" opacity="0.8"/>
<circle cx="${cx+6}" cy="${cy+0}" r="1.8" fill="${color}" opacity="0.7"/>
<circle cx="${cx-2}" cy="${cy-40}" r="1.6" fill="${color}" opacity="0.7"/>
<circle cx="${cx+12}" cy="${cy+20}" r="1.6" fill="${color}" opacity="0.7"/>
<circle cx="${cx-10}" cy="${cy-15}" r="1.4" fill="${color}" opacity="0.6"/>`;
}

// ─── Glass / vessel shapes ─────────────────────────────────────────────────

function martiniGlass(liquid, garnishSvg) {
  return `<path d="M255 255 L425 255 L348 415 L332 415 Z" fill="#160b06" opacity="0.92"/>
<path d="M268 262 L412 262 L344 400 L336 400 Z" fill="${liquid}"/>
<ellipse cx="340" cy="270" rx="72" ry="10" fill="${liquid}" opacity="0.55"/>
<rect x="336" y="415" width="8" height="62" fill="#26160c"/>
<ellipse cx="340" cy="480" rx="58" ry="11" fill="#1a0f08"/>
${garnishSvg ? garnishSvg : ""}`;
}

function champagneFlute(liquid) {
  return `<path d="M312 150 C312 230 296 250 296 300 C296 330 320 345 340 345 C360 345 384 330 384 300 C384 250 368 230 368 150 Z" fill="#120d05" opacity="0.85"/>
<path d="M318 156 C318 230 305 248 305 298 C305 322 322 336 340 336 C358 336 375 322 375 298 C375 248 362 230 362 156 Z" fill="${liquid}"/>
${bubbles(340, 260, "#fff6da")}
<ellipse cx="335" cy="180" rx="14" ry="22" fill="#ffffff" opacity="0.08"/>
<rect x="336" y="345" width="8" height="70" fill="#1c1408"/>
<ellipse cx="340" cy="420" rx="56" ry="11" fill="#15100a"/>`;
}

function rocksGlass(liquid, withIce) {
  return `<path d="M270 230 L410 230 L398 400 Q398 416 382 416 L298 416 Q282 416 282 400 Z" fill="#160f08" opacity="0.5"/>
<path d="M278 260 L402 260 L394 398 Q394 410 380 410 L300 410 Q286 410 286 398 Z" fill="${liquid}"/>
${withIce ? iceCubes(322, 300) : ""}
<ellipse cx="340" cy="232" rx="70" ry="9" fill="#ffffff" opacity="0.06"/>`;
}

function wineGlass(liquid) {
  return `<path d="M300 180 C300 230 280 250 280 285 C280 320 308 345 340 345 C372 345 400 320 400 285 C400 250 380 230 380 180 Z" fill="#140d08" opacity="0.55"/>
<path d="M300 250 C302 275 312 300 340 320 C368 300 378 275 380 250 C380 220 364 200 340 195 C316 200 300 220 300 250 Z" fill="${liquid}"/>
<rect x="336" y="345" width="8" height="80" fill="#1c150c"/>
<ellipse cx="340" cy="430" rx="60" ry="11" fill="#15100a"/>`;
}

function beerBottle(liquid, labelColor) {
  return `<rect x="300" y="160" width="80" height="270" rx="16" fill="#0c1410" opacity="0.5"/>
<rect x="308" y="200" width="64" height="220" rx="14" fill="${liquid}"/>
<rect x="318" y="120" width="44" height="50" fill="#0c1410" opacity="0.6"/>
<rect x="314" y="105" width="52" height="22" rx="6" fill="#caa84a"/>
<rect x="300" y="290" width="80" height="60" fill="${labelColor}"/>
<circle cx="330" cy="270" r="2.4" fill="#fff" opacity="0.5"/>
<circle cx="352" cy="240" r="2" fill="#fff" opacity="0.45"/>`;
}

function shotGlass(liquid) {
  return `<path d="M296 250 L384 250 L372 380 Q372 392 360 392 L320 392 Q308 392 308 380 Z" fill="#160f08" opacity="0.5"/>
<path d="M304 268 L376 268 L366 378 Q366 386 356 386 L324 386 Q314 386 314 378 Z" fill="${liquid}"/>
<ellipse cx="340" cy="251" rx="44" ry="7" fill="#ffffff" opacity="0.07"/>`;
}

function highballGlass(liquid, wedgeColor) {
  return `<rect x="290" y="200" width="100" height="220" rx="10" fill="#160f08" opacity="0.4"/>
<rect x="298" y="230" width="84" height="182" rx="8" fill="${liquid}"/>
${iceCubes(316, 260)}
<path d="M375 220 q16 4 16 22 q0 16 -16 14" fill="${wedgeColor}" opacity="0.9"/>
<ellipse cx="340" cy="201" rx="50" ry="8" fill="#ffffff" opacity="0.07"/>`;
}

function sodaCan(labelText) {
  return `<rect x="288" y="170" width="104" height="250" rx="14" fill="#a9aeb2"/>
<rect x="288" y="170" width="104" height="46" rx="14" fill="#0a0a0a" opacity="0.85"/>
<rect x="288" y="270" width="104" height="58" fill="#c0273a"/>
<text x="340" y="305" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="20" fill="#ffffff" letter-spacing="1">${labelText}</text>
<ellipse cx="340" cy="170" rx="52" ry="9" fill="#c7cbce"/>
<circle cx="320" cy="200" r="3" fill="#ffffff" opacity="0.55"/>
<circle cx="365" cy="230" r="2.4" fill="#ffffff" opacity="0.5"/>
<circle cx="305" cy="350" r="2.6" fill="#ffffff" opacity="0.5"/>
<circle cx="372" cy="380" r="2.2" fill="#ffffff" opacity="0.45"/>`;
}

function limeOnNeck(cx, cy) {
  return `<path d="M${cx} ${cy} q15 5 14 22 q-1 15 -16 14" fill="#9fb83a" opacity="0.92"/>
<path d="M${cx} ${cy} q15 5 14 22 q-1 15 -16 14" fill="none" stroke="#fff" stroke-opacity="0.35" stroke-width="1"/>`;
}

function sparklingBottle(liquid) {
  return `<rect x="305" y="150" width="70" height="270" rx="18" fill="#0a1418" opacity="0.45"/>
<rect x="313" y="190" width="54" height="222" rx="16" fill="${liquid}"/>
${bubbles(340, 280, "#eaf6ff")}
<rect x="322" y="118" width="36" height="40" fill="#0a1418" opacity="0.55"/>
<rect x="316" y="104" width="48" height="20" rx="5" fill="#9fb8c4"/>`;
}

// ─── Beverage roster (the 22 currently on the menu) ────────────────────────

const beverages = [
  { id: "bev-01", file: "royal-flush",          name: "Royal Flush",
    inner: martiniGlass("#8a5a22", peelTwist(380, 270, "#c98a3a")) },
  { id: "bev-02", file: "midnight-negroni",      name: "Midnight Negroni",
    inner: martiniGlass("#9c2a28", citrusWheel(380, 268, "#d9622f")) },
  { id: "bev-03", file: "espresso-martini",      name: "Espresso Martini",
    inner: martiniGlass("#3b2414",
      `<path d="M276 266 Q310 252 344 266 Q378 252 404 266 Q378 278 344 270 Q310 278 276 266 Z" fill="#e8dcc8"/>
       <circle cx="318" cy="262" r="8" fill="#2c1a0e"/><circle cx="333" cy="258" r="7" fill="#2c1a0e"/>`) },
  { id: "bev-04", file: "house-margarita",       name: "House Margarita",
    inner: martiniGlass("#c9d96a", citrusWheel(380, 268, "#8fb83a")) },
  { id: "bev-05", file: "vegas-vice",            name: "Vegas Vice",
    inner: martiniGlass("#d9622f", citrusWheel(380, 268, "#e98a2f")) },
  { id: "bev-06", file: "moet-chandon-brut",     name: "Moët & Chandon Brut",
    inner: champagneFlute("#e9c25a") },
  { id: "bev-07", file: "dom-perignon-2015",     name: "Dom Pérignon 2015",
    inner: champagneFlute("#caa23a") },
  { id: "bev-08", file: "pappy-van-winkle-23yr", name: "Pappy Van Winkle 23yr",
    inner: rocksGlass("#7a3f12", true) },
  { id: "bev-09", file: "johnnie-walker-blue",   name: "Johnnie Walker Blue",
    inner: rocksGlass("#a5731f", true) },
  { id: "bev-10", file: "caymus-cabernet",       name: "Caymus Cabernet",
    inner: wineGlass("#5e0f1c") },
  { id: "bev-11", file: "whispering-angel-rose", name: "Whispering Angel Rosé",
    inner: wineGlass("#e1a4ab") },
  { id: "bev-12", file: "modelo-especial",       name: "Modelo Especial",
    inner: beerBottle("#d9a431", "#caa84a") },
  { id: "bev-13", file: "blue-moon",             name: "Blue Moon",
    inner: beerBottle("#e8c25e", "#2451d6") },
  { id: "bev-14", file: "don-julio-1942",        name: "Don Julio 1942",
    inner: shotGlass("#c08a3a") },
  { id: "bev-15", file: "jameson-irish-whiskey", name: "Jameson Irish Whiskey",
    inner: shotGlass("#a5621f") },
  { id: "bev-16", file: "garden-lemonade",       name: "Garden Lemonade",
    inner: highballGlass("#e9d65a", "#d9c12f") },
  { id: "bev-17", file: "san-pellegrino",        name: "San Pellegrino",
    inner: sparklingBottle("#bfe0ea") },
  { id: "bev-18", file: "seedlip-spice-94",      name: "Seedlip Spice 94",
    inner: rocksGlass("#7a5a22", true) },
  { id: "bev-19", file: "jack-and-coke",         name: "Jack & Coke",
    inner: highballGlass("#3a2412", "#8fb83a") },
  { id: "bev-20", file: "rum-punch",             name: "Rum Punch",
    inner: highballGlass("#d9622f", "#e9c25a") },
  { id: "bev-21", file: "white-russian",         name: "White Russian",
    inner: rocksGlass("#d8c39a", true) },
  { id: "bev-22", file: "spicy-martini",         name: "Spicy Martini",
    inner: martiniGlass("#9fb83a", citrusWheel(380, 268, "#7a9c2a")) },
  { id: "bev-MQPY4GLG-OLT2", file: "corona",      name: "Corona",
    inner: beerBottle("#e3c878", "#e9c25a") + limeOnNeck(372, 230) },
  { id: "bev-MQPY62Q2-XKIS", file: "diet-coke",   name: "Diet Coke",
    inner: sodaCan("DIET") },
];

for (const b of beverages) {
  const svg = card(
    `${b.name} — festive 4th of July styled beverage card`,
    `Stylized illustration of ${b.name}, lit by a warm pale-gold spotlight behind the glass fading into red and blue glow accents at the corners, against a deep navy background, framed by a red-white-blue gradient border.`,
    b.inner,
  );
  fs.writeFileSync(path.join(outDir, `${b.file}.svg`), svg, "utf8");
}

console.log(`Generated ${beverages.length} files in ${outDir}`);
