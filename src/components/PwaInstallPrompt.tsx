'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePwaInstall } from '../lib/usePwaInstall';

/* Estilo propio del banner, acorde a la identidad navy/dorado del sitio. */
const MODAL_STYLE: React.CSSProperties = {
  position: 'fixed',
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 2147483001,
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
  const { isStandalone, installed, isIos, deferredAvailable, canInstallNative, install } =
    usePwaInstall();
  const [visible, setVisible] = useState(false);
  const [dismissedThisSession, setDismissedThisSession] = useState(false);

  useEffect(() => {
    if (isStandalone || installed) return;
    if (dismissedThisSession) return;
    try {
      if (sessionStorage.getItem('pjl_pwa_dismissed_session')) return;
    } catch { /* ignore */ }

    const show = () => setVisible(true);
    const onInstalled = () => setVisible(false);

    // Se muestra solo si el navegador es capaz de instalar de forma nativa
    // (beforeinstallprompt disponible) o si es iOS (instrucciones manuales).
    const autoShow = () => {
      if (isIos || deferredAvailable) setVisible(true);
    };

    const timer = window.setTimeout(autoShow, 3500);
    window.addEventListener('pjl_request_install', show);
    window.addEventListener('pjl_app_installed', onInstalled);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pjl_request_install', show);
      window.removeEventListener('pjl_app_installed', onInstalled);
    };
  }, [isStandalone, installed, dismissedThisSession, isIos, deferredAvailable]);

  const handleInstall = useCallback(async () => {
    const ok = await install();
    if (ok) setVisible(false);
  }, [install]);

  const dismiss = useCallback(() => {
    try {
      sessionStorage.setItem('pjl_pwa_dismissed_session', '1');
    } catch {
      /* almacenamiento no disponible */
    }
    setDismissedThisSession(true);
    setVisible(false);
  }, []);

  if (!visible || isStandalone || installed) return null;

  const canNative = canInstallNative;

  const iosSteps = isIos
    ? [
        '1️⃣ Tocá el botón Compartir (cuadrado con flecha ⬆️) en la barra de Safari.',
        '2️⃣ Deslizá hasta la opción "Agregar a Pantalla de Inicio".',
        '3️⃣ Tocá "Agregar" y la app quedará en tu teléfono. 📲',
      ]
    : null;

  return (
    <div role="dialog" aria-label="Instalar Pastoral Juvenil Luqueña" style={MODAL_STYLE}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <span style={{ fontSize: '30px', lineHeight: 1 }} aria-hidden="true">📲</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: '15px', lineHeight: 1.3 }}>
            Instalá la app de Pastoral Luque en tu teléfono
          </div>
          <div style={{ fontSize: '12.5px', opacity: 0.85, marginTop: 4, lineHeight: 1.45 }}>
            {iosSteps
              ? iosSteps.map((s, i) => (
                  <div key={i} style={{ marginTop: i === 0 ? 0 : 6 }}>{s}</div>
                ))
              : canNative
                ? 'Tocá "Instalar" y confirmá el aviso del navegador. Tendrás la comunidad, la agenda y los avisos siempre a mano, incluso sin internet.'
                : 'Abrí el menú ⋮ de tu navegador y elegí "Instalar aplicación" o "Agregar a pantalla de inicio". Así tendrás la app siempre a mano.'}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          type="button"
          onClick={dismiss}
          style={{
            flex: 1, padding: '11px 14px', borderRadius: '999px',
            border: '1px solid rgba(255,255,255,0.35)', background: 'transparent',
            color: '#fff', fontWeight: 700, fontSize: '13px', cursor: 'pointer',
          }}
        >
          Ahora no
        </button>
        {canNative && (
          <button
            type="button"
            onClick={handleInstall}
            style={{
              flex: 1, padding: '11px 14px', borderRadius: '999px', border: 'none',
              background: 'linear-gradient(135deg, #C8973A, #e2b45a)',
              color: '#1A2744', fontWeight: 800, fontSize: '13px', cursor: 'pointer',
            }}
          >
            📲 Instalar
          </button>
        )}
        {!canNative && (
          <button
            type="button"
            onClick={dismiss}
            style={{
              flex: 1, padding: '11px 14px', borderRadius: '999px', border: 'none',
              background: 'linear-gradient(135deg, #C8973A, #e2b45a)',
              color: '#1A2744', fontWeight: 800, fontSize: '13px', cursor: 'pointer',
            }}
          >
            Entendido
          </button>
        )}
      </div>
    </div>
  );
}
