// Stáhne z registru ARES všechny ekonomické subjekty se sídlem v Pečkách (včetně Velkých Chvalovic).
// Slouží jako kontrolní seznam "kdo tu je registrovaný" – nejsou v něm telefony ani otevírací doby.
// Použití: node scripts/crawl-ares.js data/zdroj-ares.json
const fs = require("fs");
const API = "https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty";
const out = process.argv[2];
const KOD_OBCE = 537641; // Pečky
async function post(body) {
  const r = await fetch(API + "/vyhledat", { method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json(); if (!r.ok) throw new Error(JSON.stringify(j)); return j;
}
async function part(icoSample) {
  const r = await fetch(`${API}/${icoSample}`, { headers: { Accept: "application/json" } });
  const j = await r.json(); return { kod: j.sidlo.kodCastiObce, nazev: j.sidlo.nazevCastiObce };
}
(async () => {
  const parts = [await part("00239607") /* Město Pečky */, await part("25104870") /* BARTÁK MF, Velké Chvalovice */];
  const all = [];
  for (const p of parts) {
    let start = 0, total = Infinity;
    while (start < total) {
      const j = await post({ sidlo: { kodObce: KOD_OBCE, kodCastiObce: p.kod }, pocet: 200, start });
      total = j.pocetCelkem;
      for (const e of j.ekonomickeSubjekty || []) all.push({
        ico: e.ico, nazev: e.obchodniJmeno, pravniForma: e.pravniForma, adresa: e.sidlo && e.sidlo.textovaAdresa, castObce: p.nazev,
        nace: e.czNace2008 || [], datumVzniku: e.datumVzniku || null, aktualizace: e.datumAktualizace
      });
      start += 200;
      console.log(`${p.nazev}: ${Math.min(start, total)}/${total}`);
      await new Promise(r => setTimeout(r, 400));
    }
  }
  fs.writeFileSync(out, JSON.stringify({ fetched: new Date().toISOString(), pocet: all.length, subjekty: all }, null, 1), "utf8");
  console.log(`hotovo: ${all.length} subjektů -> ${out}`);
})().catch(e => { console.error(e); process.exit(1); });
