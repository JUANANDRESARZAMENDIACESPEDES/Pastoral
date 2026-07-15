# Guía de Implementación: Sistema de Gestión de Noticias
## Pastoral Juvenil de Luque

---

## PASO 1: Preparación de la Base de Datos

### 1.1 Ejecutar el script SQL

1. Abre tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. Ve a **SQL Editor** → **New Query**
3. Copia todo el contenido de `news-system-schema.sql`
4. Pégalo en el editor y ejecuta (**Cmd+Enter** o **Ctrl+Enter**)

El script creará:
- 6 tablas nuevas (articles, events, categories, tags, images, activity_log)
- Índices para performance
- Triggers para timestamps
- Políticas de Row Level Security (RLS)
- 8 categorías por defecto
- 2 funciones de utilidad

**Verificar instalación:**
```sql
-- En Supabase SQL Editor, ejecuta:
SELECT * FROM public.news_categories LIMIT 5;
```

Si ves 8 categorías, ¡todo está listo!

---

## PASO 2: Instalar Zod (Validación)

Si aún no lo tienes, instala Zod para validación:

```bash
npm install zod
```

---

## PASO 3: Crear un Artículo de Prueba (Opcional)

Crea un artículo directamente desde el admin actual o vía API:

```bash
curl -X POST http://localhost:3000/api/news/articles \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Primer evento de prueba",
    "body": "Este es el cuerpo del artículo de prueba con contenido válido.",
    "category_id": null,
    "published": false
  }'
```

---

## PASO 4: Endpoints Disponibles

### Artículos

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/news/articles` | Listar artículos con filtros |
| `POST` | `/api/news/articles` | Crear nuevo artículo |
| `GET` | `/api/news/articles/:id` | Obtener artículo específico |
| `PATCH` | `/api/news/articles/:id` | Actualizar artículo |
| `DELETE` | `/api/news/articles/:id` | Eliminar artículo |
| `POST` | `/api/news/articles/:id/actions` | Acciones (pin, publish, archive) |

### Eventos

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/news/events` | Listar próximos eventos |
| `POST` | `/api/news/events` | Crear nuevo evento |
| `GET` | `/api/news/events/:id` | Obtener evento específico |
| `PATCH` | `/api/news/events/:id` | Actualizar evento |
| `DELETE` | `/api/news/events/:id` | Eliminar evento |

### Categorías

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/news/categories` | Listar todas las categorías |
| `POST` | `/api/news/categories` | Crear nueva categoría |

### Búsqueda y Feed

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/news/search?q=` | Búsqueda full-text |
| `GET` | `/api/news/feed/homepage` | Feed para página principal |
| `GET` | `/api/news/feed/upcoming-events` | Próximos eventos ordenados |

---

## PASO 5: Ejemplos de Uso

### Crear un Artículo

```bash
curl -X POST http://localhost:3000/api/news/articles \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Retiro Cuaresmal Juvenil",
    "subtitle": "Un encuentro profundo con el Señor",
    "body": "La Pastoral Juvenil Luqueña invita a todos los jóvenes a participar del retiro cuaresmal...",
    "category_id": "category-uuid-here",
    "tags": ["tag-uuid-1", "tag-uuid-2"],
    "featured_image_url": "https://example.com/image.jpg",
    "published": false
  }'
```

### Crear un Evento

```bash
curl -X POST http://localhost:3000/api/news/events \
  -H "Content-Type: application/json" \
  -d '{
    "article_id": "article-uuid-here",
    "start_date": "2026-04-05",
    "start_time": "09:00",
    "end_date": "2026-04-05",
    "end_time": "18:00",
    "location_name": "Santuario Virgen del Rosario",
    "location_address": "Luque, Paraguay",
    "google_maps_url": "https://maps.google.com/maps?q=...",
    "location_lat": -25.3025,
    "location_lng": -57.6157,
    "allow_inscription": true,
    "max_participants": 200,
    "contact_person_name": "Juan García",
    "contact_email": "juan@pjl.org",
    "contact_phone": "+595 981 123456"
  }'
```

### Pinchar un Artículo

```bash
curl -X POST http://localhost:3000/api/news/articles/:id/actions \
  -H "Content-Type: application/json" \
  -d '{
    "action": "pin",
    "pin_order": 1
  }'
```

### Buscar Artículos

```bash
curl "http://localhost:3000/api/news/search?q=retiro&category_id=uuid&from_date=2026-03-01&to_date=2026-04-30"
```

---

## PASO 6: Integración con Frontend

### Obtener Feed para Homepage

```typescript
// En src/app/page.tsx
const response = await fetch('/api/news/feed/homepage?limit=10');
const { data: homepageArticles } = await response.json();
```

### Obtener Próximos Eventos

```typescript
// Para mostrar en calendario/agenda
const response = await fetch('/api/news/feed/upcoming-events?days=30&limit=20');
const { data: upcomingEvents } = await response.json();
```

### Listar Todas las Categorías

