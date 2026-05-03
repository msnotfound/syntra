import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';
import { Event } from '@syntra/db';

const SCENARIOS: Record<string, { title: string; description: string; country_code: string; lat: number; lng: number; severity: string }> = {
  'red-sea': { title: 'Red Sea shipping disruption — Houthi strikes reported', description: 'Vessel attacks in the Bab el-Mandeb strait. Major container lines diverting via Cape of Good Hope.', country_code: 'YE', lat: 14.795, lng: 42.949, severity: 'critical' },
  'india-rain': { title: 'Cyclone warning — Gujarat coastline', description: 'IMD issues red alert. Ports at Mundra and Kandla suspending operations for 48h.', country_code: 'IN', lat: 22.7, lng: 71.4, severity: 'high' },
  'sudan-unrest': { title: 'Civil unrest escalates in Khartoum', description: 'Armed clashes near industrial zones. UK/US embassies advising nationals to shelter in place.', country_code: 'SD', lat: 15.5, lng: 32.5, severity: 'high' },
};

export async function POST(req: NextRequest) {
  const { scenarioId } = await req.json();
  const s = SCENARIOS[scenarioId];
  if (!s) return NextResponse.json({ error: 'Unknown scenario' }, { status: 400 });

  await ensureDb();
  await Event.create({
    title: s.title,
    description: s.description,
    source: { url: 'https://demo.syntra.app', name: 'Syntra Demo' },
    severity: s.severity,
    country_code: s.country_code,
    location: { lat: s.lat, lng: s.lng },
    tags: ['demo'],
    processed: false,
  });
  return NextResponse.json({ ok: true });
}
