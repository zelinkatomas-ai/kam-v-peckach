// Statické podstránky pro vyhledávače: kategorie, podkategorie, podniky, výlety, akce, sitemap, robots.
// Hlavní aplikace (docs/index.html) je jedna stránka bez odkazů, které by roboti mohli procházet,
// proto se tu z dat generují obyčejné HTML stránky s vlastní adresou, titulkem a strukturovanými daty.
// Volá se ze scripts/build.js.
const fs = require("fs");
const path = require("path");

const DOCS = path.join(__dirname, "..", "docs");
const BASE = "https://kamvpeckach.cz";
const DAYS = ["po", "út", "st", "čt", "pá", "so", "ne"];
const DAY_NAME = { po: "Po", "út": "Út", st: "St", "čt": "Čt", "pá": "Pá", so: "So", ne: "Ne" };
const DAY_SCHEMA = { po: "Monday", "út": "Tuesday", st: "Wednesday", "čt": "Thursday", "pá": "Friday", so: "Saturday", ne: "Sunday" };

const slug = s => (s || "").toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const esc = s => (s || "").toString().replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const write = (rel, html) => { const f = path.join(DOCS, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, html, "utf8"); };
const clean = dir => { const f = path.join(DOCS, dir); if (fs.existsSync(f)) fs.rmSync(f, { recursive: true }); };

// Skloňování pro titulky: "Obchody v Pečkách", "Kadeřnictví v Pečkách"
const SEO_NAMES = {
  "Obchody": "Obchody", "Služby": "Služby a řemeslníci", "Restaurace a občerstvení": "Restaurace, hospody a občerstvení",
  "Auto-moto": "Autoservisy a auto-moto služby", "Zdravotnictví": "Lékaři, zubaři a lékárny", "Sport a volný čas": "Sport, spolky a volný čas",
  "Město a instituce": "Úřad, školy a instituce", "Firmy a výroba": "Firmy a výroba"
};

function hoursRows(h) {
  if (!h) return "";
  const rows = DAYS.filter(d => h[d] !== undefined).map(d => `<tr><th>${DAY_NAME[d]}</th><td>${h[d].length ? h[d].map(s => s.join("–")).join(", ") : "zavřeno"}</td></tr>`).join("");
  return rows ? `<table class="hours">${rows}</table>${h.pozn ? `<p class="muted">${esc(h.pozn)}</p>` : ""}` : "";
}
function hoursSchema(h) {
  if (!h) return undefined;
  const out = [];
  for (const d of DAYS) for (const [a, b] of (h[d] || [])) out.push({ "@type": "OpeningHoursSpecification", dayOfWeek: DAY_SCHEMA[d], opens: a.padStart(5, "0"), closes: b.padStart(5, "0") });
  return out.length ? out : undefined;
}
const mapy = p => `https://mapy.cz/zakladni?q=${encodeURIComponent((p.adresa || p.nazev) + (/pe[čc]ky/i.test(p.adresa || "") ? "" : ", Pečky"))}`;

