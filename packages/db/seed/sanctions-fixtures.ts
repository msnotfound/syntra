import type { ISanctionsEntry } from '../models/SanctionsList.js';

/**
 * Three representative OFAC SDN fixture entries for dev/test seeding.
 * These are based on publicly available OFAC SDN list data.
 */
export const OFAC_FIXTURE_ENTRIES: ISanctionsEntry[] = [
  {
    name: 'AL-RASHIDI TRADING COMPANY',
    aliases: ['Al Rashidi Trading', 'Al-Rashidy Trading Co', 'ARTC'],
    country: 'IR',
    dob: null,
    id_numbers: ['TRD-IR-00421'],
    programs: ['IRAN', 'SDGT'],
    source_url: 'https://sanctionssearch.ofac.treas.gov/',
  },
  {
    name: 'SALAMI, Hossein',
    aliases: ['Hosein Salami', 'Hussein Salami', 'SALAMI Hossein'],
    country: 'IR',
    dob: '1963-03-14',
    id_numbers: ['IRGC-CMD-001'],
    programs: ['IRAN', 'IRGC'],
    source_url: 'https://sanctionssearch.ofac.treas.gov/',
  },
  {
    name: 'PERSIAN GULF SHIPPING LLC',
    aliases: ['PGS LLC', 'Persian Gulf Ship', 'Gulf Shipping Persian'],
    country: 'AE',
    dob: null,
    id_numbers: ['IMO-9234567'],
    programs: ['IRAN', 'NPWMD'],
    source_url: 'https://sanctionssearch.ofac.treas.gov/',
  },
];

export const OFAC_FIXTURE_LIST_META = {
  list_name: 'ofac_sdn' as const,
  version: '2026-05-10',
  updated_at: new Date('2026-05-10T00:00:00.000Z'),
  entry_count: OFAC_FIXTURE_ENTRIES.length,
};
