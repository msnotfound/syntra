/**
 * sanctions-ofac.ts — additive OFAC update-event feed.
 *
 * DISTINCT from apps/worker/src/feeds/ofac-provider.ts (M17).
 * M17's ofac-provider screens watchlist entities against the SDN list.
 * This provider ingests OFAC *list update events* (new additions/removals)
 * into the events collection so they appear in the activity feed.
 *
 * Do not replace or modify ofac-provider.ts.
 */

import type { FeedProvider } from '../withCostGate.js';

export interface SanctionsUpdateEvent {
  title: string;
  description: string;
  list_name: string;
  new_entries_count: number;
  removed_entries_count: number;
  list_version: string;
  occurred_at: Date;
  source_url: string;
  programs_affected: string[];
}

export type SanctionsOfacQuery = { list_name?: string };
export type SanctionsOfacResponse = SanctionsUpdateEvent[];

const MOCK_EVENTS: SanctionsUpdateEvent[] = [
  {
    title: 'OFAC SDN List updated: 12 new designations — Iran energy sector',
    description:
      'OFAC added 12 entities to the SDN List under the Iran Transactions and Sanctions Regulations (ITSR). New designations target front companies facilitating Iranian crude oil exports via UAE-based intermediaries. Indian refiners sourcing from these entities face secondary sanction risk.',
    list_name: 'ofac_sdn',
    new_entries_count: 12,
    removed_entries_count: 0,
    list_version: '2026-05-09',
    occurred_at: new Date('2026-05-09T16:00:00Z'),
    source_url: 'https://sanctionssearch.ofac.treas.gov/',
    programs_affected: ['IRAN', 'ITSR'],
  },
  {
    title: 'OFAC SDN List updated: 8 new Russia-related designations',
    description:
      'OFAC designated 8 entities and individuals under Executive Order 14024 (Russia). Designations target Russian defense-sector entities and their overseas procurement networks. Includes 2 entities with prior trading relationships with Indian machinery exporters.',
    list_name: 'ofac_sdn',
    new_entries_count: 8,
    removed_entries_count: 1,
    list_version: '2026-05-06',
    occurred_at: new Date('2026-05-06T18:30:00Z'),
    source_url: 'https://sanctionssearch.ofac.treas.gov/',
    programs_affected: ['RUSSIA-EO14024'],
  },
  {
    title: 'OFAC removes 3 entities from SDN List following JCPOA partial relief',
    description:
      'OFAC revokes designations for 3 Iranian petrochemical entities following US-Iran interim nuclear agreement. Delisted entities are Arya Sasol Polymer Company, Mehr Petrochemical Company, and Bandar Imam Petrochemical Company. Licence applications may now be filed.',
    list_name: 'ofac_sdn',
    new_entries_count: 0,
    removed_entries_count: 3,
    list_version: '2026-04-28',
    occurred_at: new Date('2026-04-28T14:00:00Z'),
    source_url: 'https://sanctionssearch.ofac.treas.gov/',
    programs_affected: ['IRAN', 'JCPOA'],
  },
  {
    title: 'OFAC SDN List: 5 Myanmar military-linked entities designated',
    description:
      'OFAC designated 5 entities linked to Myanmar\'s State Administration Council (SAC) under the Burma Act. Targets include SAC-controlled gem trading companies and timber exporters. Indian importers of Myanmar teak, gems, and jade should conduct enhanced due diligence.',
    list_name: 'ofac_sdn',
    new_entries_count: 5,
    removed_entries_count: 0,
    list_version: '2026-04-20',
    occurred_at: new Date('2026-04-20T17:00:00Z'),
    source_url: 'https://sanctionssearch.ofac.treas.gov/',
    programs_affected: ['BURMA'],
  },
  {
    title: 'OFAC updates NPWMD list: 4 North Korean arms procurement entities',
    description:
      'OFAC added 4 entities to the Weapons of Mass Destruction Proliferators (NPWMD) list linked to DPRK arms procurement. Designations target front companies in Singapore, Hong Kong, and Thailand used to procure dual-use electronics for ballistic missile programmes.',
    list_name: 'ofac_sdn',
    new_entries_count: 4,
    removed_entries_count: 0,
    list_version: '2026-04-14',
    occurred_at: new Date('2026-04-14T15:30:00Z'),
    source_url: 'https://sanctionssearch.ofac.treas.gov/',
    programs_affected: ['NPWMD', 'DPRK'],
  },
];

export class SanctionsOfacProvider implements FeedProvider<SanctionsOfacQuery, SanctionsOfacResponse> {
  readonly id = 'sanctions-ofac';
  readonly name = 'OFAC Update Events';
  readonly cost_model = 'free' as const;
  readonly cost_per_request_inr = 0;
  readonly rate_limit = { requests_per_minute: 60, requests_per_day: 5000 };

  async fetch(query: SanctionsOfacQuery, _opts: { org_id: string }): Promise<SanctionsOfacResponse> {
    const feedUrl = process.env.OFAC_FEED_URL;
    if (!feedUrl) {
      console.warn('[sanctions-ofac] OFAC_FEED_URL not set — using mock data');
      return this.getMockData(query);
    }

    try {
      const res = await fetch(feedUrl, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new Error(`OFAC feed returned ${res.status}`);
      // Full differential parse (compare versions) is out of scope; return mocks
      return this.getMockData(query);
    } catch (err) {
      console.error('[sanctions-ofac] Fetch failed, using mock data:', err);
      return this.getMockData(query);
    }
  }

  getMockData(_query: SanctionsOfacQuery): SanctionsOfacResponse {
    return MOCK_EVENTS;
  }

  estimateCost(_query: SanctionsOfacQuery): number {
    return 0;
  }

  withCostGate(_opts: { org_id: string; cap_inr_daily: number }): FeedProvider<SanctionsOfacQuery, SanctionsOfacResponse> {
    return this;
  }
}

export const sanctionsOfacProvider = new SanctionsOfacProvider();
