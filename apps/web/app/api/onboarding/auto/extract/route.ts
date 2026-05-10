import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';
import { callLLMJson } from '@syntra/llm';
import { z } from 'zod';
import { fetchContent, FetchStrategy } from '@/lib/onboarding/fetch';
import { enrichFromLinkedIn } from '@/lib/onboarding/enrich/linkedin';
import { enrichFromCrunchbase } from '@/lib/onboarding/enrich/crunchbase';
import { enrichFromCompaniesHouse } from '@/lib/onboarding/enrich/companies-house';
import { enrichFromGst } from '@/lib/onboarding/enrich/gst';
import type { MockEnrichFields } from '@syntra/shared/mocks/onboarding-enrich';

const ExtractRequestSchema = z.object({
  url: z.string().url('Invalid URL'),
});

interface CompanyMetadataExtractOutput {
  company_name: string | null;
  sector: string | null;
  country: string | null;
  region: string | null;
  suppliers: Array<{ name: string; confidence: number; excerpt: string }>;
  customers: Array<{ name: string; confidence: number; excerpt: string }>;
  facilities: Array<{ name: string; location: string | null; confidence: number; excerpt: string }>;
  counterparties: Array<{ name: string; type: 'supplier' | 'customer' | 'partner' | 'competitor' | null; confidence: number; excerpt: string }>;
}

export type EnrichmentSource = 'linkedin' | 'crunchbase' | 'companies-house' | 'gst';

export interface EnrichmentSourceStatus {
  source: EnrichmentSource;
  hit: boolean;
  used_mock: boolean;
  fields_contributed: string[];
}

export interface EnrichedFieldEntry {
  value: string | number | string[] | null;
  source: 'extraction' | EnrichmentSource;
  confidence: number;
}

function mergeEnrichment(
  extractionBase: Partial<MockEnrichFields>,
  enrichResults: Array<{ source: EnrichmentSource; fields: Partial<MockEnrichFields>; confidence: number; used_mock: boolean }>,
): {
  merged: Record<string, EnrichedFieldEntry>;
  sources: EnrichmentSourceStatus[];
} {
  const merged: Record<string, EnrichedFieldEntry> = {};

  // Seed from extraction (highest confidence base)
  for (const [key, val] of Object.entries(extractionBase)) {
    if (val != null) {
      merged[key] = { value: val as string | number | string[], source: 'extraction', confidence: 0.9 };
    }
  }

  const sources: EnrichmentSourceStatus[] = [];

  for (const enricher of enrichResults) {
    const fieldsContributed: string[] = [];
    for (const [key, val] of Object.entries(enricher.fields)) {
      if (val == null) continue;
      const existing = merged[key];
      if (!existing || enricher.confidence > existing.confidence) {
        merged[key] = { value: val as string | number | string[], source: enricher.source, confidence: enricher.confidence };
        fieldsContributed.push(key);
      }
    }
    sources.push({
      source: enricher.source,
      hit: Object.keys(enricher.fields).length > 0,
      used_mock: enricher.used_mock,
      fields_contributed: fieldsContributed,
    });
  }

  return { merged, sources };
}

