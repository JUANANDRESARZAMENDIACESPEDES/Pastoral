'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePwaInstall } from '@/lib/usePwaInstall';

interface PlatformInfo {
  key: 'android' | 'ios' | 'desktop';
  label: string;
  icon: string;
}

function detectPlatform(): PlatformInfo {
  const ua = navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua) && (window.navigator as any).standalone === undefined;
  if (isIos) return { key: 'ios', label: 'iPhone / iPad', icon: '🍎' };
  const isAndroid = /android/i.test(ua) && /mobile/i.test(ua);
  if (isAndroid) return { key: 'android', label: 'Android', icon: '🤖' };
  return { key: 'desktop', label: 'Computadora', icon: '💻' };
}

const ANDROID_STEPS = [
  'Abrí la app en el navegador Chrome (u otro navegador compatible).',
  'Tocá el botón «Instalar ahora» de abajo (o el menú ⋮ de Chrome).',
  'En el menú elegí «Instalar aplicación» o «Agregar a pantalla de inicio».',
  'Confirmá tocando «Instalar» y la app quedará en tu teléfono. 📲',
];

const IOS_STEPS = [
  'Abrí el sitio en Safari (es el único navegador que permite instalar en iPhone/iPad).',
  'Tocá el botón Compartir (cuadrado con flecha hacia arriba ⬆️) en la barra inferior de Safari.',
  'Deslizá las opciones y elegí «Agregar a Pantalla de Inicio».',
  'Tocá «Agregar» (arriba a la derecha). La app quedará en tu pantalla de inicio. 📲',
];

const DESKTOP_CHROME_STEPS = [
  'Abrí el sitio en Google Chrome.',
  'Tocá el icono de instalar en la barra de direcciones (ícono de monitor con flecha ⬇️).',
  'O abrí el menú ⋮ y elegí «Instalar Pastoral Juvenil Luqueña…».',
  'Tocá «Instalar» y la app se abrirá en su propia ventana. 🖥️',
];

const DESKTOP_EDGE_STEPS = [
  'Abrí el sitio en Microsoft Edge.',
  'Tocá el icono de instalar en la barra de direcciones (ícono de monitor con signo +).',
  'O abrí el menú ⋯ y elegí «Aplicaciones» → «Instalar este sitio como una aplicación».',
  'Tocá «Instalar» y la app se abrirá en su propia ventana. 🖥️',
];

