'use client';

import { useEffect } from 'react';
import { store } from '@/lib/pjlStore';
import { fetchStoreValue, subscribeStoreChanges } from '@/lib/supabaseStore';

export default function ThemeLoader() {
  useEffect(() => {
    const applyTheme = (themeOverride?: { gold: string; navy: string } | null) => {
      const theme = themeOverride || store.theme.get();
      if (theme) {
        document.documentElement.style.setProperty('--gold', theme.gold);
        document.documentElement.style.setProperty('--navy', theme.navy);
      }
    };

    const syncTheme = (theme: { gold: string; navy: string } | null) => {
      if (!theme) return;
      try {
        localStorage.setItem('pjl_theme', JSON.stringify(theme));
      } catch {
        // ignore localStorage write failures
      }
      applyTheme(theme);
    };

    applyTheme();

    void fetchStoreValue<{ gold: string; navy: string }>('theme')
      .then(theme => syncTheme(theme))
      .catch(() => {});

    // Listen to localStorage changes across tabs, or custom events from admin panel
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'pjl_theme') {
        applyTheme();
      }
    };

    // Custom event to handle in-tab immediate updates
    const handleCustomChange = () => applyTheme();
    const unsubscribeRemote = subscribeStoreChanges((key, value) => {
      if (key === 'theme' && value && typeof value === 'object') {
        syncTheme(value as { gold: string; navy: string });
      }
    });

    window.addEventListener('storage', handleStorage);
    window.addEventListener('pjl_theme_update', handleCustomChange);

    return () => {
      unsubscribeRemote();
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('pjl_theme_update', handleCustomChange);
    };
  }, []);

  return null;
}
