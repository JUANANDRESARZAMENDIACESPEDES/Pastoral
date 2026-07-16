'use client';

import { useEffect, useRef, useState } from 'react';

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
  enableSearch?: boolean;
}

interface PlaceSuggestion {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
  class?: string;
  importance?: number;
  address?: Record<string, string>;
}

const DEFAULT_ZONE_COLORS: Record<number, { fill: string; border: string; text: string }> = {
  1: { fill: 'rgba(59, 130, 246, 0.25)',  border: '#3B82F6', text: 'Zona 1' },
  2: { fill: 'rgba(34, 197, 94, 0.25)',   border: '#22C55E', text: 'Zona 2' },
  3: { fill: 'rgba(234, 179, 8, 0.25)',   border: '#EAB308', text: 'Zona 3' },
  4: { fill: 'rgba(239, 68, 68, 0.25)',   border: '#EF4444', text: 'Zona 4' },
};

const MARKER_COLORS: Record<number, string> = {
  1: '#3B82F6',
  2: '#22C55E',
  3: '#F59E0B',
  4: '#EF4444',
};

// Función matemática para calcular el centro exacto (Centroide) de los polígonos personalizados
const getPolygonCenter = (coords: [number, number][]): [number, number] => {
  if (!coords || coords.length === 0) return [-25.2688, -57.4754];
  let latSum = 0;
  let lngSum = 0;
  coords.forEach(([lat, lng]) => {
    latSum += lat;
    lngSum += lng;
  });
  return [latSum / coords.length, lngSum / coords.length];
};