export default function InstallGuidePage() {
  const { isStandalone, installed, isIos, deferredAvailable, install } = usePwaInstall();
  const [platform, setPlatform] = useState<PlatformInfo | null>(null);
  const [installing, setInstalling] = useState(false);
  const [isEdge, setIsEdge] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
    setIsEdge(/edg/i.test(navigator.userAgent));
  }, []);

  const installedState = isStandalone || installed;

  const steps = useMemo(() => {
    if (!platform) return [];
    if (platform.key === 'android') return ANDROID_STEPS;
    if (platform.key === 'ios') return IOS_STEPS;
    if (isEdge) return DESKTOP_EDGE_STEPS;
    return DESKTOP_CHROME_STEPS;
  }, [platform, isEdge]);

  const canNative = !isIos && deferredAvailable;

  const handleInstall = async () => {
    setInstalling(true);
    const ok = await install();
    if (ok) {
      return;
    }
    // Sin prompt nativo (todavía): mostramos que use el menú del navegador.
    setInstalling(false);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #16203a 0%, #1A2744 45%, #23345e 100%)',
        color: '#FDFAF5',
        fontFamily: "var(--font-body), 'Manrope', sans-serif",
        padding: '96px 20px 60px',
      }}
    >
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>
        <Link
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            color: 'var(--gold-light, #E8B85A)',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: 600,
            marginBottom: '24px',
          }}
        >
          ← Volver al inicio
        </Link>

        <div
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '20px',
            padding: '28px 24px',
            boxShadow: '0 18px 50px rgba(13,21,46,0.5)',
          }}
        >
          {installedState ? (
            <InstalledNotice />
          ) : (
            <>
              <PlatformHeader platform={platform} />

              <div style={{ marginTop: '8px', fontSize: '14px', lineHeight: 1.6, opacity: 0.9 }}>
                {platform?.key === 'ios'
                  ? 'En iPhone e iPad no se muestra el botón de instalar del navegador, pero podés agregarla a tu pantalla de inicio siguiendo estos pasos:'
                  : 'Seguí estos pasos para tener la app siempre a mano, incluso sin internet.'}
              </div>

              {/* Botón de instalación nativa (solo Android/Chrome) */}
              {platform?.key === 'android' && (
                <div
                  style={{
                    margin: '20px 0 6px',
                    padding: '16px',
                    borderRadius: '14px',
                    background: 'linear-gradient(135deg, #C8973A, #E8B85A)',
                    textAlign: 'center',
                  }}
                >
                  <button
                    type="button"
                    onClick={handleInstall}
                    disabled={installing}
                    style={{
                      width: '100%',
                      padding: '14px 18px',
                      borderRadius: '999px',
                      border: 'none',
                      background: '#1A2744',
                      color: '#fff',
                      fontWeight: 800,
                      fontSize: '16px',
                      cursor: 'pointer',
                    }}
                  >
                    {installing ? 'Preparando…' : '📲 Instalar la app ahora'}
                  </button>
                  {!canNative && (
                    <div
                      style={{
                        marginTop: '10px',
                        fontSize: '12.5px',
                        color: '#1A2744',
                        fontWeight: 700,
                        lineHeight: 1.4,
                      }}
                    >
                      {!deferredAvailable
                        ? 'Si no aparece el aviso del navegador, seguí los pasos de acá abajo.'
                        : 'Chrome te mostrará el aviso de instalación. Confirmá tocando «Instalar».'}
                    </div>
                  )}
                </div>
              )}

              {/* Pasos numerados */}
              <ol
                style={{
                  listStyle: 'none',
                  margin: '22px 0 0',
                  padding: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                {steps.map((step, i) => (
                  <li
                    key={i}
                    style={{
                      display: 'flex',
                      gap: '14px',
                      alignItems: 'flex-start',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '12px',
                      padding: '12px 14px',
                    }}
                  >
                    <span
                      style={{
                        flexShrink: 0,
                        width: '30px',
                        height: '30px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #C8973A, #E8B85A)',
                        color: '#1A2744',
                        fontWeight: 800,
                        fontSize: '15px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {i + 1}
                    </span>
                    <span style={{ fontSize: '14.5px', lineHeight: 1.5 }}>{step}</span>
                  </li>
                ))}
              </ol>

              {/* Atajo manual si no funcionó el botón */}
              {platform?.key === 'android' && !canNative && (
                <div
                  style={{
                    marginTop: '18px',
                    fontSize: '13px',
                    lineHeight: 1.5,
                    opacity: 0.85,
                    background: 'rgba(255,255,255,0.05)',
                    padding: '12px',
                    borderRadius: '12px',
                    border: '1px dashed rgba(255,255,255,0.25)',
                  }}
                >
                  💡 <strong>Atajo rápido:</strong> abrí el menú ⋮ de Chrome y tocá «Instalar
                  aplicación».
                </div>
              )}
            </>
          )}
        </div>

        <p
          style={{
            textAlign: 'center',
            fontSize: '12.5px',
            opacity: 0.7,
            marginTop: '22px',
            lineHeight: 1.5,
          }}
        >
          Usás {platform?.label ?? 'tu dispositivo'}. Esta guía se adapta automáticamente a tu
          navegador. La app funciona sin internet tras la primera carga.
        </p>
      </div>
    </div>
  );
}

function PlatformHeader({ platform }: { platform: PlatformInfo | null }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
      <span
        style={{
          fontSize: '42px',
          lineHeight: 1,
          background: 'rgba(255,255,255,0.08)',
          borderRadius: '16px',
          padding: '10px 12px',
        }}
        aria-hidden="true"
      >
        {platform?.icon ?? '📲'}
      </span>
      <div>
        <div style={{ fontSize: '26px', fontWeight: 800, lineHeight: 1.2, fontFamily: "var(--font-display), 'Fraunces', serif" }}>
          Instalá la app
        </div>
        <div style={{ fontSize: '13px', opacity: 0.85, marginTop: 2 }}>
          Guía para {platform?.label ?? 'tu dispositivo'}
        </div>
      </div>
    </div>
  );
}

function InstalledNotice() {
  return (
    <div style={{ textAlign: 'center', padding: '20px 8px' }}>
      <div
        style={{
          fontSize: '52px',
          lineHeight: 1,
          background: 'rgba(255,255,255,0.08)',
          borderRadius: '18px',
          display: 'inline-block',
          padding: '12px 16px',
          marginBottom: '16px',
        }}
        aria-hidden="true"
      >
        ✅
      </div>
      <div style={{ fontSize: '22px', fontWeight: 800, fontFamily: "var(--font-display), 'Fraunces', serif" }}>
        ¡La app ya está instalada!
      </div>
      <p style={{ fontSize: '14px', opacity: 0.85, marginTop: '8px', lineHeight: 1.6 }}>
        La Pastoral Juvenil Luqueña ya está en tu dispositivo. Abrila desde tu pantalla de inicio o
        seguí usando el sitio. 🙏
      </p>
      <Link
        href="/"
        style={{
          display: 'inline-block',
          marginTop: '18px',
          padding: '12px 26px',
          borderRadius: '999px',
          background: 'linear-gradient(135deg, #C8973A, #E8B85A)',
          color: '#1A2744',
          fontWeight: 800,
          fontSize: '14px',
          textDecoration: 'none',
        }}
      >
        Volver a la comunidad
      </Link>
    </div>
  );
}
