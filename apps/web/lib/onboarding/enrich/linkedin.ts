import type { MockEnrichFields } from '@syntra/shared/mocks/onboarding-enrich';

export interface LinkedInEnrichResult {
  source: 'linkedin';
  fields: Partial<MockEnrichFields>;
  confidence: number;
  used_mock: boolean;
}

export async function enrichFromLinkedIn(companyName: string): Promise<LinkedInEnrichResult> {
  const apiKey = process.env.LINKEDIN_API_KEY;
  if (!apiKey) {
    const { mockLinkedinEnrich } = await import('@syntra/shared/mocks/onboarding-enrich');
    const result = await mockLinkedinEnrich(companyName);
    return { source: 'linkedin', ...result, used_mock: true };
  }

  // Real LinkedIn People API / Company Lookup would go here.
  // Shape: GET https://api.linkedin.com/v2/organizationsLookup?q=vanityName&vanityName=<slug>
  // Requires OAuth 2.0 client credentials with r_organization_social scope.
  throw new Error('LinkedIn live enrichment not implemented — set LINKEDIN_API_KEY');
}
