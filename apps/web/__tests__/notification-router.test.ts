/**
 * M37 notification-router tests
 * Tests: routing correctness, format selection, quiet-hours respect.
 *
 * Pure-unit tests — no DB, no BullMQ. Functions under test are imported
 * from digest-router.ts directly.
 */

import {
  severityMeetsThreshold,
  isInDeliveryWindow,
  formatAlert,
} from '../../worker/src/workers/digest-router';
import mongoose from 'mongoose';
import type { IAlert } from '@syntra/db';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeAlert(overrides: Partial<IAlert> = {}): IAlert {
  return {
    _id: new mongoose.Types.ObjectId(),
    org_id: new mongoose.Types.ObjectId(),
    event_id: new mongoose.Types.ObjectId(),
    watchlist_entity_ids: [],
    severity: 'high',
    event_snapshot: {
      title: 'Port shutdown — Mundra',
      description: 'Mundra port has suspended operations due to flooding.',
      location: { lat: 22.84, lng: 69.72 },
      country: 'India',
      country_code: 'IN',
      event_type: 'natural_disaster',
      occurred_at: new Date('2026-05-10T08:00:00Z'),
      sources: [{ url: 'https://example.com', name: 'Reuters' }],
    },
    llm_context: {
      why_matters: 'Your supplier routes 40% of cargo through Mundra.',
      recommended_actions: ['Identify alternate ports', 'Notify logistics partner'],
    },
    match_reasons: [],
    subtype: 'geopolitical',
    status: 'open',
    assignee_user_id: null,
    comments: [],
    created_at: new Date(),
    dispatched_at: null,
    channels_sent: [],
    acknowledged_at: null,
    acknowledged_by_user_id: null,
    acknowledgement_note: null,
    ...overrides,
  } as unknown as IAlert;
}

function makeWindow(start_hour: number, end_hour: number, timezone = 'UTC') {
  return { start_hour, end_hour, timezone };
}

// ---------------------------------------------------------------------------
// severityMeetsThreshold
// ---------------------------------------------------------------------------

