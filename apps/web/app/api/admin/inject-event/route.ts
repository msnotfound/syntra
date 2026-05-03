import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';
import { Organization, WatchlistEntity, Event, Alert } from '@syntra/db';
import { haversineKm, pointNearPolyline, meetsThreshold } from '@syntra/shared';
import type { IOrganization, IWatchlistEntity } from '@syntra/db';
import type { MatchReason } from '@syntra/shared';

const PRESETS: Record<string, { title: string; description: string; country: string; country_code: string; lat: number; lng: number; severity: string; event_type: string; sources: Array<{ url: string; name: string }> }> = {
  red_sea_strike: {
    title: 'LIVE: Houthi drone strike — MSC Tavita diverts away from Suez',
    description: 'Houthi forces launched a coordinated drone attack on the MSC Tavita near Bab-el-Mandeb. The vessel has diverted south and is transiting Cape of Good Hope. All India–East Africa sailings via Suez suspended by carrier.',
    country: 'Yemen', country_code: 'YE', lat: 14.79, lng: 42.94, severity: 'critical', event_type: 'maritime_attack',
    sources: [{ url: 'https://maritimeexecutive.com/live/msc-tavita-2025', name: 'Maritime Executive' }, { url: 'https://reuters.com/world/middle-east/houthi-drone-2025', name: 'Reuters' }],
  },
  mombasa_closure: {
    title: 'LIVE: Mombasa Port authority suspends operations — worker lockout',
    description: 'Kenya Ports Authority issued an emergency lockout order at all Mombasa container berths following escalation in dock worker dispute. All inbound vessels diverted to Dar es Salaam.',
    country: 'Kenya', country_code: 'KE', lat: -4.04, lng: 39.67, severity: 'high', event_type: 'port_closure',
    sources: [{ url: 'https://portcalls.com/mombasa-lockout-2025', name: 'Port Calls' }, { url: 'https://reuters.com/world/africa/mombasa-2025', name: 'Reuters' }],
  },
  india_cyclone: {
    title: 'LIVE: Cyclone alert upgraded to Very Severe — Chennai Port suspended',
    description: 'IMD has upgraded Cyclone Mocha to Very Severe Cyclonic Storm. All Chennai Port operations suspended until further notice. Shipments at berth or anchorage face 5–7 day delay minimum.',
    country: 'India', country_code: 'IN', lat: 13.08, lng: 80.29, severity: 'high', event_type: 'natural_disaster',
    sources: [{ url: 'https://mausam.imd.gov.in/live/mocha-upgrade', name: 'IMD India' }, { url: 'https://maritimeexecutive.com/chennai-cyclone-live', name: 'Maritime Executive' }],
  },
  nigeria_strike: {
    title: 'LIVE: Apapa Terminal dockers walk off — indefinite strike declared',
    description: 'Dockworkers at Apapa Container Terminal walked off the job at 06:00 WAT. NPA declares force majeure on all inbound vessels. Delays of 14+ days expected.',
    country: 'Nigeria', country_code: 'NG', lat: 6.45, lng: 3.38, severity: 'medium', event_type: 'labor_action',
    sources: [{ url: 'https://businessday.ng/maritime/apapa-strike-live', name: 'BusinessDay Nigeria' }],
  },
};

function matchToEntities(event: { location: { lat: number; lng: number }; country_code: string }, entities: IWatchlistEntity[]) {
  const matched = new Map<string, { entity: IWatchlistEntity; reasons: Set<MatchReason> }>();

  for (const entity of entities) {
    if (!entity.active) continue;
    const key = String(entity._id);

    if (entity.latitude !== null && entity.longitude !== null) {
      const dist = haversineKm(entity.latitude, entity.longitude, event.location.lat, event.location.lng);
      if (dist <= 200) {
        if (!matched.has(key)) matched.set(key, { entity, reasons: new Set() });
        matched.get(key)!.reasons.add('proximity');
      }
    }

    if (entity.country_code && entity.country_code === event.country_code) {
      if (!matched.has(key)) matched.set(key, { entity, reasons: new Set() });
      const reasons = matched.get(key)!.reasons;
      reasons.add(entity.type === 'country' || entity.type === 'region' ? 'country' : 'supplier_country');
    }

    if (entity.type === 'route') {
      const meta = entity.metadata as { waypoints?: Array<{ lat: number; lng: number }>; buffer_km?: number };
      const waypoints = meta.waypoints ?? [];
      const bufferKm = meta.buffer_km ?? 200;
      if (waypoints.length >= 2 && pointNearPolyline(waypoints, event.location, bufferKm)) {
        if (!matched.has(key)) matched.set(key, { entity, reasons: new Set() });
        matched.get(key)!.reasons.add('route');
      }
    }
  }

  const entities_out: IWatchlistEntity[] = [];
  const reasons_out = new Set<MatchReason>();
  for (const { entity, reasons } of matched.values()) {
    entities_out.push(entity);
    reasons.forEach(r => reasons_out.add(r));
  }
  return { entities: entities_out, reasons: [...reasons_out] };
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const preset = PRESETS[body.preset as string];
  if (!preset) return NextResponse.json({ error: 'Unknown preset' }, { status: 400 });

  await ensureDb();

  const newEvent = await Event.create({
    title: preset.title,
    description: preset.description,
    location: { lat: preset.lat, lng: preset.lng },
    country: preset.country,
    country_code: preset.country_code,
    severity: preset.severity,
    event_type: preset.event_type,
    sources: preset.sources,
    occurred_at: new Date(),
    processed: false,
  });

  const orgs = await Organization.find({ status: 'active' }).lean() as unknown as IOrganization[];
  const alertIds: string[] = [];

  for (const org of orgs) {
    const entities = await WatchlistEntity.find({ org_id: org._id, active: true }).lean() as unknown as IWatchlistEntity[];
    const { entities: matched, reasons } = matchToEntities(
      { location: newEvent.location, country_code: newEvent.country_code },
      entities,
    );
    if (matched.length === 0) continue;
    if (!meetsThreshold(newEvent.severity, org.settings.severity_threshold)) continue;

    const alert = await Alert.create({
      org_id: org._id,
      event_id: newEvent._id,
      watchlist_entity_ids: matched.map(e => e._id),
      severity: newEvent.severity,
      match_reasons: reasons,
      event_snapshot: {
        title: newEvent.title,
        description: newEvent.description,
        location: newEvent.location,
        country: newEvent.country,
        country_code: newEvent.country_code,
        event_type: newEvent.event_type,
        occurred_at: newEvent.occurred_at,
        sources: newEvent.sources,
      },
      llm_context: {
        why_matters: `Live event injected for demo. ${matched.length} watchlist ${matched.length === 1 ? 'entity' : 'entities'} matched: ${matched.map(e => e.name).join(', ')}.`,
        recommended_actions: ['Review shipment schedule', 'Contact freight forwarder', 'Monitor situation updates'],
      },
    });
    alertIds.push(String(alert._id));
  }

  return NextResponse.json({ ok: true, alertsCreated: alertIds.length, alertIds });
}
