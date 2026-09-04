'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable' | 'error';
export type InstallState = 'idle' | 'installing' | InstallOutcome;

export function usePwaInstall() {
  const [isStandalone, setIsStandalone] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [deferredAvailable, setDeferredAvailable] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [installState, setInstallState] = useState<InstallState>('idle');
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const reloadTriedRef = useRef(false);
  const [inAppBrowser, setInAppBrowser] = useState(false);

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
    const ua = navigator.userAgent;
    const isIosEval =
      /iphone|ipad|ipod/i.test(ua) &&
      (window.navigator as any).standalone === undefined;
    setIsIos(isIosEval);

    const isAndroidEval =
      /android/i.test(ua) &&
      /mobile/i.test(ua);
    setIsAndroid(isAndroidEval);

    // Navegadores incrustados (Facebook, WhatsApp, Instagram, etc.) NO
    // permiten instalar apps. Hay que abrir la web en Chrome.
    const isInAppBrowserEval = /(wv|webview|fbav|fban|instagram|whatsapp|line\/|kakaotalk|twitter|pinterest|snapchat|micromessenger|okhttp|daumapps|naverinapp|gaia\/|yandexsearch)/i.test(ua);
    setInAppBrowser(isInAppBrowserEval);

    // Si venimos de una recarga por intención de instalar, no reintentamos
    // la recarga otra vez en la misma sesión (evita bucles).
    try {
      if (sessionStorage.getItem('pjl_install_reload_done') === '1') {
        reloadTriedRef.current = true;
      }
    } catch {}

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
      setInstallState('accepted');
      setDeferredAvailable(false);
      deferredPrompt.current = null;
      try {
        const g = (window as any).__pjlpwa; if (g) { g.hasPrompt = false; g.deferredPrompt = null; }
        sessionStorage.removeItem('pjl_install_reload_done');
        sessionStorage.removeItem('pjl_install_intent');
      } catch {}
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

  // Espera breve a que Chrome dispare el prompt nativo. Devuelve el evento o null.
  const waitForPrompt = useCallback((timeoutMs: number) => {
    return new Promise<BeforeInstallPromptEvent | null>((resolve) => {
      let settled = false;
      const onEvt = (e: Event) => { if (!settled) { settled = true; resolve(e as BeforeInstallPromptEvent); } };
      window.addEventListener('beforeinstallprompt', onEvt);
      window.addEventListener('pjl_beforeinstall', onEvt);
      window.setTimeout(() => {
        if (!settled) {
          settled = true;
          window.removeEventListener('beforeinstallprompt', onEvt);
          window.removeEventListener('pjl_beforeinstall', onEvt);
          resolve(null);
        }
      }, timeoutMs);
    });
  }, []);

  const install = useCallback(async (): Promise<boolean> => {
    let deferred = deferredPrompt.current;
    if (!deferred) {
      // Re-sincroniza con la captura temprana del layout por si llegó tarde.
      syncFromGlobal();
      deferred = deferredPrompt.current;
    }

    if (!deferred) {
      setInstallState('installing');
      // Primer intento: esperamos un momento a que Chrome dispare el prompt.
      // Si no llega, RECARGAMOS UNA sola vez: al volver a cargar Chrome
      // vuelve a evaluar instalabilidad (con el SW ya controlando la página)
      // y generalmente dispara beforeinstallprompt de inmediato.
      let reloaded = false;
      try {
        deferred = await waitForPrompt(2000);
      } catch {
        return false;
      }
      if (!deferred && isAndroid && !reloadTriedRef.current && !inAppBrowser) {
        reloadTriedRef.current = true;
        reloaded = true;
        try {
          sessionStorage.setItem('pjl_install_reload_done', '1');
          sessionStorage.setItem('pjl_install_intent', '1');
        } catch {}
        window.location.reload();
        return false;
      }
      if (!deferred) {
        // Segunda espera (iOS, escritorio, navegador incrustado, o ya se
        // reintentó la recarga): chance extra de obtener el prompt.
        try {
          deferred = await waitForPrompt(3000).catch(() => null);
        } catch {
          deferred = null;
        }
        if (!deferred) {
          setInstallState('unavailable');
          return false;
        }
      }
      deferredPrompt.current = deferred;
      setDeferredAvailable(true);
    }

    if (!deferred) {
      setInstallState('unavailable');
      return false;
    }

    try {
      setInstallState('installing');
      // 'prompt()' debe llamarse en el gesto del usuario para que el
      // navegador muestre el diálogo nativo de instalación.
      await deferred.prompt();
    } catch {
      deferredPrompt.current = null;
      setDeferredAvailable(false);
      setInstallState('error');
      return false;
    }
    const result = await deferred.userChoice.catch(() => null);
    deferredPrompt.current = null;
    setDeferredAvailable(false);
    if (result && result.outcome === 'accepted') {
      setInstalled(true);
      setInstallState('accepted');
      return true;
    }
    setInstallState('dismissed');
    return false;
  }, [syncFromGlobal, waitForPrompt, isAndroid, inAppBrowser]);

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
  const handleDownload = useCallback(async () => {
    if (deferredPrompt.current && !isIos) {
      const ok = await install();
      if (ok) return;
    }
    window.location.href = '/instalar';
  }, [install, isIos]);

  return {
    isStandalone,
    installed,
    deferredAvailable,
    isIos,
    isAndroid,
    inAppBrowser,
    canInstallNative,
    installState,
    install,
    requestInstallUI,
    handleDownload,
  };
}