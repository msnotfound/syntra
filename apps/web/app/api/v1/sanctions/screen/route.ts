import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateApiKey } from '@/lib/api/key-auth';
import { ensureDb } from '@/lib/db';
import { apiResponse, apiError, bestMatchScore } from '@syntra/shared';
import { SanctionsList } from '@syntra/db';
import type { ISanctionsEntry } from '@syntra/db';

const BodySchema = z.object({
  entity_name: z.string().min(1),
  aliases: z.array(z.string()).optional().default([]),
  country: z.string().length(2).toUpperCase().optional(),
  lists: z
    .array(z.enum(['ofac_sdn', 'un_consolidated', 'eu_restricted', 'uk_hmt', 'india_mea']))
    .optional()
    .default(['ofac_sdn', 'un_consolidated']),
});

// Fallback mock data when DB has no list yet
const OFAC_MOCK: ISanctionsEntry[] = [
  {
    name: 'AL-RASHIDI TRADING COMPANY',
    aliases: ['Al Rashidi Trading', 'Al-Rashidy Trading Co', 'ARTC'],
    country: 'IR',
    dob: null,
    id_numbers: ['TRD-IR-00421'],
    programs: ['IRAN', 'SDGT'],
    source_url: 'https://sanctionssearch.ofac.treas.gov/',
  },
  {
    name: 'SALAMI, Hossein',
    aliases: ['Hosein Salami', 'Hussein Salami', 'SALAMI Hossein'],
    country: 'IR',
    dob: '1963-03-14',
    id_numbers: ['IRGC-CMD-001'],
    programs: ['IRAN', 'IRGC'],
    source_url: 'https://sanctionssearch.ofac.treas.gov/',
  },
  {
    name: 'PERSIAN GULF SHIPPING LLC',
    aliases: ['PGS LLC', 'Persian Gulf Ship', 'Gulf Shipping Persian'],
    country: 'AE',
    dob: null,
    id_numbers: ['IMO-9234567'],
    programs: ['IRAN', 'NPWMD'],
    source_url: 'https://sanctionssearch.ofac.treas.gov/',
  },
];

export async function POST(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(apiError('bad_request', 'Invalid JSON'), { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      apiError('validation_error', 'Invalid request body', parsed.error.issues),
      { status: 422 },
    );
  }

  const { entity_name, aliases, lists } = parsed.data;
  const entityNames = [entity_name, ...(aliases ?? [])];

  await ensureDb();

  const matches: Array<{
    list_name: string;
    matched_name: string;
    match_score: number;
    entry: { name: string; aliases: string[]; programs: string[]; source_url: string };
  }> = [];

  for (const listName of lists) {
    const doc = await SanctionsList.findOne({ list_name: listName }).sort({ updated_at: -1 }).lean();
    const entries: ISanctionsEntry[] =
      doc?.entries?.length
        ? (doc.entries as unknown as ISanctionsEntry[])
        : listName === 'ofac_sdn'
          ? OFAC_MOCK
          : [];

    for (const entry of entries) {
      const { score, matchedName } = bestMatchScore(entityNames, entry);
      if (score >= 80) {
        matches.push({
          list_name: listName,
          matched_name: matchedName,
          match_score: score / 100, // contract schema expects 0–1
          entry: {
            name: entry.name,
            aliases: entry.aliases,
            programs: entry.programs,
            source_url: entry.source_url,
          },
        });
      }
    }
  }

  matches.sort((a, b) => b.match_score - a.match_score);

  return NextResponse.json(
    apiResponse({
      screened_entity: entity_name,
      matched: matches.length > 0,
      matches,
      screened_at: new Date(),
    }),
  );
}
