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
  const [isAndroid, setIsAndroid] = useState(false);
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);

  // Recupera el prompt capturado por el script TEMPRANO del layout (window.__pjlpwa)
  const syncFromGlobal = useCallback(() => {
    try {
      const g = (window as any).__pjlpwa;
      if (g && g.hasPrompt && g.deferredPrompt && !deferredPrompt.current) {
        deferredPrompt.current = g.deferredPrompt as BeforeInstallPromptEvent;
        setDeferredAvailable(true);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const isIosEval =
      /iphone|ipad|ipod/i.test(navigator.userAgent) &&
      (window.navigator as any).standalone === undefined;
    setIsIos(isIosEval);

    const isAndroidEval =
      /android/i.test(navigator.userAgent) &&
      /mobile/i.test(navigator.userAgent);
    setIsAndroid(isAndroidEval);

    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      setDeferredAvailable(true);
      try { (window as any).__pjlpwa = { ...((window as any).__pjlpwa || {}), deferredPrompt: e, hasPrompt: true, captured: true }; } catch {}
    };
    const onAppInstalled = () => {
      setInstalled(true);
      setDeferredAvailable(false);
      deferredPrompt.current = null;
      try { const g = (window as any).__pjlpwa; if (g) { g.hasPrompt = false; g.deferredPrompt = null; } } catch {}
      window.dispatchEvent(new CustomEvent('pjl_app_installed'));
    };

    // Si el prompt ya fue capturado por el script temprano, usarlo.
    syncFromGlobal();

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onAppInstalled);
    window.addEventListener('pjl_beforeinstall', onBeforeInstall as any);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onAppInstalled);
      window.removeEventListener('pjl_beforeinstall', onBeforeInstall as any);
    };
  }, [syncFromGlobal]);

  const install = useCallback(async (): Promise<boolean> => {
    let deferred = deferredPrompt.current;
    if (!deferred) {
      // Re-sincroniza con la captura temprana del layout por si llegó tarde.
      syncFromGlobal();
      deferred = deferredPrompt.current;
    }
    if (!deferred) {
      // Aún sin evento: espera brevemente a que Chrome lo dispare (puede
      // llegar algo después de pintar la página). Timeout de 6s.
      try {
        deferred = await new Promise<BeforeInstallPromptEvent | null>((resolve) => {
          let settled = false;
          const onEvt = (e: Event) => { if (!settled) { settled = true; resolve(e as BeforeInstallPromptEvent); } };
          window.addEventListener('beforeinstallprompt', onEvt);
          window.addEventListener('pjl_beforeinstall', onEvt);
          window.setTimeout(() => { if (!settled) { settled = true; window.removeEventListener('beforeinstallprompt', onEvt); window.removeEventListener('pjl_beforeinstall', onEvt); resolve(null); } }, 6000);
        });
      } catch {
        return false;
      }
      if (!deferred) return false;
      deferredPrompt.current = deferred;
      setDeferredAvailable(true);
    }
    try {
      // 'prompt()' debe llamarse en el mismo gesto del usuario para que el
      // navegador muestre el diálogo nativo de instalación.
      await deferred.prompt();
    } catch {
      deferredPrompt.current = null;
      setDeferredAvailable(false);
      return false;
    }
    const result = await deferred.userChoice.catch(() => null);
    deferredPrompt.current = null;
    setDeferredAvailable(false);
    if (result && result.outcome === 'accepted') {
      setInstalled(true);
      return true;
    }
    return false;
  }, [syncFromGlobal]);

  // Android/Chrome: si recibimos el 'beforeinstallprompt' mostramos el
  // instalador nativo de inmediato. Si no (iOS o criterios aún no reunidos),
  // abrimos el modal con las instrucciones adecuadas.
  const requestInstallUI = useCallback(() => {
    if (deferredPrompt.current) {
      install();
    } else {
      window.dispatchEvent(new CustomEvent('pjl_request_install'));
    }
  }, [install]);

  const canInstallNative = deferredAvailable && !isIos;

  // Acción del botón "Descargar App":
  // - Android con capacidad de instalación nativa disponible → muestra el
  //   diálogo nativo del navegador (beforeinstallprompt).
  // - iOS o sin prompt nativo disponible → redirige a la guía paso a paso
  //   (/instalar) que se adapta al dispositivo.
  const handleDownload = useCallback(() => {
    if (deferredPrompt.current && !isIos) {
      install();
      return;
    }
    window.location.href = '/instalar';
  }, [install, isIos]);

  return {
    isStandalone,
    installed,
    deferredAvailable,
    isIos,
    isAndroid,
    canInstallNative,
    install,
    requestInstallUI,
    handleDownload,
  };
}
