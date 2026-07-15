/**
 * Component: NewsArticleForm
 * Formulario para crear y editar artículos de noticias
 */

'use client';

import { useEffect, useState, useRef } from 'react';
import { NewsArticleWithDetails, NewsCategory } from '@/lib/newsTypes';

interface NewsArticleFormProps {
  article?: NewsArticleWithDetails;
  onSave?: (article: NewsArticleWithDetails) => void;
  onCancel?: () => void;
}

export function NewsArticleForm({ article, onSave, onCancel }: NewsArticleFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<NewsCategory[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    subtitle: '',
    body: '',
    category_id: '',
    featured_image_url: '',
    published: false,
  });

  useEffect(() => {
    fetchCategories();
    if (article) {
      setFormData({
        title: article.title,
        subtitle: article.subtitle || '',
        body: article.body,
        category_id: article.category_id || '',
        featured_image_url: article.featured_image_url || '',
        published: article.published,
      });
    }
  }, [article]);

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/news/categories');
      const data = await response.json();
      if (data.success) {
        setCategories(data.data);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const method = article ? 'PATCH' : 'POST';
      const endpoint = article ? `/api/news/articles/${article.id}` : '/api/news/articles';

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        onSave?.(data.data);
      } else {
        setError(data.error || 'Error saving article');
      }
    } catch (err) {
      setError('Error saving article');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', background: 'white', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
      <style jsx>{`
        .form-group {
          margin-bottom: 20px;
        }
        label {
          display: block;
          margin-bottom: 8px;
          font-weight: 500;
          color: #333;
        }
        input[type='text'],
        input[type='url'],
        textarea,
        select {
          width: 100%;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 1rem;
          font-family: inherit;
        }
        textarea {
          min-height: 150px;
          resize: vertical;
        }
        input[type='text']:focus,
        input[type='url']:focus,
        textarea:focus,
        select:focus {
          outline: none;
          border-color: #C8973A;
          box-shadow: 0 0 0 3px rgba(200, 151, 58, 0.1);
        }
        .checkbox-group {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        input[type='checkbox'] {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }
        .button-group {
          display: flex;
          gap: 10px;
          margin-top: 30px;
        }
        button {
          padding: 10px 20px;
          border: none;
          border-radius: 4px;
          font-size: 1rem;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
        }
        .btn-save {
          background: #C8973A;
          color: white;
        }
        .btn-save:hover:not(:disabled) {
          background: #b07d2e;
        }
        .btn-cancel {
          background: #eee;
          color: #333;
          border: 1px solid #ddd;
        }
        .btn-cancel:hover {
          background: #ddd;
        }
        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .error {
          background: #fee;
          color: #c33;
          padding: 12px;
          border-radius: 4px;
          margin-bottom: 20px;
        }
        .help-text {
          font-size: 0.85rem;
          color: #666;
          margin-top: 4px;
        }
        .row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }
        @media (max-width: 768px) {
          .row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <h2 style={{ marginBottom: '20px', color: '#333' }}>
        {article ? 'Editar Artículo' : 'Crear Nuevo Artículo'}
      </h2>

      {error && <div className="error">{error}</div>}

      <form ref={formRef} onSubmit={handleSubmit}>
        <div className="row">
          <div className="form-group">
            <label htmlFor="title">Título *</label>
            <input
              id="title"
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="Ej: Retiro Cuaresmal Juvenil"
              required
              minLength={5}
              maxLength={200}
            />
            <div className="help-text">{formData.title.length}/200</div>
          </div>

          <div className="form-group">
            <label htmlFor="category">Categoría</label>
            <select
              id="category"
              name="category_id"
              value={formData.category_id}
              onChange={handleChange}
            >
              <option value="">-- Seleccionar categoría --</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon_emoji} {cat.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="subtitle">Copete/Subtítulo</label>
          <input
            id="subtitle"
            type="text"
            name="subtitle"
            value={formData.subtitle}
            onChange={handleChange}
            placeholder="Resumen breve del artículo"
            maxLength={300}
          />
          <div className="help-text">{formData.subtitle.length}/300</div>
        </div>

        <div className="form-group">
          <label htmlFor="featured_image_url">URL de Imagen Destacada</label>
          <input
            id="featured_image_url"
            type="url"
            name="featured_image_url"
            value={formData.featured_image_url}
            onChange={handleChange}
            placeholder="https://example.com/image.jpg"
          />
          <div className="help-text">URL completa de la imagen (JPEG, PNG, WebP)</div>
        </div>

        <div className="form-group">
          <label htmlFor="body">Cuerpo del Artículo *</label>
          <textarea
            id="body"
            name="body"
            value={formData.body}
            onChange={handleChange}
            placeholder="Contenido principal del artículo..."
            required
            minLength={20}
            maxLength={10000}
          />
          <div className="help-text">{formData.body.length}/10000</div>
        </div>

        <div className="form-group">
          <div className="checkbox-group">
            <input
              id="published"
              type="checkbox"
              name="published"
              checked={formData.published}
              onChange={handleChange}
            />
            <label htmlFor="published" style={{ margin: 0 }}>
              Publicar inmediatamente
            </label>
          </div>
          <div className="help-text">Si no marcan, quedará como borrador</div>
        </div>

        <div className="button-group">
          <button type="submit" className="btn-save" disabled={loading}>
            {loading ? 'Guardando...' : article ? 'Actualizar' : 'Crear'}
          </button>
          <button type="button" className="btn-cancel" onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

export default NewsArticleForm;
