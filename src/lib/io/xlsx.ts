/**
 * Minimal .xlsx reader: reads the first worksheet of an Office Open XML workbook
 * into a 2-D array of strings. Supports shared strings, inline strings, numbers
 * and booleans — everything needed to import a training table.
 */
import JSZip from 'jszip';

const decode = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, '&');

function textOf(xml: string): string {
  // concatenates every <t>…</t> run (rich text has several)
  const parts: string[] = [];
  const re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) parts.push(decode(m[1] ?? ''));
  return parts.join('');
}

function colIndex(ref: string): number {
  const letters = /^[A-Z]+/.exec(ref)?.[0] ?? 'A';
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export async function readXlsx(data: ArrayBuffer | Uint8Array): Promise<string[][]> {
  const zip = await JSZip.loadAsync(data);
  const read = async (path: string) => {
    const f = zip.file(path);
    return f ? f.async('string') : null;
  };
  let sheetPath = 'xl/worksheets/sheet1.xml';
  const workbook = await read('xl/workbook.xml');
  const rels = await read('xl/_rels/workbook.xml.rels');
  if (workbook && rels) {
    const rid = /<sheet\b[^>]*\br:id="([^"]+)"/.exec(workbook)?.[1];
    if (rid) {
      const relRe = /<Relationship\b([^>]*)\/?>/g;
      let m: RegExpExecArray | null;
      while ((m = relRe.exec(rels)) !== null) {
        const attrs = m[1];
        if (new RegExp(`\\bId="${rid}"`).test(attrs)) {
          const target = /\bTarget="([^"]+)"/.exec(attrs)?.[1];
          if (target) sheetPath = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
        }
      }
    }
  }
  const sheet = await read(sheetPath);
  if (!sheet) throw new Error('The workbook has no readable worksheet.');
  const sharedXml = await read('xl/sharedStrings.xml');
  const shared: string[] = [];
  if (sharedXml) {
    const siRe = /<si>([\s\S]*?)<\/si>/g;
    let m: RegExpExecArray | null;
    while ((m = siRe.exec(sharedXml)) !== null) shared.push(textOf(m[1]));
  }
  const rows: string[][] = [];
  const rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
  let rm: RegExpExecArray | null;
  while ((rm = rowRe.exec(sheet)) !== null) {
    const row: string[] = [];
    const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cm: RegExpExecArray | null;
    let next = 0;
    while ((cm = cellRe.exec(rm[1])) !== null) {
      const attrs = cm[1];
      const body = cm[2] ?? '';
      const ref = /\br="([A-Z]+\d+)"/.exec(attrs)?.[1];
      const idx = ref ? colIndex(ref) : next;
      next = idx + 1;
      const type = /\bt="([^"]+)"/.exec(attrs)?.[1];
      const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      let value = '';
      if (type === 's' && v !== undefined) value = shared[Number(v)] ?? '';
      else if (type === 'inlineStr') value = textOf(body);
      else if (type === 'b' && v !== undefined) value = v === '1' ? 'TRUE' : 'FALSE';
      else if (v !== undefined) value = decode(v);
      while (row.length < idx) row.push('');
      row[idx] = value;
    }
    rows.push(row);
  }
  const width = Math.max(0, ...rows.map((r) => r.length));
  return rows.map((r) => [...r, ...Array(width - r.length).fill('')]).filter((r) => r.some((c) => c.trim() !== ''));
}
