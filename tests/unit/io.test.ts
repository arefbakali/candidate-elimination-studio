import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { parseCsv, detectDelimiter, toCsv } from '../../src/lib/io/csv';
import { readXlsx } from '../../src/lib/io/xlsx';
import { buildDataset, defaultConfig, profileTable } from '../../src/lib/io/analyze';
import { parseDatasetObject, serializeDataset, validateDataset } from '../../src/lib/io/schema';
import { loadFile } from '../../src/lib/io/load';
import { createSpace, runBoundaries, formatHypothesis } from '../../src/lib/ce';
import { BIRDS, SPORT } from '../../src/lib/datasets';

const enc = (s: string) => new TextEncoder().encode(s).buffer as ArrayBuffer;

describe('CSV', () => {
  it('parses quotes, embedded delimiters and CRLF', () => {
    expect(parseCsv('a,b\r\n"x, y","say ""hi"""\r\n1,2')).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"'],
      ['1', '2'],
    ]);
  });
  it('detects semicolons and tabs', () => {
    expect(detectDelimiter('a;b;c\n1;2;3')).toBe(';');
    expect(detectDelimiter('a\tb\n1\t2')).toBe('\t');
  });
  it('round-trips through toCsv', () => {
    const rows = [['a', 'b,c'], ['"q"', '']];
    expect(parseCsv(toCsv(rows)).slice(0, 1)).toEqual([['a', 'b,c']]);
  });
});

describe('table → dataset', () => {
  const csv = `Id,Sport,Type,Place,Level,Day,Class
1,football,team,outdoor,national,Saturday,1
2,hockey,team,outdoor,national,Saturday,1
3,gymnastics,individual,indoor,world,Saturday,0
4,handball,team,indoor,national,Saturday,1
5,decathlon,individual,outdoor,world,Sunday,0`;
  it('recognises the id column, the target column and the positive class', () => {
    const [header, ...rows] = parseCsv(csv);
    const profiles = profileTable(header, rows);
    expect(profiles[0].suggestedRole).toBe('ignore');
    expect(profiles[6].suggestedRole).toBe('target');
    const cfg = defaultConfig(profiles);
    expect(cfg.positive).toEqual(['1']);
    const { dataset, issues } = buildDataset(header, rows, profiles, cfg);
    expect(issues).toEqual([]);
    expect(dataset!.attributes.map((a) => a.name)).toEqual(['Sport', 'Type', 'Place', 'Level', 'Day']);
    // the imported Sport table gives the course's final boundaries
    const b = runBoundaries(createSpace(dataset!.attributes), dataset!.examples);
    expect(b.S.map(formatHypothesis)).toEqual(['⟨?, team, ?, national, Saturday⟩']);
    expect(b.G.map(formatHypothesis).sort()).toEqual(['⟨?, ?, ?, national, ?⟩', '⟨?, team, ?, ?, ?⟩']);
  });
  it('numeric columns: interval mode reproduces Birds, discretisation creates bins', () => {
    const table = [
      ['flat', 'size', 'neck', 'bird'],
      ['True', '30', 'russet', 'duck'],
      ['False', '70', 'grey', 'penguin'],
      ['True', '40', 'orange', 'duck'],
      ['False', '60', 'orange', 'penguin'],
    ];
    const [header, ...rows] = table;
    const profiles = profileTable(header, rows);
    expect(profiles[1].numeric).toBe(true);
    const cfg = defaultConfig(profiles);
    cfg.positive = ['duck'];
    cfg.columns[1] = { role: 'attribute', type: 'interval', min: 0, max: Infinity, step: 1 };
    const r = buildDataset(header, rows, profiles, cfg);
    expect(r.dataset!.attributes[1]).toEqual({ kind: 'interval', name: 'size', min: 0, max: Infinity, step: 1 });
    expect(validateDataset(r.dataset!).errors).toEqual([]);
    cfg.columns[1] = { role: 'attribute', type: 'discretize', min: 30, max: 70, bins: 2 };
    const d = buildDataset(header, rows, profiles, cfg).dataset!;
    expect(d.attributes[1]).toEqual({ kind: 'categorical', name: 'size', values: ['[30, 50[', '[50, 70]'] });
    expect(d.examples.map((e) => e.values[1])).toEqual(['[30, 50[', '[50, 70]', '[30, 50[', '[50, 70]']);
  });
  it('missing values become typed nulls and are reported', () => {
    const [header, ...rows] = parseCsv('a,b,y\nx,?,1\nz,w,0');
    const profiles = profileTable(header, rows);
    const cfg = defaultConfig(profiles);
    const ds = buildDataset(header, rows, profiles, cfg).dataset!;
    expect(ds.examples[0].values).toEqual(['x', null]);
    expect(validateDataset(ds).warnings.join(' ')).toMatch(/missing/);
  });
});

