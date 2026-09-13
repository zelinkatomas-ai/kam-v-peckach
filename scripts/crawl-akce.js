// Stáhne akce z kalendáře Pečeckého regionu a z aktualit města Pečky do data/akce.json.
// Spouští se denně (GitHub Actions, .github/workflows/akce.yml) nebo ručně:
//   node scripts/crawl-akce.js
// Dříve stažené akce, které ještě neskončily, zůstávají v souboru i když už na zdroji nejsou.
const fs = require("fs");
const path = require("path");
const OUT = path.join(__dirname, "..", "data", "akce.json");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0 Safari/537.36";
const REGION = "https://www.pececkyregion.cz";
const MESTO = "https://pecky.cz";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const dec = s => (s || "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n)).replace(/\s+/g, " ").trim();
const strip = h => dec((h || "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|h\d)>/gi, "\n").replace(/<[^>]+>/g, " ")).trim();
const paras = h => (h || "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|h\d)>/gi, "\n").replace(/<[^>]+>/g, " ").split("\n").map(x => dec(x)).filter(Boolean);
let n = 0;
async function get(url) {
  for (let i = 0; i < 3; i++) {
    try { const r = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "cs" } }); n++; if (r.ok) { await sleep(400); return (await r.text()).replace(/\r?\n/g, " "); } if (r.status === 404) return ""; } catch (e) { }
    await sleep(2000);
  }
  return "";
}
// "13. 9. 2026 17:00" / "13. 9. 2026" -> "2026-09-13T17:00" / "2026-09-13"
function czDate(s) {
  const m = (s || "").match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})(?:\s+(\d{1,2})[:.](\d{2}))?/);
  if (!m) return null;
  const d = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return m[4] ? `${d}T${m[4].padStart(2, "0")}:${m[5]}` : d;
}
const obecZ = venue => { const p = (venue || "").split(",").map(x => x.trim()); return p.length > 1 ? p[p.length - 1] : ""; };

