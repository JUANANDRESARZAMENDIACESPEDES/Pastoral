-- ============================================================================
-- SISTEMA DE GESTIÓN DE NOTICIAS Y EVENTOS
-- Pastoral Juvenil de Luque
-- ============================================================================
-- Ejecutar este SQL en el editor Supabase de tu proyecto.
-- Este script crea todas las tablas necesarias para el nuevo sistema.

-- ============================================================================
-- 1. TABLA: news_categories
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.news_categories (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  icon_emoji VARCHAR(5),
  color_hex VARCHAR(7) DEFAULT '#C8973A',
  sort_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_news_categories_slug ON public.news_categories(slug);
CREATE INDEX IF NOT EXISTS idx_news_categories_active ON public.news_categories(active);

-- ============================================================================
-- 2. TABLA: news_tags
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.news_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL UNIQUE,
  slug VARCHAR(50) UNIQUE NOT NULL,
  color_hex VARCHAR(7) DEFAULT '#C8973A',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_news_tags_slug ON public.news_tags(slug);

-- ============================================================================
-- 3. TABLA: news_articles
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.news_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  subtitle VARCHAR(300),
  body TEXT NOT NULL,
  slug VARCHAR(250) UNIQUE NOT NULL,
  category_id UUID REFERENCES public.news_categories(id) ON DELETE SET NULL,
  tags JSONB DEFAULT '[]'::jsonb,
  featured_image_url TEXT,
  gallery_urls JSONB DEFAULT '[]'::jsonb,
  published BOOLEAN DEFAULT false,
  pinned BOOLEAN DEFAULT false,
  pin_order INTEGER DEFAULT 999,
  featured_on_homepage BOOLEAN DEFAULT false,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  views_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  archived BOOLEAN DEFAULT false,
  archived_at TIMESTAMPTZ,
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('spanish', title) || to_tsvector('spanish', COALESCE(body, ''))
  ) STORED
);

CREATE INDEX IF NOT EXISTS idx_news_articles_category ON public.news_articles(category_id);
CREATE INDEX IF NOT EXISTS idx_news_articles_published ON public.news_articles(published, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_articles_pinned ON public.news_articles(pinned, pin_order);
CREATE INDEX IF NOT EXISTS idx_news_articles_slug ON public.news_articles(slug);
CREATE INDEX IF NOT EXISTS idx_news_articles_search ON public.news_articles USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_news_articles_archived ON public.news_articles(archived);
CREATE INDEX IF NOT EXISTS idx_news_articles_created ON public.news_articles(created_at DESC);

-- ============================================================================
-- 4. TABLA: news_events
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.news_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL UNIQUE REFERENCES public.news_articles(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  start_time TIME,
  end_date DATE,
  end_time TIME,
  location_name VARCHAR(150),
  location_address TEXT,
  google_maps_url TEXT,
  location_lat NUMERIC(10, 8),
  location_lng NUMERIC(11, 8),
  allow_inscription BOOLEAN DEFAULT false,
  max_participants INTEGER,
  current_participants INTEGER DEFAULT 0,
  inscription_deadline TIMESTAMPTZ,
  contact_person_name VARCHAR(100),
  contact_email VARCHAR(100),
  contact_phone VARCHAR(20),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_news_events_article ON public.news_events(article_id);
CREATE INDEX IF NOT EXISTS idx_news_events_date ON public.news_events(start_date);
CREATE INDEX IF NOT EXISTS idx_news_events_upcoming ON public.news_events(start_date ASC);

-- ============================================================================
-- 5. TABLA: news_images
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.news_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES public.news_articles(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  alt_text VARCHAR(200),
  caption TEXT,
  sort_order INTEGER DEFAULT 0,
  width INTEGER,
  height INTEGER,
  file_size INTEGER,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_news_images_article ON public.news_images(article_id);

-- ============================================================================
-- 6. TABLA: news_activity_log
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.news_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID REFERENCES public.news_articles(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changes JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_news_activity_log_article ON public.news_activity_log(article_id);
CREATE INDEX IF NOT EXISTS idx_news_activity_log_actor ON public.news_activity_log(actor_id);

-- ============================================================================
-- 7. TRIGGERS para actualizar updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_news_articles_timestamp ON public.news_articles;
CREATE TRIGGER trigger_news_articles_timestamp
BEFORE UPDATE ON public.news_articles
FOR EACH ROW
EXECUTE FUNCTION public.update_timestamp();

DROP TRIGGER IF EXISTS trigger_news_events_timestamp ON public.news_events;
CREATE TRIGGER trigger_news_events_timestamp
BEFORE UPDATE ON public.news_events
FOR EACH ROW
EXECUTE FUNCTION public.update_timestamp();

-- ============================================================================
-- 8. ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- news_categories: todos pueden leer, solo admin puede escribir
ALTER TABLE public.news_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read news_categories" ON public.news_categories;
CREATE POLICY "Public read news_categories"
ON public.news_categories FOR SELECT
TO anon, authenticated
USING (active = true);

DROP POLICY IF EXISTS "Admin manage news_categories" ON public.news_categories;
CREATE POLICY "Admin manage news_categories"
ON public.news_categories FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE auth_uid = auth.uid()
    AND role IN ('desarrollador', 'editor')
  )
);

-- news_tags: todos pueden leer, solo admin puede escribir
ALTER TABLE public.news_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read news_tags" ON public.news_tags;
CREATE POLICY "Public read news_tags"
ON public.news_tags FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Admin manage news_tags" ON public.news_tags;
CREATE POLICY "Admin manage news_tags"
ON public.news_tags FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE auth_uid = auth.uid()
    AND role IN ('desarrollador', 'editor')
  )
);

