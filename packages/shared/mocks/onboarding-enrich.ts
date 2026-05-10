console.warn('[MOCK] Using mock onboarding enrichers — set provider API keys in .env to use real sources.');

export interface MockEnrichFields {
  company_name?: string;
  description?: string;
  employee_count?: string;
  industry?: string;
  website?: string;
  founded_year?: number;
  headquarters?: string;
  linkedin_url?: string;
  crunchbase_url?: string;
  registration_number?: string;
  gstin?: string;
  pan?: string;
  registered_address?: string;
  directors?: string[];
  filing_status?: string;
}

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

export async function mockLinkedinEnrich(
  companyName: string,
): Promise<{ fields: MockEnrichFields; confidence: number }> {
  await delay(80);
  const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return {
    fields: {
      company_name: companyName,
      description: `${companyName} is a manufacturing and export company based in India, serving international markets across Asia, Europe, and North America.`,
      employee_count: '51-200',
      industry: 'Manufacturing',
      linkedin_url: `https://www.linkedin.com/company/${slug}`,
      website: `https://www.${slug}.com`,
      headquarters: 'Mumbai, Maharashtra, India',
      founded_year: 2005,
    },
    confidence: 0.6,
  };
}

export async function mockCrunchbaseEnrich(
  companyName: string,
): Promise<{ fields: MockEnrichFields; confidence: number }> {
  await delay(90);
  const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return {
    fields: {
      company_name: companyName,
      crunchbase_url: `https://www.crunchbase.com/organization/${slug}`,
      founded_year: 2005,
      employee_count: '51-200',
      description: `${companyName} is an Indian exporter operating in manufacturing and trade sectors.`,
      headquarters: 'India',
    },
    confidence: 0.55,
  };
}

export async function mockCompaniesHouseEnrich(
  companyName: string,
): Promise<{ fields: MockEnrichFields; confidence: number }> {
  await delay(70);
  return {
    fields: {
      company_name: companyName,
      registration_number: 'U12345MH2005PTC000001',
      registered_address: 'Mumbai, Maharashtra 400001, India',
      directors: ['Director A', 'Director B'],
      filing_status: 'Active',
    },
    confidence: 0.7,
  };
}

export async function mockGstEnrich(
  companyName: string,
): Promise<{ fields: MockEnrichFields; confidence: number }> {
  await delay(60);
  return {
    fields: {
      company_name: companyName,
      gstin: '27AABCU9603R1ZX',
      pan: 'AABCU9603R',
      registered_address: 'Mumbai, Maharashtra, India',
      filing_status: 'Active',
    },
    confidence: 0.75,
  };
}
