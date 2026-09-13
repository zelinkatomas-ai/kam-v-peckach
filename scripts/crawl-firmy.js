// Stáhne výpis Firmy.cz pro Pečky (výpis + detaily) do JSON.
// Použití: node scripts/crawl-firmy.js data/zdroj-firmy-cz.json
// Je schválně pomalý (0,6 s mezi požadavky), 278 firem trvá zhruba 4 minuty.
const fs = require("fs");
const LIST = "https://www.firmy.cz/kraj-stredocesky/kolin/3458-pecky";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0 Safari/537.36";
const out = process.argv[2];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const dec = s => (s || "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n)).replace(/\s+/g, " ").trim();
const strip = h => dec((h || "").replace(/<[^>]+>/g, " "));
let n = 0;
async function get(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "cs" } }); n++;
      if (r.ok) { await sleep(600); return await r.text(); }
      if (r.status === 404) return "";
    } catch (e) { }
    await sleep(3000);
  }
  throw new Error("fail " + url);
}
function ldjson(html) {
  const out = [];
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g; let m;
  while ((m = re.exec(html))) { try { out.push(JSON.parse(m[1])); } catch (e) { } }
  return out;
}
function parseList(html) {
  const items = [];
  const parts = html.split('<article class="premiseBox').slice(1);
  for (const p of parts) {
    const url = (p.match(/href="(https:\/\/www\.firmy\.cz\/detail\/(\d+)[^"]*)"/) || [])[1];
    const id = (p.match(/\/detail\/(\d+)-/) || [])[1];
    if (!id) continue;
    const name = dec((p.match(/<h3 class="h3 title"[^>]*>([^<]*)<\/h3>/) || [])[1]);
    const tags = [...p.matchAll(/<ul class="tags">([\s\S]*?)<\/ul>/g)].flatMap(m => [...m[1].matchAll(/<li>([^<]*)<\/li>/g)].map(x => dec(x[1])));
    const desc = strip((p.match(/<div class="description">([\s\S]*?)<\/div>/) || [])[1]);
    const ld = ldjson(p)[0] || {};
    items.push({ id: +id, url, name, tags, desc, ld });
  }
  return items;
}
function parseDetail(html) {
  const ld = ldjson(html).find(x => x["@type"] && x["@type"] !== "BreadcrumbList") || {};
  const category = dec((html.match(/<h1[^>]*>[\s\S]*?<\/h1>\s*<[^>]*>([^<]{3,80})</) || [])[1]);
  const phones = [...html.matchAll(/<span data-dot="origin-phone-number">([^<]*)<\/span>/g)].map(m => dec(m[1]));
  const emails = [...html.matchAll(/href="mailto:([^"?]*)/g)].map(m => dec(m[1]));
  const webs = [...html.matchAll(/class="value detailWebUrl[^"]*"[\s\S]*?href="([^"]*)"/g)].map(m => m[1]);
  const web = ld.url || webs[0] || "";
  const hoursNotes = [...html.matchAll(/<div class="weekCol notes subtle[^"]*">([\s\S]*?)<\/div>/g)].map(m => strip(m[1])).filter(Boolean);
  const cats = [...html.matchAll(/<a[^>]*class="[^"]*categoryLink[^"]*"[^>]*>([^<]*)<\/a>/g)].map(m => dec(m[1]));
  return { ld, category, phones, emails, web, hoursNotes, cats };
}
// Volitelný rozsah stran: node scripts/crawl-firmy.js out.json 13-20  (výsledek se přimíchá k existujícímu souboru)
const range = (process.argv[3] || "1-40").split("-").map(Number);
(async () => {
  const items = new Map();
  if (fs.existsSync(out)) for (const it of JSON.parse(fs.readFileSync(out, "utf8")).entries) items.set(it.id, it);
  let total = Infinity;
  for (let page = range[0]; page <= range[1]; page++) {
    let html = await get(page === 1 ? LIST : `${LIST}?page=${page}`);
    let list = parseList(html);
    const tm = html.match(/z celkem (\d+)/); if (tm) total = +tm[1];
    if (!list.length && (page - 1) * 14 < total) { await sleep(5000); html = await get(`${LIST}?page=${page}`); list = parseList(html); }
    if (!list.length) break;
    for (const it of list) if (!items.has(it.id)) items.set(it.id, it);
    console.log(`strana ${page}: ${list.length} firem, celkem ${items.size} z ${total}`);
    if (page * 14 >= total) break;
  }
  let i = 0;
  for (const it of items.values()) {
    if (it.detail) { i++; continue; }
    try {
      const html = await get(it.url);
      it.detail = html ? parseDetail(html) : null;
    } catch (e) { it.detail = null; it.error = String(e); }
    if (++i % 20 === 0) console.log(`detaily ${i}/${items.size}`);
  }
  fs.writeFileSync(out, JSON.stringify({ fetched: new Date().toISOString(), source: LIST, entries: [...items.values()] }, null, 1), "utf8");
  console.log(`hotovo: ${items.size} firem, ${n} požadavků -> ${out}`);
})();
