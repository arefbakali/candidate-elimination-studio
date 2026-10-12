/**
 * POST /api/run — runs the engine on a dataset (JSON format of the studio)
 * and returns the final boundaries and the boundary history.
 * The studio itself computes in the browser; this endpoint shows that the
 * engine is independent of the UI and can be used headless.
 */
import { NextResponse } from 'next/server';
import { candidateElimination, createSpace, enumerateVersionSpace, formatHypothesis } from '@/lib/ce';
import { parseDatasetObject, validateDataset } from '@/lib/io/schema';

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body must be JSON.' }, { status: 400 });
  }
  try {
    const ds = parseDatasetObject(body);
    const report = validateDataset(ds);
    if (report.errors.length) return NextResponse.json({ error: 'Invalid dataset.', details: report.errors }, { status: 422 });
    const space = createSpace(ds.attributes);
    const r = candidateElimination(space, ds.examples);
    const vs = enumerateVersionSpace(space, r.final, 20000);
    return NextResponse.json({
      S: r.final.S.map(formatHypothesis),
      G: r.final.G.map(formatHypothesis),
      collapsed: r.collapsed,
      versionSpace: { status: vs.status, size: vs.status === 'complete' ? vs.count : null, hypotheses: vs.hypotheses.map(formatHypothesis) },
      history: r.history.map((b, i) => ({ step: i, S: b.S.map(formatHypothesis), G: b.G.map(formatHypothesis) })),
      warnings: report.warnings,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 422 });
  }
}
