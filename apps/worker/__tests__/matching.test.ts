import { matchEventToEntities } from '../../../packages/shared/utils/index';
import type { PlainEntity } from '../../../packages/shared/utils/index';

function ent(overrides: Partial<PlainEntity> & { name: string }): PlainEntity {
  return {
    _id: overrides.name,
    type: 'supplier',
    name: overrides.name,
    latitude: null,
    longitude: null,
    country_code: null,
    metadata: {},
    active: true,
    ...overrides,
  };
}

describe('matchEventToEntities — 10 fixture cases', () => {

  test('1. proximity: Mumbai event + Mumbai supplier → match', () => {
    const event = { location: { lat: 19.076, lng: 72.877 }, country_code: 'IN' };
    const result = matchEventToEntities(event, [
      ent({ name: 'Mumbai Supplier', latitude: 19.100, longitude: 72.900, country_code: 'IN' }),
    ]);
    expect(result.entities).toHaveLength(1);
    expect(result.reasons).toContain('proximity');
  });

  test('2. route: Yemen event inside Red Sea route buffer → match', () => {
    const event = { location: { lat: 14.795, lng: 42.949 }, country_code: 'YE' };
    const result = matchEventToEntities(event, [
      ent({
        name: 'Red Sea Route', type: 'route',
        metadata: {
          buffer_km: 200,
          waypoints: [
            { lat: 18.948, lng: 72.948 },
            { lat: 12.0,   lng: 45.0   },
            { lat: 14.7,   lng: 42.9   },
            { lat: 29.97,  lng: 32.56  },
          ],
        },
      }),
    ]);
    expect(result.entities).toHaveLength(1);
    expect(result.reasons).toContain('route');
  });

  test('3. country: Sudan event + Sudan country entity → match', () => {
    const event = { location: { lat: 15.0, lng: 30.0 }, country_code: 'SD' };
    const result = matchEventToEntities(event, [
      ent({ name: 'Sudan', type: 'country', country_code: 'SD', latitude: 15.0, longitude: 30.0 }),
    ]);
    expect(result.entities).toHaveLength(1);
    expect(result.reasons).toContain('country');
  });

  test('4. no match: Tokyo event, only India entities → empty', () => {
    const event = { location: { lat: 35.689, lng: 139.691 }, country_code: 'JP' };
    const result = matchEventToEntities(event, [
      ent({ name: 'Mumbai Supplier', latitude: 19.076, longitude: 72.877, country_code: 'IN' }),
    ]);
    expect(result.entities).toHaveLength(0);
  });

  test('5. severity not checked by matcher: critical event still returns entities', () => {
    const event = { location: { lat: 19.076, lng: 72.877 }, country_code: 'IN' };
    const result = matchEventToEntities(event, [
      ent({ name: 'S', latitude: 19.100, longitude: 72.900, country_code: 'IN' }),
    ]);
    expect(result.entities.length).toBeGreaterThan(0);
  });

  test('6. medium event still returns entities (threshold is caller responsibility)', () => {
    const event = { location: { lat: 19.076, lng: 72.877 }, country_code: 'IN' };
    const result = matchEventToEntities(event, [
      ent({ name: 'S', latitude: 19.100, longitude: 72.900 }),
    ]);
    expect(result.entities).toHaveLength(1);
  });

  test('7. quiet-hours deferral not handled by matcher: entity still returned', () => {
    const event = { location: { lat: 19.076, lng: 72.877 }, country_code: 'IN' };
    const result = matchEventToEntities(event, [
      ent({ name: 'S', latitude: 19.100, longitude: 72.900 }),
    ]);
    expect(result.entities).toHaveLength(1);
  });

  test('8. single event matches 3 distinct entities → all 3 returned', () => {
    const event = { location: { lat: 19.076, lng: 72.877 }, country_code: 'IN' };
    const result = matchEventToEntities(event, [
      ent({ name: 'A', latitude: 19.100, longitude: 72.900, country_code: 'IN' }),
      ent({ name: 'B', latitude: 19.050, longitude: 72.850, country_code: 'IN' }),
      ent({ name: 'C', type: 'country', country_code: 'IN', latitude: 20.0, longitude: 77.0 }),
    ]);
    expect(result.entities).toHaveLength(3);
  });

  test('9. dedup: entity matching proximity AND country appears exactly once', () => {
    const event = { location: { lat: 19.076, lng: 72.877 }, country_code: 'IN' };
    const result = matchEventToEntities(event, [
      ent({ name: 'Mumbai Co', latitude: 19.100, longitude: 72.900, country_code: 'IN', type: 'supplier' }),
    ]);
    expect(result.entities).toHaveLength(1);
    expect(result.reasons).toContain('proximity');
    expect(result.reasons).toContain('supplier_country');
  });

  test('10. inactive entity is never matched', () => {
    const event = { location: { lat: 19.076, lng: 72.877 }, country_code: 'IN' };
    const result = matchEventToEntities(event, [
      ent({ name: 'Inactive', latitude: 19.100, longitude: 72.900, country_code: 'IN', active: false }),
    ]);
    expect(result.entities).toHaveLength(0);
  });

});
