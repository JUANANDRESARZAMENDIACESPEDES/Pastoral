'use client';
import { useEffect, useRef, useState } from 'react';
import { useNotifications } from '../lib/useNotifications';

export default function NotificationBell({
  variant = 'desktop',
  onPromptClose,
}: {
  variant?: 'desktop' | 'mobile';
  onPromptClose?: () => void;
}) {
  const { supported, permission, subscribed, isSubscribing, backendReady, subscribe } =
    useNotifications();
  const [message, setMessage] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [justEnabled, setJustEnabled] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (subscribed) {
      setJustEnabled(true);
      setShowModal(false);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setJustEnabled(false), 6000);
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [subscribed]);

  // Si ya está suscrito, no mostrar nada (silencio activo).
  if (!supported) return null;
  if (subscribed) {
    return variant === 'desktop' ? (
      <li className="nav-item">
        <button
          type="button"
          className="nav-btn nav-bell nav-bell-on"
          onClick={() => {
            setShowModal(true);
            setMessage('Ya estás suscripto a los avisos de último momento. 📣');
          }}
          aria-label="Notificaciones activadas"
          title="Notificaciones activadas"
        >
          <span className="nav-ico" aria-hidden="true">🔔</span>
          <span className="nav-txt">Avisos</span>
        </button>
      </li>
    ) : (
      <li>
        <button
          type="button"
          className="drawer-btn nav-bell-on"
          onClick={() => {
            setShowModal(true);
            setMessage('Ya estás suscripto a los avisos de último momento. 📣');
          }}
        >
          <span className="drawer-ico" aria-hidden="true">🔔</span>
          <span>Avisos activados</span>
        </button>
      </li>
    );
  }

  if (permission === 'denied' || !backendReady) return null;

  const handleSubscribe = async () => {
    setMessage(null);
    const ok = await subscribe();
    if (!ok) {
      setMessage(
        'No se pudo activar. Verificá que el sitio esté en línea (https) y que permitas las notificaciones del navegador.'
      );
    }
  };

  const buttonMarkup = (
    <button
      type="button"
      className={`nav-btn nav-bell ${isSubscribing ? 'is-loading' : ''}`}
      onClick={async () => {
        await handleSubscribe();
        if (onPromptClose) onPromptClose();
      }}
      aria-label="Activar notificaciones"
      title="Activar notificaciones de último momento"
    >
      <span className="nav-ico" aria-hidden="true">🔕</span>
      <span className="nav-txt">{isSubscribing ? 'Activando…' : 'Avisos'}</span>
    </button>
  );

  return (
    <>
      {variant === 'desktop' ? (
        <li className="nav-item">{buttonMarkup}</li>
      ) : (
        <li>{buttonMarkup}</li>
      )}

      {showModal && (
        <div
          className="push-backdrop"
          onClick={() => setShowModal(false)}
          role="presentation"
        >
          <div className="push-modal" role="dialog" aria-label="Notificaciones de la Pastoral">
            <button className="push-modal-close" onClick={() => setShowModal(false)} aria-label="Cerrar">
              ✕
            </button>
            <span className="push-modal-ico" aria-hidden="true">🔔</span>
            <h4>{justEnabled ? '¡Listo! 🎉' : 'Avisos de último momento'}</h4>
            <p>
              {justEnabled
                ? 'Activaste las notificaciones. Nunca más te vas a perder los avisos de última hora.'
                : 'Activá las notificaciones para recibir al instante avisos importantes, como cambios de horario de la misa o novedades de la Pastoral. Sin apps externas, directo en tu celular.'}
            </p>
            {subscribed ? (
              <button className="push-modal-btn push-modal-btn-ok" onClick={() => setShowModal(false)}>
                Entendido
              </button>
            ) : (
              <div className="push-modal-actions">
                <button
                  className="push-modal-btn push-modal-btn-ghost"
                  onClick={() => setShowModal(false)}
                >
                  Ahora no
                </button>
                <button
                  className="push-modal-btn push-modal-btn-primary"
                  onClick={handleSubscribe}
                  disabled={isSubscribing}
                >
                  {isSubscribing ? 'Activando…' : 'Activar notificaciones'}
                </button>
              </div>
            )}
            {message && <p className="push-modal-error">{message}</p>}
          </div>
        </div>
      )}
    </>
  );
}