// ---------- Pečecký region ----------
async function region() {
  const out = [];
  for (let page = 1; page <= 20; page++) {
    const html = await get(`${REGION}/aktuality/kalendar-akci/${page > 1 ? "?page=" + page : ""}`);
    const items = html.split('<div class="event-action__item').slice(1);
    if (!items.length) break;
    let nove = 0;
    for (const it of items) {
      const id = (it.match(/id="event-(\d+)"/) || [])[1];
      const href = (it.match(/<a class="event-action__link[^"]*" href="([^"]*)"/) || [])[1];
      if (!id || !href || out.some(x => x.id === "region-" + id)) continue;
      nove++;
      const g = re => dec((it.match(re) || [])[1]);
      out.push({
        id: "region-" + id, url: REGION + href,
        nazev: g(/<h3 class="event-action__heading">([^<]*)<\/h3>/),
        zacatekText: g(/event-action__row-body--date-start">([^<]*)</),
        misto: g(/event-action__row-body--venue">([^<]*)</),
        kategorie: [...it.matchAll(/<span class="event-action__label">([^<]*)<\/span>/g)].map(m => dec(m[1])),
        obrazek: (it.match(/<img class="event-action__img" src="([^"]*)"/) || [])[1] || ""
      });
    }
    console.log(`region strana ${page}: ${items.length} akcí, ${nove} nových`);
    if (!nove) break;   // stránkování za koncem vrací poslední stranu znovu
  }
  for (const e of out) {
    const html = await get(e.url);
    const body = (html.match(/<div class="module_content event-detail[\s\S]*?<div class="event-detail__content">([\s\S]*?)(Podrobnosti o vložení záznamu|<footer|$)/) || [])[1] || "";
    const gcal = (html.match(/href="(https:\/\/(?:www\.)?google\.com\/calendar\/[^"]*)"/) || [])[1] || "";
    const dates = (gcal.match(/dates=(\d{8}T\d{6})\/(\d{8}T\d{6})/) || []);
    const iso = s => s ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(9, 11)}:${s.slice(11, 13)}` : null;
    const konecText = (body.match(/Konec[^<]*<\/span>[\s\S]*?event-action__row-body[^>]*>([^<]*)</) || [])[1];
    const lead = body.split(/Další informace/)[1] || body;
    const ps = paras(lead).filter(p => !/^(Přidat do Google kalendáře|Zdroj:|Vhodné pro|Kategorie|Místo konání|Začátek|Konec|Domácí zápasy)/.test(p) && p.length > 15);
    const zdrojObec = (html.match(/event-action-data__source-link"[^>]*>\s*([^<]{2,40}?)\s*</) || [])[1];
    e.zacatek = czDate(e.zacatekText) || iso(dates[1]);
    e.konec = czDate(konecText) || iso(dates[2]) || null;
    if (e.konec && e.zacatek && e.konec <= e.zacatek) e.konec = null;
    e.obec = (obecZ(e.misto) || dec(zdrojObec || "")).replace(/^(Obec|Město|Městys|OÚ|MÚ)\s+/i, "");
    if (e.obec && e.misto.endsWith(", " + e.obec)) e.misto = e.misto.slice(0, -(e.obec.length + 2));
    e.popis = ps.slice(0, 3).join(" ").slice(0, 600);
    e.vhodne = [...body.matchAll(/event-action__label[^>]*>([^<]*)</g)].map(m => dec(m[1])).filter(x => !e.kategorie.includes(x));
    e.zdroj = "Pečecký region";
    delete e.zacatekText;
  }
  return out.filter(e => e.zacatek);
}

// ---------- aktuality města ----------
async function mesto() {
  const home = await get(MESTO + "/");
  const links = [...new Set([...home.matchAll(/href="(\/default\/report\/(\d+)_[^"]*)"/g)].map(m => m[1]))];
  const out = [];
  for (const href of links) {
    const html = await get(MESTO + href);
    if (!/Začátek události/.test(html)) continue;
    const id = href.match(/report\/(\d+)_/)[1];
    const g = re => dec((html.match(re) || [])[1]);
    const detail = ((html.match(/<section class="report-detail">([\s\S]*?)<\/section>/) || [])[1] || "").split(/>\s*Přílohy\s*</)[0].replace(/<[^>]*$/, "");
    const text = paras(detail).filter(p => !/^(Zveřejněno|Platí pro|Událost$|Začátek události|Konec události|Přílohy|Zobrazit|Stáhnout|\/)/.test(p) && !/\.(png|jpg|jpeg|pdf)$/i.test(p));
    const img = (detail.match(/href="([^"]*\.(?:png|jpe?g))"/i) || [])[1] || "";
    out.push({
      id: "mesto-" + id, url: MESTO + href,
      nazev: g(/<h1 class="title-subpages">([^<]*)<\/h1>/),
      zacatek: czDate(g(/Začátek události:\s*([^<]*)</)),
      konec: czDate(g(/Konec události:\s*([^<]*)</)),
      misto: (g(/Platí pro:\s*([^<]*)</) || "").replace(/^Celé město$/, "Pečky"), obec: "Pečky",
      kategorie: [], popis: text.join(" ").slice(0, 600),
      obrazek: img ? (img.startsWith("http") ? img : MESTO + img) : "",
      zdroj: "Město Pečky", zverejneno: czDate(g(/Zveřejněno:\s*([^<]*)</))
    });
  }
  console.log(`město: ${links.length} aktualit, ${out.length} s událostí`);
  return out.filter(e => e.zacatek);
}

(async () => {
  const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")).akce : [];
  const fresh = [...await region(), ...await mesto()];
  const byId = new Map(prev.map(e => [e.id, e]));
  for (const e of fresh) byId.set(e.id, { ...(byId.get(e.id) || {}), ...e, videno: new Date().toISOString().slice(0, 10) });
  const limit = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
  const akce = [...byId.values()].filter(e => (e.konec || e.zacatek).slice(0, 10) >= limit).sort((a, b) => a.zacatek.localeCompare(b.zacatek));
  fs.writeFileSync(OUT, JSON.stringify({ aktualizovano: new Date().toISOString().slice(0, 16).replace("T", " "), akce }, null, 1), "utf8");
  console.log(`hotovo: ${akce.length} akcí (${fresh.length} nově staženo, ${n} požadavků) -> ${OUT}`);
})().catch(e => { console.error(e); process.exit(1); });
