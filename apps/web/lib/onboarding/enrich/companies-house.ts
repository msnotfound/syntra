import type { MockEnrichFields } from '@syntra/shared/mocks/onboarding-enrich';

export interface CompaniesHouseEnrichResult {
  source: 'companies-house';
  fields: Partial<MockEnrichFields>;
  confidence: number;
  used_mock: boolean;
}

export async function enrichFromCompaniesHouse(
  companyName: string,
): Promise<CompaniesHouseEnrichResult> {
  const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
  if (!apiKey) {
    const { mockCompaniesHouseEnrich } = await import('@syntra/shared/mocks/onboarding-enrich');
    const result = await mockCompaniesHouseEnrich(companyName);
    return { source: 'companies-house', ...result, used_mock: true };
  }

  // Real Companies House (UK) API — or MCA21/ROC for Indian companies:
  // GET https://api.companieshouse.gov.uk/search/companies?q=<name>  (UK)
  // India: https://api.mca.gov.in/DCAService/ (requires MCA21 registration)
  throw new Error('Companies House live enrichment not implemented — set COMPANIES_HOUSE_API_KEY');
}
