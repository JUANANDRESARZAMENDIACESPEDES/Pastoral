'use client';
import { useEffect } from 'react';

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function loadBlobUrl(logoUrl: string): Promise<string> {
  let imgUrl = logoUrl;
  if (logoUrl.endsWith('.svg') || logoUrl.startsWith('data:')) {
    const res = await fetch(logoUrl);
    if (!res.ok) throw new Error('fetch failed');
    const blob = await res.blob();
    imgUrl = URL.createObjectURL(blob);
  }
  return imgUrl;
}

function fillSolidCircle(ctx: CanvasRenderingContext2D, size: number, color: string) {
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawCentered(img: HTMLImageElement, ctx: CanvasRenderingContext2D, size: number, ratio: number) {
  const m = Math.min(img.width, img.height);
  const target = size * ratio;
  ctx.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, (size - target) / 2, (size - target) / 2, target, target);
}

async function generateIcon(logoUrl: string, size: number, mode: 'circle' | 'maskable'): Promise<Blob | null> {
  try {
    const imgUrl = await loadBlobUrl(logoUrl);
    const img = await loadImage(imgUrl);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    if (mode === 'maskable') {
      // Fondo sólido navy + logo en la zona segura central (66%) para que
      // Android recorte bien el ícono como máscara redondeada.
      fillSolidCircle(ctx, size, '#1A2744');
      ctx.clip();
      drawCentered(img, ctx, size, 0.66);
    } else {
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      drawCentered(img, ctx, size, 0.9);
    }
    if (imgUrl.startsWith('blob:')) URL.revokeObjectURL(imgUrl);
    return new Promise((resolve) => { canvas.toBlob((b) => resolve(b), 'image/png'); });
  } catch { return null; }
}

export default function PwaIconSync() {
  useEffect(() => {
    let cancelled = false;

    async function updatePwaIcons(logoUrl: string) {
      if (cancelled) return;
      const [icon192, icon512] = await Promise.all([
        generateIcon(logoUrl, 192, 'circle'),
        generateIcon(logoUrl, 512, 'maskable'),
      ]);
      if (cancelled) return;
      try {
        const cache = await caches.open('pjl-custom-icons');
        if (icon192) await cache.put(new Request('/android-chrome-192.png'), new Response(icon192, { headers: { 'Content-Type': 'image/png' } }));
        if (icon512) await cache.put(new Request('/android-chrome-512.png'), new Response(icon512, { headers: { 'Content-Type': 'image/png' } }));
        if (icon512) await cache.put(new Request('/maskable-512.png'), new Response(icon512, { headers: { 'Content-Type': 'image/png' } }));
      } catch {}
      try {
        if (navigator.serviceWorker?.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'UPDATE_PWA_ICONS' });
        }
      } catch {}
    }

    function loadLogo() {
      if (cancelled) return;
      try {
        const raw = localStorage.getItem('pjl_branding');
        // Logo real de la app (ya no el placeholder pjl-logo.svg).
        let logoUrl = '/android-chrome-512.png';
        if (raw) {
          const branding = JSON.parse(raw);
          // Prioridad: androidLogo (logo dedicado para la app en Android);
          // si no está, cae al logo principal del sitio.
          if (branding?.androidLogo) logoUrl = branding.androidLogo;
          else if (branding?.mainLogo) logoUrl = branding.mainLogo;
        }
        updatePwaIcons(logoUrl);
      } catch {}
    }

    function onStore(e: Event) { if ((e as CustomEvent).detail?.key === 'branding') loadLogo(); }
    function onStorage(e: StorageEvent) { if (e.key === 'pjl_branding') loadLogo(); }

    const t = setTimeout(loadLogo, 100);
    window.addEventListener('pjl_store_update', onStore);
    window.addEventListener('storage', onStorage);
    return () => { cancelled = true; clearTimeout(t); window.removeEventListener('pjl_store_update', onStore); window.removeEventListener('storage', onStorage); };
  }, []);

  return null;
}
