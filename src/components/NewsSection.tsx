'use client';

import { useState, useEffect } from 'react';

interface NewsArticle {
  id: string;
  title: string;
  subtitle: string | null;
  featured_image_url: string | null;
  slug: string;
  published_at: string;
  views_count: number;
  pinned: boolean;
  category?: {
    name: string;
    icon_emoji: string;
    color_hex: string;
  };
}

export function NewsSection() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHomepageArticles();
  }, []);

  const fetchHomepageArticles = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/news/feed/homepage');
      
      if (!response.ok) {
        throw new Error('Error al cargar noticias');
      }

      const data = await response.json();
      setArticles(data.data || []);
      setError(null);
    } catch (err) {
      console.error('Error:', err);
      setError('No se pudieron cargar las noticias');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <section className="section-pjl" style={{ background: 'var(--cream)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            Cargando noticias...
          </div>
        </div>
      </section>
    );
  }

  if (error || articles.length === 0) {
    return null; // No mostrar sección si no hay noticias
  }

  return (
    <section className="section-pjl" style={{ background: 'var(--cream)' }} id="noticias-homepage">
      <div className="container">
        <div className="section-head reveal">
          <span style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 700, letterSpacing: '2px', color: 'var(--gold)', textTransform: 'uppercase' }}>ÚLTIMAS NOTICIAS</span>
          <h3 style={{ margin: '10px 0' }}>📰 Noticias y Eventos</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>Mantente informado sobre las actividades de la Pastoral Juvenil</p>
          <div className="line" style={{ margin: '0 auto' }}></div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '30px',
          marginTop: '40px'
        }}>
          {articles.slice(0, 6).map((article, index) => (
            <a
              key={article.id}
              href={`/noticias/${article.slug}`}
              className="reveal"
              style={{
                animationDelay: `${index * 0.1}s`,
                textDecoration: 'none',
                color: 'inherit'
              }}
            >
              <div style={{
                borderRadius: '12px',
                overflow: 'hidden',
                background: 'white',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                transition: 'all 0.3s ease',
                cursor: 'pointer',
                height: '100%',
                display: 'flex',
                flexDirection: 'column'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.15)';
                e.currentTarget.style.transform = 'translateY(-8px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
              >
                {/* Imagen */}
                {article.featured_image_url ? (
                  <div style={{
                    height: '200px',
                    overflow: 'hidden',
                    background: 'linear-gradient(135deg, var(--gold) 0%, #d4a574 100%)'
                  }}>
                    <img
                      src={article.featured_image_url}
                      alt={article.title}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        transition: 'transform 0.3s ease'
                      }}
                      onMouseEnter={(e) => {
                        (e.target as HTMLImageElement).style.transform = 'scale(1.08)';
                      }}
                      onMouseLeave={(e) => {
                        (e.target as HTMLImageElement).style.transform = 'scale(1)';
                      }}
                    />
                  </div>
                ) : (
                  <div style={{
                    height: '200px',
                    background: 'linear-gradient(135deg, var(--gold) 0%, #d4a574 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '60px'
                  }}>
                    📰
                  </div>
                )}

                {/* Contenido */}
                <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  {/* Categoría y Pin */}
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap' }}>
                    {article.category && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '12px',
                        padding: '4px 10px',
                        borderRadius: '20px',
                        background: `${article.category.color_hex}20`,
                        color: article.category.color_hex,
                        fontWeight: 600
                      }}>
                        {article.category.icon_emoji} {article.category.name}
                      </span>
                    )}
                    {article.pinned && (
                      <span style={{
                        fontSize: '12px',
                        padding: '4px 10px',
                        borderRadius: '20px',
                        background: '#fbbf24',
                        color: '#78350f',
                        fontWeight: 600
                      }}>
                        📌 Destacado
                      </span>
                    )}
                  </div>

                  {/* Título */}
                  <h4 style={{
                    fontSize: '1.1rem',
                    fontWeight: 700,
                    marginBottom: '8px',
                    color: 'var(--navy)',
                    lineHeight: 1.4,
                    flex: 1
                  }}>
                    {article.title}
                  </h4>

                  {/* Subtítulo */}
                  {article.subtitle && (
                    <p style={{
                      fontSize: '0.9rem',
                      color: 'var(--text-muted)',
                      marginBottom: '12px',
                      lineHeight: 1.5
                    }}>
                      {article.subtitle}
                    </p>
                  )}

                  {/* Meta información */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: 'auto',
                    paddingTop: '12px',
                    borderTop: '1px solid #e5e7eb',
                    fontSize: '0.85rem',
                    color: 'var(--text-muted)'
                  }}>
                    <span>
                      {new Date(article.published_at).toLocaleDateString('es-PY', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </span>
                    <span>👁️ {article.views_count}</span>
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>

        {/* Ver todas las noticias */}
        <div style={{ textAlign: 'center', marginTop: '50px' }}>
          <a
            href="/noticias"
            style={{
              display: 'inline-block',
              padding: '12px 32px',
              background: 'var(--gold)',
              color: 'var(--navy)',
              borderRadius: '8px',
              fontWeight: 700,
              textDecoration: 'none',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#d4a574';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--gold)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            Ver todas las noticias →
          </a>
        </div>
      </div>
    </section>
  );
}
