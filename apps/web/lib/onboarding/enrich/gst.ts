import type { MockEnrichFields } from '@syntra/shared/mocks/onboarding-enrich';

export interface GstEnrichResult {
  source: 'gst';
  fields: Partial<MockEnrichFields>;
  confidence: number;
  used_mock: boolean;
}

export async function enrichFromGst(companyName: string): Promise<GstEnrichResult> {
  const apiKey = process.env.GST_API_KEY;
  if (!apiKey) {
    const { mockGstEnrich } = await import('@syntra/shared/mocks/onboarding-enrich');
    const result = await mockGstEnrich(companyName);
    return { source: 'gst', ...result, used_mock: true };
  }

  // Real GST API (India):
  // POST https://api.gst.gov.in/commonapi/v1.1/search?action=TP  (search by trade name)
  // Requires GST API Auth Token from GST Suvidha Provider registration.
  throw new Error('GST live enrichment not implemented — set GST_API_KEY');
}
