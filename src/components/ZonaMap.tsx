'use client';

import { useEffect, useRef } from 'react';

export interface ChapelMapPoint {
  id: string | number;
  name: string;
  lat?: number;
  lng?: number;
  zonaId: number;
  estadoComunidad?: string;
  comunidadNombre?: string;
  markerColor?: string;
}

interface ZonaMapProps {
  chapels?: ChapelMapPoint[];
  selectedZone?: number | null;
  height?: string;
  zoneColors?: Record<number, string>;
  polygons?: Record<number, [number, number][]>;
  tempPolygon?: [number, number][];
  showAllZones?: boolean;
  mapCenterLat?: number;
  mapCenterLng?: number;
  mapZoom?: number;
  scrollWheelZoom?: boolean;
  drawingMode?: boolean;
  hideFallbackPolygon?: boolean;
}

// Default zone color palette
const DEFAULT_ZONE_COLORS: Record<number, { fill: string; border: string; text: string }> = {
  1: { fill: 'rgba(59, 130, 246, 0.35)',  border: '#3B82F6', text: 'Zona 1' },
  2: { fill: 'rgba(34, 197, 94, 0.35)',   border: '#22C55E', text: 'Zona 2' },
  3: { fill: 'rgba(234, 179, 8, 0.35)',   border: '#EAB308', text: 'Zona 3' },
  4: { fill: 'rgba(239, 68, 68, 0.35)',   border: '#EF4444', text: 'Zona 4' },
};

const MARKER_COLORS: Record<number, string> = {
  1: '#3B82F6',
  2: '#22C55E',
  3: '#F59E0B',
  4: '#EF4444',
};

// Approximate zone polygons for Luque, Paraguay
// Center of Luque: -25.2688, -57.4754
const ZONE_POLYGONS: Record<number, [number, number][]> = {
  1: [
    [-25.235, -57.510],
    [-25.235, -57.445],
    [-25.265, -57.445],
    [-25.265, -57.510],
  ],
  2: [
    [-25.265, -57.510],
    [-25.265, -57.445],
    [-25.295, -57.445],
    [-25.295, -57.510],
  ],
  3: [
    [-25.235, -57.445],
    [-25.235, -57.385],
    [-25.265, -57.385],
    [-25.265, -57.445],
  ],
  4: [
    [-25.265, -57.445],
    [-25.265, -57.385],
    [-25.295, -57.385],
    [-25.295, -57.445],
  ],
};

// Default approximate positions per zone center (for chapels without coordinates)
const ZONE_CENTERS: Record<number, [number, number]> = {
  1: [-25.250, -57.478],
  2: [-25.280, -57.478],
  3: [-25.250, -57.415],
  4: [-25.280, -57.415],
};

