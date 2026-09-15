# Kam v Pečkách

Jedna stránka se všemi obchody, službami, řemeslníky, restauracemi, lékaři a akcemi v Pečkách.
Statický web bez serveru. Celý veřejný web je složka `docs/` (`index.html`, `data.js`, `akce.js`, `vylety.js`, `leaflet.css`, `_headers`), zbytek repozitáře jsou zdrojová data a skripty. Funguje otevřený přímo z disku, na GitHub Pages i na Cloudflare.

**Živá stránka:** https://kam-v-peckach.zelinka-tomas.workers.dev (Cloudflare) a https://zelinkatomas-ai.github.io/kam-v-peckach/ (GitHub Pages). Obě se nasazují automaticky z větve `main`, Cloudflare přes `wrangler.jsonc`, GitHub Pages ze složky `docs/`.

## Struktura

| Soubor | K čemu je |
|---|---|
| `docs/index.html` | stránka s filtrováním, vyhledáváním a kartami podniků |
| `docs/data.js`, `docs/akce.js`, `docs/vylety.js` | data pro stránku, **generují se** z JSON ve složce `data/` |
| `wrangler.jsonc` | konfigurace nasazení na Cloudflare (statické soubory z `docs/`) |
| `data/podniky.json` | **hlavní zdroj pravdy**, tady se data ručně upravují |
| `data/zdroj-pecky-cz.json` | surový výstup crawleru z katalogu firem města (pro dohledání původu) |
| `data/zdroj-firmy-cz.json` | surový výstup crawleru z Firmy.cz (výpis pro Pečky) |
| `data/zdroj-ares.json` | všechny subjekty se sídlem v Pečkách z registru ARES (kontrolní seznam, bez kontaktů) |
| `data/upravy.json` | ruční opravy importovaných záznamů (kategorie, podkategorie, skrytí zaniklých) |
| `data/rucni.json` | ručně přidané záznamy (OC Pečky, lékaři z nového webu města) |
| `scripts/crawl-pecky.js` | stáhne katalog firem z webu města (běží na `pecky.as4u.cz`) |
| `scripts/crawl-firmy.js` | stáhne výpis a detaily z Firmy.cz |
| `scripts/crawl-ares.js` | stáhne registr ARES pro Pečky |
| `scripts/import.js` | spojí všechny zdroje do `podniky.json`, sloučí duplicity, aplikuje ruční úpravy |
| `scripts/build.js` | vygeneruje `docs/data.js`, `docs/akce.js`, `docs/vylety.js` |
| `scripts/serve.js` | lokální náhled na http://localhost:5173 |

## Běžná údržba

1. Upravte záznam v `data/podniky.json` (telefon, otevírací doba, poznámka).
2. Spusťte `node scripts/build.js`.
3. Commit a push, oba hostingy se nasadí samy.

## Formát záznamu

```json
{
 "id": "pecky-6502",
 "nazev": "Autoservis AMK Pečky",
 "kategorie": "Auto-moto",
 "podkategorie": ["Autoservisy"],
 "adresa": "Sladkovského 266, Pečky",
 "psc": "289 11",
 "telefony": ["723 385 957"],
 "email": "",
 "web": "",
 "kontakt": "Lukáš Najbrt",
 "ico": "",
 "popis": "Opravy motorových vozidel, pneuservis.",
 "otevreno": { "po": [["8:00","12:00"],["13:00","17:00"]], "so": [], "pozn": "v létě do 18:00" },
 "zdroj": "katalog firem pecky.cz",
 "zkontrolovano": "2026-09-13",
 "rucne": true
}
```

- `otevreno`: `null` = neznámá. Klíče dní `po út st čt pá so ne`, prázdné pole = zavřeno. Jakmile má aspoň jeden záznam otevírací dobu, na stránce se zapne filtr „Otevřeno teď“.
- `zkontrolovano`: datum, kdy někdo údaje ověřil. Zobrazuje se na kartě.
- `rucne: true`: záznam se při novém importu z pecky.cz nepřepíše. Pole `otevreno`, `poznamka`, `zkontrolovano` a `aktualne` se zachovají vždy.
- Nové záznamy z jiných zdrojů dávejte `id` s jiným prefixem než `pecky-` (třeba `fb-kadernictvi-tesoro`).
- `kontaktEmail` v hlavičce souboru: adresa, kam chodí „Nahlásit změnu“ a „Přidat podnik“. Prázdná = odkazy se nezobrazí.

## Nové stažení zdrojů a import

