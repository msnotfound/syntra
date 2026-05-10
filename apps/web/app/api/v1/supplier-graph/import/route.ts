import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/api/key-auth';
import { SupplierLink, WatchlistEntity } from '@syntra/db';
import { apiResponse, apiError } from '@syntra/shared';
import { ensureDb } from '@/lib/db';

const TIER_VALUES = new Set([1, 2, 3]);

interface CsvRow { parent: string; child: string; tier: string }

function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const header = lines[0].split(',').map(h => h.trim().toLowerCase());
  const parentIdx = header.indexOf('parent');
  const childIdx  = header.indexOf('child');
  const tierIdx   = header.indexOf('tier');

  if (parentIdx === -1 || childIdx === -1 || tierIdx === -1) {
    throw new Error('CSV must have columns: parent, child, tier');
  }

  return lines.slice(1)
    .filter(l => l.trim())
    .map(line => {
      const cols = line.split(',').map(c => c.trim());
      return { parent: cols[parentIdx] ?? '', child: cols[childIdx] ?? '', tier: cols[tierIdx] ?? '' };
    });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;
  if (!auth.scopes.includes('write:watchlist')) {
    return NextResponse.json(apiError('FORBIDDEN', 'Insufficient scope'), { status: 403 });
  }
  await ensureDb();

  const contentType = req.headers.get('content-type') ?? '';
  let rows: CsvRow[];

  try {
    if (contentType.includes('text/csv') || contentType.includes('text/plain')) {
      const text = await req.text();
      rows = parseCsv(text);
    } else {
      const body = await req.json() as { csv?: string };
      if (!body.csv) {
        return NextResponse.json(apiError('VALIDATION_ERROR', 'Provide CSV as text/csv body or JSON { csv: string }'), { status: 400 });
      }
      rows = parseCsv(body.csv);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Invalid CSV';
    return NextResponse.json(apiError('VALIDATION_ERROR', msg), { status: 400 });
  }

  if (rows.length === 0) {
    return NextResponse.json(apiError('VALIDATION_ERROR', 'No data rows found in CSV'), { status: 400 });
  }

  // Validate tier values
  const invalid = rows.filter(r => !TIER_VALUES.has(Number(r.tier)));
  if (invalid.length > 0) {
    return NextResponse.json(apiError('VALIDATION_ERROR', `Invalid tier value(s). Must be 1, 2, or 3. Rows: ${invalid.map(r => `${r.parent}→${r.child}`).slice(0, 5).join(', ')}`), { status: 400 });
  }

  // Resolve entity names → ObjectIds (names must already exist in watchlist for this org)
  const allNames = [...new Set([...rows.map(r => r.parent), ...rows.map(r => r.child)])];
  const entities = await WatchlistEntity.find({
    org_id: auth.orgId,
    name: { $in: allNames },
    active: true,
  }).lean();

  const entityByName = new Map(entities.map(e => [e.name, e]));

  const missing = allNames.filter(n => !entityByName.has(n));
  if (missing.length > 0) {
    return NextResponse.json(apiError('NOT_FOUND', `Entities not found in watchlist: ${missing.slice(0, 10).join(', ')}`), { status: 422 });
  }

  // Build link docs (upsert to avoid duplicates)
  let created = 0;
  let skipped = 0;

  for (const row of rows) {
    const parent = entityByName.get(row.parent)!;
    const child  = entityByName.get(row.child)!;
    const tier   = Number(row.tier) as 1 | 2 | 3;

    const existing = await SupplierLink.findOne({
      org_id: auth.orgId,
      parent_entity_id: parent._id,
      child_entity_id: child._id,
    }).lean();

    if (existing) {
      skipped++;
    } else {
      await SupplierLink.create({
        org_id: auth.orgId,
        parent_entity_id: parent._id,
        child_entity_id: child._id,
        tier_offset: tier,
        source: 'imported_csv',
        confidence_pct: 85,
      });
      created++;
    }
  }

  return NextResponse.json(apiResponse({ created, skipped, total: rows.length }), { status: 201 });
}
