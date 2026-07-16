/**
 * Component: NewsAdminTable
 * Tabla principal del panel de administración de noticias
 */

'use client';

import { useEffect, useState } from 'react';
import { NewsArticleWithDetails } from '@/lib/newsTypes';

interface NewsAdminTableProps {
  onEdit?: (article: NewsArticleWithDetails) => void;
  onDelete?: (id: string) => void;
  onEvent?: (article: NewsArticleWithDetails) => void;
}

export function NewsAdminTable({ onEdit, onDelete, onEvent }: NewsAdminTableProps) {
  const [articles, setArticles] = useState<NewsArticleWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    published: 'all',
    archived: 'false',
    sort: 'published_at',
  });

  useEffect(() => {
    fetchArticles();
  }, [filters]);

  const fetchArticles = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();

      if (filters.published !== 'all') {
        params.append('published', filters.published === 'true' ? 'true' : 'false');
      }
      if (filters.archived !== 'all') {
        params.append('archived', filters.archived);
      }
      params.append('limit', '50');

      const response = await fetch(`/api/news/articles?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setArticles(data.data);
        setError(null);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Error fetching articles');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePin = async (id: string) => {
    try {
      const response = await fetch(`/api/news/articles/${id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pin', pin_order: 0 }),
      });

      if (response.ok) {
        fetchArticles();
      }
    } catch (err) {
      console.error('Error pinning article:', err);
    }
  };

  const handlePublish = async (id: string) => {
    try {
      const response = await fetch(`/api/news/articles/${id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'publish' }),
      });

      if (response.ok) {
        fetchArticles();
      }
    } catch (err) {
      console.error('Error publishing article:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este artículo?')) return;

    try {
      const response = await fetch(`/api/news/articles/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchArticles();
        onDelete?.(id);
      }
    } catch (err) {
      console.error('Error deleting article:', err);
    }
  };

  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Cargando artículos...</div>;
  }

  if (error) {
    return <div style={{ padding: '20px', color: 'red' }}>Error: {error}</div>;
  }

  return (
    <div style={{ padding: '20px' }}>
      <style jsx>{`
        .filters {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }
        .filter-group {
          display: flex;
          gap: 5px;
          align-items: center;
        }
        .filter-group label {
          font-weight: 500;
          font-size: 0.9rem;
        }
        .filter-group select {
          padding: 5px 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 0.9rem;
        }
        .table-container {
          overflow-x: auto;
          border: 1px solid #ddd;
          border-radius: 8px;
          background: white;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.95rem;
        }
        thead {
          background: #f5f5f5;
          font-weight: 600;
        }
        th {
          padding: 12px;
          text-align: left;
          border-bottom: 2px solid #ddd;
        }
        td {
          padding: 12px;
          border-bottom: 1px solid #eee;
        }
        tbody tr:hover {
          background: #f9f9f9;
        }
        .status-badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 0.85rem;
          font-weight: 500;
        }
        .status-published {
          background: #d1fae5;
          color: #065f46;
        }
        .status-draft {
          background: #fef3c7;
          color: #78350f;
        }
        .status-archived {
          background: #f3f4f6;
          color: #374151;
        }
        .actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .action-btn {
          padding: 6px 12px;
          border: 1px solid #ddd;
          background: white;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.85rem;
          transition: all 0.2s;
        }
        .action-btn:hover {
          background: #f0f0f0;
          border-color: #999;
        }
        .action-btn.delete {
          color: #dc2626;
          border-color: #dc2626;
        }
        .action-btn.delete:hover {
          background: #fee2e2;
        }
        .title-cell {
          font-weight: 500;
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .date-cell {
          font-size: 0.9rem;
          color: #666;
        }
        .empty {
          text-align: center;
          padding: 40px;
          color: #999;
        }
        @media (max-width: 768px) {
          .filters {
            flex-direction: column;
            align-items: stretch;
          }
          .filter-group {
            width: 100%;
            justify-content: space-between;
          }
          .filter-group select {
            width: 100%;
          }
          .table-container {
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }
          table {
            min-width: 600px;
          }
          th,
          td {
            white-space: nowrap;
          }
          .actions {
            gap: 6px;
          }
          .action-btn {
            min-height: 40px;
            min-width: 40px;
          }
          .title-cell {
            max-width: none;
          }
        }
      `}</style>

      <div className="filters">
        <div className="filter-group">
          <label htmlFor="published-filter">Estado:</label>
          <select
            id="published-filter"
            value={filters.published}
            onChange={(e) => setFilters({ ...filters, published: e.target.value })}
          >
            <option value="all">Todos</option>
            <option value="true">Publicados</option>
            <option value="false">Borradores</option>
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="archived-filter">Archivados:</label>
          <select
            id="archived-filter"
            value={filters.archived}
            onChange={(e) => setFilters({ ...filters, archived: e.target.value })}
          >
            <option value="false">No</option>
            <option value="true">Sí</option>
            <option value="all">Todos</option>
          </select>
        </div>
      </div>

      {articles.length === 0 ? (
        <div className="empty">
          <p>No hay artículos que mostrar</p>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Título</th>
                <th>Categoría</th>
                <th>Estado</th>
                <th>Fecha</th>
                <th>Vistas</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {articles.map((article) => (
                <tr key={article.id}>
                  <td className="title-cell" title={article.title}>
                    {article.pinned && '📌 '}
                    {article.title}
                  </td>
                  <td>{article.category?.name || '—'}</td>
                  <td>
                    <span
                      className={`status-badge ${
                        article.archived
                          ? 'status-archived'
                          : article.published
                            ? 'status-published'
                            : 'status-draft'
                      }`}
                    >
                      {article.archived ? 'Archivado' : article.published ? 'Publicado' : 'Borrador'}
                    </span>
                  </td>
                  <td className="date-cell">
                    {article.published_at ? new Date(article.published_at).toLocaleDateString('es-PY') : '—'}
                  </td>
                  <td>{article.views_count}</td>
                  <td>
                    <div className="actions">
                      <button
                        className="action-btn"
                        onClick={() => onEdit?.(article)}
                        title="Editar"
                      >
                        ✏️
                      </button>
                      <button
                        className="action-btn"
                        onClick={() => onEvent?.(article)}
                        title="Programar Evento"
                      >
                        📅
                      </button>
                      {!article.published && (
                        <button
                          className="action-btn"
                          onClick={() => handlePublish(article.id)}
                          title="Publicar"
                        >
                          ✓
                        </button>
                      )}
                      {!article.pinned && (
                        <button
                          className="action-btn"
                          onClick={() => handlePin(article.id)}
                          title="Fijar"
                        >
                          📌
                        </button>
                      )}
                      <button
                        className="action-btn delete"
                        onClick={() => handleDelete(article.id)}
                        title="Eliminar"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default NewsAdminTable;
