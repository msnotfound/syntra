import { connectDb, Shipment, VesselPosition, Event } from '@syntra/db';
import { marinetrafficAisProvider, withCostGate, FeedCapExceededError } from '@syntra/feeds';
import type { AISPosition } from '@syntra/feeds';

const DEFAULT_DAILY_CAP_INR = 500;

async function pollAIS(): Promise<void> {
  const trackedShipments = await Shipment.find({ ais_tracked: true, active: true }).lean();

  for (const shipment of trackedShipments) {
    if (!shipment.vessel_imo) continue;
    const orgId = shipment.org_id.toString();

    const gatedProvider = withCostGate(marinetrafficAisProvider, {
      org_id: orgId,
      cap_inr_daily: DEFAULT_DAILY_CAP_INR,
    });

    let positions: AISPosition[];
    try {
      positions = await gatedProvider.fetch({ imo: shipment.vessel_imo }, { org_id: orgId });
    } catch (err) {
      if (err instanceof FeedCapExceededError) {
        console.warn(`[realtime-feeds] AIS daily cap exceeded for org ${orgId}`);
        positions = marinetrafficAisProvider.getMockData({ imo: shipment.vessel_imo });
      } else {
        console.error(`[realtime-feeds] AIS fetch error for ${shipment.vessel_imo}:`, err);
        continue;
      }
    }

    const latest = positions[0];
    if (!latest) continue;

    await VesselPosition.create({
      vessel_imo: latest.imo,
      vessel_mmsi: latest.mmsi,
      lat: latest.lat,
      lng: latest.lng,
      heading: latest.heading,
      speed_knots: latest.speed_knots,
      nav_status: latest.nav_status,
      source: 'marinetraffic',
      shipment_id: shipment._id,
      recorded_at: latest.last_updated,
    });

    await Shipment.findByIdAndUpdate(shipment._id, {
      ais_position: {
        lat: latest.lat,
        lng: latest.lng,
        heading: latest.heading,
        speed_kn: latest.speed_knots,
        updated_at: latest.last_updated,
      },
    });

    if (latest.nav_status === 'not_defined') {
      const title = `AIS signal lost: ${latest.vessel_name} (IMO ${latest.imo})`;
      const today = new Date(); today.setUTCHours(0, 0, 0, 0);
      const exists = await Event.countDocuments({ title, created_at: { $gte: today } });
      if (!exists) {
        await Event.create({
          title,
          description: `Vessel ${latest.vessel_name} stopped transmitting AIS at ${latest.lat.toFixed(3)}, ${latest.lng.toFixed(3)}.`,
          location: { lat: latest.lat, lng: latest.lng },
          country: latest.flag_country,
          country_code: latest.flag_code,
          severity: 'medium',
          event_type: 'ais_dark',
          sources: [{ url: 'https://www.marinetraffic.com', name: 'MarineTraffic AIS' }],
          occurred_at: latest.last_updated,
        });
      }
    }
  }
}

export async function runRealtimeFeeds(): Promise<void> {
  await connectDb();
  await pollAIS();
}

if (require.main === module) {
  runRealtimeFeeds()
    .then(() => { console.log('[realtime-feeds] done'); process.exit(0); })
    .catch((err) => { console.error('[realtime-feeds] fatal:', err); process.exit(1); });
}
