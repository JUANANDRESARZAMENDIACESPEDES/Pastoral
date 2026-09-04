'use client';
import { useEffect } from 'react';

const DEFAULT_LOGO = '/pjl-logo.svg';

export default function FaviconSync() {
  useEffect(() => {
    let cancelled = false;
    let retries = 0;

    function applyFavicon(dataUrl: string) {
      const existing = document.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]');
      existing.forEach(el => el.remove());

      const link = document.createElement('link');
      link.rel = 'icon';
      link.type = 'image/png';
      link.href = dataUrl;
      document.head.insertBefore(link, document.head.firstChild);

      const apple = document.createElement('link');
      apple.rel = 'apple-touch-icon';
      apple.href = dataUrl;
      document.head.appendChild(apple);
    }

    function tryLoad() {
      if (cancelled) return;
      try {
        const raw = localStorage.getItem('pjl_branding');
        let logoUrl = DEFAULT_LOGO;
        if (raw) {
          const branding = JSON.parse(raw);
          if (branding?.mainLogo) logoUrl = branding.mainLogo;
        }

        if (logoUrl.endsWith('.svg') || logoUrl.startsWith('data:')) {
          fetch(logoUrl)
            .then(r => r.blob())
            .then(blob => {
              const reader = new FileReader();
              reader.onload = () => {
                if (cancelled) return;
                const img = new Image();
                img.onload = () => drawCircle(img);
                img.onerror = () => { applyFavicon(logoUrl); };
                img.src = reader.result as string;
              };
              reader.readAsDataURL(blob);
            })
            .catch(() => { applyFavicon(logoUrl); });
          return;
        }

        const img = new Image();
        img.onload = () => drawCircle(img);
        img.onerror = () => { applyFavicon(logoUrl); };
        img.src = logoUrl;
      } catch { retry(); }
    }

    function drawCircle(img: HTMLImageElement) {
      if (cancelled) return;
      const s = 256;
      const c = document.createElement('canvas');
      c.width = s; c.height = s;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      ctx.beginPath();
      ctx.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      const m = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, s, s);
      applyFavicon(c.toDataURL('image/png'));
    }

    function retry() {
      if (cancelled || retries >= 30) return;
      retries++;
      setTimeout(tryLoad, Math.min(retries * 150, 3000));
    }

    const t = setTimeout(tryLoad, 50);
    function onStore(e: Event) { if ((e as CustomEvent).detail?.key === 'branding') { retries = 0; tryLoad(); } }
    function onStorage(e: StorageEvent) { if (e.key === 'pjl_branding') { retries = 0; tryLoad(); } }
    window.addEventListener('pjl_store_update', onStore);
    window.addEventListener('storage', onStorage);
    return () => { cancelled = true; clearTimeout(t); window.removeEventListener('pjl_store_update', onStore); window.removeEventListener('storage', onStorage); };
  }, []);

  return null;
}
