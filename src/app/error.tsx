'use client';

import Link from 'next/link';

export default function PageError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="section-pjl" style={{ minHeight: '70vh', display: 'flex', alignItems: 'center' }}>
      <div className="container">
        <div className="pjl-empty-state" style={{ maxWidth: '560px', margin: '0 auto' }}>
          <div className="empty-icon">⚠️</div>
          <h4 className="empty-title">Algo salió mal</h4>
          <p className="empty-desc">Ocurrió un error inesperado al cargar esta sección. Podés reintentar o volver al inicio.</p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button className="btn-premium btn-premium-gold" onClick={reset}>Reintentar</button>
            <Link className="btn-premium btn-premium-outline" href="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Ir al inicio</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
