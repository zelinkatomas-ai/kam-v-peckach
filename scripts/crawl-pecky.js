// Stáhne katalog firem města Pečky (starý web na pecky.as4u.cz) do JSON.
// Použití: node scripts/crawl-pecky.js data/zdroj-pecky-cz.json
const fs=require('fs');
const BASE='https://pecky.as4u.cz/redakce/index.php';
const CATS=[{slug:'auto-moto',name:'Auto-moto',clanek:107760},{slug:'restaurace-a-ubytovani',name:'Restaurace a ubytování',clanek:107762},{slug:'obchody',name:'Obchody',clanek:107763},{slug:'sluzby',name:'Služby',clanek:107764},{slug:'sport',name:'Sport',clanek:107766}];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const dec=s=>s.replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(n)).replace(/\s+/g,' ').trim();
const strip=h=>dec(h.replace(/<br\s*\/?>/gi,'\n').replace(/<\/p>/gi,'\n').replace(/<[^>]+>/g,'')).trim();
let n=0;
async function get(url){for(let i=0;i<3;i++){try{const r=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 (katalog Pecky, kontakt zelinka)'}});n++;if(r.ok){await sleep(250);return await r.text();}}catch(e){}await sleep(1500);}throw new Error('fail '+url);}
function parseList(html){const out=[];const re=/<h3><a href="[^"]*detaildb=(\d+)[^"]*">([^<]*)<\/a><\/h3>/g;let m;while((m=re.exec(html)))out.push({id:+m[1],name:dec(m[2])});return out;}
function parseSubcats(html){const out=[];const re=/<a href="[^"]*db_podkategorie=(\d+)&db_hltrideni=(\d+)[^"]*"[^>]*>([^<]*)<\/a>/g;let m;const seen=new Set();while((m=re.exec(html))){if(seen.has(m[1]))continue;seen.add(m[1]);out.push({pod:+m[1],hl:+m[2],name:dec(m[3])});}return out;}
async function listAll(urlFn){const ids=[];for(let od=0;od<1000;od+=10){const html=await get(urlFn(od));const e=parseList(html);if(!e.length)break;ids.push(...e);if(!/class="dalsi"/.test(html))break;}return ids;}
function parseDetail(html){
  const body=(html.match(/<h2 class="nadpis_clanku">([\s\S]*?)<div class="nahled_tisk">/)||[])[1]||'';
  const name=dec((body.match(/^([\s\S]*?)<\/h2>/)||['',''])[1]);
  const art=(body.match(/<div class="clanek">([\s\S]*)$/)||['',''])[1];
  const field=(label)=>{const m=art.match(new RegExp('<strong>'+label+'\s*:?</strong>\s*:?\s*([^<]*)'));return m?dec(m[1]):'';};
  const ico=field('IČ'), druh=field('Druh organizace'), tel=field('Tel\.'), fax=field('Fax'), email=field('E-mail'), web=field('Web'), osoba=field('Kontaktní osoba');
  // address: first <p><strong>...</strong></p> that is not a label
  let address='';const pm=art.match(/<p><strong>([^<]{4,})<\/strong><\/p>/);if(pm)address=dec(pm[1]);
  // description: text after the contact paragraph
  let desc='';const dm=art.match(/<p><strong>\s*<p>([\s\S]*?)<\/strong>/)||art.match(/<\/p>\s*<p><strong>\s*([\s\S]*?)<\/strong><\/p>/);
  if(dm)desc=strip(dm[1]);
  const wm=art.match(/<strong>Web:<\/strong>\s*<a[^>]*href="([^"]*)"/);const web2=wm?wm[1]:web;
  const em=art.match(/<strong>E-mail:<\/strong>\s*<a[^>]*href="mailto:([^"]*)"/);const email2=em?em[1]:email;
  return {name,ico,druh,address,tel,fax,email:email2,web:web2,osoba,desc,raw:strip(art)};
}
(async()=>{
  const result={fetched:new Date().toISOString(),categories:[],entries:{}};
  for(const c of CATS){
    const first=await get(`https://pecky.as4u.cz/cs/organizace-a-sluzby/katalog-firem/${c.slug}.html`);
    const subs=parseSubcats(first);
    const all=await listAll(od=>`${BASE}?lanG=cs&clanek=${c.clanek}&slozka=107358&xsekce=107740&od=${od}&`);
    console.error(`${c.name}: ${all.length} entries, ${subs.length} subcats`);
    for(const e of all){result.entries[e.id]=result.entries[e.id]||{id:e.id,name:e.name,category:c.name,clanek:c.clanek,subcats:[]};}
    // Filtr podkategorií na webu města nefunguje (vrací celou databázi), proto se podkategorie nestahují.
    result.categories.push({...c,subcats:subs.map(s=>s.name),count:all.length});
  }
  const ids=Object.keys(result.entries);console.error('details to fetch:',ids.length);
  let i=0;for(const id of ids){const r=result.entries[id];const html=await get(`${BASE}?lanG=cs&clanek=${r.clanek}&slozka=107358&xsekce=107740&detaildb=${id}&`);Object.assign(r,{detail:parseDetail(html)});if(++i%20==0)console.error('details',i);}
  fs.writeFileSync(process.argv[2],JSON.stringify(result,null,1),'utf8');
  console.error('requests:',n,'entries:',ids.length);
})();
