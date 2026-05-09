import mongoose from 'mongoose';
import { createHmac } from 'crypto';
import { buildSlackCard } from '../app/api/integrations/slack/dispatch-helpers';
import { validateSlackSignature } from '../app/api/integrations/slack/actions/route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAlert(overrides: Partial<Parameters<typeof buildSlackCard>[0]> = {}) {
  return {
    _id: new mongoose.Types.ObjectId(),
    severity: 'high' as const,
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
    ...overrides,
  };
}

const APP_URL = 'https://app.syntra.app';

// ---------------------------------------------------------------------------
// Card payload structure
// ---------------------------------------------------------------------------

describe('buildSlackCard — structure', () => {
  test('returns top-level text and blocks array', () => {
    const card = buildSlackCard(makeAlert(), APP_URL);
    expect(typeof card.text).toBe('string');
    expect(Array.isArray(card.blocks)).toBe(true);
    expect(card.blocks.length).toBeGreaterThan(0);
  });

  test('header block contains severity and title', () => {
    const alert = makeAlert();
    const card = buildSlackCard(alert, APP_URL);
    const header = card.blocks.find((b: any) => b.type === 'header') as any;
    expect(header).toBeDefined();
    expect(header.text.text).toContain('HIGH');
    expect(header.text.text).toContain(alert.event_snapshot.title);
  });

  test('header emoji matches severity', () => {
    const criticalCard = buildSlackCard(makeAlert({ severity: 'critical' }), APP_URL);
    const header = criticalCard.blocks.find((b: any) => b.type === 'header') as any;
    expect(header.text.text).toContain('🔴');

    const lowCard = buildSlackCard(makeAlert({ severity: 'low' }), APP_URL);
    const lowHeader = lowCard.blocks.find((b: any) => b.type === 'header') as any;
    expect(lowHeader.text.text).toContain('🔵');
  });

  test('context block includes country', () => {
    const card = buildSlackCard(makeAlert(), APP_URL);
    const ctx = card.blocks.find((b: any) => b.type === 'context') as any;
    expect(ctx).toBeDefined();
    expect(ctx.elements[0].text).toContain('India');
  });

  test('why_matters section included when present', () => {
    const card = buildSlackCard(makeAlert(), APP_URL);
    const section = card.blocks.find(
      (b: any) => b.type === 'section' && b.text?.text?.includes('Why this matters'),
    ) as any;
    expect(section).toBeDefined();
    expect(section.text.text).toContain('Mundra');
  });

  test('why_matters section omitted when null', () => {
    const alert = makeAlert({ llm_context: { why_matters: null, recommended_actions: [] } });
    const card = buildSlackCard(alert, APP_URL);
    const section = card.blocks.find(
      (b: any) => b.type === 'section' && b.text?.text?.includes('Why this matters'),
    );
    expect(section).toBeUndefined();
  });

  test('actions block has three buttons', () => {
    const card = buildSlackCard(makeAlert(), APP_URL);
    const actions = card.blocks.find((b: any) => b.type === 'actions') as any;
    expect(actions).toBeDefined();
    expect(actions.elements).toHaveLength(3);
  });

  test('acknowledge button is primary style', () => {
    const card = buildSlackCard(makeAlert(), APP_URL);
    const actions = card.blocks.find((b: any) => b.type === 'actions') as any;
    const ack = actions.elements.find((e: any) => e.action_id === 'acknowledge');
    expect(ack).toBeDefined();
    expect(ack.style).toBe('primary');
  });

  test('all buttons carry the alertId as value', () => {
    const alert = makeAlert();
    const alertId = String(alert._id);
    const card = buildSlackCard(alert, APP_URL);
    const actions = card.blocks.find((b: any) => b.type === 'actions') as any;
    for (const el of actions.elements) {
      expect(el.value).toBe(alertId);
    }
  });

  test('open_in_app button contains correct URL', () => {
    const alert = makeAlert();
    const card = buildSlackCard(alert, APP_URL);
    const actions = card.blocks.find((b: any) => b.type === 'actions') as any;
    const openBtn = actions.elements.find((e: any) => e.action_id === 'open_in_app');
    expect(openBtn.url).toBe(`${APP_URL}/app/alerts/${String(alert._id)}`);
  });
});

// ---------------------------------------------------------------------------
// Signature validation
// ---------------------------------------------------------------------------

describe('validateSlackSignature', () => {
  const secret = 'test-signing-secret';

  function makeValidSig(body: string, timestamp: string) {
    const base = `v0:${timestamp}:${body}`;
    const hash = createHmac('sha256', secret).update(base).digest('hex');
    return `v0=${hash}`;
  }

  test('returns true for a valid signature', () => {
    const body = 'payload={}';
    const ts = Math.floor(Date.now() / 1000).toString();
    const sig = makeValidSig(body, ts);
    expect(validateSlackSignature(secret, ts, body, sig)).toBe(true);
  });

  test('returns false for an invalid signature', () => {
    const body = 'payload={}';
    const ts = Math.floor(Date.now() / 1000).toString();
    expect(validateSlackSignature(secret, ts, body, 'v0=badsig')).toBe(false);
  });

  test('returns false for a stale timestamp (>5 min)', () => {
    const body = 'payload={}';
    const staleTs = (Math.floor(Date.now() / 1000) - 400).toString();
    const sig = makeValidSig(body, staleTs);
    expect(validateSlackSignature(secret, staleTs, body, sig)).toBe(false);
  });

  test('returns false when signature length differs', () => {
    const body = 'payload={}';
    const ts = Math.floor(Date.now() / 1000).toString();
    const shortSig = 'v0=abc';
    expect(validateSlackSignature(secret, ts, body, shortSig)).toBe(false);
  });
});