describe('JSON dataset format', () => {
  it('round-trips the Birds dataset including +∞', () => {
    const json = JSON.stringify(serializeDataset(BIRDS));
    expect(json).toContain('"max":"inf"');
    const back = parseDatasetObject(JSON.parse(json));
    expect(back.attributes[1]).toEqual(BIRDS.attributes[1]);
    expect(back.examples).toEqual(BIRDS.examples);
  });
  it('rejects malformed datasets with a readable message', () => {
    expect(() => parseDatasetObject({ attributes: [{ kind: 'weird' }], examples: [] })).toThrow('Invalid dataset JSON');
  });
  it('validation reports out-of-domain values and contradictions', () => {
    const bad = { ...SPORT, examples: [...SPORT.examples, { id: 'bad', values: ['chess', 'team', 'indoor', 'world', 'Saturday'], label: true }, { ...SPORT.examples[0], id: 'dup', label: false }] };
    const r = validateDataset(bad);
    expect(r.errors.join(' ')).toMatch(/chess/);
    expect(r.warnings.join(' ')).toMatch(/opposite label/);
  });
  it('loadFile accepts dataset JSON and record arrays', async () => {
    const a = await loadFile('d.json', enc(JSON.stringify(serializeDataset(SPORT))));
    expect(a.kind).toBe('dataset');
    const b = await loadFile('r.json', enc(JSON.stringify([{ x: 'a', y: 1 }, { x: 'b', y: 0 }])));
    expect(b.kind).toBe('table');
  });
});

describe('XLSX', () => {
  it('reads shared strings, inline strings and numbers from the first sheet', async () => {
    const zip = new JSZip();
    zip.file('xl/workbook.xml', '<workbook xmlns:r="r"><sheets><sheet name="Data" sheetId="1" r:id="rId1"/></sheets></workbook>');
    zip.file('xl/_rels/workbook.xml.rels', '<Relationships><Relationship Id="rId1" Type="ws" Target="worksheets/sheet1.xml"/></Relationships>');
    zip.file('xl/sharedStrings.xml', '<sst><si><t>Sky</t></si><si><t>Size</t></si><si><r><t>Sun</t></r><r><t>ny</t></r></si><si><t>Enjoy</t></si></sst>');
    zip.file(
      'xl/worksheets/sheet1.xml',
      '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>3</v></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>42</v></c><c r="C2" t="inlineStr"><is><t>Yes &amp; more</t></is></c></row><row r="3"><c r="A3" t="inlineStr"><is><t>Rainy</t></is></c><c r="C3" t="b"><v>0</v></c></row></sheetData></worksheet>',
    );
    const buf = await zip.generateAsync({ type: 'uint8array' });
    expect(await readXlsx(buf)).toEqual([
      ['Sky', 'Size', 'Enjoy'],
      ['Sunny', '42', 'Yes & more'],
      ['Rainy', '', 'FALSE'],
    ]);
  });
});