-- news_articles: published visible para todos, editables por admin/editor
ALTER TABLE public.news_articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read published articles" ON public.news_articles;
CREATE POLICY "Public read published articles"
ON public.news_articles FOR SELECT
TO anon, authenticated
USING (published = true AND archived = false);

DROP POLICY IF EXISTS "Admin read all articles" ON public.news_articles;
CREATE POLICY "Admin read all articles"
ON public.news_articles FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE auth_uid = auth.uid()
    AND role IN ('desarrollador', 'editor')
  )
);

DROP POLICY IF EXISTS "Admin manage articles" ON public.news_articles;
CREATE POLICY "Admin manage articles"
ON public.news_articles FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE auth_uid = auth.uid()
    AND role IN ('desarrollador', 'editor')
  )
);

-- news_events: public para eventos publicados, admin para todos
ALTER TABLE public.news_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read published events" ON public.news_events;
CREATE POLICY "Public read published events"
ON public.news_events FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.news_articles
    WHERE id = article_id AND published = true AND archived = false
  )
);

DROP POLICY IF EXISTS "Admin read all events" ON public.news_events;
CREATE POLICY "Admin read all events"
ON public.news_events FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE auth_uid = auth.uid()
    AND role IN ('desarrollador', 'editor')
  )
);

DROP POLICY IF EXISTS "Admin manage events" ON public.news_events;
CREATE POLICY "Admin manage events"
ON public.news_events FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE auth_uid = auth.uid()
    AND role IN ('desarrollador', 'editor')
  )
);

-- news_images: policies similares a articles
ALTER TABLE public.news_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read images" ON public.news_images;
CREATE POLICY "Public read images"
ON public.news_images FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.news_articles
    WHERE id = article_id AND published = true
  )
);

DROP POLICY IF EXISTS "Admin manage images" ON public.news_images;
CREATE POLICY "Admin manage images"
ON public.news_images FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE auth_uid = auth.uid()
    AND role IN ('desarrollador', 'editor')
  )
);

-- news_activity_log: solo admin puede leer/escribir
ALTER TABLE public.news_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin read logs" ON public.news_activity_log;
CREATE POLICY "Admin read logs"
ON public.news_activity_log FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE auth_uid = auth.uid()
    AND role IN ('desarrollador', 'editor')
  )
);

