'use client';
import { useEffect } from 'react';

export default function FaviconSync() {
  useEffect(() => {
    let cancelled = false;
    let retries = 0;

    function removeStaticIcons() {
      document.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]').forEach(el => el.remove());
    }

    function applyFavicon(dataUrl: string) {
      removeStaticIcons();
      let link = document.querySelector('link[data-favicon-dyn]') as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        link.type = 'image/png';
        link.setAttribute('data-favicon-dyn', '1');
        document.head.prepend(link);
      }
      link.href = dataUrl;
    }

    function updateFavicon() {
      if (cancelled) return;
      try {
        const raw = localStorage.getItem('pjl_branding');
        if (!raw) { retry(); return; }
        const branding = JSON.parse(raw);
        const logoUrl = branding?.mainLogo;
        if (!logoUrl) { retry(); return; }

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          if (cancelled) return;
          const size = 256;
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          ctx.beginPath();
          ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
          const minDim = Math.min(img.width, img.height);
          const srcX = (img.width - minDim) / 2;
          const srcY = (img.height - minDim) / 2;
          ctx.drawImage(img, srcX, srcY, minDim, minDim, 0, 0, size, size);
          applyFavicon(canvas.toDataURL('image/png'));
        };
        img.onerror = () => retry();
        img.src = logoUrl;
      } catch { retry(); }
    }

    function retry() {
      if (cancelled || retries >= 20) return;
      retries++;
      setTimeout(updateFavicon, Math.min(retries * 200, 2000));
    }

    const timer = setTimeout(updateFavicon, 100);

    function onStoreUpdate(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail?.key === 'branding') { retries = 0; updateFavicon(); }
    }
    function onStorage(e: StorageEvent) {
      if (e.key === 'pjl_branding') { retries = 0; updateFavicon(); }
    }

    window.addEventListener('pjl_store_update', onStoreUpdate);
    window.addEventListener('storage', onStorage);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      window.removeEventListener('pjl_store_update', onStoreUpdate);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return null;
}