```typescript
// Para usar en selectores del admin
const response = await fetch('/api/news/categories');
const { data: categories } = await response.json();
```

---

## PASO 7: Seguridad y Autenticación

### Políticas RLS

Las siguientes políticas están configuradas:

**Lectura Pública:**
- Artículos publicados (`published = true`)
- No archivados (`archived = false`)
- Categorías activas
- Tags públicos

**Acceso de Admin:**
- Solo usuarios con `role = 'editor'` o `'desarrollador'`
- Pueden ver/editar/eliminar todo
- Auditoría en `news_activity_log`

### Recomendación de Seguridad

Antes de usar en producción:
1. Crear un middleware de autenticación en `/api/news/*`
2. Validar que el usuario tiene rol `editor` o `desarrollador`
3. Registrar todas las acciones en `news_activity_log`
4. Usar HTTPS en todo momento

Ejemplo de middleware:

```typescript
// src/lib/newsAuth.ts
import { createClient } from '@supabase/supabase-js';

export async function checkNewsAdminAccess(userId: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data, error } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('auth_uid', userId)
    .single();

  return !error && (data?.role === 'editor' || data?.role === 'desarrollador');
}
```

---

## PASO 8: Próximas Fases

### Fase 2: Panel de Admin Mejorado
- [ ] Página `/admin/noticias` con tabla de artículos
- [ ] Formulario completo CRUD
- [ ] Editor WYSIWYG para body
- [ ] Galería de imágenes con drag-drop
- [ ] Filtros avanzados

### Fase 3: Features Avanzadas
- [ ] Edge Function para archivado automático
- [ ] Cache de feed en Redis (opcional)
- [ ] Integración con CDN para imágenes
- [ ] Búsqueda con elasticsearch (opcional)

### Fase 4: Optimizaciones
- [ ] Caché de categorías en cliente
- [ ] Lazy loading de imágenes
- [ ] Paginación eficiente
- [ ] Soft delete para auditoría completa

---

## PASO 9: Troubleshooting

### Error: "Table 'news_articles' not found"
**Solución**: Asegúrate de haber ejecutado el script SQL en Supabase.

### Error: "Permission denied (RLS policy)"
**Solución**: Verifica que el usuario tiene rol `editor`. En RLS policies, mira `user_profiles.role`.

### Error: "Invalid UUID"
**Solución**: Los IDs de categorías y tags deben ser UUIDs válidos (ej: `550e8400-e29b-41d4-a716-446655440000`).

### Error: "Slug already exists"
**Solución**: El slug debe ser único. Usa un slug diferente o deja que se auto-genere.

---

## PASO 10: Estructura de Carpetas

```
src/
├── app/
│   ├── api/
│   │   └── news/
│   │       ├── articles/
│   │       │   ├── route.ts          (POST/GET artículos)
│   │       │   └── [id]/
│   │       │       ├── route.ts      (GET/PATCH/DELETE)
│   │       │       └── actions/
│   │       │           └── route.ts  (pin, publish, etc)
│   │       ├── events/
│   │       │   ├── route.ts          (POST/GET eventos)
│   │       │   └── [id]/
│   │       │       └── route.ts      (GET/PATCH/DELETE eventos)
│   │       ├── categories/
│   │       │   └── route.ts          (GET/POST categorías)
│   │       ├── search/
│   │       │   └── route.ts          (Búsqueda full-text)
│   │       └── feed/
│   │           ├── homepage/
│   │           │   └── route.ts      (Feed para homepage)
│   │           └── upcoming-events/
│   │               └── route.ts      (Próximos eventos)
│   └── admin/
│       └── noticias/
│           └── page.tsx              (Panel de admin de noticias) - próxima fase
├── lib/
│   ├── newsTypes.ts                  (Tipos TypeScript)
│   ├── newsValidation.ts             (Esquemas Zod)
│   └── newsAuth.ts                   (Autenticación) - por crear
├── components/
│   └── admin/
│       ├── NewsArticleTable.tsx       (Tabla de artículos) - por crear
│       ├── NewsArticleForm.tsx        (Formulario CRUD) - por crear
│       ├── NewsEventForm.tsx          (Formulario de eventos) - por crear
│       └── NewsWYSIWYGEditor.tsx      (Editor de texto) - por crear
└── news-system-schema.sql            (Script de BD)
```

---

## Referencias Útiles

- [Documentación Supabase](https://supabase.com/docs)
- [PostgreSQL Full-Text Search](https://www.postgresql.org/docs/current/textsearch.html)
- [Zod Validation](https://zod.dev)
- [Next.js API Routes](https://nextjs.org/docs/pages/building-your-application/routing/api-routes)

---

## Soporte

Si encuentras problemas:
1. Verifica los logs de Supabase en el dashboard
2. Revisa la consola del navegador (F12)
3. Consulta el archivo `eslint_errors.txt` del proyecto
4. Prueba los endpoints con Postman o curl antes de integrar

**Última actualización**: 2026-07-14
