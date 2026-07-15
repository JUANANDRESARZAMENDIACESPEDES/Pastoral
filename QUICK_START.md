# 🚀 INICIO RÁPIDO: Sistema de Gestión de Noticias

## 5 MINUTOS PARA EMPEZAR

### Paso 1: Crear la Base de Datos (2 min)

1. Abre https://app.supabase.com y entra a tu proyecto
2. Haz clic en **SQL Editor** → **New Query**
3. Copia TODO el contenido de **`news-system-schema.sql`**
4. Pégalo en el editor
5. Presiona **Cmd+Enter** (Mac) o **Ctrl+Enter** (Windows)
6. ¡Listo! La base de datos está creada

**Verificar:** 
```sql
SELECT COUNT(*) FROM public.news_categories;
-- Debe devolver: 8
```

---

### Paso 2: Acceder al Panel Admin (1 min)

```
Abre en tu navegador:
http://localhost:3000/admin/noticias
```

Si ves una tabla vacía y un botón "✨ Crear Nueva Noticia", ¡funciona!

---

### Paso 3: Crear tu Primer Artículo (2 min)

1. Haz clic en **"✨ Crear Nueva Noticia"**
2. Completa:
   - **Título:** "Mi primer artículo" (mínimo 5 caracteres)
   - **Cuerpo:** "Este es el contenido de mi primer artículo sobre la pastoral." (mínimo 20 caracteres)
3. Deja los demás campos opcionales
4. Haz clic en **"Crear"**

¡Aparecerá en la tabla!

---

## 📋 OPERACIONES BÁSICAS

### Crear Artículo
1. Panel → Crear Nueva Noticia → Llenar formulario → Crear

### Editar Artículo
1. Tabla → Haz clic en ✏️ → Modifica → Actualizar

### Publicar Artículo
1. Tabla → Haz clic en ✓ (si está en Borrador)

### Fijar en Top
1. Tabla → Haz clic en 📌 (aparecerá primero)

### Eliminar
1. Tabla → Haz clic en 🗑️ → Confirmar

### Agregar Evento
1. Tabla → Editar artículo → Opción "Crear Evento"
2. Llenar fechas, ubicación, contacto
3. Crear

---

## 🔗 APIS DISPONIBLES

```bash
# Listar artículos publicados
curl http://localhost:3000/api/news/articles?published=true

# Búsqueda
curl "http://localhost:3000/api/news/search?q=retiro"

# Próximos eventos (30 días)
curl http://localhost:3000/api/news/feed/upcoming-events

# Feed para homepage
curl http://localhost:3000/api/news/feed/homepage
```

---

## 🎨 CAMPOS DISPONIBLES

### Artículo
- **Título** ✓ (requerido): 5-200 caracteres
- **Subtítulo**: Resumen breve (0-300)
- **Cuerpo** ✓ (requerido): Contenido principal (20-10000)
- **Categoría**: Formaciones, Eventos, Recordatorios, etc.
- **Imagen destacada**: URL de imagen
- **Publicado**: Si/No (defecto: No)

### Evento (opcional)
- **Fecha inicio** ✓ (requerido si es evento)
- **Hora inicio/fin**: Formato HH:MM
- **Lugar**: Nombre del sitio
- **Dirección**
- **Google Maps**: URL del mapa
- **Inscripción**: Si/No, máx participantes
- **Contacto**: Persona, email, teléfono

---

## 🏆 CATEGORÍAS POR DEFECTO

1. **🎓 Formaciones** - Talleres y capacitaciones
2. **💬 Charlas y Encuentros** - Eventos comunitarios
3. **🎉 Fiestas Patronales** - Celebraciones
4. **🎂 Cumpleaños** - Celebraciones personales
5. **⚠️ Recordatorios** - Avisos urgentes
6. **📣 Convocatorias** - Voluntariados
7. **📅 Eventos** - Eventos generales
8. **📰 Noticias** - Noticias generales

---

## ❌ ERRORES COMUNES

### "Título debe tener al menos 5 caracteres"
→ Escribe un título más largo

### "El cuerpo debe tener al menos 20 caracteres"
→ Escribe más contenido en el cuerpo

### "URL de imagen inválida"
→ Verifica que la URL empiece con `https://`

### "Artículo no encontrado"
→ Intenta recargar la página

---

## 💡 CONSEJOS

✅ **Usa categorías claras** para que los usuarios encuentren lo que buscan

✅ **Escribe subtítulos cortos** para captar atención

✅ **Fija avisos importantes** con 📌 para que aparezcan primero

✅ **Crea eventos con lugar** para que aparezcan en calendario

✅ **Publica después de verificar** para evitar errores

✅ **Usa Google Maps** para que usuarios vean la ubicación

---

## 🔐 SEGURIDAD

- Solo usuarios con rol `editor` pueden crear/editar
- Las contraseñas se guardan en Supabase Auth
- Los datos están encriptados en tránsito (HTTPS)
- Hay auditoría de cambios automática

---

## 📱 COMPATIBLE CON

- ✅ Desktop
- ✅ Tablet
- ✅ Mobile (responsive)

---

## 🆘 NECESITAS AYUDA?

1. **Revisa:**
   - `NEWS_IMPLEMENTATION_GUIDE.md` - Documentación completa
   - `NEWS_IMPLEMENTATION_SUMMARY.md` - Resumen técnico
   - `NEWS_MANAGEMENT_PROPOSAL.md` - Propuesta inicial

2. **Verifica:**
   - Que el script SQL fue ejecutado correctamente
   - Que las variables de entorno de Supabase están configuradas
   - Que `localhost:3000` está en marcha

3. **Prueba APIs:**
   - Abre Postman
   - Haz GET a http://localhost:3000/api/news/categories
   - Debe devolver la lista de categorías

---

## 📚 PRÓXIMO PASO

Integra los datos en tu frontend:

```typescript
// En src/app/page.tsx
const response = await fetch('/api/news/feed/homepage');
const { data: articles } = await response.json();

// Mostrar artículos en la página principal
articles.forEach(article => {
  console.log(article.title, article.featured_image_url);
});
```

---

**¿Listo? ¡Crea tu primer artículo ahora!** 🎉

Fecha: 2026-07-14
Sistema: Gestión de Noticias PJL
