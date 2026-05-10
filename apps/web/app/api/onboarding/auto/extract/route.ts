import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';
import { callLLMJson } from '@syntra/llm';
import { z } from 'zod';

const ExtractRequestSchema = z.object({
  url: z.string().url('Invalid URL'),
});

interface FetchedContent {
  text: string;
  source: 'webpage' | 'annual_report';
  url: string;
}

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

async function fetchAndParseUrl(url: string): Promise<FetchedContent> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Syntra Onboarding Bot)',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > 2 * 1024 * 1024) {
      throw new Error('Content exceeds 2MB limit');
    }

    const text = new TextDecoder().decode(buffer);

    // Simple heuristic: if content looks like a PDF or has "annual report" in title, treat as such
    const contentType = response.headers.get('content-type') || '';
    const isPDF = contentType.includes('application/pdf');
    const isAnnualReport = isPDF || text.toLowerCase().includes('annual report');

    // Strip HTML if it's a webpage
    let cleanText = text;
    if (!isPDF) {
      cleanText = text
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim();
    }

    // Truncate to first 50KB of useful content
    const MAX_CHARS = 50000;
    cleanText = cleanText.substring(0, MAX_CHARS);

    return {
      text: cleanText,
      source: isAnnualReport ? 'annual_report' : 'webpage',
      url,
    };
  } finally {
    clearTimeout(timeout);
  }
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

    // Fetch and parse the URL
    let content: FetchedContent;
    try {
      content = await fetchAndParseUrl(url);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : 'Failed to fetch URL';
      return NextResponse.json(
        { error: 'FETCH_ERROR', message },
        { status: 400 },
      );
    }

    // Call LLM or mock for extraction
    let extracted: CompanyMetadataExtractOutput;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      // Use mock extraction
      const mock = await import('@syntra/shared/mocks/anthropic.js');
      extracted = await mock.extractCompanyMetadata(content.text, content.source);
    } else {
      // Call real LLM
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

    // Transform extracted data into watchlist entity candidates
    const candidates = [];

    // Add company itself if identified
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

    // Add suppliers
    extracted.suppliers.forEach(s => {
      candidates.push({
        type: 'supplier',
        name: s.name,
        sector: null,
        country: null,
        region: null,
        confidence: s.confidence,
        excerpt: s.excerpt,
      });
    });

    // Add customers as separate entity type
    extracted.customers.forEach(c => {
      candidates.push({
        type: 'customer',
        name: c.name,
        sector: null,
        country: null,
        region: null,
        confidence: c.confidence,
        excerpt: c.excerpt,
      });
    });

    // Add facilities
    extracted.facilities.forEach(f => {
      candidates.push({
        type: 'facility',
        name: f.name,
        sector: null,
        country: null,
        region: null,
        location: f.location,
        confidence: f.confidence,
        excerpt: f.excerpt,
      });
    });

    // Add other counterparties
    extracted.counterparties.forEach(cp => {
      if (!extracted.suppliers.find(s => s.name === cp.name) && !extracted.customers.find(c => c.name === cp.name)) {
        candidates.push({
          type: cp.type || 'partner',
          name: cp.name,
          sector: null,
          country: null,
          region: null,
          confidence: cp.confidence,
          excerpt: cp.excerpt,
        });
      }
    });

    return NextResponse.json({
      source_url: url,
      source_type: content.source,
      company_name: extracted.company_name,
      sector: extracted.sector,
      country: extracted.country,
      region: extracted.region,
      candidates: candidates.filter(c => c.confidence >= 0.5).sort((a, b) => b.confidence - a.confidence),
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
