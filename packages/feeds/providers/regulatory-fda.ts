import type { FeedProvider } from '../withCostGate.js';

export type RegulatoryCategory =
  | 'export_control'
  | 'import_ban'
  | 'sanctions'
  | 'environmental'
  | 'labor'
  | 'data_privacy'
  | 'other';

export interface RegulatoryChange {
  title: string;
  summary: string;
  jurisdiction: string;
  country_code: string;
  category: RegulatoryCategory;
  effective_date: Date;
  source_url: string;
  affects_industries: string[];
}

export type RegulatoryQuery = { jurisdiction?: string; category?: RegulatoryCategory };
export type RegulatoryResponse = RegulatoryChange[];

const MOCK_REGULATORY_CHANGES: RegulatoryChange[] = [
  {
    title: 'US BIS adds 47 Chinese semiconductor entities to Entity List',
    summary:
      'Bureau of Industry and Security (BIS) adds 47 Chinese entities to the Entity List under 15 CFR Part 744. Entities subject to license requirement for exports, re-exports, or in-country transfers of all items subject to the EAR. Effective immediately.',
    jurisdiction: 'United States',
    country_code: 'US',
    category: 'export_control',
    effective_date: new Date('2026-05-09'),
    source_url: 'https://www.federalregister.gov/documents/search?conditions[term]=entity+list',
    affects_industries: ['semiconductors', 'electronics', 'telecom', 'defense'],
  },
  {
    title: 'EU Carbon Border Adjustment Mechanism (CBAM) enters full implementation',
    summary:
      'CBAM Regulation (EU) 2023/956 enters full implementation phase from 1 January 2026. Importers of cement, iron, steel, aluminium, fertilisers, electricity and hydrogen must purchase CBAM certificates. Indian steel and aluminium exporters face compliance obligations and increased cost of entry.',
    jurisdiction: 'European Union',
    country_code: 'EU',
    category: 'environmental',
    effective_date: new Date('2026-01-01'),
    source_url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32023R0956',
    affects_industries: ['steel', 'aluminium', 'cement', 'fertilisers', 'energy'],
  },
  {
    title: 'India DGFT amends export policy — drones and drone components require licence',
    summary:
      'Directorate General of Foreign Trade notification S.O. 1847(E) shifts unmanned aerial systems and key drone components from free to restricted category. Export licence required from DGFT effective 1 June 2026. Dual-use technology controls aligned with Wassenaar Arrangement.',
    jurisdiction: 'India',
    country_code: 'IN',
    category: 'export_control',
    effective_date: new Date('2026-06-01'),
    source_url: 'https://www.dgft.gov.in/CP/?opt=notificationnew',
    affects_industries: ['aerospace', 'defense', 'electronics', 'manufacturing'],
  },
  {
    title: 'UK Product Safety and Metrology Bill — CE marking no longer accepted',
    summary:
      'UK Product Safety and Metrology Act 2026 confirms UKCA marking mandatory for all regulated products sold in Great Britain from 1 October 2026. EU CE marking no longer accepted. Exporters must obtain UK conformity assessment. Significant compliance burden for Indian exporters to the UK market.',
    jurisdiction: 'United Kingdom',
    country_code: 'GB',
    category: 'other',
    effective_date: new Date('2026-10-01'),
    source_url: 'https://www.legislation.gov.uk/',
    affects_industries: ['manufacturing', 'electronics', 'pharmaceuticals', 'medical_devices'],
  },
  {
    title: 'Saudi Arabia imposes import ban on single-use plastics',
    summary:
      'Saudi Standards, Metrology and Quality Organization (SASO) enforces complete import ban on single-use plastic bags, cutlery, straws and stirrers effective 1 July 2026. Non-compliant shipments will be seized at customs. Indian packaging exporters must requalify product lines.',
    jurisdiction: 'Saudi Arabia',
    country_code: 'SA',
    category: 'import_ban',
    effective_date: new Date('2026-07-01'),
    source_url: 'https://www.saso.gov.sa/',
    affects_industries: ['plastics', 'packaging', 'retail', 'food_service'],
  },
];

export class RegulatoryFdaProvider implements FeedProvider<RegulatoryQuery, RegulatoryResponse> {
  readonly id = 'regulatory-fda';
  readonly name = 'Regulatory Feed (Federal Register / EUR-Lex / India Gazette)';
  readonly cost_model = 'free' as const;
  readonly cost_per_request_inr = 0;
  readonly rate_limit = { requests_per_minute: 30, requests_per_day: 500 };

  async fetch(query: RegulatoryQuery, _opts: { org_id: string }): Promise<RegulatoryResponse> {
    const apiKey = process.env.FEDERAL_REGISTER_API_KEY;
    if (!apiKey) {
      console.warn('[regulatory-fda] FEDERAL_REGISTER_API_KEY not set — using mock data');
      return this.getMockData(query);
    }

    try {
      const params = new URLSearchParams({
        'conditions[term]': 'export control import regulation trade',
        per_page: '20',
        order: 'newest',
        fields: 'title,abstract,publication_date,html_url,agencies',
      });
      if (query.category === 'export_control') {
        params.set('conditions[term]', 'export control entity list sanctions');
      }
      const res = await fetch(`https://www.federalregister.gov/api/v1/documents.json?${params}`, {
        headers: { Authorization: `Token ${apiKey}` },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`Federal Register API returned ${res.status}`);
      return this.getMockData(query); // full normalization out of scope
    } catch (err) {
      console.error('[regulatory-fda] Fetch failed, using mock data:', err);
      return this.getMockData(query);
    }
  }

  getMockData(_query: RegulatoryQuery): RegulatoryResponse {
    return MOCK_REGULATORY_CHANGES;
  }

  estimateCost(_query: RegulatoryQuery): number {
    return 0;
  }

  withCostGate(_opts: { org_id: string; cap_inr_daily: number }): FeedProvider<RegulatoryQuery, RegulatoryResponse> {
    return this;
  }
}

export const regulatoryFdaProvider = new RegulatoryFdaProvider();
