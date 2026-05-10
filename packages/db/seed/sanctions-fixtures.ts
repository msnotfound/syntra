import type { ISanctionsEntry } from '../models/SanctionsList.js';
import { SanctionsList } from '../models/SanctionsList.js';

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
    address: 'Tehran Grand Bazaar, Tehran, Iran',
    id_numbers: ['TRD-IR-00421'],
    programs: ['IRAN', 'SDGT'],
    source_url: 'https://sanctionssearch.ofac.treas.gov/',
  },
  {
    name: 'SALAMI, Hossein',
    aliases: ['Hosein Salami', 'Hussein Salami', 'SALAMI Hossein'],
    country: 'IR',
    dob: '1963-03-14',
    address: 'Pasdaran Avenue, Tehran, Iran',
    id_numbers: ['IRGC-CMD-001'],
    programs: ['IRAN', 'IRGC'],
    source_url: 'https://sanctionssearch.ofac.treas.gov/',
  },
  {
    name: 'PERSIAN GULF SHIPPING LLC',
    aliases: ['PGS LLC', 'Persian Gulf Ship', 'Gulf Shipping Persian'],
    country: 'AE',
    dob: null,
    address: 'Jebel Ali Free Zone, Dubai, United Arab Emirates',
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

export const UN_FIXTURE_ENTRIES: ISanctionsEntry[] = [
  {
    name: 'KOREA MINING DEVELOPMENT TRADING CORPORATION',
    aliases: ['KOMID', 'Korea Mining Development Corp'],
    country: 'KP',
    dob: null,
    address: 'Central District, Pyongyang, Democratic People Republic of Korea',
    id_numbers: ['UN-KP-001'],
    programs: ['DPRK', 'UNSCR-1718'],
    source_url: 'https://scsanctions.un.org/consolidated/',
  },
  {
    name: 'OCEAN MARITIME MANAGEMENT COMPANY LIMITED',
    aliases: ['OMM', 'Ocean Maritime Management Co Ltd'],
    country: 'KP',
    dob: null,
    address: 'Donghung Dong, Central District, Pyongyang, DPRK',
    id_numbers: ['UN-KP-OMM-001'],
    programs: ['DPRK', 'UNSCR-2270'],
    source_url: 'https://scsanctions.un.org/consolidated/',
  },
];

export const EU_FIXTURE_ENTRIES: ISanctionsEntry[] = [
  {
    name: 'ROSNEFT AERO',
    aliases: ['Rosneft-Aero', 'RN Aero'],
    country: 'RU',
    dob: null,
    address: '26/1 Sofiyskaya Embankment, Moscow, Russia',
    id_numbers: ['EU-RU-ROS-AERO'],
    programs: ['RUSSIA', 'COUNCIL-REG-269-2014'],
    source_url: 'https://webgate.ec.europa.eu/fsd/fsf',
  },
  {
    name: 'MOGILEVICH, Semion',
    aliases: ['Semyon Mogilevich', 'Semion Yudkovich Mogilevich'],
    country: 'RU',
    dob: '1946-06-30',
    address: 'Moscow, Russia',
    id_numbers: ['EU-RU-IND-001'],
    programs: ['RUSSIA', 'EU-RESTRICTIVE-MEASURES'],
    source_url: 'https://webgate.ec.europa.eu/fsd/fsf',
  },
];

export const UN_FIXTURE_LIST_META = {
  list_name: 'un_consolidated' as const,
  version: '2026-05-10',
  updated_at: new Date('2026-05-10T00:00:00.000Z'),
  entry_count: UN_FIXTURE_ENTRIES.length,
};

export const EU_FIXTURE_LIST_META = {
  list_name: 'eu_restricted' as const,
  version: '2026-05-10',
  updated_at: new Date('2026-05-10T00:00:00.000Z'),
  entry_count: EU_FIXTURE_ENTRIES.length,
};

export async function seedSanctionsFixtures() {
  const lists = [
    { ...OFAC_FIXTURE_LIST_META, entries: OFAC_FIXTURE_ENTRIES },
    { ...UN_FIXTURE_LIST_META, entries: UN_FIXTURE_ENTRIES },
    { ...EU_FIXTURE_LIST_META, entries: EU_FIXTURE_ENTRIES },
  ];

  for (const list of lists) {
    await SanctionsList.updateOne(
      { list_name: list.list_name, version: list.version },
      { $set: list },
      { upsert: true },
    );
  }

  console.log('[seed] Sanctions fixtures: done');
}