const FALLBACK_POLYGONS: Record<number, [number, number][]> = {
  1: [[-25.235, -57.510], [-25.235, -57.445], [-25.265, -57.445], [-25.265, -57.510]],
  2: [[-25.265, -57.510], [-25.265, -57.445], [-25.295, -57.445], [-25.295, -57.510]],
  3: [[-25.235, -57.445], [-25.235, -57.385], [-25.265, -57.385], [-25.265, -57.445]],
  4: [[-25.265, -57.445], [-25.265, -57.385], [-25.295, -57.385], [-25.295, -57.445]],
};

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
  enableSearch = false,
}: ZonaMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const layersRef = useRef<any[]>([]);
  const baseLayerRef = useRef<any>(null);
  const zoomControlRef = useRef<any>(null);
  const searchMarkerRef = useRef<any>(null);
  const searchTimerRef = useRef<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PlaceSuggestion[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<PlaceSuggestion | null>(null);

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) {
        window.clearTimeout(searchTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!enableSearch) {
      setSearchQuery('');
      setSearchResults([]);
      setSelectedPlace(null);
    }
  }, [enableSearch]);

  useEffect(() => {
    if (!enableSearch) return;

    const query = searchQuery.trim();
    if (query.length < 3) {
      setSearchResults([]);
      return;
    }

    if (searchTimerRef.current) {
      window.clearTimeout(searchTimerRef.current);
    }

    searchTimerRef.current = window.setTimeout(() => {
      setSearchLoading(true);
      fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&q=${encodeURIComponent(query)}`)
        .then(r => r.json())
        .then((data: PlaceSuggestion[]) => {
          setSearchResults(Array.isArray(data) ? data : []);
        })
        .catch(() => setSearchResults([]))
        .finally(() => setSearchLoading(false));
    }, 350);

    return () => {
      if (searchTimerRef.current) {
        window.clearTimeout(searchTimerRef.current);
      }
    };
  }, [enableSearch, searchQuery]);

  const focusPlace = (place: PlaceSuggestion) => {
    const map = leafletMapRef.current;
    if (!map) return;

    const L = require('leaflet');
    const lat = Number(place.lat);
    const lng = Number(place.lon);

    try {
      map.setView([lat, lng], Math.max(map.getZoom?.() || 14, 15), { animate: true });
    } catch (e) {}

    if (searchMarkerRef.current && map.removeLayer) {
      try { map.removeLayer(searchMarkerRef.current); } catch (e) {}
    }

    const marker = L.marker([lat, lng]).addTo(map).bindPopup(`
      <div style="min-width: 180px; max-width: 240px; font-size: 12px; line-height: 1.4; padding: 2px 0;">
        <strong style="display:block; margin-bottom:4px;">${place.display_name}</strong>
        <div style="color:#666; margin-bottom:4px;">${place.class || 'Lugar'} · ${place.type || 'Ubicación'}</div>
        <div style="color:#333;">Lat: ${lat.toFixed(5)}<br/>Lng: ${lng.toFixed(5)}</div>
      </div>
    `).openPopup();

    searchMarkerRef.current = marker;
    setSelectedPlace(place);
    setSearchResults([]);
  };

  useEffect(() => {
    if (!mapRef.current) return;

    let L: any;
    try { 
      L = require('leaflet'); 
    } catch { 
      return; 
    }

    if (!leafletMapRef.current) {
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

      const map = L.map(mapRef.current, { zoomControl: false, scrollWheelZoom }).setView(center, zoom);
      leafletMapRef.current = map;
      zoomControlRef.current = L.control.zoom({ position: drawingMode ? 'bottomright' : 'topright' }).addTo(map);

      const baseLayers = [
        { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', options: { attribution: '© OpenStreetMap', maxZoom: 19, crossOrigin: true } }
      ];

      const layer = L.tileLayer(baseLayers[0].url, baseLayers[0].options).addTo(map);
      baseLayerRef.current = layer;

      // ─── SOLUCIÓN MAPA EN BLANCO: Forzar recálculo inmediato ───
      setTimeout(() => { 
        try { 
          map.invalidateSize(); 
        } catch (e) {} 
      }, 50);
    }

    const map = leafletMapRef.current;
    
    // Repetimos la sincronización dimensional del contenedor por seguridad
    try { 
      map.invalidateSize(); 
    } catch (e) {}

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && mapRef.current) {
      resizeObserver = new ResizeObserver(() => { 
        try { map.invalidateSize(false); } catch (e) {} 
      });
      resizeObserver.observe(mapRef.current);
    }

    layersRef.current.forEach(layer => {
      if (layer && layer.remove) layer.remove();
      else if (map && map.removeLayer) { try { map.removeLayer(layer); } catch(e) {} }
    });
    layersRef.current = [];

    if (zoomControlRef.current && map && map.removeControl) {
      try { map.removeControl(zoomControlRef.current); } catch (e) {}
      zoomControlRef.current = null;
    }
    zoomControlRef.current = L.control.zoom({ position: drawingMode ? 'bottomright' : 'topright' }).addTo(map);

    // Dibujar polígonos de zonas activas
    const zonesToDraw = (selectedZone && !showAllZones) ? [selectedZone] : [1, 2, 3, 4];
    zonesToDraw.forEach((zId) => {
      const savedPolygon = polygons[zId];
      const coords = (savedPolygon && savedPolygon.length > 0) 
        ? savedPolygon 
        : (!hideFallbackPolygon ? FALLBACK_POLYGONS[zId] : undefined);
      
      if (!coords || coords.length === 0) return;

      const customColor = zoneColors[zId];
      const defaultColor = DEFAULT_ZONE_COLORS[zId];
      const borderColor = customColor || defaultColor.border;
      const fillColor = customColor ? `${customColor}55` : defaultColor.fill;

      const polygon = L.polygon(coords, {
        color: borderColor,
        fillColor: fillColor,
        fillOpacity: (selectedZone === zId || !selectedZone || showAllZones) ? 0.35 : 0.08,
        weight: (selectedZone === zId) ? 3 : 1.5,
        dashArray: (savedPolygon && savedPolygon.length > 0) ? undefined : '6 4',
      }).addTo(map);

      layersRef.current.push(polygon);

      if (selectedZone === zId || !selectedZone || showAllZones) {
        const polygonCenter = getPolygonCenter(coords);
        const textTooltip = L.tooltip({
          permanent: true,
          direction: 'center',
          className: 'zone-tooltip-centered'
        })
        .setLatLng(polygonCenter)
        .setContent(`<strong>Zona ${zId}</strong>`)
        .addTo(map);

        layersRef.current.push(textTooltip);
      }
    });

    // ─── LÓGICA MEJORADA: CONEXIÓN MAGNÉTICA A CUALQUIER PUNTO PREVIO ───
    const onMapClickInternal = (e: any) => {
      if ((window as any).onPJLMapClick) {
        const clickLat = e.latlng.lat;
        const clickLng = e.latlng.lng;

        if (tempPolygon && tempPolygon.length > 0) {
          let closestPoint: [number, number] | null = null;
          let minDistance = Infinity;

          // Recorremos todos los puntos existentes para ver cuál está más cerca del nuevo clic
          tempPolygon.forEach((pt) => {
            const ptLatLng = L.latLng(pt[0], pt[1]);
            const clickLatLng = L.latLng(clickLat, clickLng);
            const dist = ptLatLng.distanceTo(clickLatLng); // Distancia real en metros

            if (dist < minDistance) {
              minDistance = dist;
              closestPoint = pt;
            }
          });

          // Si el clic se hizo a menos de 40 metros de CUALQUIER punto anterior, 
          // se acopla magnéticamente a ese punto exacto en vez de crear uno encima.
          if (closestPoint && minDistance < 40) {
            (window as any).onPJLMapClick(closestPoint[0], closestPoint[1]);
            return;
          }
        }

        // Si no está cerca de ningún punto previo, se crea uno normal
        (window as any).onPJLMapClick(clickLat, clickLng);
      }
    };
    map.on('click', onMapClickInternal);
    layersRef.current.push({ remove: () => map.off('click', onMapClickInternal) });

    // Dibujar los marcadores premium de las capillas ⛪
    const chapelsToShow = selectedZone ? chapels.filter(c => c.zonaId === selectedZone) : chapels;
    chapelsToShow.forEach((chapel) => {
      const markerColor = chapel.markerColor || zoneColors[chapel.zonaId] || MARKER_COLORS[chapel.zonaId] || '#C8973A';
      const currentZoneCoords = polygons[chapel.zonaId] || FALLBACK_POLYGONS[chapel.zonaId];
      const referenceCenter = getPolygonCenter(currentZoneCoords);
      
      const idxInZone = chapels.filter(c => c.zonaId === chapel.zonaId).indexOf(chapel);
      const latOffset = (idxInZone % 4) * 0.002 - 0.004;
      const lngOffset = Math.floor(idxInZone / 4) * 0.002 - 0.004;
      
      const lat = chapel.lat || (referenceCenter[0] + latOffset);
      const lng = chapel.lng || (referenceCenter[1] + lngOffset);

      const svgIcon = L.divIcon({
        html: `
          <div style="width: 32px; height: 32px; background: ${markerColor}; border: 3px solid white; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); box-shadow: 0 4px 12px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center;">
            <div style="transform: rotate(45deg); color: #fff; font-size: 14px; font-weight: 900;">⛪</div>
          </div>`,
        className: 'premium-marker',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -34],
      });

      const marker = L.marker([lat, lng], { icon: svgIcon }).addTo(map)
        .bindPopup(`<div style="padding: 5px;"><strong>${chapel.name}</strong><br/><span style="font-size:11px;color:#666;">Zona Pastoral ${chapel.zonaId}</span></div>`);
      
      layersRef.current.push(marker);
    });

    // Dibujar la traza interactiva actual
    if (tempPolygon && tempPolygon.length > 0) {
      try {
        const polyline = L.polyline(tempPolygon, { color: '#C8973A', weight: 4, dashArray: '8, 8' }).addTo(map);
        layersRef.current.push(polyline);
        
        tempPolygon.forEach((p, i) => {
          const dot = L.circleMarker(p, { 
            radius: 6, 
            fillColor: '#C8973A', 
            color: '#fff', 
            weight: 2, 
            fillOpacity: 1 
          }).addTo(map);
          
          layersRef.current.push(dot);
        });
        
        if (tempPolygon.length > 2) {
          const fill = L.polygon(tempPolygon, { color: 'transparent', fillColor: '#C8973A', fillOpacity: 0.18 }).addTo(map);
          layersRef.current.push(fill);
        }
      } catch (err) { console.error('Leaflet Temp Draw Error:', err); }
    }

    // Ejecutar un invalidateSize extra diferido al renderizar elementos reactivos
    const mapTimeout = setTimeout(() => { try { map.invalidateSize(); } catch(e){} }, 300);

    return () => {
      clearTimeout(mapTimeout);
      resizeObserver?.disconnect();
      if (searchMarkerRef.current && map && map.removeLayer) {
        try { map.removeLayer(searchMarkerRef.current); } catch (e) {}
        searchMarkerRef.current = null;
      }
      if (zoomControlRef.current && map && map.removeControl) {
        try { map.removeControl(zoomControlRef.current); } catch (e) {}
        zoomControlRef.current = null;
      }
      layersRef.current.forEach(layer => {
        if (layer.remove) layer.remove();
        else if (map && map.removeLayer) { try { map.removeLayer(layer); } catch(e) {} }
      });
      layersRef.current = [];
    };
  }, [chapels, selectedZone, zoneColors, polygons, tempPolygon, showAllZones, mapCenterLat, mapCenterLng, mapZoom, scrollWheelZoom, drawingMode, hideFallbackPolygon]);

  useEffect(() => {
    return () => { if (leafletMapRef.current) { leafletMapRef.current.remove(); leafletMapRef.current = null; } };
  }, []);

  return (
    <>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
      <style>{`
        .zone-tooltip-centered {
          background: rgba(26, 39, 68, 0.88) !important;
          border: 2px solid white !important;
          color: white !important;
          font-weight: 800 !important;
          border-radius: 8px !important;
          font-size: 13px !important;
          padding: 6px 12px !important;
          box-shadow: 0 4px 15px rgba(0,0,0,0.3) !important;
          text-align: center;
          white-space: nowrap;
        }
        .zone-tooltip-centered::before { display: none !important; }
        .leaflet-drawing-cursor .leaflet-container { cursor: crosshair !important; }
        .zona-map-search {
          position: absolute;
          top: 14px;
          left: 14px;
          z-index: 1200;
          width: min(92vw, 360px);
          pointer-events: auto;
        }
        .zona-map-search input {
          width: 100%;
          border: 1px solid rgba(200, 151, 58, 0.35);
          border-radius: 14px;
          padding: 12px 14px;
          background: rgba(255,255,255,0.96);
          color: var(--navy);
          box-shadow: 0 10px 24px rgba(0,0,0,0.12);
          outline: none;
        }
        .zona-map-search-results {
          margin-top: 8px;
          background: rgba(255,255,255,0.98);
          border: 1px solid rgba(200, 151, 58, 0.28);
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 14px 30px rgba(0,0,0,0.16);
          max-height: 240px;
          overflow-y: auto;
        }
        .zona-map-search-results button {
          width: 100%;
          border: 0;
          background: transparent;
          text-align: left;
          padding: 12px 14px;
          cursor: pointer;
          display: block;
          border-bottom: 1px solid rgba(0,0,0,0.06);
        }
        .zona-map-search-results button:hover {
          background: rgba(200,151,58,0.08);
        }
        .zona-map-search-meta {
          display: inline-block;
          margin-top: 4px;
          font-size: 11px;
          color: #7a6a55;
        }
        .zona-map-details {
          position: absolute;
          right: 14px;
          bottom: 14px;
          z-index: 1200;
          width: min(92vw, 320px);
          background: rgba(26, 39, 68, 0.94);
          color: #fff;
          border: 1px solid rgba(200,151,58,0.3);
          border-radius: 16px;
          padding: 12px 14px;
          box-shadow: 0 14px 30px rgba(0,0,0,0.18);
        }
        @media (max-width: 768px) {
          .zona-map-search {
            width: calc(100vw - 28px);
          }
          .zona-map-details {
            left: 14px;
            right: 14px;
            width: auto;
          }
        }
      `}</style>
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        {enableSearch && (
          <div className="zona-map-search">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar lugar, dirección o referencia..."
              aria-label="Buscar ubicación en el mapa"
            />
            {searchLoading && <div className="zona-map-search-meta">Buscando ubicaciones…</div>}
            {searchResults.length > 0 && (
              <div className="zona-map-search-results">
                {searchResults.map(place => (
                  <button key={place.place_id} type="button" onClick={() => focusPlace(place)}>
                    <strong style={{ display: 'block', color: 'var(--navy)' }}>{place.display_name}</strong>
                    <span className="zona-map-search-meta">
                      {place.class || 'Lugar'} {place.type ? `· ${place.type}` : ''}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {enableSearch && selectedPlace && (
          <div className="zona-map-details">
            <div style={{ fontSize: '11px', fontWeight: 900, letterSpacing: '1px', color: 'var(--gold)', marginBottom: '6px' }}>UBICACIÓN SELECCIONADA</div>
            <div style={{ fontWeight: 800, lineHeight: 1.35, marginBottom: '6px' }}>{selectedPlace.display_name}</div>
            <div style={{ fontSize: '12px', opacity: 0.9 }}>
              {selectedPlace.class || 'Lugar'} {selectedPlace.type ? `· ${selectedPlace.type}` : ''}
            </div>
            <div style={{ fontSize: '12px', marginTop: '8px', opacity: 0.9 }}>
              Lat: {Number(selectedPlace.lat).toFixed(5)} · Lng: {Number(selectedPlace.lon).toFixed(5)}
            </div>
          </div>
        )}
        <div ref={mapRef} style={{ height, width: '100%', borderRadius: '12px', zIndex: 1 }} className={drawingMode ? 'leaflet-drawing-cursor' : ''} />
      </div>
    </>
  );
}
