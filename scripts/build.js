// Vygeneruje docs/data.js, docs/akce.js a docs/vylety.js z JSON v data/. Složka docs/ je celý veřejný web
// (prohlížeč nedovolí fetch() lokálního JSON souboru).
//
// Použití:  node scripts/build.js
const fs = require("fs");
const path = require("path");
const src = path.join(__dirname, "..", "data", "podniky.json");
const out = path.join(__dirname, "..", "docs", "data.js");
const data = JSON.parse(fs.readFileSync(src, "utf8"));
fs.writeFileSync(out, "// Generováno skriptem scripts/build.js z data/podniky.json – neupravovat ručně.\nwindow.PECKY_DATA = " + JSON.stringify(data) + ";\n", "utf8");
console.log(`data.js: ${data.podniky.length} záznamů, ${(fs.statSync(out).size / 1024).toFixed(0)} kB`);

// akce.js z data/akce.json (plní scripts/crawl-akce.js)
const akceSrc = path.join(__dirname, "..", "data", "akce.json");
const akceOut = path.join(__dirname, "..", "docs", "akce.js");
const akce = fs.existsSync(akceSrc) ? JSON.parse(fs.readFileSync(akceSrc, "utf8")) : { aktualizovano: "", akce: [] };
fs.writeFileSync(akceOut, "// Generováno skriptem scripts/build.js z data/akce.json – neupravovat ručně.\nwindow.PECKY_AKCE = " + JSON.stringify(akce) + ";\n", "utf8");
console.log(`akce.js: ${akce.akce.length} akcí`);

// vylety.js z data/vylety.json (ručně udržovaný seznam míst)
const vylSrc = path.join(__dirname, "..", "data", "vylety.json");
const vylOut = path.join(__dirname, "..", "docs", "vylety.js");
const vyl = fs.existsSync(vylSrc) ? JSON.parse(fs.readFileSync(vylSrc, "utf8")) : { mista: [] };
fs.writeFileSync(vylOut, "// Generováno skriptem scripts/build.js z data/vylety.json – neupravovat ručně.\nwindow.PECKY_VYLETY = " + JSON.stringify(vyl) + ";\n", "utf8");
console.log(`vylety.js: ${vyl.mista.length} míst`);