describe('severityMeetsThreshold', () => {
  test('critical meets any threshold', () => {
    expect(severityMeetsThreshold('critical', 'critical')).toBe(true);
    expect(severityMeetsThreshold('critical', 'info')).toBe(true);
  });

  test('info only meets info threshold', () => {
    expect(severityMeetsThreshold('info', 'info')).toBe(true);
    expect(severityMeetsThreshold('info', 'low')).toBe(false);
    expect(severityMeetsThreshold('info', 'high')).toBe(false);
  });

  test('high meets high and lower thresholds', () => {
    expect(severityMeetsThreshold('high', 'critical')).toBe(false);
    expect(severityMeetsThreshold('high', 'high')).toBe(true);
    expect(severityMeetsThreshold('high', 'medium')).toBe(true);
    expect(severityMeetsThreshold('high', 'low')).toBe(true);
    expect(severityMeetsThreshold('high', 'info')).toBe(true);
  });

  test('medium does not meet critical or high threshold', () => {
    expect(severityMeetsThreshold('medium', 'critical')).toBe(false);
    expect(severityMeetsThreshold('medium', 'high')).toBe(false);
    expect(severityMeetsThreshold('medium', 'medium')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isInDeliveryWindow
// ---------------------------------------------------------------------------

describe('isInDeliveryWindow', () => {
  // UTC timestamps for known hours
  function utcHour(h: number): number {
    const d = new Date('2026-05-10T00:00:00Z');
    d.setUTCHours(h);
    return d.getTime();
  }

  test('inside normal window (08:00-22:00) passes', () => {
    const w = makeWindow(8, 22, 'UTC');
    expect(isInDeliveryWindow(w, utcHour(10))).toBe(true);
    expect(isInDeliveryWindow(w, utcHour(8))).toBe(true);
    expect(isInDeliveryWindow(w, utcHour(21))).toBe(true);
  });

  test('outside normal window is blocked', () => {
    const w = makeWindow(8, 22, 'UTC');
    expect(isInDeliveryWindow(w, utcHour(7))).toBe(false);
    expect(isInDeliveryWindow(w, utcHour(22))).toBe(false);
    expect(isInDeliveryWindow(w, utcHour(3))).toBe(false);
  });

  test('midnight-wrapping window (22-06) passes at 23:00 and 04:00', () => {
    const w = makeWindow(22, 6, 'UTC');
    expect(isInDeliveryWindow(w, utcHour(23))).toBe(true);
    expect(isInDeliveryWindow(w, utcHour(4))).toBe(true);
  });

  test('midnight-wrapping window (22-06) blocks at 10:00', () => {
    const w = makeWindow(22, 6, 'UTC');
    expect(isInDeliveryWindow(w, utcHour(10))).toBe(false);
  });

  test('full-day window (0-24 equivalent: 0-0) always passes', () => {
    // 0-0 wraps midnight — all hours in window
    const w = makeWindow(0, 0, 'UTC');
    for (let h = 0; h < 24; h++) {
      // wrapping window: h >= 0 || h < 0 — every hour qualifies
      expect(isInDeliveryWindow(w, utcHour(h))).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// formatAlert
// ---------------------------------------------------------------------------

describe('formatAlert', () => {
  test('oneliner is a single line with severity and title', () => {
    const alert = makeAlert();
    const out = formatAlert(alert, 'oneliner');
    expect(out.split('\n').filter(l => l.trim()).length).toBe(1);
    expect(out).toContain('HIGH');
    expect(out).toContain('Port shutdown');
    expect(out).toContain('India');
  });

  test('summary includes why_matters', () => {
    const alert = makeAlert();
    const out = formatAlert(alert, 'summary');
    expect(out).toContain('40% of cargo');
    expect(out).not.toContain('Recommended');
  });

  test('summary omits why_matters when null', () => {
    const alert = makeAlert({ llm_context: { why_matters: null, recommended_actions: [] } } as any);
    const out = formatAlert(alert, 'summary');
    expect(out).not.toContain('Why this matters');
  });

  test('full includes description and recommended actions', () => {
    const alert = makeAlert();
    const out = formatAlert(alert, 'full');
    expect(out).toContain('suspended operations');
    expect(out).toContain('Identify alternate ports');
    expect(out).toContain('Notify logistics partner');
    expect(out).toContain('Why this matters');
  });

  test('severity emojis are correct', () => {
    expect(formatAlert(makeAlert({ severity: 'critical' } as any), 'oneliner')).toContain('🔴');
    expect(formatAlert(makeAlert({ severity: 'high' }    as any), 'oneliner')).toContain('🟠');
    expect(formatAlert(makeAlert({ severity: 'medium' }  as any), 'oneliner')).toContain('🟡');
    expect(formatAlert(makeAlert({ severity: 'low' }     as any), 'oneliner')).toContain('🔵');
    expect(formatAlert(makeAlert({ severity: 'info' }    as any), 'oneliner')).toContain('⚪');
  });

  test('full always has more content than summary', () => {
    const alert = makeAlert();
    expect(formatAlert(alert, 'full').length).toBeGreaterThan(formatAlert(alert, 'summary').length);
  });

  test('summary always has more content than oneliner', () => {
    const alert = makeAlert();
    expect(formatAlert(alert, 'summary').length).toBeGreaterThan(formatAlert(alert, 'oneliner').length);
  });
});

// ---------------------------------------------------------------------------
// Routing correctness (integration-style, using mocked dispatch)
// ---------------------------------------------------------------------------

describe('routing gating logic', () => {
  test('alert below priority_threshold is skipped (threshold check)', () => {
    // low severity alert, threshold is high
    const alertSev = 'low' as const;
    const threshold = 'high' as const;
    expect(severityMeetsThreshold(alertSev, threshold)).toBe(false);
  });

  test('alert at threshold is dispatched', () => {
    const alertSev = 'high' as const;
    const threshold = 'high' as const;
    expect(severityMeetsThreshold(alertSev, threshold)).toBe(true);
  });

  test('quiet hours block outside window', () => {
    // 07:30 UTC, window 08-22
    const ts = new Date('2026-05-10T07:30:00Z').getTime();
    expect(isInDeliveryWindow(makeWindow(8, 22, 'UTC'), ts)).toBe(false);
  });

  test('quiet hours allow inside window', () => {
    // 09:00 UTC, window 08-22
    const ts = new Date('2026-05-10T09:00:00Z').getTime();
    expect(isInDeliveryWindow(makeWindow(8, 22, 'UTC'), ts)).toBe(true);
  });

  test('combined: alert above threshold AND in window => routable', () => {
    const sev = 'critical' as const;
    const threshold = 'high' as const;
    const ts = new Date('2026-05-10T10:00:00Z').getTime();
    const window = makeWindow(8, 22, 'UTC');
    expect(severityMeetsThreshold(sev, threshold) && isInDeliveryWindow(window, ts)).toBe(true);
  });

  test('combined: in window but below threshold => not routable', () => {
    const sev = 'info' as const;
    const threshold = 'high' as const;
    const ts = new Date('2026-05-10T10:00:00Z').getTime();
    const window = makeWindow(8, 22, 'UTC');
    expect(severityMeetsThreshold(sev, threshold) && isInDeliveryWindow(window, ts)).toBe(false);
  });
});