const CSS = `
:root{--bg:#F2F4F3;--surface:#fff;--ink:#172226;--muted:#5A6B70;--line:#D5DCDA;--accent:#1E6E63;--accent-soft:#DDEDE9;--display:"Barlow Condensed","Arial Narrow",Arial,sans-serif;--body:"Source Sans 3","Segoe UI",Roboto,Arial,sans-serif}
@media (prefers-color-scheme:dark){:root{--bg:#121819;--surface:#1A2224;--ink:#E4EAE8;--muted:#93A3A7;--line:#2C383B;--accent:#5DBBA9;--accent-soft:#1F3634}}
*{box-sizing:border-box}html{color-scheme:light dark}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 var(--body)}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
.wrap{max-width:900px;margin:0 auto;padding:0 20px}
header{border-bottom:1px solid var(--line);background:var(--surface)}header .wrap{display:flex;justify-content:space-between;align-items:baseline;gap:16px;flex-wrap:wrap;padding:16px 20px}
.brand{font:700 26px/1 var(--display);text-transform:uppercase;color:var(--ink)}.brand span{color:var(--accent)}
nav.crumbs{font-size:14px;color:var(--muted);margin:18px 0 6px}nav.crumbs a{color:var(--muted)}
h1{font:700 34px/1.1 var(--display);margin:0 0 6px;text-wrap:balance}h2{font:600 22px/1.1 var(--display);text-transform:uppercase;letter-spacing:.04em;margin:28px 0 10px;padding-bottom:6px;border-bottom:2px solid var(--ink)}
.lead{color:var(--muted);max-width:70ch;margin:0 0 18px}
.list{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;margin:0;padding:0;list-style:none}
.card{background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:12px 14px}.card h3{margin:0 0 4px;font:600 19px/1.15 var(--display)}
.card .muted,.muted{color:var(--muted);font-size:14px}.card dl{margin:6px 0 0;font-size:15px}.card dd{margin:0}
dl.facts{display:grid;grid-template-columns:auto 1fr;gap:4px 14px;margin:14px 0}dl.facts dt{color:var(--muted);font-size:13px;text-transform:uppercase;letter-spacing:.05em;padding-top:3px}dl.facts dd{margin:0}
table.hours{border-collapse:collapse;font-variant-numeric:tabular-nums}table.hours th{text-align:left;padding:2px 12px 2px 0;font-weight:600}table.hours td{padding:2px 0;color:var(--muted)}
.btn{display:inline-block;border:1px solid var(--accent);color:var(--accent);border-radius:6px;padding:8px 14px;font:600 15px/1 var(--display);text-transform:uppercase;letter-spacing:.05em;margin:4px 8px 4px 0}
.btn.primary{background:var(--accent);color:#fff}
.links{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:15px}
footer{border-top:1px solid var(--line);color:var(--muted);font-size:14px;margin-top:40px}footer .wrap{padding:18px 20px 30px}
footer .cats{display:flex;flex-wrap:wrap;gap:6px 14px;margin:10px 0 0;padding:0;list-style:none}
`;

function page({ title, description, canonical, body, jsonld, crumbs }) {
  const crumbHtml = crumbs && crumbs.length ? `<nav class="crumbs" aria-label="Drobečková navigace">${crumbs.map(c => c.href ? `<a href="${c.href}">${esc(c.text)}</a>` : esc(c.text)).join(" › ")}</nav>` : "";
  return `<!doctype html>
<html lang="cs">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${canonical}"><meta property="og:type" content="website"><meta property="og:locale" content="cs_CZ">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Source+Sans+3:wght@400;600&display=swap">
<style>${CSS}</style>
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ""}
</head>
<body>
<header><div class="wrap"><a class="brand" href="/">Kam v <span>Pečkách</span></a><nav class="links"><a href="/">Podniky</a><a href="/?akce">Akce</a><a href="/?vylety">Výlety</a></nav></div></header>
<main class="wrap">${crumbHtml}${body}</main>
<footer><div class="wrap"><p>Kam v Pečkách je nezávislý katalog podniků, služeb, akcí a výletů pro město Pečky a okolí. Údaje pocházejí z webu města, Firmy.cz a od samotných podniků. Chybu nebo chybějící podnik nahlaste přímo <a href="/">v katalogu</a>.</p>%%CATS%%</div></footer>
</body>
</html>`;
}

function businessCard(p) {
  const tel = (p.telefony || []).map(t => `<a href="tel:${t.replace(/\s+/g, "")}">${esc(t)}</a>`).join(", ");
  const today = DAYS[(new Date().getDay() + 6) % 7];
  const hToday = p.otevreno && p.otevreno[today] !== undefined ? (p.otevreno[today].length ? "dnes " + p.otevreno[today].map(s => s.join("–")).join(", ") : "dnes zavřeno") : "";
  return `<li class="card"><h3><a href="/podnik/${p.slug}/">${esc(p.nazev)}</a></h3>
  <div class="muted">${esc((p.podkategorie || []).join(", "))}</div>
  ${p.adresa ? `<div>${esc(p.adresa)}</div>` : ""}
  ${tel ? `<div>${tel}</div>` : ""}
  ${hToday ? `<div class="muted">${esc(hToday)}</div>` : ""}</li>`;
}

