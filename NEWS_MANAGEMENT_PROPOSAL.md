# Propuesta Técnica: Sistema de Gestión de Noticias y Eventos
## Pastoral Juvenil de Luque

---

## ÍNDICE
1. [Visión General](#visión-general)
2. [Estructura de Base de Datos](#estructura-de-base-de-datos)
3. [Arquitectura de API](#arquitectura-de-api)
4. [Lógica de Negocio](#lógica-de-negocio)
5. [Interfaz de Administrador](#interfaz-de-administrador)
6. [Plan de Implementación](#plan-de-implementación)

---

## VISIÓN GENERAL

### Objetivos
- **Normalizar** la gestión de noticias/eventos con una estructura relacional clara
- **Dinamizar** el panel de admin con interfaz intuitiva y validación en tiempo real
- **Optimizar** la presentación de contenido en el frontend (ordenamiento, filtros, archivado automático)
- **Mantener** compatibilidad total con el diseño frontend existente

### Principios de Diseño
- **Modular**: Tablas independientes pero relacionadas
- **Escalable**: Preparado para crecer sin rediseños futuros
- **Seguro**: Validación en backend, RLS en Supabase
- **Performante**: Índices estratégicos, queries optimizadas
- **Auditable**: Registro de cambios y timestamps

---

## ESTRUCTURA DE BASE DE DATOS

### 1. Tabla: `news_articles`
Almacena artículos/noticias principales.

```sql
CREATE TABLE news_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  subtitle VARCHAR(300),
  body TEXT NOT NULL,
  slug VARCHAR(250) UNIQUE NOT NULL,
  
  -- Categorización
  category_id UUID REFERENCES news_categories(id),
  tags JSONB DEFAULT '[]'::jsonb,
  
  -- Medios
  featured_image_url TEXT,
  gallery_urls JSONB DEFAULT '[]'::jsonb,
  
  -- Control Editorial
  published BOOLEAN DEFAULT false,
  pinned BOOLEAN DEFAULT false,
  pin_order INTEGER DEFAULT 999,
  featured_on_homepage BOOLEAN DEFAULT false,
  
  -- Metadata
  author_id UUID REFERENCES auth.users(id),
  views_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  published_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  archived BOOLEAN DEFAULT false,
  
  -- Búsqueda full-text (PostgreSQL)
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('spanish', title) || to_tsvector('spanish', COALESCE(body, ''))
  ) STORED
);

-- Índices
CREATE INDEX idx_news_category ON news_articles(category_id);
CREATE INDEX idx_news_published ON news_articles(published, published_at DESC);
CREATE INDEX idx_news_pinned ON news_articles(pinned, pin_order);
CREATE INDEX idx_news_slug ON news_articles(slug);
CREATE INDEX idx_news_search ON news_articles USING GIN(search_vector);
```

### 2. Tabla: `news_events`
Extensión de noticias con información de eventos.

```sql
CREATE TABLE news_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL UNIQUE REFERENCES news_articles(id) ON DELETE CASCADE,
  
  -- Logística
  start_date DATE NOT NULL,
  start_time TIME,
  end_date DATE,
  end_time TIME,
  
  location_name VARCHAR(150),
  location_address TEXT,
  google_maps_url TEXT,
  location_lat NUMERIC(10, 8),
  location_lng NUMERIC(11, 8),
  
  -- Inscripción
  allow_inscription BOOLEAN DEFAULT false,
  max_participants INTEGER,
  current_participants INTEGER DEFAULT 0,
  inscription_deadline TIMESTAMPTZ,
  
  -- Contacto
  contact_person_name VARCHAR(100),
  contact_email VARCHAR(100),
  contact_phone VARCHAR(20),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_events_article ON news_events(article_id);
CREATE INDEX idx_events_date ON news_events(start_date);
```

### 3. Tabla: `news_categories`
Categorías dinámicas para clasificar noticias.

```sql
CREATE TABLE news_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  icon_emoji VARCHAR(5),
  color_hex VARCHAR(7),
  
  -- Orden
  sort_order INTEGER DEFAULT 0,
  
  -- Archivado
  active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_categories_slug ON news_categories(slug);
CREATE INDEX idx_categories_active ON news_categories(active);
```

### 4. Tabla: `news_tags`
Tags reutilizables para flexibilidad.

```sql
CREATE TABLE news_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL UNIQUE,
  slug VARCHAR(50) UNIQUE NOT NULL,
  color_hex VARCHAR(7),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tags_slug ON news_tags(slug);
```

### 5. Tabla: `news_images`
Galería de imágenes con metadata.

```sql
CREATE TABLE news_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES news_articles(id) ON DELETE CASCADE,
  
  image_url TEXT NOT NULL,
  alt_text VARCHAR(200),
  caption TEXT,
  
  -- Orden en galería
  sort_order INTEGER DEFAULT 0,
  
  -- Metadata
  width INTEGER,
  height INTEGER,
  file_size INTEGER,
  
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_images_article ON news_images(article_id);
```

### 6. Tabla: `news_activity_log`
Auditoría de cambios.

```sql
CREATE TABLE news_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID REFERENCES news_articles(id) ON DELETE SET NULL,
  
  action VARCHAR(50) NOT NULL, -- 'CREATE', 'UPDATE', 'PUBLISH', 'ARCHIVE', 'DELETE'
  actor_id UUID REFERENCES auth.users(id),
  
  changes JSONB, -- {field: old_value, field: new_value}
  ip_address VARCHAR(45),
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_log_article ON news_activity_log(article_id);
CREATE INDEX idx_log_actor ON news_activity_log(actor_id);
```

---

## ARQUITECTURA DE API

### Endpoints Core

#### 1. **Gestión de Artículos**
```
POST   /api/news/articles
GET    /api/news/articles?category=&tag=&published=&pinned=&sort=
GET    /api/news/articles/:id
PATCH  /api/news/articles/:id
DELETE /api/news/articles/:id
POST   /api/news/articles/:id/publish
POST   /api/news/articles/:id/archive
POST   /api/news/articles/:id/pin
POST   /api/news/articles/:id/unpin
```

#### 2. **Gestión de Eventos**
```
POST   /api/news/articles/:id/event
GET    /api/news/events?start_date=&end_date=&sort=
PATCH  /api/news/articles/:id/event
DELETE /api/news/articles/:id/event
POST   /api/news/events/:id/inscription
GET    /api/news/events/:id/inscriptions
```

#### 3. **Categorías y Tags**
```
GET    /api/news/categories
POST   /api/news/categories (admin)
PATCH  /api/news/categories/:id (admin)

GET    /api/news/tags
POST   /api/news/tags (admin)
DELETE /api/news/tags/:id (admin)
```

#### 4. **Búsqueda y Filtrado**
```
GET    /api/news/search?q=&category=&tags=&from=&to=
GET    /api/news/feed/homepage (últimas + pinned)
GET    /api/news/feed/upcoming-events (próximos eventos)
GET    /api/news/feed/calendar (eventos con fecha)
```

---

## LÓGICA DE NEGOCIO

### 1. **Ordenamiento Automático**

**Página Principal:**
```javascript
GET /api/news/feed/homepage
// Retorna:
// 1. Artículos pinned (ordenados por pin_order)
// 2. Artículos recientes (últimos 7 días, ordenados por published_at DESC)
// 3. Eventos próximos (start_date >= hoy)
```

**Página de Noticias:**
```javascript
// Mostrar primero eventos próximos (start_date ASC)
// Luego noticias recientes (published_at DESC)
// Filtrado por: categoría, tags, búsqueda full-text
```

### 2. **Archivado Automático**

Ejecutar diariamente via Supabase Edge Function:
```javascript
// Archiva automáticamente:
// - Noticias con expires_at < NOW()
// - Eventos finalizados (end_date < TODAY)
// - Cumpleaños/Fiestas Patronales (date < TODAY)
```

### 3. **Validación de Datos**

**Backend Validation:**
- Título: 1-200 caracteres, sin HTML
- Subtítulo: 0-300 caracteres
- Body: 20-10000 caracteres (HTML permitido)
- Slug: único, sin caracteres especiales, auto-generado si falta
- Categoría: debe existir
- Tags: máximo 10, deben existir en BD
- Imágenes: URL válida, máximo 3 MB
- Google Maps URL: validar formato
- Horas: formato 24h válido, start_time < end_time

### 4. **Seguridad y Permisos**

```javascript
// Row Level Security (RLS) en Supabase
- Anon/Users: LECTURA de artículos published=true
- Editors: LECTURA completa + CREATE/UPDATE/DELETE propios
- Admin: LECTURA/ESCRITURA completa + auditoría
- Sistema: Acceso especial para triggers y edge functions
```

---

## INTERFAZ DE ADMINISTRADOR

### Panel de Noticias Mejorado

#### Layout Principal:
```
┌─────────────────────────────────────┐
│ 📰 GESTIÓN DE NOTICIAS Y EVENTOS    │
├─────────────────────────────────────┤
│ [+ Nueva Noticia] [Filtros] [BÚsqueda] │
├─────────────────────────────────────┤
│                                     │
│ TABLA DE ARTÍCULOS:                 │
│ ┌──────────────────────────────┐   │
│ │ Título  │ Categoría │ Estado│   │
│ │━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│   │
│ │ [Pinned] Art. 1 │ Evento │ ✓  │   │
│ │         Art. 2 │ Noticia│ ✗  │   │
│ │         Art. 3 │ Anuncio│ ✓  │   │
│ └──────────────────────────────┘   │
└─────────────────────────────────────┘
```

#### Formulario de Creación/Edición:

**Sección 1: Datos Básicos**
- Campo: Título (validación real-time: 1-200 chars)
- Campo: Copete/Subtítulo (0-300 chars)
- Selector: Categoría (dropdown con +crear)
- Campo: Tags (multi-select, crear dinámico)
- Editor: Cuerpo (WYSIWYG, soporta HTML básico)
- Validación: Preview en tiempo real

**Sección 2: Medios**
- Selector: Imagen Destacada (drag-drop + URL)
- Galería: Múltiples imágenes (drag-to-reorder)
- Validación: Tamaño y formato (JPEG, PNG, WebP)

**Sección 3: Control Editorial**
- Toggle: Publicado/Borrador
- Checkbox: Pinned (si marcar, mostrar input para pin_order)
- Checkbox: Destacado en homepage
- Date: Fecha publicación (default: hoy)
- Date: Fecha expiración (opcional)

**Sección 4: Logística de Evento** (condicional, si "Evento" activado)
- Date + Time: Inicio evento
- Date + Time: Fin evento
- Campo: Lugar (nombre del sitio)
- Campo: Dirección
- Campo: Enlace Google Maps (validación de URL)
- Validación: start_date < end_date, start_time < end_time
- Toggle: Permitir inscripción
- Number: Máx. participantes (si inscripción activada)
- Date: Fecha límite inscripción
- Campos: Contacto (nombre, email, teléfono)

**Sección 5: Metadatos**
- Campo: Slug (auto-generado, editable)
- Info: ID único, fecha creación, última actualización
- Botón: Ver artículo publicado

#### Acciones Rápidas (por fila):
- 📌 Pin/Unpin
- ✏️ Editar
- 👁️ Previsualizar
- 🗂️ Archivar (marcar para expiración)
- 🗑️ Eliminar (con confirmación)

#### Filtros:
- Categoría: Dropdown multi-select
- Estado: [Todos, Publicado, Borrador, Archivado]
- Tipo: [Todos, Noticia, Evento, Cumpleaños, Fiesta]
- Período: Date range picker (última semana, mes, año, custom)
- Búsqueda: Full-text search

#### Estadísticas del Dashboard:
```
┌────────────────────────────┐
│ 📊 ESTADÍSTICAS            │
├────────────────────────────┤
│ Total Artículos: 45        │
│ Publicados: 42             │
│ Borradores: 3              │
│ Eventos próximos: 7        │
│ Vistas esta semana: 1,234  │
└────────────────────────────┘
```

---

## PLAN DE IMPLEMENTACIÓN

### Fase 1: Base de Datos (Semana 1)
- [ ] Crear script SQL con todas las tablas
- [ ] Definir RLS policies
- [ ] Crear triggers para timestamps
- [ ] Crear índices para performance
- [ ] Seed data: Categorías por defecto

### Fase 2: APIs Backend (Semana 1-2)
- [ ] Crear rutas `/api/news/articles/*`
- [ ] Crear rutas `/api/news/events/*`
- [ ] Crear rutas `/api/news/categories/*`
- [ ] Implementar validación Zod
- [ ] Implementar búsqueda full-text

### Fase 3: Interfaz Admin (Semana 2-3)
- [ ] Componente: Tabla de artículos
- [ ] Componente: Formulario CRUD
- [ ] Componente: Editor WYSIWYG
- [ ] Componente: Galería de imágenes
- [ ] Componente: Selector de categorías/tags

### Fase 4: Funcionalidades Avanzadas (Semana 3)
- [ ] Archivado automático (Edge Function)
- [ ] Búsqueda full-text en admin
- [ ] Exportar/Importar noticias
- [ ] Caché y CDN para imágenes

### Fase 5: Testing y Optimización (Semana 4)
- [ ] Tests unitarios para APIs
- [ ] Tests E2E para admin UI
- [ ] Optimización de queries
- [ ] Audit logging completo

---

## VARIABLES DE ENTORNO NECESARIAS

```
# Ya existentes
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

# Nuevas (opcionales)
NEXT_PUBLIC_IMAGE_RESIZE_API=https://...
EDITOR_WYSIWYG_API_KEY=...
```

---

## NOTAS IMPORTANTES

1. **Compatibilidad Frontend**: Las nuevas APIs no cambian el esquema existente de `pjl_store`. Conviven en paralelo.
2. **Migración de Datos**: Los artículos en `pjl_store.news` pueden migrarse a `news_articles` manualmente o automáticamente.
3. **Imagen Hosting**: Recomendar Supabase Storage o Cloudinary para hosting de imágenes.
4. **Performance**: Full-text search indexado en PostgreSQL es muy eficiente (< 100ms).
5. **Escalabilidad**: Estructura preparada para + de 10,000 artículos sin problemas.

---

**Documento Versión**: 1.0  
**Última Actualización**: 2026-07-14  
**Estado**: Listo para Implementación
