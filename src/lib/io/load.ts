import { parseCsv } from './csv';
import { readXlsx } from './xlsx';
import { parseDatasetObject } from './schema';
import { recordsToTable } from './analyze';
import type { Dataset } from '../ce/types';

export type Loaded = { kind: 'dataset'; dataset: Dataset } | { kind: 'table'; header: string[]; rows: string[][]; fileName: string };

export const MAX_FILE_BYTES = 5 * 1024 * 1024;

/**
 * Load an uploaded file. A JSON file in the studio's dataset format is loaded
 * directly; CSV, Excel and JSON record arrays become a table for the import wizard.
 */
export async function loadFile(fileName: string, data: ArrayBuffer): Promise<Loaded> {
  if (data.byteLength > MAX_FILE_BYTES) throw new Error('The file is larger than 5 MB.');
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.xlsx') || lower.endsWith('.xlsm')) {
    const table = await readXlsx(data);
    return asTable(table, fileName);
  }
  if (lower.endsWith('.xls')) throw new Error('Legacy .xls files are not supported: save the sheet as .xlsx or .csv.');
  const text = new TextDecoder('utf-8').decode(data);
  if (lower.endsWith('.json')) {
    let obj: unknown;
    try {
      obj = JSON.parse(text);
    } catch {
      throw new Error('The JSON file could not be parsed.');
    }
    if (obj && typeof obj === 'object' && !Array.isArray(obj) && 'attributes' in obj && 'examples' in obj) {
      return { kind: 'dataset', dataset: parseDatasetObject(obj) };
    }
    if (Array.isArray(obj) && obj.every((r) => r && typeof r === 'object' && !Array.isArray(r))) {
      const t = recordsToTable(obj as Record<string, unknown>[]);
      return { kind: 'table', header: t.header, rows: t.rows, fileName };
    }
    throw new Error('Unsupported JSON: expected an array of records or a dataset {attributes, examples}.');
  }
  return asTable(parseCsv(text), fileName);
}

function asTable(table: string[][], fileName: string): Loaded {
  if (table.length < 2) throw new Error('The table needs a header row and at least one data row.');
  const [header, ...rows] = table;
  return { kind: 'table', header, rows, fileName };
}
