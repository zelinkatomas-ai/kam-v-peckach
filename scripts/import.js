// Spojí všechny zdroje do data/podniky.json:
//   data/zdroj-pecky-cz.json  (katalog firem starého webu města, scripts/crawl-pecky.js)
//   data/zdroj-firmy-cz.json  (Firmy.cz, scripts/crawl-firmy.js)
//   data/rucni.json           (ručně přidané záznamy)
//   data/upravy.json          (ruční opravy podle id, _kategorie = pořadí kategorií)
// Duplicity mezi zdroji se slučují (podle telefonu, webu, názvu+adresy). Výstup je deterministický,
// takže import lze kdykoli spustit znovu a ruční úpravy zůstanou.
//
// Použití:  node scripts/import.js
const fs = require("fs");
const path = require("path");
const DATA = path.join(__dirname, "..", "data");
const read = f => fs.existsSync(path.join(DATA, f)) ? JSON.parse(fs.readFileSync(path.join(DATA, f), "utf8")) : null;
const TODAY = new Date().toISOString().slice(0, 10);

const upravy = read("upravy.json") || {};
const rucni = (read("rucni.json") || { podniky: [] }).podniky;
const rawPecky = read("zdroj-pecky-cz.json");
const rawFirmy = read("zdroj-firmy-cz.json");
const prev = read("podniky.json") || {};

