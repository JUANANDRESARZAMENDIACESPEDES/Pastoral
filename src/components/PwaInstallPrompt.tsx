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
  const { isStandalone, installed, isIos, isAndroid, canInstallNative, install } = usePwaInstall();
  const [visible, setVisible] = useState(false);
  const [dismissedThisSession, setDismissedThisSession] = useState(false);

  useEffect(() => {
    if (isStandalone || installed) return;
    if (dismissedThisSession) return;

    const show = () => setVisible(true);
    const onInstalled = () => setVisible(false);

    // Se muestra en móviles de forma proactiva (Android o iOS), o en escritorio
    // cuando el navegador habilita la instalación nativa. Aparece en cada
    // carga de página (sin guardado persistente) para que el aviso de
    // instalación nunca quede "atrapado" en un estado anterior de la sesión.
    const autoShow = () => {
      if (isIos || isAndroid || canInstallNative) setVisible(true);
    };

    const timer = window.setTimeout(autoShow, 2500);
    window.addEventListener('pjl_request_install', show);
    window.addEventListener('pjl_app_installed', onInstalled);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pjl_request_install', show);
      window.removeEventListener('pjl_app_installed', onInstalled);
    };
  }, [isStandalone, installed, dismissedThisSession, isIos, isAndroid, canInstallNative]);

  const handleInstall = useCallback(async () => {
    const ok = await install();
    if (ok) {
      setVisible(false);
      return;
    }
    // En Android si por algún motivo no hay prompt nativo aún, igual va a la
    // guía como respaldo.
    setVisible(false);
    window.location.href = '/instalar';
  }, [install]);

  const goToGuide = useCallback(() => {
    setVisible(false);
    window.location.href = '/instalar';
  }, []);

  const dismiss = useCallback(() => {
    // Solo se oculta para esta vista de la página: al volver a cargar (o en
    // una navegación nueva) el aviso vuelve a aparecer.
    setDismissedThisSession(true);
    setVisible(false);
  }, []);

  if (!visible || isStandalone || installed) return null;

  const iosSteps = isIos
    ? [
        '1️⃣ Tocá Compartir (cuadrado con flecha ⬆️) en Safari.',
        '2️⃣ Elegí «Agregar a Pantalla de Inicio».',
        '3️⃣ Tocá «Agregar».',
      ]
    : null;

  const body = iosSteps ? (
    iosSteps.map((s, i) => (
      <div key={i} style={{ marginTop: i === 0 ? 0 : 4 }}>{s}</div>
    ))
  ) : isAndroid ? (
    canInstallNative
      ? 'Tocá «Instalar» y confirmá el aviso del navegador. Si no aparece, te guiamos paso a paso.'
      : 'En Android tocá «Ver pasos» y te mostramos cómo instalarla desde el menú de tu navegador.'
  ) : (
    'Tocá «Ver pasos» y te mostramos cómo instalar la app en este dispositivo.'
  );

  return (
    <div role="dialog" aria-label="Instalar Pastoral Juvenil Luqueña" style={MODAL_STYLE}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <span style={{ fontSize: '30px', lineHeight: 1 }} aria-hidden="true">📲</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: '15px', lineHeight: 1.3 }}>
            Instalá la app de Pastoral Luque en tu teléfono
          </div>
          <div style={{ fontSize: '12.5px', opacity: 0.85, marginTop: 4, lineHeight: 1.45 }}>
            {body}
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
        {isAndroid ? (
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
        ) : (
          <button
            type="button"
            onClick={goToGuide}
            style={{
              flex: 1, padding: '11px 14px', borderRadius: '999px', border: 'none',
              background: 'linear-gradient(135deg, #C8973A, #e2b45a)',
              color: '#1A2744', fontWeight: 800, fontSize: '13px', cursor: 'pointer',
            }}
          >
            Ver pasos →
          </button>
        )}
      </div>
    </div>
  );
}
