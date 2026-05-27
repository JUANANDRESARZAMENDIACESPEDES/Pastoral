'use client';

import { useEffect, useRef } from 'react';

// Declaramos los tipos de datos que va a recibir nuestro mapa desde el panel de administración
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

// Configuración de colores oficiales por defecto para las 4 zonas de la Pastoral
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

// Función para calcular el centro geográfico exacto de cualquier figura dibujada
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

// Cuadrados iniciales de simulación por si el usuario aún no dibujó nada real
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
}: ZonaMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const layersRef = useRef<any[]>([]);
  const baseLayerRef = useRef<any>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    // Cargamos Leaflet de forma dinámica y segura para evitar errores en Next.js
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
      L.control.zoom({ position: drawingMode ? 'bottomright' : 'topright' }).addTo(map);

      const baseLayers = [
        { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', options: { attribution: '© OpenStreetMap', maxZoom: 19, crossOrigin: true } }
      ];

      const layer = L.tileLayer(baseLayers[0].url, baseLayers[0].options).addTo(map);
      baseLayerRef.current = layer;

      setTimeout(() => { try { map.invalidateSize(); } catch (e) {} }, 150);
    }

    const map = leafletMapRef.current;
    try { map.invalidateSize(); } catch (e) {}

    if (drawingMode) {
      setTimeout(() => { try { map.invalidateSize(); } catch (e) {} }, 100);
    }

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && mapRef.current) {
      resizeObserver = new ResizeObserver(() => { try { map.invalidateSize(false); } catch (e) {} });
      resizeObserver.observe(mapRef.current);
    }

    // Limpieza de capas anteriores
    layersRef.current.forEach(layer => {
      if (layer && layer.remove) layer.remove();
      else if (map && map.removeLayer) { try { map.removeLayer(layer); } catch(e) {} }
    });
    layersRef.current = [];

    // Renderizar polígonos de zonas existentes
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
        fillOpacity: (selectedZone === zId || !selectedZone || showAllZones) ? 0.4 : 0.1,
        weight: (selectedZone === zId) ? 3 : 1,
        dashArray: (savedPolygon && savedPolygon.length > 0) ? undefined : '6 3',
      }).addTo(map);

      layersRef.current.push(polygon);

      // Renderizar el cuadro de texto flotante en el centro exacto de tu figura
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

    // Escuchador inteligente de clics para cerrar la figura conectando puntos
    const onMapClickInternal = (e: any) => {
      if ((window as any).onPJLMapClick) {
        const clickLat = e.latlng.lat;
        const clickLng = e.latlng.lng;

        if (tempPolygon && tempPolygon.length >= 3) {
          const firstPoint = tempPolygon[0];
          const firstLatLng = L.latLng(firstPoint[0], firstPoint[1]);
          const currentLatLng = L.latLng(clickLat, clickLng);
          const distanceInMetres = firstLatLng.distanceTo(currentLatLng);

          // Si el clic está cerca del punto de inicio, cerramos la figura automáticamente
          if (distanceInMetres < 45) {
            (window as any).onPJLMapClick(firstPoint[0], firstPoint[1]);
            return;
          }
        }

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

    // Dibujar líneas dinámicas mientras se definen límites
    if (tempPolygon && tempPolygon.length > 0) {
      try {
        const polyline = L.polyline(tempPolygon, { color: '#C8973A', weight: 4, dashArray: '10, 10' }).addTo(map);
        layersRef.current.push(polyline);
        
        tempPolygon.forEach((p, i) => {
          const isFirst = i === 0 && tempPolygon.length >= 3;
          const dot = L.circleMarker(p, { 
            radius: isFirst ? 8 : 5, 
            fillColor: isFirst ? '#22C55E' : '#C8973A', 
            color: '#fff', 
            weight: 2, 
            fillOpacity: 1 
          }).addTo(map);
          
          if (isFirst) {
            dot.bindTooltip("Clic aquí para cerrar zona", { direction: 'top', className: 'close-hint-tooltip' });
          }
          layersRef.current.push(dot);
        });
        
        if (tempPolygon.length > 2) {
          const fill = L.polygon(tempPolygon, { color: 'transparent', fillColor: '#C8973A', fillOpacity: 0.2 }).addTo(map);
          layersRef.current.push(fill);
        }
      } catch (err) { console.error('Leaflet Error:', err); }
    }

    return () => {
      resizeObserver?.disconnect();
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
          background: rgba(26, 39, 68, 0.85) !important;
          border: 2px solid white !important;
          color: white !important;
          font-weight: 800 !important;
          border-radius: 8px !important;
          font-size: 13px !important;
          padding: 6px 12px !important;
          box-shadow: 0 4px 15px rgba(0,0,0,0.25) !important;
          text-align: center;
          white-space: nowrap;
        }
        .zone-tooltip-centered::before { display: none !important; }
        
        .close-hint-tooltip {
          background: #16a34a !important;
          color: white !important;
          border: none !important;
          font-weight: 700 !important;
          font-size: 11px !important;
          border-radius: 4px !important;
        }
        .leaflet-drawing-cursor .leaflet-container { cursor: crosshair !important; }
      `}</style>
      <div ref={mapRef} style={{ height, width: '100%', borderRadius: '12px', zIndex: 1 }} className={drawingMode ? 'leaflet-drawing-cursor' : ''} />
    </>
  );
}