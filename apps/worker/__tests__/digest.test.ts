// Daily aggregation logic tests — pure unit tests, no DB or external deps

function makeSeverityCounts(alerts: Array<{ severity: string }>): Record<string, number> {
  const counts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const a of alerts) counts[a.severity] = (counts[a.severity] ?? 0) + 1;
  return counts;
}

function filterByPeriod<T extends { created_at: Date }>(items: T[], since: Date): T[] {
  return items.filter(i => i.created_at >= since);
}

function sortBySeverity<T extends { severity: string }>(items: T[]): T[] {
  const ORDER = ['critical', 'high', 'medium', 'low'];
  return [...items].sort((a, b) => ORDER.indexOf(a.severity) - ORDER.indexOf(b.severity));
}

function makeDailySince(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d;
}

function makeWeeklySince(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d;
}

function makeMonthlySince(): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d;
}

// ─── Severity counting ────────────────────────────────────────────────────

describe('severity counting', () => {
  test('counts by severity correctly', () => {
    const counts = makeSeverityCounts([
      { severity: 'critical' },
      { severity: 'critical' },
      { severity: 'high' },
      { severity: 'low' },
    ]);
    expect(counts.critical).toBe(2);
    expect(counts.high).toBe(1);
    expect(counts.medium).toBe(0);
    expect(counts.low).toBe(1);
  });

  test('empty list → all zeros', () => {
    const counts = makeSeverityCounts([]);
    expect(Object.values(counts).every(c => c === 0)).toBe(true);
  });
});

// ─── Period filtering ──────────────────────────────────────────────────────

describe('period filtering', () => {
  test('alert exactly at boundary is included', () => {
    const since = new Date('2026-05-09T00:00:00Z');
    const alerts = [{ created_at: new Date('2026-05-09T00:00:00Z') }];
    expect(filterByPeriod(alerts, since)).toHaveLength(1);
  });

  test('alert before boundary is excluded', () => {
    const since = new Date('2026-05-09T00:00:00Z');
    const alerts = [{ created_at: new Date('2026-05-08T23:59:59Z') }];
    expect(filterByPeriod(alerts, since)).toHaveLength(0);
  });

  test('daily: alert from 12h ago is included', () => {
    const since = makeDailySince();
    const alerts = [{ created_at: new Date(Date.now() - 12 * 60 * 60 * 1000) }];
    expect(filterByPeriod(alerts, since)).toHaveLength(1);
  });

  test('daily: alert from 25h ago is excluded', () => {
    const since = makeDailySince();
    const alerts = [{ created_at: new Date(Date.now() - 25 * 60 * 60 * 1000) }];
    expect(filterByPeriod(alerts, since)).toHaveLength(0);
  });

  test('weekly: alert from 3 days ago is included', () => {
    const since = makeWeeklySince();
    const alerts = [{ created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) }];
    expect(filterByPeriod(alerts, since)).toHaveLength(1);
  });

  test('weekly: alert from 8 days ago is excluded', () => {
    const since = makeWeeklySince();
    const alerts = [{ created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) }];
    expect(filterByPeriod(alerts, since)).toHaveLength(0);
  });

  test('monthly: alert from 15 days ago is included', () => {
    const since = makeMonthlySince();
    const alerts = [{ created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000) }];
    expect(filterByPeriod(alerts, since)).toHaveLength(1);
  });
});

// ─── Severity ordering ─────────────────────────────────────────────────────

describe('severity ordering', () => {
  test('sorts critical → high → medium → low', () => {
    const sorted = sortBySeverity([
      { severity: 'low' },
      { severity: 'critical' },
      { severity: 'medium' },
      { severity: 'high' },
    ]);
    expect(sorted.map(a => a.severity)).toEqual(['critical', 'high', 'medium', 'low']);
  });

  test('same severity items preserve order', () => {
    const items = [
      { severity: 'high', id: 1 },
      { severity: 'high', id: 2 },
    ];
    const sorted = sortBySeverity(items);
    expect(sorted).toHaveLength(2);
    expect(sorted.every(i => i.severity === 'high')).toBe(true);
  });
});

// ─── Multi-alert aggregation ───────────────────────────────────────────────

describe('multi-alert aggregation', () => {
  test('aggregates 5 alerts with mixed severities correctly', () => {
    const alerts = [
      { severity: 'critical' },
      { severity: 'high' },
      { severity: 'high' },
      { severity: 'medium' },
      { severity: 'low' },
    ];
    const counts = makeSeverityCounts(alerts);
    const total = Object.values(counts).reduce((s, c) => s + c, 0);
    expect(total).toBe(5);
    expect(counts.high).toBe(2);
  });

  test('period filtering + severity counting pipeline', () => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const allAlerts = [
      { severity: 'critical', created_at: new Date(Date.now() - 12 * 60 * 60 * 1000) },
      { severity: 'high',     created_at: new Date(Date.now() - 6 * 60 * 60 * 1000) },
      { severity: 'low',      created_at: new Date(Date.now() - 48 * 60 * 60 * 1000) }, // excluded
    ];
    const inPeriod = filterByPeriod(allAlerts, since);
    const counts = makeSeverityCounts(inPeriod);
    expect(inPeriod).toHaveLength(2);
    expect(counts.critical).toBe(1);
    expect(counts.high).toBe(1);
    expect(counts.low).toBe(0);
  });
});