DROP POLICY IF EXISTS "Admin write logs" ON public.news_activity_log;
CREATE POLICY "Admin write logs"
ON public.news_activity_log FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE auth_uid = auth.uid()
    AND role IN ('desarrollador', 'editor')
  )
);

-- ============================================================================
-- 9. SEED DATA: Categorías por defecto
-- ============================================================================
INSERT INTO public.news_categories (name, slug, description, icon_emoji, color_hex, sort_order)
VALUES
  ('Formaciones', 'formaciones', 'Talleres, charlas y procesos de formación integral', '🎓', '#3B82F6', 1),
  ('Charlas y Encuentros', 'charlas-encuentros', 'Encuentros comunitarios y charlas temáticas', '💬', '#8B5CF6', 2),
  ('Fiestas Patronales', 'fiestas-patronales', 'Celebraciones de fiestas patronales de las capillas', '🎉', '#EC4899', 3),
  ('Cumpleaños', 'cumpleaños', 'Celebraciones de cumpleaños de coordinadores y miembros', '🎂', '#F59E0B', 4),
  ('Recordatorios', 'recordatorios', 'Recordatorios y avisos parroquiales urgentes', '⚠️', '#EF4444', 5),
  ('Convocatorias', 'convocatorias', 'Convocatorias a voluntariados y eventos especiales', '📣', '#10B981', 6),
  ('Eventos', 'eventos', 'Eventos generales de la pastoral', '📅', '#06B6D4', 7),
  ('Noticias', 'noticias', 'Noticias generales de la comunidad', '📰', '#C8973A', 8)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- 10. FUNCIÓN: Obtener artículos para homepage
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_homepage_articles()
RETURNS TABLE (
  id UUID,
  title VARCHAR(200),
  subtitle VARCHAR(300),
  body TEXT,
  slug VARCHAR(250),
  featured_image_url TEXT,
  published_at TIMESTAMPTZ,
  pinned BOOLEAN,
  pin_order INTEGER,
  is_event BOOLEAN,
  event_date DATE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.title,
    a.subtitle,
    a.body,
    a.slug,
    a.featured_image_url,
    a.published_at,
    a.pinned,
    a.pin_order,
    (e.id IS NOT NULL)::BOOLEAN,
    e.start_date
  FROM public.news_articles a
  LEFT JOIN public.news_events e ON a.id = e.article_id
  WHERE a.published = true
    AND a.archived = false
    AND (a.featured_on_homepage = true OR a.pinned = true)
  ORDER BY
    a.pinned DESC,
    a.pin_order ASC,
    COALESCE(e.start_date, a.published_at) DESC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 11. FUNCIÓN: Obtener próximos eventos
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_upcoming_events(days_ahead INTEGER DEFAULT 30)
RETURNS TABLE (
  id UUID,
  title VARCHAR(200),
  slug VARCHAR(250),
  start_date DATE,
  start_time TIME,
  location_name VARCHAR(150),
  location_lat NUMERIC(10, 8),
  location_lng NUMERIC(11, 8)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.title,
    a.slug,
    e.start_date,
    e.start_time,
    e.location_name,
    e.location_lat,
    e.location_lng
  FROM public.news_articles a
  INNER JOIN public.news_events e ON a.id = e.article_id
  WHERE a.published = true
    AND a.archived = false
    AND e.start_date >= CURRENT_DATE
    AND e.start_date <= CURRENT_DATE + INTERVAL '1 day' * days_ahead
  ORDER BY e.start_date ASC, e.start_time ASC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Comentarios de documentación
-- ============================================================================
COMMENT ON TABLE public.news_articles IS 'Artículos y noticias del sistema de gestión de contenidos';
COMMENT ON TABLE public.news_events IS 'Información adicional para artículos que representan eventos';
COMMENT ON TABLE public.news_categories IS 'Categorías para clasificar artículos';
COMMENT ON TABLE public.news_tags IS 'Tags reutilizables para flexibilidad en clasificación';
COMMENT ON TABLE public.news_images IS 'Galería de imágenes asociadas a artículos';
COMMENT ON TABLE public.news_activity_log IS 'Registro de auditoría de cambios en artículos';
