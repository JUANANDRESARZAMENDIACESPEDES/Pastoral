'use client';
import { useEffect } from 'react';

export default function FaviconSync() {
  useEffect(() => {
    let cancelled = false;

    const updateFavicon = () => {
      try {
        const raw = localStorage.getItem('pjl_branding');
        if (!raw) return;
        const branding = JSON.parse(raw);
        const logoUrl = branding?.mainLogo;
        if (!logoUrl) return;

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          if (cancelled) return;
          const size = 192;
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
          const dataUrl = canvas.toDataURL('image/png');
          let link = document.querySelector('link[data-favicon-dyn]') as HTMLLinkElement | null;
          if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            link.type = 'image/png';
            link.setAttribute('data-favicon-dyn', '1');
            document.head.appendChild(link);
          }
          link.href = dataUrl;
        };
        img.onerror = () => {};
        img.src = logoUrl;
      } catch {}
    };

    const timer = setTimeout(updateFavicon, 300);

    const onStoreUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.key === 'branding') updateFavicon();
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'pjl_branding') updateFavicon();
    };

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