// ---------- pomocné funkce ----------
const norm = s => (s || "").toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
function cleanAddress(a) {
  if (!a) return { adresa: "", psc: "" };
  let s = a.replace(/\s+/g, " ").trim();
  s = s.replace(/([^\d\s.,])(\d)/g, "$1 $2");
  s = s.replace(/([a-záčďéěíňóřšťúůýž])\.(\d)/gi, "$1. $2");
  s = s.replace(/\s+,/g, ",").replace(/,\s*/g, ", ");
  let psc = "";
  s = s.replace(/\b(\d{3})\s?(\d{2})\b/g, (_, x, y) => { psc = x + " " + y; return ""; });
  s = s.replace(/\s+,/g, ",").replace(/,\s*,/g, ",").replace(/\s{2,}/g, " ").replace(/,\s*$/, "").trim();
  const village = /^(\d+),\s*([^,]+)$/.test(s);
  s = s.replace(/^(\d+),\s*([^,]+)$/, "$2 $1");
  if (village) return { adresa: s, psc: "" };
  const m = s.match(/^(Pečky),\s*(.+)$/i); if (m) s = m[2] + ", " + m[1];
  if (!/,/.test(s) && !/pe[čc]ky|chvalovice/i.test(s)) s += ", Pečky";
  return { adresa: s, psc };
}
function phones(t) {
  if (!t) return [];
  const list = Array.isArray(t) ? t : t.split(/[,;\/]|\s{2,}|\bnebo\b/i);
  return [...new Set(list.map(x => x.replace(/[^\d+]/g, "")).filter(x => x.replace(/\D/g, "").length >= 9)
    .map(x => { x = x.replace(/^\+?420/, ""); return x.length === 9 ? x.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3") : x; }))];
}
function web(w) {
  if (!w) return ""; w = w.trim(); if (!w) return "";
  w = w.replace(/^https?:\/\/(?=https?:\/\/)/i, "");
  if (/firmy\.cz\//.test(w)) return "";
  if (!/^https?:\/\//i.test(w)) w = "http://" + w;
  return w;
}
const host = w => { try { return new URL(w).hostname.replace(/^www\./, ""); } catch (e) { return ""; } };
function cleanDesc(d, name, address) {
  if (!d) return ""; d = d.replace(/\s+/g, " ").trim();
  if (norm(d) === norm(name) || norm(d) === norm(address)) return "";
  return d;
}
// "Mo,Tu,We,Th,Fr 9:00–18:00" / "Mo-Fr 8:00–12:00, 13:00–17:00" -> {po:[["9:00","18:00"]],...}
const DAY = { Mo: "po", Tu: "út", We: "st", Th: "čt", Fr: "pá", Sa: "so", Su: "ne" };
const ORDER = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
function parseOpening(list, notes) {
  if (!list || !list.length) return null;
  const h = {};
  for (const line of list) {
    const m = line.match(/^([A-Za-z,\- ]+?)\s+(.+)$/); if (!m) continue;
    const days = [];
    for (const part of m[1].split(",")) {
      const r = part.trim().split("-");
      if (r.length === 2) { const a = ORDER.indexOf(r[0]), b = ORDER.indexOf(r[1]); if (a >= 0 && b >= a) days.push(...ORDER.slice(a, b + 1)); }
      else if (ORDER.includes(r[0])) days.push(r[0]);
    }
    const spans = [...m[2].matchAll(/(\d{1,2}[:.]\d{2})\s*[–-]\s*(\d{1,2}[:.]\d{2})/g)].map(x => [x[1].replace(".", ":"), x[2].replace(".", ":")]);
    if (/nonstop|24/i.test(m[2]) && !spans.length) spans.push(["0:00", "24:00"]);
    for (const d of days) h[DAY[d]] = spans;
  }
  if (!Object.keys(h).length) return null;
  for (const d of Object.values(DAY)) if (h[d] === undefined) h[d] = [];   // den bez údaje = zavřeno
  if (notes && notes.length) h.pozn = [...new Set(notes)].join(" ");
  return h;
}

// ---------- mapování kategorií Firmy.cz ----------
// [regex na štítek, kategorie, podkategorie]; první shoda vyhrává
const MAP = [
  [/výdejní boxy|poštovní|kurýrní/i, "Služby", "Zásilky, pošta a boxy"],
  [/bankomat|^banky/i, "Služby", "Banky a bankomaty"],
  [/sázení/i, "Služby", "Sázková kancelář"],
  [/pizzerie/i, "Restaurace a občerstvení", "Bistro a rozvoz"],
  [/rychlá občerstvení|snack/i, "Restaurace a občerstvení", "Bistro a rozvoz"],
  [/kavárn|cukrárn/i, "Restaurace a občerstvení", "Kavárna a cukrárna"],
  [/hospody|hostince|pivnice/i, "Restaurace a občerstvení", "Hospoda a bar"],
  [/restaurace/i, "Restaurace a občerstvení", "Restaurace"],
  [/ubytování|penzion|hotel/i, "Restaurace a občerstvení", "Ubytování"],
  [/vinotéky/i, "Obchody", "Vinotéka a nápoje"],
  [/praktičtí lékaři pro děti/i, "Zdravotnictví", "Dětský lékař"],
  [/praktičtí lékaři/i, "Zdravotnictví", "Praktický lékař pro dospělé"],
  [/stomatolog|zubní/i, "Zdravotnictví", "Zubní lékař"],
  [/lékárn/i, "Zdravotnictví", "Lékárna"],
  [/fyzioterap|rehabilit/i, "Zdravotnictví", "Rehabilitace a fyzioterapie"],
  [/logoped/i, "Zdravotnictví", "Logopedie"],
  [/gynekolog/i, "Zdravotnictví", "Gynekologie"],
  [/psycholog/i, "Zdravotnictví", "Psycholog a poradna"],
  [/inkontinence|zdravotnick/i, "Zdravotnictví", "Zdravotnické potřeby"],
  [/veterin/i, "Zdravotnictví", "Veterinář"],
  [/oční optik/i, "Zdravotnictví", "Optika"],
  [/pečovatelsk|domov pro seniory/i, "Město a instituce", "Sociální služby"],
  [/kadeřnic|kosmeti|pedikúr|manikúr|nehty|nehtov/i, "Služby", "Kadeřnictví, kosmetika a nehty"],
  [/masáže|wellness|solári/i, "Služby", "Masáže a wellness"],
  [/instalatér|topenář|plyn|elektrorevize|elektroinstal|klimatiza/i, "Služby", "Řemesla: voda, topení, elektro"],
  [/tesař|pokrývač|klempíř|truhlář|stolař|zámečnic|malířství|tapetář|vrat a bran|montáže oken|plastových oken|rekonstrukce|stavební firmy|lešení|jeřábnick|kamenictví|zednic|podlah|žaluzií/i, "Služby", "Řemesla a stavebnictví"],
  [/projektové|inženýrské|znalci|geodet/i, "Služby", "Stavebnictví, projekce a geodézie"],
  [/účetnictv|daňov|účetní|finanční poraden|hypoték|pojišťovac|právní|advokát/i, "Služby", "Právo, daně a účetnictví"],
  [/realit|developer/i, "Služby", "Reality"],
  [/krejčov|čistírn|prádeln|peří|výšivek|potisků/i, "Služby", "Krejčovství, čistírna a textil"],
  [/autoškol/i, "Auto-moto", "Autoškola"],
  [/autoservis|pneuservis|automyč|čištění vozidel|autopůjčov|servisy lodí/i, "Auto-moto", "Autoservis a pneuservis"],
  [/čerpací|nabíjecí/i, "Auto-moto", "Čerpací a nabíjecí stanice"],
  [/karavan|osobních automobil|náhradních dílů|autodoplň/i, "Auto-moto", "Prodej aut, karavanů a dílů"],
  [/stěhování|doprava|kamionov|nákladní|autobusov|taxi/i, "Služby", "Doprava a stěhování"],
  [/webdesign|výpočetní|notebook|hardwar|bezdrátov|internet|software/i, "Služby", "Počítače, internet a IT"],
  [/fotograf/i, "Služby", "Fotografické služby"],
  [/úklid/i, "Služby", "Úklid"],
  [/půjčovn/i, "Služby", "Půjčovna"],
  [/kurzy|výuka|jazykov|doučov/i, "Služby", "Kurzy a vzdělávání"],
  [/potravin|smíšeného|supermarket|lahůdek/i, "Obchody", "Potraviny a supermarkety"],
  [/masných|řeznic|ryb a rybích/i, "Obchody", "Řeznictví a ryby"],
  [/zdravé výživy|potravinových doplňků/i, "Obchody", "Zdravá výživa"],
  [/drogeri|dekorativní kosmetiky/i, "Obchody", "Drogerie"],
  [/květin/i, "Obchody", "Květinářství"],
  [/cyklist/i, "Obchody", "Jízdní kola"],
  [/chovatelsk|zemědělské techniky|krmiv/i, "Obchody", "Zemědělství a chovatelské potřeby"],
  [/trafik|tiskovin/i, "Obchody", "Trafika a tisk"],
  [/knihkupec|papírnic/i, "Obchody", "Knihy a papírnictví"],
  [/železářstv|stavebnin|hobby/i, "Obchody", "Železářství a stavebniny"],
  [/oblečení|prádla|second hand|obuv|textil/i, "Obchody", "Oděvy a domácnost"],
  [/elektrospotřebič|spotřební elektroni|elektro, mobily/i, "Obchody", "Elektro"],
  [/krbů|komínů|kamen/i, "Obchody", "Krby, komíny a topení"],
  [/regálů|kuchyňského|nábytk|kancelářsk/i, "Obchody", "Kancelář a nábytek"],
  [/modelářsk|společenských her|hraček|hobby/i, "Obchody", "Hračky a hry"],
  [/železniční modelářství/i, "Obchody", "Hračky a hry"],
  [/hasicích/i, "Obchody", "Hasicí technika"],
  [/^obchody a obchůdky/i, "Obchody", "Ostatní"],
  [/městské úřady|odbory|policie|hasičsk|správa a údržba|sběrné dvory/i, "Město a instituce", "Úřady a služby města"],
  [/mateřské školy|základní školy|základní umělecké|praktické a speciální/i, "Město a instituce", "Školy a vzdělávání"],
  [/knihovn|divadl|kulturní/i, "Město a instituce", "Kultura a knihovna"],
  [/církevní/i, "Město a instituce", "Církve"],
  [/mateřská centra|pro děti a mládež/i, "Sport a volný čas", "Děti a rodina"],
  [/sportovní kluby|fotbalov|tenisov|minigolf|pilates|tělovýchovn|fitness/i, "Sport a volný čas", "Sportoviště a kluby"],
  [/neziskov|sdružení|spolky|svazy|organizace pro|zábavní/i, "Sport a volný čas", "Spolky a kluby"],
  [/^výroba|kovoobráb|kalibrace|lesnictv|zpracování|sběrny|nakladatel|výtahů|měřicí|armatur|forem|obalů|elektrosoučást|kovovýrob|strojíren|velkoobchod/i, "Firmy a výroba", "Výroba a průmysl"],
  [/on-line prodej/i, "Firmy a výroba", "E-shopy"],
];
function mapTag(tag) { for (const [re, k, p] of MAP) if (re.test(tag)) return [k, p]; return null; }

// ---------- 1) katalog města ----------
const records = [];
if (rawPecky) for (const e of Object.values(rawPecky.entries)) {
  const d = e.detail || {};
  const { adresa, psc } = cleanAddress(d.address);
  records.push({
    id: "pecky-" + e.id,
    nazev: (d.name || e.name || "").replace(/\s+/g, " ").trim(),
    kategorie: e.category, podkategorie: [],
    adresa, psc, telefony: phones(d.tel), email: (d.email || "").trim(), web: web(d.web),
    kontakt: (d.osoba || "").trim(), ico: (d.ico || "").replace(/\D/g, ""),
    popis: cleanDesc(d.desc, d.name, d.address), otevreno: null, gps: null,
    zdroj: "katalog firem pecky.cz", zkontrolovano: null
  });
}
// ---------- 2) ruční záznamy ----------
for (const p of rucni) records.push({ gps: null, ...p });

// ---------- 3) Firmy.cz ----------
const unmapped = {};
const firmy = [];
if (rawFirmy) for (const e of rawFirmy.entries) {
  const ld = (e.detail && e.detail.ld) || e.ld || {};
  const addr = ld.address || {};
  const nazev = (e.name || ld.name || "").replace(/\s+/g, " ").trim();
  if (!nazev) continue;
  const street = addr.streetAddress || "";
  const loc = addr.addressLocality || "Pečky";
  const { adresa, psc } = cleanAddress(street ? `${street}, ${loc}` : loc);
  let kategorie = null, podkategorie = [];
  for (const t of e.tags) { const m = mapTag(t); if (m) { kategorie = kategorie || m[0]; if (!podkategorie.includes(m[1])) podkategorie.push(m[1]); } else unmapped[t] = (unmapped[t] || 0) + 1; }
  if (!kategorie) { kategorie = "Firmy a výroba"; podkategorie = ["Ostatní"]; }
  const det = e.detail || {};
  firmy.push({
    id: "firmy-" + e.id, nazev, kategorie, podkategorie, adresa, psc: psc || (addr.postalCode || "").replace(/(\d{3})(\d{2})/, "$1 $2"),
    telefony: phones([...(det.phones || []), ld.telephone || ""]),
    email: (det.emails || [])[0] || "", web: web(det.web || ""),
    kontakt: "", ico: "", popis: cleanDesc(e.desc || ld.description, nazev, adresa),
    otevreno: parseOpening(ld.openingHours, det.hoursNotes),
    gps: ld.geo ? [+(+ld.geo.latitude).toFixed(6), +(+ld.geo.longitude).toFixed(6)] : null,
    firmyTagy: e.tags, firmyUrl: e.url,
    zdroj: "Firmy.cz", zkontrolovano: TODAY
  });
}

// ---------- 4) sloučení duplicit ----------
const STOP = /^(ing|mgr|mudr|judr|paeddr|mvdr|bc|spol|the|pecky|pecek|peckach|restaurace|hostinec|hospoda|hospudka|obchod|prodej|servis|sluzby|firma|centrum|mesta|mesto|ucetnictvi|kadernictvi|bar|klub)$/;
const words = s => norm(s).split(" ").filter(w => w.length > 2 && !STOP.test(w));
function keys(r) {
  const k = [];
  for (const t of r.telefony || []) k.push("tel:" + t.replace(/\D/g, ""));
  if (r.web && host(r.web) && !/facebook|seznam\.cz|centrum\.cz|webnode|fler\.cz|eatbu/i.test(r.web)) k.push("web:" + host(r.web));
  if (r.email && !/seznam|centrum|gmail|quick|tiscali|raz-dva/i.test(r.email)) k.push("mail:" + r.email.toLowerCase());
  const nw = words(r.nazev).slice(0, 2).sort(); if (!nw.length) nw.push(norm(r.nazev));
  k.push("nazev:" + nw[0] + "|" + norm(r.adresa).split(" ").slice(0, 2).join(" "));   // 1 významné slovo + ulice
  k.push("nazevonly:" + nw.join(" "));   // použije se jen, když jedna ze stran nemá ulici (jen "Pečky")
  return k;
}
function merge(base, extra) {
  for (const f of ["email", "web", "kontakt", "ico", "popis", "psc"]) if (!base[f] && extra[f]) base[f] = extra[f];
  base.telefony = [...new Set([...(base.telefony || []), ...(extra.telefony || [])])];
  if (!base.otevreno && extra.otevreno) base.otevreno = extra.otevreno;
  if (!base.gps && extra.gps) base.gps = extra.gps;
  if (!base.adresa && extra.adresa) base.adresa = extra.adresa;
  for (const p of extra.podkategorie || []) if (!base.podkategorie.includes(p)) base.podkategorie.push(p);
  if (extra.firmyUrl) base.firmyUrl = extra.firmyUrl;
  if (extra.zkontrolovano && (!base.zkontrolovano || extra.zkontrolovano > base.zkontrolovano)) base.zkontrolovano = extra.zkontrolovano;
  if (!base.zdroj.includes(extra.zdroj)) base.zdroj += "; " + extra.zdroj;
  (base.slouceno = base.slouceno || []).push(extra.id);
}
const index = new Map();
const final = [];
const similar = (a, b) => { const wa = words(a), wb = new Set(words(b)); return wa.some(w => wb.has(w)) || norm(a).includes(norm(b)) || norm(b).includes(norm(a)); };
function add(r) {
  const ks = keys(r);
  // shoda názvu+adresy stačí; jinak je třeba shoda telefonu/webu/e-mailu A zároveň podobný název
  // (sdílený telefon mívá třeba fotbalový klub a hospoda na hřišti)
  let hit = null;
  const noStreet = a => !/\d/.test(a || "");
  const byName = index.get(ks.find(k => k.startsWith("nazev:")));
  const byNameOnly = index.get(ks.find(k => k.startsWith("nazevonly:")));
  if (byName) hit = byName;
  else if (byNameOnly && (noStreet(r.adresa) || noStreet(byNameOnly.adresa))) hit = byNameOnly;
  else {
    const cands = ks.filter(k => !k.startsWith("nazev")).map(k => index.get(k)).filter(Boolean);
    hit = cands.find(c => similar(c.nazev, r.nazev)) || null;
  }
  if (hit) { merge(hit, r); for (const k of ks) index.set(k, hit); return; }
  final.push(r); for (const k of ks) index.set(k, r);
}
for (const r of records) add(r);       // město + ruční mají přednost (ručně tříděné kategorie)
for (const r of firmy) add(r);

// ---------- 5) ruční úpravy ----------
const podniky = [];
for (const r of final) {
  const u = upravy[r.id];
  if (u) { const c = { ...u }; for (const k of Object.keys(c)) if (k.startsWith("_")) delete c[k]; Object.assign(r, c); }
  if (r.skryt) continue;
  if (!r.podkategorie || !r.podkategorie.length) r.podkategorie = ["Ostatní"];
  podniky.push(r);
}
podniky.sort((a, b) => a.nazev.localeCompare(b.nazev, "cs"));
const kategorie = (upravy._kategorie || []).slice();
for (const p of podniky) if (!kategorie.includes(p.kategorie)) kategorie.push(p.kategorie);

fs.writeFileSync(path.join(DATA, "podniky.json"), JSON.stringify({ aktualizovano: TODAY, kontaktEmail: prev.kontaktEmail || "", formEndpoint: prev.formEndpoint || "", kategorie, podniky }, null, 1), "utf8");
const c = {}; podniky.forEach(p => c[p.kategorie] = (c[p.kategorie] || 0) + 1);
console.log(`zapsáno ${podniky.length} záznamů (sloučeno ${final.filter(f => f.slouceno).length} duplicit, s otevírací dobou ${podniky.filter(p => p.otevreno).length}, s GPS ${podniky.filter(p => p.gps).length})`);
console.log(c);
if (Object.keys(unmapped).length) console.log("Nezmapované štítky Firmy.cz:", Object.entries(unmapped).map(x => `${x[0]} (${x[1]})`).join(", "));