export async function POST(req: NextRequest) {
  try {
    await ensureDb();

    const body = await req.json();
    const parsed = ExtractRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', details: parsed.error.issues },
        { status: 400 },
      );
    }

    const { url } = parsed.data;

    let content: Awaited<ReturnType<typeof fetchContent>>;
    try {
      content = await fetchContent(url);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : 'Failed to fetch URL';
      return NextResponse.json({ error: 'FETCH_ERROR', message }, { status: 400 });
    }

    // LLM extraction
    let extracted: CompanyMetadataExtractOutput;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      const mock = await import('@syntra/shared/mocks/anthropic.js');
      extracted = await mock.extractCompanyMetadata(content.text, content.source);
    } else {
      const prompt = `Source: ${content.source}

Content:
${content.text}

Extract company metadata: name, sector, country/region, major suppliers (with excerpt), major customers (with excerpt), key facilities, and notable counterparties. For each entity, include a source excerpt and confidence score 0–1. Omit entities with <0.6 confidence. Return JSON with this structure:
{
  "company_name": string | null,
  "sector": string | null,
  "country": string | null,
  "region": string | null,
  "suppliers": [{ "name": string, "confidence": number, "excerpt": string }],
  "customers": [{ "name": string, "confidence": number, "excerpt": string }],
  "facilities": [{ "name": string, "location": string | null, "confidence": number, "excerpt": string }],
  "counterparties": [{ "name": string, "type": "supplier" | "customer" | "partner" | "competitor" | null, "confidence": number, "excerpt": string }]
}`;

      const systemPrompt =
        'You are an intelligence analyst extracting company metadata from business documents. Extract only entities that are explicitly mentioned or strongly implied. Rate confidence 0–1. Do not guess or hallucinate entities. Return only valid JSON.';

      extracted = await callLLMJson<CompanyMetadataExtractOutput>(
        'claude-haiku-4-5-20251001',
        systemPrompt,
        prompt,
        async () => {
          const mock = await import('@syntra/shared/mocks/anthropic.js');
          return mock.extractCompanyMetadata(content.text, content.source);
        },
      );
    }

    // Parallel enrichment fan-out
    const companyName = extracted.company_name ?? '';
    const enrichSettled = await Promise.allSettled([
      enrichFromLinkedIn(companyName),
      enrichFromCrunchbase(companyName),
      enrichFromCompaniesHouse(companyName),
      enrichFromGst(companyName),
    ]);

    const enrichResults = enrichSettled
      .map(r => (r.status === 'fulfilled' ? r.value : null))
      .filter((r): r is NonNullable<typeof r> => r !== null);

    const extractionBase: Partial<MockEnrichFields> = {
      company_name: extracted.company_name ?? undefined,
      industry: extracted.sector ?? undefined,
      headquarters: extracted.region ?? undefined,
    };

    const { merged: enrichedFields, sources: enrichmentSources } = mergeEnrichment(
      extractionBase,
      enrichResults,
    );

    // Build watchlist candidates
    const candidates = [];

    if (extracted.company_name) {
      candidates.push({
        type: 'company',
        name: extracted.company_name,
        sector: extracted.sector,
        country: extracted.country,
        region: extracted.region,
        confidence: 0.95,
        excerpt: 'Company itself',
      });
    }

    extracted.suppliers.forEach(s => {
      candidates.push({ type: 'supplier', name: s.name, sector: null, country: null, region: null, confidence: s.confidence, excerpt: s.excerpt });
    });

    extracted.customers.forEach(c => {
      candidates.push({ type: 'customer', name: c.name, sector: null, country: null, region: null, confidence: c.confidence, excerpt: c.excerpt });
    });

    extracted.facilities.forEach(f => {
      candidates.push({ type: 'facility', name: f.name, sector: null, country: null, region: null, location: f.location, confidence: f.confidence, excerpt: f.excerpt });
    });

    extracted.counterparties.forEach(cp => {
      if (!extracted.suppliers.find(s => s.name === cp.name) && !extracted.customers.find(c => c.name === cp.name)) {
        candidates.push({ type: cp.type || 'partner', name: cp.name, sector: null, country: null, region: null, confidence: cp.confidence, excerpt: cp.excerpt });
      }
    });

    return NextResponse.json({
      source_url: url,
      source_type: content.source,
      fetch_strategy: content.strategy as FetchStrategy,
      company_name: extracted.company_name,
      sector: extracted.sector,
      country: extracted.country,
      region: extracted.region,
      candidates: candidates.filter(c => c.confidence >= 0.5).sort((a, b) => b.confidence - a.confidence),
      enrichment_sources: enrichmentSources,
      enriched_fields: enrichedFields,
      prompt_id: 'COMPANY_METADATA_EXTRACT',
      prompt_version: '1.0.0',
    });
  } catch (error) {
    console.error('[onboarding/auto/extract]', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Extraction failed' },
      { status: 500 },
    );
  }
}
