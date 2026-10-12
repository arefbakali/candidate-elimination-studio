import { describe, expect, it } from 'vitest';
import { buildLattice, candidateElimination, createSpace } from '../../src/lib/ce';
import { SPORT, BIRDS } from '../../src/lib/datasets';
import { historyCsv, latticeSvg, reportPdf, resultJson } from '../../src/lib/export/report';
import { toWinAnsi } from '../../src/lib/export/pdf';
import { parseCsv } from '../../src/lib/io/csv';
import { buildScenes } from '../../src/lib/presentation';
import { fallbackLayout } from '../../src/lib/layout';

const space = createSpace(SPORT.attributes);
const run = candidateElimination(space, SPORT.examples);

describe('exports reflect the computed result', () => {
  it('JSON contains the final boundaries and the 6-hypothesis version space', () => {
    const j = resultJson(SPORT, space, run);
    expect(j.final.S).toEqual(['⟨?, team, ?, national, Saturday⟩']);
    expect(j.final.versionSpace.size).toBe(6);
    expect(j.history).toHaveLength(6);
    expect(j.steps.length).toBe(run.steps.length);
  });
  it('CSV history has one row per boundary state', () => {
    const rows = parseCsv(historyCsv(space, run));
    expect(rows[0]).toEqual(['step', 'example', 'label', 'S', 'G', '|S|', '|G|', '|VS|']);
    expect(rows).toHaveLength(7);
    expect(rows[6][7]).toBe('6');
    expect(rows[0 + 1][7]).toBe('1297');
  });
  it('PDF is well-formed', () => {
    const pdf = reportPdf(SPORT, space, run);
    const text = String.fromCharCode(...pdf.slice(0, 8));
    expect(text).toBe('%PDF-1.4');
    const tail = String.fromCharCode(...pdf.slice(pdf.length - 6));
    expect(tail).toBe('%%EOF\n');
    // xref offset points at "xref"
    const all = Array.from(pdf, (b) => String.fromCharCode(b)).join('');
    const off = Number(/startxref\n(\d+)/.exec(all)![1]);
    expect(all.slice(off, off + 4)).toBe('xref');
  });
  it('WinAnsi transliteration keeps the notation readable', () => {
    expect(String.fromCharCode(...toWinAnsi('⟨?, ∅⟩ ⪰'))).toBe('<?, Ø> >=');
  });
  it('SVG contains every node of the lattice', () => {
    const lat = buildLattice(space, run.final);
    const boxes = fallbackLayout(lat);
    const svg = latticeSvg(lat, boxes, { dark: true, title: 'Sport' });
    expect(svg.startsWith('<svg')).toBe(true);
    expect((svg.match(/<rect /g) ?? []).length).toBe(lat.nodes.length + 1);
    expect(svg).toContain('⟨?, team, ?, national, Saturday⟩');
  });
});

describe('presentation scenes', () => {
  it('Sport: the ten-part demo is driven by real trace steps', () => {
    const scenes = buildScenes(SPORT, space, run);
    expect(scenes.length).toBeGreaterThan(9);
    for (const s of scenes) expect(s.step).toBeLessThan(run.steps.length);
    const final = scenes.find((s) => s.reveal)!;
    expect(final.narration).toContain('exactly 6 hypotheses');
    const total = scenes.reduce((a, s) => a + s.seconds, 0);
    expect(total).toBeLessThan(6 * 60);
    expect(total).toBeGreaterThan(4 * 60);
  });
  it('works for other datasets too', () => {
    const sp = createSpace(BIRDS.attributes);
    const r = candidateElimination(sp, BIRDS.examples);
    expect(buildScenes(BIRDS, sp, r).length).toBeGreaterThan(5);
  });
});
