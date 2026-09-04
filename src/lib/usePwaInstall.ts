'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePwaInstall() {
  const [isStandalone, setIsStandalone] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [deferredAvailable, setDeferredAvailable] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const isIosEval =
      /iphone|ipad|ipod/i.test(navigator.userAgent) &&
      (window.navigator as any).standalone === undefined;
    setIsIos(isIosEval);

    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      setDeferredAvailable(true);
    };
    const onAppInstalled = () => {
      setInstalled(true);
      setDeferredAvailable(false);
      window.dispatchEvent(new CustomEvent('pjl_app_installed'));
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const install = useCallback(async (): Promise<boolean> => {
    const deferred = deferredPrompt.current;
    if (deferred) {
      await deferred.prompt();
      const result = await deferred.userChoice.catch(() => null);
      deferredPrompt.current = null;
      setDeferredAvailable(false);
      if (result && result.outcome === 'accepted') {
        setInstalled(true);
        return true;
      }
      return false;
    }
    return false;
  }, []);

  const requestInstallUI = useCallback(() => {
    if (deferredPrompt.current) {
      install();
    } else {
      window.dispatchEvent(new CustomEvent('pjl_request_install'));
    }
  }, [install]);

  return { isStandalone, installed, deferredAvailable, isIos, install, requestInstallUI };
}
