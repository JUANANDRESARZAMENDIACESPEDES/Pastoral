'use client';
import { usePwaInstall } from '../lib/usePwaInstall';

export default function NavDownloadButton({ variant = 'desktop' }: { variant?: 'desktop' | 'mobile' }) {
  const { isStandalone, installed, triggerInstall } = usePwaInstall();

  // Si la app ya está instalada (o abierta en pantalla completa), ocultar botón.
  if (isStandalone || installed) return null;

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    triggerInstall();
  };

  if (variant === 'mobile') {
    return (
      <li>
        <button
          type="button"
          onClick={onClick}
          className="drawer-btn drawer-btn-download"
          aria-label="Descargar la app"
        >
          <span className="drawer-ico" aria-hidden="true">📲</span>
          <span>Descargar App</span>
        </button>
      </li>
    );
  }

  return (
    <li className="nav-item nav-download-item">
      <button
        type="button"
        onClick={onClick}
        className="nav-btn nav-download-btn"
        data-nav="descargar"
        aria-label="Descargar la app"
      >
        <span className="nav-ico nav-download-ico" aria-hidden="true">📲</span>
        <span className="nav-txt">Descargar App</span>
      </button>
    </li>
  );
}
