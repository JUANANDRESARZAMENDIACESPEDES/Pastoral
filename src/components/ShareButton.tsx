'use client';
import { useEffect, useState } from 'react';

interface ShareButtonProps {
  title: string;
  text?: string;
  url?: string;
  className?: string;
  label?: string;
}

export default function ShareButton({ title, text, url, className = '', label = 'Compartir' }: ShareButtonProps) {
  const [supported, setSupported] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setSupported(typeof navigator !== 'undefined' && !!navigator.share);
  }, []);

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : '/');
    if (navigator.share) {
      try {
        await navigator.share({ title, text: text || title, url: shareUrl });
        return;
      } catch {
        // usuario canceló o falló → intentar copiar el enlace
      }
    }
    // Fallback: copiar enlace al portapapeles.
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* sin portapapeles disponible */
    }
  };

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={handleShare}
      className={`share-btn ${className}`}
      aria-label={`Compartir: ${title}`}
      title={label}
    >
      {copied ? (
        <>
          <span aria-hidden="true">✅</span>
          <span>Enlace copiado</span>
        </>
      ) : (
        <>
          <span aria-hidden="true">🔗</span>
          <span>{label}</span>
        </>
      )}
    </button>
  );
}
