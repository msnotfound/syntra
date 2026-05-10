'use client';
import { useEffect, useRef } from 'react';

interface WatchlistPin {
  id: string;
  lat: number;
  lng: number;
  name: string;
  type: string;
}

interface EventPin {
  id: string;
  lat: number;
  lng: number;
  severity: string;
  title: string;
}

interface WorldMapProps {
  watchlistPins?: WatchlistPin[];
  eventPins?: EventPin[];
  center?: [number, number];
  zoom?: number;
  height?: string;
}

export function WorldMap({
  watchlistPins = [],
  eventPins = [],
  center = [20, 0],
  zoom = 2,
  height = '100%',
}: WorldMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? 'pk.placeholder';

    import('mapbox-gl').then(({ default: mapboxgl }) => {
      mapboxgl.accessToken = token;

      const map = new mapboxgl.Map({
        container: containerRef.current!,
        style: 'mapbox://styles/mapbox/dark-v11',
        center,
        zoom,
        attributionControl: false,
      });
      mapRef.current = map;

      map.on('load', () => {
        // Watchlist pins — blue dots
        for (const pin of watchlistPins) {
          const el = document.createElement('div');
          el.className = 'w-3 h-3 rounded-full border-2 border-text-primary bg-accent';
          el.style.cssText = 'width:12px;height:12px;border-radius:50%;background:#3B82F6;border:2px solid rgba(255,255,255,0.5);';
          new mapboxgl.Marker(el).setLngLat([pin.lng, pin.lat]).addTo(map);
        }

        // Event pins — severity-colored with pulse
        for (const pin of eventPins) {
          const color = {
            critical: '#EF4444', high: '#F97316', medium: '#EAB308', low: '#60A5FA', info: '#94A3B8',
          }[pin.severity] ?? '#94A3B8';

          const el = document.createElement('div');
          el.style.cssText = `position:relative;width:16px;height:16px;`;

          const pulse = document.createElement('div');
          pulse.style.cssText = `position:absolute;inset:0;border-radius:50%;background:${color};opacity:0.4;animation:pulse-ring 2s ease-in-out infinite;`;

          const dot = document.createElement('div');
          dot.style.cssText = `position:absolute;inset:4px;border-radius:50%;background:${color};`;

          el.appendChild(pulse);
          el.appendChild(dot);
          new mapboxgl.Marker(el).setLngLat([pin.lng, pin.lat]).addTo(map);
        }

        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');
      });
    }).catch(() => {
      // Mapbox token invalid / network error — show placeholder
    });

    return () => {
      if (mapRef.current) (mapRef.current as { remove: () => void }).remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div className="relative rounded-md overflow-hidden bg-[#0A0A0A]" style={{ height }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {!process.env.NEXT_PUBLIC_MAPBOX_TOKEN && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-xs text-text-muted font-mono">Map requires NEXT_PUBLIC_MAPBOX_TOKEN</span>
        </div>
      )}
    </div>
  );
}