function businessPage(p, cats) {
  const title = `${p.nazev} – Pečky | Kam v Pečkách`;
  const bits = [p.podkategorie.join(", "), p.adresa, p.telefony[0] && "tel. " + p.telefony[0], p.otevreno && "otevírací doba"].filter(Boolean);
  const description = `${p.nazev}: ${bits.join(", ")}. Kontakty a otevírací doba v katalogu Kam v Pečkách.`;
  const canonical = `${BASE}/podnik/${p.slug}/`;
  const catSlug = slug(p.kategorie);
  const facts = [
    p.adresa && `<dt>Adresa</dt><dd>${esc(p.adresa)}${p.psc ? ", " + esc(p.psc) : ""} · <a href="${mapy(p)}" rel="noopener" target="_blank">mapa</a></dd>`,
    p.telefony.length && `<dt>Telefon</dt><dd>${p.telefony.map(t => `<a href="tel:${t.replace(/\s+/g, "")}">${esc(t)}</a>`).join(", ")}</dd>`,
    p.email && `<dt>E-mail</dt><dd><a href="mailto:${esc(p.email)}">${esc(p.email)}</a></dd>`,
    p.web && `<dt>Web</dt><dd><a href="${esc(p.web)}" rel="noopener" target="_blank">${esc(p.web.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""))}</a></dd>`,
    p.kontakt && `<dt>Kontakt</dt><dd>${esc(p.kontakt)}</dd>`,
    p.ico && `<dt>IČ</dt><dd>${esc(p.ico)}</dd>`
  ].filter(Boolean).join("");
  const jsonld = {
    "@context": "https://schema.org", "@type": "LocalBusiness", name: p.nazev, url: canonical,
    description: p.popis || undefined, telephone: p.telefony[0] || undefined, email: p.email || undefined,
    address: p.adresa ? { "@type": "PostalAddress", streetAddress: p.adresa.split(",")[0], addressLocality: "Pečky", postalCode: (p.psc || "289 11").replace(" ", ""), addressCountry: "CZ" } : undefined,
    geo: p.gps ? { "@type": "GeoCoordinates", latitude: p.gps[0], longitude: p.gps[1] } : undefined,
    openingHoursSpecification: hoursSchema(p.otevreno), sameAs: [p.web, p.firmyUrl].filter(Boolean)
  };
  const body = `<h1>${esc(p.nazev)}</h1>
<p class="lead">${esc(p.podkategorie.join(", "))} · <a href="/${catSlug}/">${esc(SEO_NAMES[p.kategorie] || p.kategorie)} v Pečkách</a></p>
${p.popis ? `<p>${esc(p.popis)}</p>` : ""}
<dl class="facts">${facts}</dl>
${p.otevreno ? `<h2>Otevírací doba</h2>${hoursRows(p.otevreno)}` : `<p class="muted">Otevírací dobu zatím neznáme. Pokud ji víte, nahlaste ji v katalogu.</p>`}
<p><a class="btn primary" href="/#p${esc(p.id)}">Otevřít v katalogu</a><a class="btn" href="${mapy(p)}" rel="noopener" target="_blank">Ukázat na mapě</a></p>
<p class="muted">Zdroj: ${esc(p.zdroj || "")}${p.zkontrolovano ? `, ověřeno ${esc(p.zkontrolovano)}` : ""}.</p>`;
  return page({ title, description, canonical, body, jsonld, crumbs: [{ text: "Kam v Pečkách", href: "/" }, { text: SEO_NAMES[p.kategorie] || p.kategorie, href: `/${catSlug}/` }, { text: p.nazev }] });
}

function listPage({ heading, lead, canonical, items, crumbs, extra }) {
  const title = `${heading} | Kam v Pečkách`;
  const names = items.slice(0, 6).map(p => p.nazev).join(", ");
  const description = `${heading}: ${items.length} ${items.length === 1 ? "záznam" : items.length < 5 ? "záznamy" : "záznamů"} s kontakty a otevírací dobou. ${names}${items.length > 6 ? " a další" : ""}.`;
  const jsonld = { "@context": "https://schema.org", "@type": "ItemList", name: heading, url: canonical, numberOfItems: items.length, itemListElement: items.map((p, i) => ({ "@type": "ListItem", position: i + 1, name: p.nazev, url: `${BASE}/podnik/${p.slug}/` })) };
  const body = `<h1>${esc(heading)}</h1><p class="lead">${esc(lead)}</p>${extra || ""}<ul class="list">${items.map(businessCard).join("")}</ul>`;
  return page({ title, description, canonical, body, jsonld, crumbs });
}

