'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePwaInstall } from '../lib/usePwaInstall';

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
  const { isStandalone, installed, isIos, install } = usePwaInstall();
  const [visible, setVisible] = useState(false);
  const [dismissedThisSession, setDismissedThisSession] = useState(false);

  useEffect(() => {
    // Si ya está instalada (app abierta en modo standalone) o recién instalada,
    // no mostramos el prompt.
    if (isStandalone || installed) return;

    // Si el usuario cerró el aviso en ESTA visita, no lo repetimos hasta su
    // próxima entrada a la página. Volverá a aparecer cada vez que entre sin
    // tener la app descargada.
    if (dismissedThisSession) return;
    const sessionDismiss = sessionStorage.getItem('pjl_pwa_dismissed_session');
    if (sessionDismiss) return;

    const show = () => setVisible(true);

    const timer = window.setTimeout(show, 3500);
    window.addEventListener('pjl_request_install', show);
    window.addEventListener('pjl_can_install', show);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pjl_request_install', show);
      window.removeEventListener('pjl_can_install', show);
    };
  }, [isStandalone, installed, dismissedThisSession]);

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

  return (
    <div role="dialog" aria-label="Instalar Pastoral Juvenil Luqueña" style={MODAL_STYLE}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <span style={{ fontSize: '30px', lineHeight: 1 }} aria-hidden="true">⛪</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: '15px', lineHeight: 1.3 }}>
            Instalá la app de Pastoral Luque en tu teléfono
          </div>
          <div style={{ fontSize: '12.5px', opacity: 0.85, marginTop: 4, lineHeight: 1.45 }}>
            {isIos
              ? 'Tocá el botón Compartir (⬆️) de tu navegador y elegí "Agregar a pantalla de inicio". Así nunca te perdés los avisos.'
              : 'Tendrás la comunidad, la agenda y los avisos siempre a mano, incluso sin internet.'}
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
        {!isIos && (
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
      </div>
    </div>
  );
}
