// Seed: Sundaram Pharma — demo Indian pharma exporter to Africa
import { Types } from 'mongoose';
import { Organization } from '../models/Organization.js';
import { User } from '../models/User.js';
import { WatchlistEntity } from '../models/WatchlistEntity.js';
import { Event } from '../models/Event.js';
import { Alert } from '../models/Alert.js';

export async function seedSundaramPharma() {
  console.log('[seed] Seeding Sundaram Pharma demo org...');

  // Upsert organization
  let org = await Organization.findOne({ slug: 'sundaram-pharma' });
  if (!org) {
    org = await Organization.create({
      name: 'Sundaram Pharma',
      slug: 'sundaram-pharma',
      plan: 'growth',
      status: 'active',
      contact_email: 'priya@sundarampharma.com',
      contact_phone: '+91 98765 43210',
      industry: 'Pharmaceuticals',
      settings: {
        alert_channels: ['email', 'whatsapp'],
        webhook_url: null,
        severity_threshold: 'medium',
        quiet_hours_start: '22:00',
        quiet_hours_end: '06:00',
        timezone: 'Asia/Kolkata',
      },
      demo_mode: true,
    });
    console.log('[seed] Created org:', org.slug);
  }

  // Upsert demo user
  const existingUser = await User.findOne({ clerk_user_id: 'user_mock_priya' });
  if (!existingUser) {
    await User.create({
      clerk_user_id: 'user_mock_priya',
      email: 'priya@sundarampharma.com',
      name: 'Priya Mehta',
      org_id: org._id,
      role: 'owner',
    });
    console.log('[seed] Created user: Priya Mehta');
  }

  // Watchlist entities — Indian pharma exporter to Africa
  const entities = [
    // Suppliers (12)
    { type: 'supplier', name: 'Aurobindo Pharma HQ',        lat: 17.3850, lng: 78.4867, cc: 'IN', region: 'South Asia', meta: { industry: 'API manufacturing', importance: 5 } },
    { type: 'supplier', name: 'Cipla Goa Plant',             lat: 15.2993, lng: 74.1240, cc: 'IN', region: 'South Asia', meta: { industry: 'Formulations', importance: 4 } },
    { type: 'supplier', name: 'Dr Reddys Hyderabad',         lat: 17.3616, lng: 78.4747, cc: 'IN', region: 'South Asia', meta: { industry: 'Generics', importance: 5 } },
    { type: 'supplier', name: 'Mylan Nashik Facility',       lat: 19.9975, lng: 73.7898, cc: 'IN', region: 'South Asia', meta: { industry: 'Generics', importance: 3 } },
    { type: 'supplier', name: 'Torrent Ahmedabad',           lat: 23.0225, lng: 72.5714, cc: 'IN', region: 'South Asia', meta: { industry: 'Cardiology', importance: 4 } },
    { type: 'supplier', name: 'Lupin Pune Plant',            lat: 18.5204, lng: 73.8567, cc: 'IN', region: 'South Asia', meta: { industry: 'API', importance: 3 } },
    { type: 'supplier', name: 'Sun Pharma Vadodara',         lat: 22.3072, lng: 73.1812, cc: 'IN', region: 'South Asia', meta: { industry: 'Speciality', importance: 4 } },
    { type: 'supplier', name: 'Alkem Daman Plant',           lat: 20.3974, lng: 72.8328, cc: 'IN', region: 'South Asia', meta: { industry: 'Antibiotics', importance: 3 } },
    { type: 'supplier', name: 'Zydus Ahmedabad R&D',         lat: 23.0354, lng: 72.5604, cc: 'IN', region: 'South Asia', meta: { industry: 'Biologics', importance: 4 } },
    { type: 'supplier', name: 'Intas Chennai Facility',      lat: 13.0827, lng: 80.2707, cc: 'IN', region: 'South Asia', meta: { industry: 'Injectables', importance: 3 } },
    { type: 'supplier', name: 'Macleods Mumbai Plant',       lat: 19.0760, lng: 72.8777, cc: 'IN', region: 'South Asia', meta: { industry: 'ARV', importance: 4 } },
    { type: 'supplier', name: 'Strides Bangalore',           lat: 12.9716, lng: 77.5946, cc: 'IN', region: 'South Asia', meta: { industry: 'Softgels', importance: 3 } },
    // Ports (4)
    { type: 'port', name: 'JNPT (Jawaharlal Nehru Port)',  lat: 18.9480, lng: 72.9481, cc: 'IN', region: 'Indian Ocean', meta: { unlocode: 'INNSA', port_type: 'container' } },
    { type: 'port', name: 'Mundra Port',                   lat: 22.8390, lng: 69.7040, cc: 'IN', region: 'Indian Ocean', meta: { unlocode: 'INMUN', port_type: 'container' } },
    { type: 'port', name: 'Chennai Port',                  lat: 13.0827, lng: 80.2946, cc: 'IN', region: 'Indian Ocean', meta: { unlocode: 'INMAA', port_type: 'multipurpose' } },
    { type: 'port', name: 'Cochin Port',                   lat: 9.9312,  lng: 76.2673, cc: 'IN', region: 'Indian Ocean', meta: { unlocode: 'INCOK', port_type: 'container' } },
    // Routes (3)
    { type: 'route', name: 'India → East Africa via Suez', lat: null, lng: null, cc: null, region: 'Red Sea / Suez',
      meta: { buffer_km: 200, waypoints: [
        { lat: 18.9480, lng: 72.9481 }, { lat: 12.0, lng: 45.0 }, { lat: 14.7956, lng: 42.9494 }, { lat: 29.9773, lng: 32.5649 }, { lat: -1.2921, lng: 36.8219 }
      ]} },
    { type: 'route', name: 'India → Gulf via Persian Gulf', lat: null, lng: null, cc: null, region: 'Persian Gulf',
      meta: { buffer_km: 200, waypoints: [
        { lat: 18.9480, lng: 72.9481 }, { lat: 12.0, lng: 62.0 }, { lat: 23.0, lng: 58.0 }, { lat: 25.2048, lng: 55.2708 }
      ]} },
    { type: 'route', name: 'India → Southern Africa direct', lat: null, lng: null, cc: null, region: 'Indian Ocean',
      meta: { buffer_km: 200, waypoints: [
        { lat: 9.9312, lng: 76.2673 }, { lat: 0.0, lng: 73.0 }, { lat: -20.0, lng: 57.0 }, { lat: -25.9692, lng: 32.5732 }
      ]} },
    // Destination countries (8)
    { type: 'country', name: 'Kenya',        lat: -1.2921, lng: 36.8219, cc: 'KE', region: 'East Africa', meta: {} },
    { type: 'country', name: 'Nigeria',      lat: 9.0820,  lng: 8.6753,  cc: 'NG', region: 'West Africa', meta: {} },
    { type: 'country', name: 'Ghana',        lat: 7.9465,  lng: -1.0232, cc: 'GH', region: 'West Africa', meta: {} },
    { type: 'country', name: 'South Africa', lat: -30.5595, lng: 22.9375, cc: 'ZA', region: 'Southern Africa', meta: {} },
    { type: 'country', name: 'UAE',          lat: 23.4241, lng: 53.8478, cc: 'AE', region: 'Gulf', meta: {} },
    { type: 'country', name: 'Saudi Arabia', lat: 23.8859, lng: 45.0792, cc: 'SA', region: 'Gulf', meta: {} },
    { type: 'country', name: 'Egypt',        lat: 26.8206, lng: 30.8025, cc: 'EG', region: 'North Africa', meta: {} },
    { type: 'country', name: 'Tanzania',     lat: -6.3690, lng: 34.8888, cc: 'TZ', region: 'East Africa', meta: {} },
    // Assets (2)
    { type: 'asset', name: 'Nairobi Distribution Warehouse', lat: -1.2833, lng: 36.8167, cc: 'KE', region: 'East Africa', meta: { notes: 'Primary East Africa hub' } },
    { type: 'asset', name: 'Dubai Distribution Hub',          lat: 25.2048, lng: 55.2708, cc: 'AE', region: 'Gulf',        meta: { notes: 'Gulf + MENA hub' } },
  ];

  for (const e of entities) {
    const exists = await WatchlistEntity.findOne({ org_id: org._id, name: e.name });
    if (!exists) {
      await WatchlistEntity.create({
        org_id: org._id,
        type: e.type,
        name: e.name,
        latitude: e.lat,
        longitude: e.lng,
        country_code: e.cc,
        region: e.region,
        metadata: e.meta,
        active: true,
      });
    }
  }
  console.log('[seed] Watchlist entities: done');

  // Seed 8 realistic events
  const now = Date.now();
  const seedEvents = [
    { title: 'Houthi missile strike near Hodeidah port', description: 'Houthi forces struck a commercial vessel near the port of Hodeidah, disrupting maritime traffic in the Bab-el-Mandeb strait.', lat: 14.7956, lng: 42.9494, country: 'Yemen', cc: 'YE', severity: 'critical', type: 'maritime_attack', minsAgo: 4 },
    { title: 'Port closure announced — Mombasa Container Terminal', description: 'Kenya Ports Authority announced temporary closure of Mombasa Container Terminal due to industrial action.', lat: -4.0435, lng: 39.6682, country: 'Kenya', cc: 'KE', severity: 'high', type: 'port_closure', minsAgo: 120 },
    { title: 'New US sanctions update — Iran banking sector', description: 'US Treasury OFAC announced additional designations targeting Iranian financial institutions.', lat: 32.4279, lng: 53.6880, country: 'Iran', cc: 'IR', severity: 'medium', type: 'sanctions', minsAgo: 360 },
    { title: 'Red Sea vessel diversion advisory issued', description: 'International Maritime Organization issued advisory recommending vessels avoid southern Red Sea corridor.', lat: 15.0, lng: 42.0, country: 'Yemen', cc: 'YE', severity: 'high', type: 'maritime_advisory', minsAgo: 600 },
    { title: 'Sudan port infrastructure damage reported', description: 'Port Sudan reports damage to loading infrastructure following nearby military operations.', lat: 19.6180, lng: 37.2164, country: 'Sudan', cc: 'SD', severity: 'medium', type: 'infrastructure_damage', minsAgo: 1440 },
    { title: 'Nigeria dockworkers strike — Apapa terminal', description: 'National Union of Dockworkers announced indefinite strike at Apapa container terminal, Lagos.', lat: 6.4450, lng: 3.3800, country: 'Nigeria', cc: 'NG', severity: 'medium', type: 'labor_action', minsAgo: 2880 },
    { title: 'Egypt Suez Canal transit fee increase', description: 'Suez Canal Authority announced 15% increase in transit fees effective next month for all vessel classes.', lat: 30.0444, lng: 31.2357, country: 'Egypt', cc: 'EG', severity: 'low', type: 'regulatory', minsAgo: 4320 },
    { title: 'Oman Gulf of Oman security incident', description: 'UK Maritime Trade Operations reports unverified security incident in Gulf of Oman, vessels advised caution.', lat: 22.0, lng: 58.0, country: 'Oman', cc: 'OM', severity: 'high', type: 'security_incident', minsAgo: 180 },
  ];

  const eventIds: Types.ObjectId[] = [];
  for (const e of seedEvents) {
    const ts = new Date(now - e.minsAgo * 60 * 1000);
    let event = await Event.findOne({ title: e.title });
    if (!event) {
      event = await Event.create({
        title: e.title,
        description: e.description,
        location: { lat: e.lat, lng: e.lng },
        country: e.country,
        country_code: e.cc,
        severity: e.severity,
        event_type: e.type,
        sources: [{ url: 'https://reuters.com', name: 'Reuters' }, { url: 'https://maritimeexecutive.com', name: 'Maritime Executive' }],
        occurred_at: ts,
      });
    }
    eventIds.push(event._id as Types.ObjectId);
  }
  console.log('[seed] Events: done');

  // Seed 8 pre-written alerts for demo org
  const allEntities = await WatchlistEntity.find({ org_id: org._id });
  const routeEntities = allEntities.filter(e => e.type === 'route');
  const portEntities  = allEntities.filter(e => e.type === 'port');
  const countryEntities = allEntities.filter(e => e.type === 'country');

  const alertDefs = [
    { eventIdx: 0, entities: [routeEntities[0], portEntities[0]], reasons: ['proximity', 'route'], severity: 'critical', acked: false },
    { eventIdx: 1, entities: [countryEntities[0], portEntities[0]], reasons: ['country'], severity: 'high', acked: false },
    { eventIdx: 2, entities: [countryEntities.find(e => e.country_code === 'IR')].filter(Boolean), reasons: ['country'], severity: 'medium', acked: true },
    { eventIdx: 3, entities: [routeEntities[0]], reasons: ['route'], severity: 'high', acked: false },
    { eventIdx: 4, entities: [countryEntities.find(e => e.country_code === 'SD')].filter(Boolean), reasons: ['country'], severity: 'medium', acked: true },
    { eventIdx: 5, entities: [countryEntities.find(e => e.country_code === 'NG')].filter(Boolean), reasons: ['country'], severity: 'medium', acked: false },
    { eventIdx: 6, entities: [countryEntities.find(e => e.country_code === 'EG')].filter(Boolean), reasons: ['country'], severity: 'low', acked: true },
    { eventIdx: 7, entities: [routeEntities[1]].filter(Boolean), reasons: ['route'], severity: 'high', acked: false },
  ];

  for (const def of alertDefs) {
    const eventId = eventIds[def.eventIdx];
    if (!eventId) continue;
    const entityIds = (def.entities as (typeof allEntities[number] | undefined)[])
      .filter((e): e is typeof allEntities[number] => !!e)
      .map(e => e._id as Types.ObjectId);
    if (entityIds.length === 0) continue;

    const existing = await Alert.findOne({ event_id: eventId, org_id: org._id });
    if (!existing) {
      const event = await Event.findById(eventId);
      if (!event) continue;
      await Alert.create({
        org_id: org._id,
        event_id: eventId,
        watchlist_entity_ids: entityIds,
        severity: def.severity,
        match_reasons: def.reasons,
        event_snapshot: {
          title: event.title,
          description: event.description,
          location: event.location,
          country: event.country,
          country_code: event.country_code,
          event_type: event.event_type,
          occurred_at: event.occurred_at,
          sources: event.sources,
        },
        llm_context: {
          why_matters: 'This event falls within your monitored region and may affect your supply chain.',
          recommended_actions: ['Review shipment schedule', 'Contact freight forwarder', 'Monitor situation'],
        },
        dispatched_at: new Date(),
        channels_sent: ['email'],
        acknowledged_at: def.acked ? new Date() : null,
        acknowledged_by_user_id: def.acked ? allEntities[0].org_id : null,
      });
    }
  }
  console.log('[seed] Alerts: done');
  console.log('[seed] Sundaram Pharma seed complete. org_id:', org._id.toString());
  return org;
}