module.exports = function buildPages(data, akce, vylety) {
  const podniky = data.podniky.filter(p => p.nazev);
  const used = new Set();
  for (const p of podniky) { let s = slug(p.nazev) || slug(p.id); while (used.has(s)) s += "-" + slug(p.id); used.add(s); p.slug = s; }
  const cats = data.kategorie.filter(k => podniky.some(p => p.kategorie === k));
  const catsFooter = `<ul class="cats">${cats.map(k => `<li><a href="/${slug(k)}/">${esc(SEO_NAMES[k] || k)}</a></li>`).join("")}<li><a href="/vylety/">Výlety</a></li><li><a href="/akce/">Akce</a></li></ul>`;
  const emit = (rel, html) => write(rel, html.replace("%%CATS%%", catsFooter));
  const urls = [{ loc: `${BASE}/`, priority: "1.0", changefreq: "daily" }];

  for (const k of cats) clean(slug(k));
  clean("podnik"); clean("vylety"); clean("akce");

  // kategorie + podkategorie
  for (const k of cats) {
    const items = podniky.filter(p => p.kategorie === k).sort((a, b) => a.nazev.localeCompare(b.nazev, "cs"));
    const subs = [...new Set(items.flatMap(p => p.podkategorie))].sort((a, b) => a.localeCompare(b, "cs"));
    const subLinks = `<p class="links">${subs.map(s => `<a href="/${slug(k)}/${slug(s)}/">${esc(s)} (${items.filter(p => p.podkategorie.includes(s)).length})</a>`).join("")}</p>`;
    const heading = `${SEO_NAMES[k] || k} v Pečkách`;
    emit(`${slug(k)}/index.html`, listPage({ heading, lead: `Všechny záznamy z kategorie ${k} v Pečkách a nejbližším okolí. Kliknutím otevřete detail s kontakty, otevírací dobou a mapou.`, canonical: `${BASE}/${slug(k)}/`, items, crumbs: [{ text: "Kam v Pečkách", href: "/" }, { text: heading }], extra: subLinks }));
    urls.push({ loc: `${BASE}/${slug(k)}/`, priority: "0.8", changefreq: "weekly" });
    for (const s of subs) {
      const sub = items.filter(p => p.podkategorie.includes(s));
      const h2 = `${s} – Pečky`;
      emit(`${slug(k)}/${slug(s)}/index.html`, listPage({ heading: h2, lead: `${s} v Pečkách a okolí: ${sub.length} ${sub.length === 1 ? "záznam" : sub.length < 5 ? "záznamy" : "záznamů"} s telefonem, adresou a otevírací dobou.`, canonical: `${BASE}/${slug(k)}/${slug(s)}/`, items: sub, crumbs: [{ text: "Kam v Pečkách", href: "/" }, { text: heading, href: `/${slug(k)}/` }, { text: s }] }));
      urls.push({ loc: `${BASE}/${slug(k)}/${slug(s)}/`, priority: "0.7", changefreq: "weekly" });
    }
  }
  // podniky
  for (const p of podniky) { emit(`podnik/${p.slug}/index.html`, businessPage(p, cats)); urls.push({ loc: `${BASE}/podnik/${p.slug}/`, priority: "0.6", changefreq: "monthly" }); }

  // výlety
  const mista = (vylety.mista || []);
  const vBody = `<h1>Výlety z Peček</h1><p class="lead">Kam se vydat z Peček pěšky, na kole nebo vlakem o jednu stanici dál: památky, příroda, stezky a rozhledny v okolí. Vzdálenosti jsou od nádraží Pečky.</p>
<ul class="list">${mista.map(m => `<li class="card"><h3>${esc(m.nazev)}</h3><div class="muted">${esc(m.obec)} · ${esc(m.kategorie)}</div><p>${esc(m.popis)}</p><div class="links">${m.wiki ? `<a href="${esc(m.wiki)}" rel="noopener" target="_blank">Wikipedie</a>` : ""}${m.web ? `<a href="${esc(m.web)}" rel="noopener" target="_blank">web</a>` : ""}<a href="https://mapy.cz/turisticka?q=${encodeURIComponent(m.nazev + ", " + m.obec)}" rel="noopener" target="_blank">Mapy.cz</a></div></li>`).join("")}</ul>
<p><a class="btn primary" href="/?vylety">Otevřít s mapou a filtry</a></p>`;
  emit("vylety/index.html", page({ title: "Výlety a zajímavosti v okolí Peček | Kam v Pečkách", description: `Tipy na výlet z Peček: ${mista.slice(0, 5).map(m => m.nazev).join(", ")} a další. Památky, příroda, stezky a rozhledny do 6 km od nádraží.`, canonical: `${BASE}/vylety/`, body: vBody, crumbs: [{ text: "Kam v Pečkách", href: "/" }, { text: "Výlety" }], jsonld: { "@context": "https://schema.org", "@type": "ItemList", name: "Výlety z Peček", itemListElement: mista.map((m, i) => ({ "@type": "ListItem", position: i + 1, item: { "@type": "TouristAttraction", name: m.nazev, description: m.popis, geo: m.gps ? { "@type": "GeoCoordinates", latitude: m.gps[0], longitude: m.gps[1] } : undefined, url: m.wiki || m.web || undefined } })) } }));
  urls.push({ loc: `${BASE}/vylety/`, priority: "0.7", changefreq: "monthly" });

  // akce (nadcházející)
  const today = new Date().toISOString().slice(0, 10);
  const ak = (akce.akce || []).filter(a => (a.konec || a.zacatek).slice(0, 10) >= today).sort((a, b) => a.zacatek.localeCompare(b.zacatek));
  const fmt = a => { const d = new Date(a.zacatek.slice(0, 10) + "T12:00"); return `${d.getDate()}. ${d.getMonth() + 1}.${a.zacatek.length > 10 && !a.zacatek.endsWith("T00:00") ? " " + a.zacatek.slice(11) : ""}`; };
  const aBody = `<h1>Akce v Pečkách a okolí</h1><p class="lead">Nadcházející kulturní, sportovní a společenské akce v Pečkách, Ratenicích, Dobřichově, Plaňanech a dalších obcích Pečecka. Seznam se aktualizuje každý den.</p>
<ul class="list">${ak.map(a => `<li class="card"><h3>${a.url ? `<a href="${esc(a.url)}" rel="noopener" target="_blank">${esc(a.nazev)}</a>` : esc(a.nazev)}</h3><div><strong>${fmt(a)}</strong> · ${esc([a.misto, a.obec].filter((x, i, arr) => x && arr.indexOf(x) === i).join(", "))}</div>${a.popis ? `<p class="muted">${esc(a.popis.slice(0, 220))}</p>` : ""}</li>`).join("") || `<li class="card">Zatím žádné nadcházející akce.</li>`}</ul>
<p><a class="btn primary" href="/?akce">Otevřít kalendář s filtry</a></p>`;
  emit("akce/index.html", page({ title: "Akce v Pečkách a okolí | Kam v Pečkách", description: `Co se děje v Pečkách: ${ak.slice(0, 4).map(a => a.nazev).join(", ")}${ak.length > 4 ? " a další" : ""}. Kalendář akcí z Peček a okolních obcí, denně aktualizovaný.`, canonical: `${BASE}/akce/`, body: aBody, crumbs: [{ text: "Kam v Pečkách", href: "/" }, { text: "Akce" }], jsonld: { "@context": "https://schema.org", "@graph": ak.slice(0, 50).map(a => ({ "@type": "Event", name: a.nazev, startDate: a.zacatek, endDate: a.konec || undefined, url: a.url || undefined, description: a.popis || undefined, eventStatus: "https://schema.org/EventScheduled", location: { "@type": "Place", name: a.misto || a.obec, address: { "@type": "PostalAddress", addressLocality: a.obec || "Pečky", addressCountry: "CZ" } } })) } }));
  urls.push({ loc: `${BASE}/akce/`, priority: "0.9", changefreq: "daily" });

  // sitemap + robots
  write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${u.loc}</loc><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`).join("\n")}\n</urlset>\n`);
  write("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${BASE}/sitemap.xml\n`);
  return { pages: urls.length, cats: cats.map(k => ({ k, slug: slug(k), name: SEO_NAMES[k] || k })) };
};
module.exports.slug = slug;
