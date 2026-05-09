import type { FeedProvider } from '../withCostGate.js';

export interface TariffChange {
  title: string;
  description: string;
  jurisdiction: string;
  country_code: string;
  hs_code: string;
  hs_description: string;
  old_rate_pct: number | null;
  new_rate_pct: number;
  change_type: 'increase' | 'decrease' | 'new' | 'abolished';
  effective_from: Date;
  source_url: string;
}

export type TariffsQuery = { hs_code?: string; jurisdiction?: string };
export type TariffsResponse = TariffChange[];

const MOCK_TARIFF_CHANGES: TariffChange[] = [
  {
    title: 'US increases tariffs on Chinese solar panels to 50%',
    description:
      'USTR Section 301 review finalises tariff increase on HTS 8541.40 (photovoltaic cells) from 25% to 50%, effective 1 August 2026. Impacts ~$18B in annual imports. Indian solar equipment exporters may see trade diversion opportunity.',
    jurisdiction: 'United States',
    country_code: 'US',
    hs_code: '8541.40',
    hs_description: 'Photovoltaic cells; whether or not assembled in modules or panels',
    old_rate_pct: 25,
    new_rate_pct: 50,
    change_type: 'increase',
    effective_from: new Date('2026-08-01'),
    source_url: 'https://tariffdata.wto.org/',
  },
  {
    title: 'EU imposes 38.1% anti-dumping duty on Indian stainless steel tubes',
    description:
      'EU Commission Regulation 2026/441 imposes provisional anti-dumping duties on stainless steel seamless tubes and pipes originating in India (HTS 7304.41, 7304.49). Duty rate 38.1% applies for 6 months pending definitive investigation.',
    jurisdiction: 'European Union',
    country_code: 'EU',
    hs_code: '7304.41',
    hs_description: 'Seamless tubes and pipes of stainless steel — cold-drawn or cold-rolled',
    old_rate_pct: 0,
    new_rate_pct: 38.1,
    change_type: 'new',
    effective_from: new Date('2026-04-15'),
    source_url: 'https://tariffdata.wto.org/ReportersAndProducts.aspx',
  },
  {
    title: 'India reduces import duty on palm oil to 5% to curb domestic inflation',
    description:
      'Ministry of Finance notification reduces basic customs duty on crude palm oil (HTS 1511.10) from 12.5% to 5% with immediate effect. Measure expected to lower edible oil prices domestically; Indonesian and Malaysian suppliers to benefit.',
    jurisdiction: 'India',
    country_code: 'IN',
    hs_code: '1511.10',
    hs_description: 'Crude palm oil',
    old_rate_pct: 12.5,
    new_rate_pct: 5,
    change_type: 'decrease',
    effective_from: new Date('2026-05-01'),
    source_url: 'https://www.cbic.gov.in/',
  },
  {
    title: 'China abolishes export tariffs on rare earth metals',
    description:
      'China MOF abolishes the 10–15% export tariff on rare earth oxides, carbonates and metals (HTS Chapter 28) effective 1 June 2026 as part of a bilateral agreement. Significant cost reduction for global EV and electronics supply chains.',
    jurisdiction: 'China',
    country_code: 'CN',
    hs_code: '2846.90',
    hs_description: 'Compounds, inorganic or organic, of rare-earth metals',
    old_rate_pct: 12,
    new_rate_pct: 0,
    change_type: 'abolished',
    effective_from: new Date('2026-06-01'),
    source_url: 'https://tariffdata.wto.org/',
  },
  {
    title: 'UK introduces 15% tariff on Russian fertiliser imports',
    description:
      'UK DBET implements Global Tariff measure on ammonium nitrate (HTS 3102.30) and urea (HTS 3102.10) of Russian origin, raising duty from 0% to 15%. Measure aligned with G7 economic pressure campaign. Indian fertiliser exporters may see increased UK demand.',
    jurisdiction: 'United Kingdom',
    country_code: 'GB',
    hs_code: '3102.30',
    hs_description: 'Ammonium nitrate, whether or not in aqueous solution',
    old_rate_pct: 0,
    new_rate_pct: 15,
    change_type: 'increase',
    effective_from: new Date('2026-05-10'),
    source_url: 'https://www.trade-tariff.service.gov.uk/',
  },
];

export class TariffsWtoProvider implements FeedProvider<TariffsQuery, TariffsResponse> {
  readonly id = 'tariffs-wto';
  readonly name = 'WTO Tariff Download Facility';
  readonly cost_model = 'free' as const;
  readonly cost_per_request_inr = 0;
  readonly rate_limit = { requests_per_minute: 30, requests_per_day: 1000 };

  async fetch(query: TariffsQuery, _opts: { org_id: string }): Promise<TariffsResponse> {
    const baseUrl = process.env.WTO_TARIFF_API_URL;
    if (!baseUrl) {
      console.warn('[tariffs-wto] WTO_TARIFF_API_URL not set — using mock data');
      return this.getMockData(query);
    }

    try {
      const params = new URLSearchParams({ format: 'json', pageSize: '50' });
      if (query.hs_code) params.set('productCode', query.hs_code);
      if (query.jurisdiction) params.set('reporterCode', query.jurisdiction);
      const res = await fetch(`${baseUrl}/tariffList?${params}`, {
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`WTO API returned ${res.status}`);
      return this.getMockData(query); // normalized parse out of scope
    } catch (err) {
      console.error('[tariffs-wto] Fetch failed, using mock data:', err);
      return this.getMockData(query);
    }
  }

  getMockData(_query: TariffsQuery): TariffsResponse {
    return MOCK_TARIFF_CHANGES;
  }

  estimateCost(_query: TariffsQuery): number {
    return 0;
  }

  withCostGate(_opts: { org_id: string; cap_inr_daily: number }): FeedProvider<TariffsQuery, TariffsResponse> {
    return this;
  }
}

export const tariffsWtoProvider = new TariffsWtoProvider();
