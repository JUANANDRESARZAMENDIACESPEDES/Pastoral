'use client';

import { useEffect, useRef, useState } from 'react';

/* Estilo propio del banner, acorde a la identidad navy/dorado del sitio. */
const MODAL_STYLE: React.CSSProperties = {
  position: 'fixed',
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 99999,
  margin: '12px',
  padding: '16px 16px 14px',
  borderRadius: '18px',
  background: 'linear-gradient(135deg, #1A2744 0%, #23345e 100%)',
  color: '#fff',
  boxShadow: '0 18px 50px rgba(13, 21, 46, 0.5)',
  fontFamily: 'inherit',
  maxWidth: '420px',
  marginLeft: 'auto',
  marginRight: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
};

export default function PwaInstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);
  const deferredPrompt = useRef<any>(null);

  useEffect(() => {
    const isIos =
      /iphone|ipad|ipod/i.test(navigator.userAgent) && 'standalone' in window.navigator === false;

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    // Si ya está instalada como APP, no mostramos nada.
    if (isStandalone) return;

    const KEY = 'pjl_pwa_dismissed';
    if (localStorage.getItem(KEY)) return;

    const onBeforeInstall = (e: any) => {
      e.preventDefault();
      deferredPrompt.current = e;
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    // iOS no dispara beforeinstallprompt: mostramos un pequeño aviso portable.
    if (isIos) {
      const t = setTimeout(() => setVisible(true), 2500);
      setIos(true);
      const onAppInstalled = () => setVisible(false);
      window.addEventListener('appinstalled', onAppInstalled);
      return () => {
        clearTimeout(t);
        window.removeEventListener('beforeinstallprompt', onBeforeInstall);
        window.removeEventListener('appinstalled', onAppInstalled);
      };
    }

    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  const install = async () => {
    const deferred = deferredPrompt.current;
    if (deferred) {
      deferred.prompt();
      const result = await deferred.userChoice.catch(() => null);
      if (result && result.outcome === 'accepted') setVisible(false);
      deferredPrompt.current = null;
    }
  };

  const dismiss = () => {
    try {
      localStorage.setItem('pjl_pwa_dismissed', '1');
    } catch {
      /* almacenamiento no disponible */
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div role="dialog" aria-label="Instalar Pastoral Juvenil Luqueña" style={MODAL_STYLE}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <span style={{ fontSize: '30px', lineHeight: 1 }} aria-hidden="true">
          ⛪
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: '15px', lineHeight: 1.3 }}>
            ¿Agregar Pastoral Luque a tu pantalla de inicio?
          </div>
          <div style={{ fontSize: '12.5px', opacity: 0.85, marginTop: 4, lineHeight: 1.45 }}>
            {ios
              ? 'Tocá el botón Compartir (⬆️) de tu navegador y elegí "Agregar a pantalla de inicio".'
              : 'Instalá la app para tener la comunidad, la agenda y los avisos siempre a mano.'}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          type="button"
          onClick={dismiss}
          style={{
            flex: 1,
            padding: '11px 14px',
            borderRadius: '999px',
            border: '1px solid rgba(255,255,255,0.35)',
            background: 'transparent',
            color: '#fff',
            fontWeight: 700,
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          Ahora no
        </button>
        {!ios && (
          <button
            type="button"
            onClick={install}
            style={{
              flex: 1,
              padding: '11px 14px',
              borderRadius: '999px',
              border: 'none',
              background: 'linear-gradient(135deg, #C8973A, #e2b45a)',
              color: '#1A2744',
              fontWeight: 800,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            📲 Instalar
          </button>
        )}
      </div>
    </div>
  );
}
