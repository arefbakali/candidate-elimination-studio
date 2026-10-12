/**
 * Tiny dependency-free PDF writer (PDF 1.4, standard Helvetica fonts, WinAnsi).
 * Enough for a clean, text-based step-by-step report.
 */

const TRANSLIT: Record<string, string> = {
  '⟨': '<', '⟩': '>', '∅': 'Ø', '⪰': '>=', '⪯': '<=', '≻': '>', '≺': '<', '∃': 'exists ', '∀': 'for all ', '∈': ' in ', '∉': ' not in ',
  '∧': ' and ', '⊤': 'T', '⊥': '_|_', '∪': ' U ', '∖': ' \\ ', '←': '<-', '→': '->', '≠': '!=', '≤': '<=', '≥': '>=', '∞': 'inf', '−': '-',
  '·': '·', '…': '...', '’': "'", '‘': "'", '“': '"', '”': '"', '—': '-', '–': '-', '✓': 'ok', '✗': 'x',
  '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9', 'ᵢ': 'i',
};

/** Code points of WinAnsiEncoding above 0x7F that are not identical to Latin-1. */
const WIN_ANSI_EXTRA: Record<string, number> = { '€': 0x80, '•': 0x95, '™': 0x99, 'Œ': 0x8c, 'œ': 0x9c };

export function toWinAnsi(s: string): number[] {
  const out: number[] = [];
  for (const ch of s) {
    const t = TRANSLIT[ch];
    if (t !== undefined && t !== ch) {
      out.push(...toWinAnsi(t));
      continue;
    }
    const cp = ch.codePointAt(0)!;
    if (cp < 0x80 || (cp >= 0xa0 && cp <= 0xff)) out.push(cp);
    else if (WIN_ANSI_EXTRA[ch] !== undefined) out.push(WIN_ANSI_EXTRA[ch]);
    else out.push(0x3f); // '?'
  }
  return out;
}

function pdfString(s: string): string {
  return toWinAnsi(s)
    .map((b) => {
      if (b === 0x28 || b === 0x29 || b === 0x5c) return '\\' + String.fromCharCode(b);
      if (b < 0x20 || b > 0x7e) return '\\' + b.toString(8).padStart(3, '0');
      return String.fromCharCode(b);
    })
    .join('');
}

export type Block =
  | { kind: 'title'; text: string }
  | { kind: 'h1'; text: string }
  | { kind: 'h2'; text: string }
  | { kind: 'p'; text: string }
  | { kind: 'mono'; text: string }
  | { kind: 'rule' }
  | { kind: 'space' };

interface Line {
  font: 'F1' | 'F2' | 'F3';
  size: number;
  text: string;
  color: [number, number, number];
  gapBefore: number;
  rule?: boolean;
}

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 56;

function wrap(text: string, size: number, mono: boolean): string[] {
  const avg = mono ? 0.6 : 0.52;
  const max = Math.max(10, Math.floor((PAGE_W - 2 * MARGIN) / (size * avg)));
  const out: string[] = [];
  for (const para of text.split('\n')) {
    const words = para.split(/(\s+)/);
    let cur = '';
    for (const w of words) {
      if ((cur + w).length > max && cur.trim() !== '') {
        out.push(cur.trimEnd());
        cur = w.trimStart();
        while (cur.length > max) {
          out.push(cur.slice(0, max));
          cur = cur.slice(max);
        }
      } else cur += w;
    }
    out.push(cur.trimEnd());
  }
  return out;
}

function layout(blocks: Block[]): Line[] {
  const lines: Line[] = [];
  for (const b of blocks) {
    if (b.kind === 'rule') lines.push({ font: 'F1', size: 6, text: '', color: [0, 0, 0], gapBefore: 6, rule: true });
    else if (b.kind === 'space') lines.push({ font: 'F1', size: 6, text: '', color: [0, 0, 0], gapBefore: 0 });
    else {
      const style =
        b.kind === 'title'
          ? { font: 'F2' as const, size: 20, color: [0.12, 0.13, 0.36] as [number, number, number], gap: 0 }
          : b.kind === 'h1'
            ? { font: 'F2' as const, size: 14, color: [0.2, 0.22, 0.6] as [number, number, number], gap: 14 }
            : b.kind === 'h2'
              ? { font: 'F2' as const, size: 11, color: [0.15, 0.15, 0.2] as [number, number, number], gap: 8 }
              : b.kind === 'mono'
                ? { font: 'F3' as const, size: 8.5, color: [0.1, 0.35, 0.3] as [number, number, number], gap: 1 }
                : { font: 'F1' as const, size: 10, color: [0.15, 0.15, 0.18] as [number, number, number], gap: 4 };
      wrap(b.text, style.size, b.kind === 'mono').forEach((t, i) =>
        lines.push({ font: style.font, size: style.size, text: t, color: style.color, gapBefore: i === 0 ? style.gap : 0 }),
      );
    }
  }
  return lines;
}

export function buildPdf(blocks: Block[], meta: { title: string }): Uint8Array<ArrayBuffer> {
  const lines = layout(blocks);
  const pages: string[] = [];
  let ops: string[] = [];
  let y = PAGE_H - MARGIN;
  const flush = () => {
    ops.push(`BT /F1 8 Tf 0.5 0.5 0.55 rg ${MARGIN} 30 Td (${pdfString(`${meta.title} — page ${pages.length + 1}`)}) Tj ET`);
    pages.push(ops.join('\n'));
    ops = [];
    y = PAGE_H - MARGIN;
  };
  for (const l of lines) {
    const lh = l.size * 1.35;
    if (y - l.gapBefore - lh < MARGIN) flush();
    y -= l.gapBefore + lh;
    if (l.rule) {
      ops.push(`0.8 0.8 0.85 RG 0.6 w ${MARGIN} ${y + lh / 2} m ${PAGE_W - MARGIN} ${y + lh / 2} l S`);
      continue;
    }
    if (l.text === '') continue;
    ops.push(`BT /${l.font} ${l.size} Tf ${l.color.join(' ')} rg ${MARGIN} ${y.toFixed(2)} Td (${pdfString(l.text)}) Tj ET`);
  }
  flush();

  const objects: string[] = [];
  const add = (s: string) => {
    objects.push(s);
    return objects.length;
  };
  const catalog = add('');
  const pagesObj = add('');
  const f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const f3 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>');
  const pageIds: number[] = [];
  for (const content of pages) {
    const bytes = latin1Length(content);
    const c = add(`<< /Length ${bytes} >>\nstream\n${content}\nendstream`);
    pageIds.push(
      add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R /F3 ${f3} 0 R >> >> /Contents ${c} 0 R >>`),
    );
  }
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
  objects[pagesObj - 1] = `<< /Type /Pages /Kids [${pageIds.map((p) => `${p} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
  const info = add(`<< /Title (${pdfString(meta.title)}) /Producer (Candidate Elimination Studio) >>`);

  let out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(latin1Length(out));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = latin1Length(out);
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) out += `${String(off).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
  return bytes;
}

function latin1Length(s: string): number {
  return s.length; // every char is in 0..255 by construction
}
