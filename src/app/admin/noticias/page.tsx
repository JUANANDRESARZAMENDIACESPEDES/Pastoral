/**
 * Page: /admin/noticias
 * Panel administrativo de noticias y eventos
 */

'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { NewsArticleWithDetails } from '@/lib/newsTypes';

// Importar componentes de forma dinámica para evitar SSR issues
const NewsAdminTable = dynamic(() => import('@/components/admin/NewsAdminTable').then(mod => ({ default: mod.NewsAdminTable })), { loading: () => <div>Cargando tabla...</div> });
const NewsArticleForm = dynamic(() => import('@/components/admin/NewsArticleForm').then(mod => ({ default: mod.NewsArticleForm })), { loading: () => <div>Cargando formulario...</div> });
const NewsEventForm = dynamic(() => import('@/components/admin/NewsEventForm').then(mod => ({ default: mod.NewsEventForm })), { loading: () => <div>Cargando formulario de eventos...</div> });

type View = 'list' | 'article' | 'event';

export default function NewsAdminPage() {
  const [currentView, setCurrentView] = useState<View>('list');
  const [selectedArticle, setSelectedArticle] = useState<NewsArticleWithDetails | null>(null);

  const handleEditArticle = (article: NewsArticleWithDetails) => {
    setSelectedArticle(article);
    setCurrentView('article');
  };

  const handleSaveArticle = () => {
    setCurrentView('list');
    setSelectedArticle(null);
  };

  const handleSaveEvent = () => {
    setCurrentView('list');
    setSelectedArticle(null);
  };

  const handleCancel = () => {
    setCurrentView('list');
    setSelectedArticle(null);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', padding: '20px' }}>
      <style jsx>{`
        .container {
          max-width: 1400px;
          margin: 0 auto;
        }
        .header {
          background: white;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 20px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        .header h1 {
          margin: 0;
          color: #333;
          font-size: 2rem;
        }
        .header-subtitle {
          color: #666;
          margin-top: 5px;
        }
        .tabs {
          display: flex;
          gap: 10px;
          margin-top: 20px;
          border-bottom: 2px solid #eee;
        }
        .tab {
          padding: 12px 20px;
          background: none;
          border: none;
          font-size: 1rem;
          cursor: pointer;
          color: #666;
          border-bottom: 3px solid transparent;
          transition: all 0.2s;
        }
        .tab:hover {
          color: #333;
        }
        .tab.active {
          color: #C8973A;
          border-bottom-color: #C8973A;
        }
        .content {
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        .new-article-btn {
          background: #C8973A;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 1rem;
          font-weight: 500;
          transition: all 0.2s;
        }
        .new-article-btn:hover {
          background: #b07d2e;
        }
        .back-btn {
          background: #eee;
          border: 1px solid #ddd;
          padding: 10px 20px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 1rem;
          transition: all 0.2s;
        }
        .back-btn:hover {
          background: #ddd;
        }
        .toolbar {
          display: flex;
          gap: 10px;
          align-items: center;
          flex-wrap: wrap;
        }
        .form-container {
          padding: 20px;
        }
      `}</style>

      <div className="container">
        <div className="header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#333' }}>📰 Gestión de Noticias</h1>
          </div>

          {currentView === 'list' && (
            <div className="toolbar" style={{ marginTop: '20px' }}>
              <button className="new-article-btn" onClick={() => setCurrentView('article')}>
                ✨ Crear Nueva Noticia
              </button>
            </div>
          )}

          {currentView !== 'list' && (
            <div className="toolbar" style={{ marginTop: '20px' }}>
              <button className="back-btn" onClick={handleCancel}>
                ← Volver a la lista
              </button>
              <div style={{ color: '#666', fontWeight: 500 }}>
                {currentView === 'article'
                  ? (selectedArticle ? `Editando: ${selectedArticle.title}` : 'Creando una nueva noticia')
                  : (selectedArticle ? `Configurando evento para: ${selectedArticle.title}` : 'Configurando evento')}
              </div>
            </div>
          )}
        </div>

        {currentView === 'list' && (
          <div className="content">
            <NewsAdminTable
              onEdit={handleEditArticle}
              onDelete={() => {}}
              onEvent={(art) => {
                setSelectedArticle(art);
                setCurrentView('event');
              }}
            />
          </div>
        )}

        {currentView === 'article' && (
          <div className="content">
            <div className="form-container">
              <NewsArticleForm
                article={selectedArticle || undefined}
                onSave={handleSaveArticle}
                onCancel={handleCancel}
              />
            </div>
          </div>
        )}

        {currentView === 'event' && selectedArticle && (
          <div className="content">
            <div className="form-container">
              <h2 style={{ marginTop: 0 }}>Agregar Evento a: &quot;{selectedArticle.title}&quot;</h2>
              <NewsEventForm
                articleId={selectedArticle.id}
                event={selectedArticle.event}
                onSave={handleSaveEvent}
                onCancel={handleCancel}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
