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

async function generateIcon(logoUrl: string, size: number): Promise<Blob | null> {
  try {
    let imgUrl = logoUrl;
    if (logoUrl.endsWith('.svg') || logoUrl.startsWith('data:')) {
      const res = await fetch(logoUrl);
      if (!res.ok) return null;
      const blob = await res.blob();
      imgUrl = URL.createObjectURL(blob);
    }
    const img = await loadImage(imgUrl);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    const m = Math.min(img.width, img.height);
    ctx.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, size, size);
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
        generateIcon(logoUrl, 192),
        generateIcon(logoUrl, 512),
      ]);
      if (cancelled) return;
      try {
        const cache = await caches.open('pjl-custom-icons');
        if (icon192) await cache.put(new Request('/android-chrome-192.png'), new Response(icon192, { headers: { 'Content-Type': 'image/png' } }));
        if (icon512) await cache.put(new Request('/android-chrome-512.png'), new Response(icon512, { headers: { 'Content-Type': 'image/png' } }));
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
        let logoUrl = '/pjl-logo.svg';
        if (raw) {
          const branding = JSON.parse(raw);
          if (branding?.mainLogo) logoUrl = branding.mainLogo;
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