export default function ZonaMap({ 
  chapels = [], 
  selectedZone = null, 
  height = '500px', 
  zoneColors = {}, 
  polygons = {},
  showAllZones = false,
  mapCenterLat,
  mapCenterLng,
  mapZoom,
  tempPolygon = [],
  scrollWheelZoom = false,
  drawingMode = false,
  hideFallbackPolygon = false,
}: ZonaMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);

  const layersRef = useRef<any[]>([]);

  useEffect(() => {
    if (!mapRef.current) return;

    let L: any;
    try {
      L = require('leaflet');
    } catch {
      return;
    }

    if (!leafletMapRef.current) {
      // Fix Leaflet default icon path issue in Next.js
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });

      const center: [number, number] = mapCenterLat && mapCenterLng
        ? [mapCenterLat, mapCenterLng]
        : selectedZone ? ZONE_CENTERS[selectedZone] : [-25.2688, -57.4754];

      const zoom = mapZoom || (selectedZone ? 14 : 13);

      const map = L.map(mapRef.current, { zoomControl: true, scrollWheelZoom }).setView(center, zoom);
      leafletMapRef.current = map;

      // OpenStreetMap tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);
    }

    const map = leafletMapRef.current;

    // Clear old layers
    layersRef.current.forEach(layer => {
      if (layer && layer.remove) layer.remove();
      else if (map && map.removeLayer) {
        try { map.removeLayer(layer); } catch(e) {}
      }
    });
    layersRef.current = [];

    const center: [number, number] = mapCenterLat && mapCenterLng
      ? [mapCenterLat, mapCenterLng]
      : selectedZone ? ZONE_CENTERS[selectedZone] : [-25.2688, -57.4754];
    const zoom = mapZoom || (selectedZone ? 14 : 13);
    
    // Only set view if coordinates or zoom actually changed to avoid flicker
    const currentCenter = map.getCenter();
    const currentZoom = map.getZoom();
    const dist = Math.sqrt(Math.pow(currentCenter.lat - center[0], 2) + Math.pow(currentCenter.lng - center[1], 2));
    
    if (dist > 0.0001 || Math.abs(currentZoom - zoom) > 0.1) {
      map.setView(center, zoom);
    }

    // Draw zone polygons
    const zonesToDraw = (selectedZone && !showAllZones) ? [selectedZone] : [1, 2, 3, 4];
    zonesToDraw.forEach((zId) => {
      const savedPolygon = polygons[zId];
      const coords = savedPolygon || (!hideFallbackPolygon ? ZONE_POLYGONS[zId] : undefined);
      const customColor = zoneColors[zId];
      const defaultColor = DEFAULT_ZONE_COLORS[zId];
      
      if (!coords || coords.length === 0) return;

      const borderColor = customColor || defaultColor.border;
      const fillColor = customColor ? `${customColor}55` : defaultColor.fill; 

      const polygon = L.polygon(coords, {
        color: borderColor,
        fillColor: fillColor,
        fillOpacity: (selectedZone === zId || !selectedZone || showAllZones) ? 0.4 : 0.1,
        weight: (selectedZone === zId) ? 3 : 1,
        dashArray: (selectedZone === zId && !showAllZones) ? undefined : '6 3',
      }).addTo(map);

      layersRef.current.push(polygon);

      if (selectedZone === zId || !selectedZone || showAllZones) {
        polygon.bindTooltip(`<strong>Zona ${zId}</strong>`, {
          permanent: true,
          direction: 'center',
          className: 'zone-tooltip',
        });
      }
    });

    // Add map click listener
    const onMapClickInternal = (e: any) => {
      if ((window as any).onPJLMapClick) {
        (window as any).onPJLMapClick(e.latlng.lat, e.latlng.lng);
      }
    };
    map.on('click', onMapClickInternal);
    layersRef.current.push({ remove: () => map.off('click', onMapClickInternal) });

    // Draw chapel markers
    const chapelsToShow = selectedZone
      ? chapels.filter(c => c.zonaId === selectedZone)
      : chapels;

    chapelsToShow.forEach((chapel) => {
      const markerColor = chapel.markerColor || zoneColors[chapel.zonaId] || MARKER_COLORS[chapel.zonaId] || '#C8973A';
      const defaultCenter = ZONE_CENTERS[chapel.zonaId] || [-25.2688, -57.4754];
      
      // Use chapel coordinates if available, otherwise use zone center with slight offset
      const idxInZone = chapels.filter(c => c.zonaId === chapel.zonaId).indexOf(chapel);
      const latOffset = (idxInZone % 4) * 0.003 - 0.006;
      const lngOffset = Math.floor(idxInZone / 4) * 0.003 - 0.006;
      
      const lat = chapel.lat || (defaultCenter[0] + latOffset);
      const lng = chapel.lng || (defaultCenter[1] + lngOffset);

      const svgIcon = L.divIcon({
        html: `
          <div style="
            width: 32px; height: 32px;
            background: ${markerColor};
            border: 3px solid white;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            box-shadow: 0 4px 12px rgba(0,0,0,0.35);
            display: flex; align-items: center; justify-content: center;
            transition: 0.3s;
          ">
            <div style="transform: rotate(45deg); color: #fff; font-size: 14px; font-weight: 900; text-shadow: 0 1px 2px rgba(0,0,0,0.3);">⛪</div>
          </div>`,
        className: 'premium-marker',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -34],
      });

      const marker = L.marker([lat, lng], { icon: svgIcon })
        .addTo(map)
        .bindPopup(`
          <div style="min-width:180px; font-family: 'Inter', sans-serif; padding: 5px;">
            <div style="font-weight:800; color:#1A2744; margin-bottom:6px; font-size:15px; border-bottom: 1px solid #eee; padding-bottom: 6px;">${chapel.name}</div>
            ${chapel.comunidadNombre ? `<div style="color:var(--gold); font-weight: 700; font-size:12px; margin-bottom:6px; display: flex; align-items: center; gap: 6px;"><span>👥</span> ${chapel.comunidadNombre}</div>` : ''}
            <div style="font-size:11px; color:#666; margin-bottom: 8px;">Zona Pastoral ${chapel.zonaId}</div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              ${chapel.estadoComunidad ? `<span style="display:inline-block; padding:3px 10px; border-radius:20px; font-size:10px; font-weight:800; text-transform: uppercase; letter-spacing: 0.5px; background:${chapel.estadoComunidad === 'Activo' ? '#d1fae5' : '#fef3c7'}; color:${chapel.estadoComunidad === 'Activo' ? '#065f46' : '#92400e'};">${chapel.estadoComunidad}</span>` : ''}
              <span style="font-size: 10px; opacity: 0.5;">ID: ${chapel.id}</span>
            </div>
          </div>
        `);
      
      layersRef.current.push(marker);
    });

    // Legend
    if (!selectedZone) {
      const legend = L.control({ position: 'bottomright' });
      legend.onAdd = () => {
        const div = L.DomUtil.create('div', '');
        div.style.cssText = 'background:white; padding:12px 16px; border-radius:10px; box-shadow:0 2px 12px rgba(0,0,0,0.15); font-family:sans-serif; font-size:12px; min-width:120px;';
        div.innerHTML = `
          <div style="font-weight:700; margin-bottom:8px; color:#1A2744; font-size:13px;">Zonas PJL</div>
          ${[1,2,3,4].map(zId => {
            const color = zoneColors[zId] || DEFAULT_ZONE_COLORS[zId].border;
            return `
              <div style="display:flex; align-items:center; gap:8px; margin-bottom:5px;">
                <div style="width:14px; height:14px; border-radius:3px; background:${color}55; border:2px solid ${color}; flex-shrink:0;"></div>
                <span style="color:#1A2744;">Zona ${zId}</span>
              </div>`;
          }).join('')}
        `;
        return div;
      };
      legend.addTo(map);
      layersRef.current.push({ remove: () => legend.remove() });
    }

    // Draw temp drawing polygon
    if (tempPolygon && tempPolygon.length > 0) {
      const polyline = L.polyline(tempPolygon, { color: '#C8973A', weight: 4, dashArray: '10, 10' }).addTo(map);
      layersRef.current.push(polyline);
      
      tempPolygon.forEach((p, i) => {
        const dot = L.circleMarker(p, { radius: 5, fillColor: '#C8973A', color: '#fff', weight: 2, fillOpacity: 1 }).addTo(map);
        layersRef.current.push(dot);
      });
      
      if (tempPolygon.length > 2) {
        const fill = L.polygon(tempPolygon, { color: 'transparent', fillColor: '#C8973A', fillOpacity: 0.2 }).addTo(map);
        layersRef.current.push(fill);
      }
    }

    // Cleanup when component unmounts or deps change
    return () => {
      layersRef.current.forEach(layer => {
        if (layer.remove) layer.remove();
        else if (map && map.removeLayer) {
           try { map.removeLayer(layer); } catch(e) {}
        }
      });
      layersRef.current = [];
    };
  }, [chapels, selectedZone, zoneColors, polygons, tempPolygon, showAllZones, mapCenterLat, mapCenterLng, mapZoom, scrollWheelZoom]);

  // Handle actual unmount
  useEffect(() => {
    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, []);

  return (
    <>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
      <style>{`
        .zone-tooltip { background: rgba(26,39,68,0.85) !important; border: none !important; color: white !important; font-weight: 700 !important; border-radius: 6px !important; font-size: 12px !important; }
        .leaflet-drawing-cursor .leaflet-container { cursor: crosshair !important; }
      `}</style>
      <div ref={mapRef} style={{ height, width: '100%', borderRadius: '12px', zIndex: 1 }} className={drawingMode ? 'leaflet-drawing-cursor' : ''} />
    </>
  );
}
