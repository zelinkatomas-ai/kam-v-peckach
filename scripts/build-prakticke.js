// Z data/prakticke.json spočítá konkrétní svozové dny pro daný rok, vyrobí docs/prakticke.js
// a pro každou zónu kalendář docs/svoz-<zona>.ics (dá se stáhnout nebo odebírat v telefonu).
// Volá se ze scripts/build.js; export vrací spočítaná data pro build-pages.js.
const fs = require("fs");
const path = require("path");
const DOCS = path.join(__dirname, "..", "docs");
const DAY_IDX = { po: 1, "út": 2, st: 3, "čt": 4, "pá": 5, so: 6, ne: 0 };

const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - y0) / 86400000 + 1) / 7);
}
function inRange(d, od, doo, rok) {
  const s = iso(d).slice(5);
  return (!od || s >= od) && (!doo || s <= doo);
}
// vrátí mapu zona -> druh -> [dny ISO]
function compute(svoz) {
  const rok = svoz.rok;
  const out = {};
  for (const z of svoz.zony) { out[z.id] = {}; for (const dr of svoz.druhy) out[z.id][dr.id] = new Set(); }
  for (const dr of svoz.druhy) {
    for (const r of dr.pravidla) {
      for (let d = new Date(rok, 0, 1); d.getFullYear() === rok; d.setDate(d.getDate() + 1)) {
        if (d.getDay() !== DAY_IDX[r.den]) continue;
        if (!inRange(d, r.od, r.do, rok)) continue;
        let ok = false;
        if (r.interval === "tydne") ok = true;
        else if (r.interval === "sude-tydny") ok = isoWeek(d) % 2 === 0;
        else if (r.interval === "liche-tydny") ok = isoWeek(d) % 2 === 1;
        else if (r.interval === "prvni-v-mesici") ok = d.getDate() <= 7;
        if (ok) for (const z of r.zony) out[z][dr.id].add(iso(d));
      }
    }
    for (const extra of dr.navic || []) for (const z of svoz.zony) out[z.id][dr.id].add(extra);
    for (const skip of dr.vynechat || []) for (const z of svoz.zony) out[z.id][dr.id].delete(skip);
  }
  const res = {};
  for (const z in out) { res[z] = {}; for (const dr in out[z]) res[z][dr] = [...out[z][dr]].sort(); }
  return res;
}
function ics(svoz, zona, dny) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Kam v Pečkách//svoz odpadu//CS", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:Svoz odpadu – ${zona.nazev}`, "X-WR-TIMEZONE:Europe/Prague", "X-WR-CALDESC:Svoz odpadu podle harmonogramu města Pečky. Připomínka večer před svozem."];
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  for (const dr of svoz.druhy) {
    for (const day of dny[dr.id] || []) {
      const d = day.replace(/-/g, "");
      const next = new Date(day + "T12:00"); next.setDate(next.getDate() + 1);
      lines.push("BEGIN:VEVENT", `UID:svoz-${zona.id}-${dr.id}-${d}@kamvpeckach.cz`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${iso(next).replace(/-/g, "")}`,
        `SUMMARY:${dr.nazev} – svoz`, `DESCRIPTION:Svoz: ${dr.nazev}, zóna ${zona.nazev}. Nádobu nebo pytle připravte večer před svozem. Zdroj: harmonogram města Pečky.`,
        "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:Zítra svoz: ${dr.nazev}`, "TRIGGER:-PT6H", "END:VALARM", "END:VEVENT");
    }
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

module.exports = function buildPrakticke(prakticke, oznameni) {
  const dny = compute(prakticke.svoz);
  for (const z of prakticke.svoz.zony) fs.writeFileSync(path.join(DOCS, `svoz-${z.id}.ics`), ics(prakticke.svoz, z, dny[z.id]), "utf8");
  const data = { ...prakticke, svoz: { ...prakticke.svoz, dny }, oznameni: oznameni || { aktualizovano: "", polozky: [] } };
  fs.writeFileSync(path.join(DOCS, "prakticke.js"), "// Generováno skriptem scripts/build.js z data/prakticke.json a data/oznameni.json – neupravovat ručně.\nwindow.PECKY_PRAKTICKE = " + JSON.stringify(data) + ";\n", "utf8");
  const n = Object.values(dny).reduce((s, z) => s + Object.values(z).reduce((a, b) => a + b.length, 0), 0);
  console.log(`prakticke.js: ${n} svozových termínů, ${prakticke.svoz.zony.length} kalendářů .ics, ${(oznameni && oznameni.polozky || []).length} oznámení`);
  return data;
};
module.exports.compute = compute;
