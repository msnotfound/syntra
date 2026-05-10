import type { MockEnrichFields } from '@syntra/shared/mocks/onboarding-enrich';

export interface CrunchbaseEnrichResult {
  source: 'crunchbase';
  fields: Partial<MockEnrichFields>;
  confidence: number;
  used_mock: boolean;
}

export async function enrichFromCrunchbase(companyName: string): Promise<CrunchbaseEnrichResult> {
  const apiKey = process.env.CRUNCHBASE_API_KEY;
  if (!apiKey) {
    const { mockCrunchbaseEnrich } = await import('@syntra/shared/mocks/onboarding-enrich');
    const result = await mockCrunchbaseEnrich(companyName);
    return { source: 'crunchbase', ...result, used_mock: true };
  }

  // Real Crunchbase Basic API:
  // GET https://api.crunchbase.com/api/v4/entities/organizations/<slug>?user_key=<key>
  // Fields: short_description, employee_count, founded_on, headquarters_identifiers
  throw new Error('Crunchbase live enrichment not implemented — set CRUNCHBASE_API_KEY');
}