```
node scripts/crawl-pecky.js data/zdroj-pecky-cz.json     # katalog města, cca 2 min
node scripts/crawl-firmy.js data/zdroj-firmy-cz.json     # Firmy.cz, cca 5 min (jen nové detaily se stahují znovu)
node scripts/crawl-ares.js data/zdroj-ares.json          # registr ARES, cca 1 min
node scripts/import.js                                   # spojí zdroje -> data/podniky.json
node scripts/build.js                                    # -> data.js
```

Crawlery jsou schválně pomalé (pauza mezi požadavky). Import je deterministický: záznamy z různých zdrojů
se slučují podle telefonu, webu nebo názvu a adresy (přednost mají ručně tříděné záznamy z webu města),
potom se aplikují `data/upravy.json`. Sloučené záznamy mají pole `slouceno` s id původních záznamů.

Kategorie Firmy.cz se převádějí tabulkou `MAP` ve `scripts/import.js`. Štítek, který tabulka nezná,
import vypíše; stačí přidat řádek.

### ARES jako kontrolní seznam

`data/zdroj-ares.json` obsahuje všech ~1000 subjektů se sídlem v Pečkách (z toho ~730 živnostníků) včetně
oborů NACE. Nejsou v něm kontakty, hodí se ale k dohledání, kdo tu ještě podniká a v katalogu chybí
(např. NACE 96 = kadeřnictví, kosmetika a podobné osobní služby).

## Akce

Záložka Akce zobrazuje nadcházející události. Data jsou v `data/akce.json` a do stránky se dostávají přes
`akce.js` (generuje `scripts/build.js`). Plní je `scripts/crawl-akce.js` ze dvou zdrojů:

- kalendář akcí Pečeckého regionu (pececkyregion.cz), který sdružuje obce okolo Peček,
- aktuality města Pečky (pecky.cz), u kterých je vyplněný blok „Událost“ se začátkem a koncem.

Crawler si pamatuje dříve stažené akce, dokud neskončí, takže se nic neztratí, když aktualita zmizí z úvodní
strany města. Workflow `.github/workflows/akce.yml` ho spouští každý den ráno a výsledek commitne, takže na
GitHub Pages jsou akce vždy aktuální bez ručního zásahu. Ručně: `node scripts/crawl-akce.js && node scripts/build.js`.

Formát akce: `{ id, nazev, zacatek: "2026-09-13T14:00", konec, misto, obec, kategorie: [], popis, url, zdroj }`.
`zacatek` bez času (`"2026-09-13"`) znamená celodenní akci.

## Hlášení změn a odkazy na karty

Každá karta má tlačítko **Odkaz** (zkopíruje adresu s kotvou, např. `…/#pfirmy-13001673`; stránka kartu při
otevření zvýrazní a posune na ni) a **Nahlásit změnu**, které otevře formulář. Odkaz „Přidat podnik“ v patičce
otevře stejný formulář pro nový záznam.

Kam formulář posílá, řídí dvě pole v hlavičce `data/podniky.json`:

- `formEndpoint`: adresa služby, která přijme formulářový POST (Formspree, Getform, Web3Forms a podobné). Když je
  vyplněná, hlášení odejde na pozadí a odesílatel nemusí mít poštovní klient. Založení na Formspree trvá
  pár minut: nový formulář, zkopírovat adresu ve tvaru `https://formspree.io/f/xxxxxxxx`, vložit sem, spustit
  `node scripts/build.js`.
- `kontaktEmail`: záložní cesta. Když endpoint chybí nebo odeslání selže, formulář složí e-mail a otevře ho
  v poštovním klientu.

Import obě pole zachovává.

## Výlety a mapa

Záložka Výlety je ručně sestavený seznam míst v `data/vylety.json` (do stránky přes `vylety.js`). Každé místo má
kategorii, obec, souřadnice, popis vlastními slovy a odkazy na Mapy.cz, Wikipedii a web. Vzdálenost od nádraží
stránka počítá sama ze souřadnic. Souřadnice pocházejí z OpenStreetMap (licence ODbL), fakta z Wikipedie
a webů obcí. `gpsPribl: true` označuje přibližnou polohu. Nové místo = nový záznam v JSON a `node scripts/build.js`.

Tlačítko Mapa zobrazí právě vyfiltrované podniky nebo výlety na mapě (Leaflet z cdnjs, dlaždice OpenStreetMap,
styl `leaflet.css` v repozitáři). Akce souřadnice nemají, tam je mapa vypnutá.

## Odkazy do stránky

`index.html?vylety` otevře záložku Výlety.

`index.html?akce` otevře rovnou záložku Akce.

`index.html?kat=Obchody` otevře rovnou kategorii, `index.html?q=kadeřnictví` předvyplní hledání.
