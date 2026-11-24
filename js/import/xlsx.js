// Lecteur .xlsx minimal et autonome (zip + XML), sans bibliothèque externe.
// Utilise DecompressionStream (navigateurs récents, Node ≥ 18). Lit : feuilles, chaînes partagées,
// cellules texte/nombre, cellules fusionnées ignorées (la valeur reste dans la 1re cellule).

const u16 = (b, o) => b[o] | (b[o + 1] << 8);
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

async function inflateRaw(data) {
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([data]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Renvoie Map nom → fonction () => Promise<Uint8Array>. */
function readZipDirectory(b) {
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 70000); i--) {
    if (u32(b, i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("Fichier illisible : ce n'est pas un classeur .xlsx valide.");
  const count = u16(b, eocd + 10);
  let p = u32(b, eocd + 16);
  const files = new Map();
  for (let n = 0; n < count; n++) {
    if (u32(b, p) !== 0x02014b50) break;
    const method = u16(b, p + 10);
    const csize = u32(b, p + 20);
    const nameLen = u16(b, p + 28), extraLen = u16(b, p + 30), commLen = u16(b, p + 32);
    const lho = u32(b, p + 42);
    const name = new TextDecoder().decode(b.subarray(p + 46, p + 46 + nameLen));
    files.set(name, async () => {
      const lnl = u16(b, lho + 26), lel = u16(b, lho + 28);
      const start = lho + 30 + lnl + lel;
      const raw = b.subarray(start, start + csize);
      if (method === 0) return raw;
      if (method === 8) return inflateRaw(raw);
      throw new Error('Compression non prise en charge dans le .xlsx.');
    });
    p += 46 + nameLen + extraLen + commLen;
  }
  return files;
}

const text = (u8) => new TextDecoder().decode(u8);
const decodeXml = (s) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&');

/** Concatène les <t> d'un bloc (texte riche inclus). */
function textOf(block) {
  let out = '';
  for (const m of block.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) out += decodeXml(m[1]);
  return out;
}

const colIndex = (ref) => {
  let n = 0;
  for (const ch of ref.replace(/[0-9]/g, '')) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

/** @returns Promise<{name:string, rows:string[][]}[]> */
export async function readXlsx(arrayBuffer) {
  const zip = readZipDirectory(new Uint8Array(arrayBuffer));
  const get = async (name) => (zip.has(name) ? text(await zip.get(name)()) : null);

  const shared = [];
  const sst = await get('xl/sharedStrings.xml');
  if (sst) for (const m of sst.matchAll(/<si>([\s\S]*?)<\/si>|<si\/>/g)) shared.push(m[1] ? textOf(m[1]) : '');

  const wb = await get('xl/workbook.xml');
  if (!wb) throw new Error('Classeur .xlsx invalide (workbook.xml manquant).');
  const rels = (await get('xl/_rels/workbook.xml.rels')) || '';
  const relTarget = {};
  for (const m of rels.matchAll(/<Relationship\s([^>]*)\/?>/g)) {
    const id = /Id="([^"]+)"/.exec(m[1])?.[1];
    const target = /Target="([^"]+)"/.exec(m[1])?.[1];
    if (id && target) relTarget[id] = target.startsWith('/') ? target.slice(1) : 'xl/' + target.replace(/^\.\//, '');
  }

  const sheets = [];
  for (const m of wb.matchAll(/<sheet\s([^>]*)\/?>/g)) {
    const name = decodeXml(/name="([^"]*)"/.exec(m[1])?.[1] || 'Feuille');
    const rid = /r:id="([^"]+)"/.exec(m[1])?.[1];
    const path = relTarget[rid];
    const xml = path && (await get(path));
    if (!xml) continue;
    const rows = [];
    for (const rm of xml.matchAll(/<row\s[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
      const rIdx = Number(/\sr="(\d+)"/.exec(rm[0])?.[1] || rows.length + 1) - 1;
      const row = [];
      for (const cm of (rm[1] || '').matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const ref = /\sr="([A-Z]+\d+)"/.exec(' ' + cm[1])?.[1];
        const t = /\st="([^"]+)"/.exec(' ' + cm[1])?.[1];
        const inner = cm[2] || '';
        let val = '';
        if (t === 's') val = shared[Number(/<v>([\s\S]*?)<\/v>/.exec(inner)?.[1])] ?? '';
        else if (t === 'inlineStr') val = textOf(inner);
        else if (t === 'str' || t === 'e') val = decodeXml(/<v>([\s\S]*?)<\/v>/.exec(inner)?.[1] ?? '');
        else if (t === 'b') val = /<v>1/.test(inner) ? 'VRAI' : 'FAUX';
        else {
          const v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
          val = v == null ? '' : String(Number(v));
        }
        if (ref) row[colIndex(ref)] = val;
        else row.push(val);
      }
      for (let i = 0; i < row.length; i++) if (row[i] === undefined) row[i] = '';
      rows[rIdx] = row;
    }
    for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
    sheets.push({ name, rows });
  }
  if (!sheets.length) throw new Error('Aucune feuille lisible dans ce classeur.');
  return sheets;
}
